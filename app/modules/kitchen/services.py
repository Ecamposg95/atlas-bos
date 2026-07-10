"""Atlas BOS modules/kitchen/services — KDS lifecycle logic.

Fire a ticket from the POS/Mesas, route each item to a station by the
product's department, and bump items/tickets through the prep lifecycle.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import ProductVariant
from app.modules.kitchen.models import (
    ItemStatus,
    KdsStatus,
    KitchenRoute,
    KitchenStation,
    KitchenTicket,
    KitchenTicketItem,
)
from app.modules.kitchen.schemas import FireItem

# Item lifecycle order for the "bump" action.
_ITEM_FLOW = [ItemStatus.PENDING, ItemStatus.PREPARING, ItemStatus.READY, ItemStatus.SERVED]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def resolve_station(
    db: Session,
    *,
    organization_id: int,
    branch_id: int,
    variant_id: Optional[str],
    override: Optional[int] = None,
) -> Optional[int]:
    """Pick the kitchen station for an item.

    Priority: explicit override → route by product department → branch default
    station (lowest sort_order). Returns None if the branch has no stations.
    """
    if override is not None:
        return override

    station_id: Optional[int] = None
    if variant_id:
        variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
        dept_id = variant.product.department_id if variant and variant.product else None
        if dept_id:
            route = (
                db.query(KitchenRoute)
                .filter(
                    KitchenRoute.organization_id == organization_id,
                    KitchenRoute.branch_id == branch_id,
                    KitchenRoute.department_id == dept_id,
                )
                .first()
            )
            if route:
                station_id = route.station_id

    if station_id is None:
        default = (
            db.query(KitchenStation)
            .filter(
                KitchenStation.organization_id == organization_id,
                KitchenStation.branch_id == branch_id,
                KitchenStation.is_active == True,  # noqa: E712
            )
            .order_by(KitchenStation.sort_order, KitchenStation.id)
            .first()
        )
        station_id = default.id if default else None

    return station_id


def fire_ticket(
    db: Session,
    *,
    organization_id: int,
    branch_id: int,
    user_id: int,
    items: List[FireItem],
    table_id: Optional[int] = None,
    parked_ticket_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> KitchenTicket:
    """Create a kitchen ticket with its routed items."""
    if not items:
        raise HTTPException(status_code=422, detail="El ticket de cocina no tiene items")

    ticket = KitchenTicket(
        organization_id=organization_id,
        branch_id=branch_id,
        table_id=table_id,
        parked_ticket_id=parked_ticket_id,
        notes=notes,
        created_by=user_id,
        status=KdsStatus.NEW,
    )
    db.add(ticket)
    db.flush()

    for it in items:
        station_id = resolve_station(
            db,
            organization_id=organization_id,
            branch_id=branch_id,
            variant_id=it.variant_id,
            override=it.station_id,
        )
        db.add(KitchenTicketItem(
            organization_id=organization_id,
            ticket_id=ticket.id,
            variant_id=it.variant_id,
            description=it.description,
            qty=it.qty,
            modifiers=it.modifiers,
            station_id=station_id,
            status=ItemStatus.PENDING,
        ))

    db.commit()
    db.refresh(ticket)
    return ticket


def _recompute_ticket_status(ticket: KitchenTicket) -> None:
    """Derive the ticket status from its items' statuses."""
    live = [i for i in ticket.items if i.status != ItemStatus.VOIDED]
    if not live:
        # Todos los items anulados: la comanda ya no existe operativamente →
        # CANCELED (antes se quedaba clavada en el tablero para siempre).
        if ticket.items and ticket.status != KdsStatus.CANCELED:
            ticket.status = KdsStatus.CANCELED
        return
    if all(i.status == ItemStatus.SERVED for i in live):
        ticket.status = KdsStatus.SERVED
        if ticket.served_at is None:
            ticket.served_at = _now()
    elif all(i.status in (ItemStatus.READY, ItemStatus.SERVED) for i in live):
        ticket.status = KdsStatus.READY
        if ticket.ready_at is None:
            ticket.ready_at = _now()
    elif any(i.status in (ItemStatus.PREPARING, ItemStatus.READY, ItemStatus.SERVED) for i in live):
        ticket.status = KdsStatus.IN_PROGRESS
    else:
        ticket.status = KdsStatus.NEW


def bump_item(db: Session, item: KitchenTicketItem) -> KitchenTicket:
    """Advance one item to the next lifecycle status."""
    if item.status == ItemStatus.VOIDED:
        raise HTTPException(status_code=409, detail="El item está anulado")
    idx = _ITEM_FLOW.index(item.status)
    if idx < len(_ITEM_FLOW) - 1:
        item.status = _ITEM_FLOW[idx + 1]
        item.bumped_at = _now()
    _recompute_ticket_status(item.ticket)
    db.commit()
    db.refresh(item.ticket)
    return item.ticket


def void_item(db: Session, item: KitchenTicketItem) -> KitchenTicket:
    item.status = ItemStatus.VOIDED
    item.bumped_at = _now()
    _recompute_ticket_status(item.ticket)
    db.commit()
    db.refresh(item.ticket)
    return item.ticket


def bump_ticket(
    db: Session, ticket: KitchenTicket, station_id: Optional[int] = None
) -> KitchenTicket:
    """Advance the ticket one step. With `station_id`, only that station's items
    move — una estación NO debe avanzar el trabajo de otra (antes bumpear "la
    comanda" adelantaba los items de todas las estaciones). Sin `station_id`
    avanza todos (acción "avanzar comanda completa")."""
    for item in ticket.items:
        if item.status == ItemStatus.VOIDED:
            continue
        if station_id is not None and item.station_id != station_id:
            continue
        idx = _ITEM_FLOW.index(item.status)
        if idx < len(_ITEM_FLOW) - 1:
            item.status = _ITEM_FLOW[idx + 1]
            item.bumped_at = _now()
    _recompute_ticket_status(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def recall_ticket(db: Session, ticket: KitchenTicket) -> KitchenTicket:
    """Pull a READY/SERVED ticket back to the line (items → PREPARING)."""
    for item in ticket.items:
        if item.status in (ItemStatus.READY, ItemStatus.SERVED):
            item.status = ItemStatus.PREPARING
    ticket.ready_at = None
    ticket.served_at = None
    _recompute_ticket_status(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def cancel_ticket(db: Session, ticket: KitchenTicket) -> KitchenTicket:
    for item in ticket.items:
        item.status = ItemStatus.VOIDED
    ticket.status = KdsStatus.CANCELED
    db.commit()
    db.refresh(ticket)
    return ticket


def ticket_age_seconds(ticket: KitchenTicket) -> Optional[int]:
    if ticket.fired_at is None:
        return None
    fired = ticket.fired_at
    if fired.tzinfo is None:
        fired = fired.replace(tzinfo=timezone.utc)
    return int((_now() - fired).total_seconds())


# Statuses considered "live" on the KDS board.
ACTIVE_TICKET_STATUSES = [KdsStatus.NEW, KdsStatus.IN_PROGRESS, KdsStatus.READY]


def kds_feed(
    db: Session,
    *,
    organization_id: int,
    branch_id: Optional[int] = None,
    station_id: Optional[int] = None,
    status: Optional[KdsStatus] = None,
) -> List[KitchenTicket]:
    """Active tickets for the KDS board, oldest first."""
    q = db.query(KitchenTicket).filter(KitchenTicket.organization_id == organization_id)
    if branch_id is not None:
        q = q.filter(KitchenTicket.branch_id == branch_id)
    if status is not None:
        q = q.filter(KitchenTicket.status == status)
    else:
        q = q.filter(KitchenTicket.status.in_(ACTIVE_TICKET_STATUSES))
    tickets = q.order_by(KitchenTicket.fired_at).all()

    if station_id is not None:
        tickets = [
            t for t in tickets
            if any(i.station_id == station_id and i.status != ItemStatus.VOIDED for i in t.items)
        ]
    return tickets
