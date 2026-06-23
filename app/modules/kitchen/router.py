"""Atlas BOS modules/kitchen/router — KDS REST API."""
from datetime import timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant_query import _resolve_org_id, get_tenant_scoped, scoped_query
from app.models import User
from app.modules.kitchen import services
from app.modules.kitchen.models import (
    ItemStatus,
    KdsStatus,
    KitchenRoute,
    KitchenStation,
    KitchenTicket,
    KitchenTicketItem,
)
from app.modules.kitchen.schemas import (
    FireTicketRequest,
    KitchenStats,
    RouteCreate,
    RouteRead,
    StationCreate,
    StationRead,
    StationUpdate,
    TicketRead,
)

router = APIRouter()


def _org_id(user: User) -> int:
    org = _resolve_org_id(user)
    if org is None:
        raise HTTPException(status_code=400, detail="No active organization in context")
    return org


def _to_ticket_read(ticket: KitchenTicket) -> TicketRead:
    obj = TicketRead.model_validate(ticket)
    return obj.model_copy(update={"age_seconds": services.ticket_age_seconds(ticket)})


# ── Stations ──────────────────────────────────────────────────────────────────

@router.get("/stations", response_model=List[StationRead])
def list_stations(
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, KitchenStation, current_user).filter(KitchenStation.is_active == True)  # noqa: E712
    if branch_id is not None:
        q = q.filter(KitchenStation.branch_id == branch_id)
    return q.order_by(KitchenStation.sort_order, KitchenStation.name).all()


@router.post("/stations", response_model=StationRead, status_code=status.HTTP_201_CREATED)
def create_station(
    payload: StationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = KitchenStation(organization_id=_org_id(current_user), **payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/stations/{station_id}", response_model=StationRead)
def update_station(
    station_id: int,
    payload: StationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = get_tenant_scoped(db, KitchenStation, station_id, current_user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/stations/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_station(
    station_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = get_tenant_scoped(db, KitchenStation, station_id, current_user)
    s.is_active = False
    db.commit()


# ── Routes (department → station) ─────────────────────────────────────────────

@router.get("/routes", response_model=List[RouteRead])
def list_routes(
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, KitchenRoute, current_user)
    if branch_id is not None:
        q = q.filter(KitchenRoute.branch_id == branch_id)
    return q.all()


@router.post("/routes", response_model=RouteRead, status_code=status.HTTP_201_CREATED)
def create_route(
    payload: RouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the station belongs to the tenant.
    get_tenant_scoped(db, KitchenStation, payload.station_id, current_user)
    r = KitchenRoute(organization_id=_org_id(current_user), **payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = get_tenant_scoped(db, KitchenRoute, route_id, current_user)
    db.delete(r)
    db.commit()


# ── Tickets ───────────────────────────────────────────────────────────────────

@router.post("/tickets", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def fire_ticket(
    payload: FireTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = services.fire_ticket(
        db,
        organization_id=_org_id(current_user),
        branch_id=payload.branch_id,
        user_id=current_user.id,
        items=payload.items,
        table_id=payload.table_id,
        parked_ticket_id=payload.parked_ticket_id,
        notes=payload.notes,
    )
    return _to_ticket_read(ticket)


@router.get("/tickets", response_model=List[TicketRead])
def list_tickets(
    branch_id: Optional[int] = None,
    station_id: Optional[int] = None,
    status: Optional[KdsStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tickets = services.kds_feed(
        db,
        organization_id=_org_id(current_user),
        branch_id=branch_id,
        station_id=station_id,
        status=status,
    )
    return [_to_ticket_read(t) for t in tickets]


@router.get("/tickets/{ticket_id}", response_model=TicketRead)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = get_tenant_scoped(db, KitchenTicket, ticket_id, current_user)
    return _to_ticket_read(ticket)


@router.post("/tickets/{ticket_id}/bump", response_model=TicketRead)
def bump_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = get_tenant_scoped(db, KitchenTicket, ticket_id, current_user)
    return _to_ticket_read(services.bump_ticket(db, ticket))


@router.post("/tickets/{ticket_id}/recall", response_model=TicketRead)
def recall_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = get_tenant_scoped(db, KitchenTicket, ticket_id, current_user)
    return _to_ticket_read(services.recall_ticket(db, ticket))


@router.post("/tickets/{ticket_id}/cancel", response_model=TicketRead)
def cancel_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = get_tenant_scoped(db, KitchenTicket, ticket_id, current_user)
    return _to_ticket_read(services.cancel_ticket(db, ticket))


# ── Items ─────────────────────────────────────────────────────────────────────

def _get_item(db: Session, item_id: int, current_user: User) -> KitchenTicketItem:
    item = get_tenant_scoped(db, KitchenTicketItem, item_id, current_user)
    return item


@router.post("/items/{item_id}/bump", response_model=TicketRead)
def bump_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _get_item(db, item_id, current_user)
    return _to_ticket_read(services.bump_item(db, item))


@router.post("/items/{item_id}/void", response_model=TicketRead)
def void_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = _get_item(db, item_id, current_user)
    return _to_ticket_read(services.void_item(db, item))


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=KitchenStats)
def stats(
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tickets = services.kds_feed(db, organization_id=_org_id(current_user), branch_id=branch_id)
    by = {KdsStatus.NEW: 0, KdsStatus.IN_PROGRESS: 0, KdsStatus.READY: 0}
    for t in tickets:
        if t.status in by:
            by[t.status] += 1

    # Average prep time from tickets that reached READY (ready_at - fired_at).
    done = (
        db.query(KitchenTicket)
        .filter(
            KitchenTicket.organization_id == _org_id(current_user),
            KitchenTicket.ready_at.isnot(None),
        )
    )
    if branch_id is not None:
        done = done.filter(KitchenTicket.branch_id == branch_id)
    durations = []
    for t in done.all():
        if t.fired_at and t.ready_at:
            fired = t.fired_at if t.fired_at.tzinfo else t.fired_at.replace(tzinfo=timezone.utc)
            ready = t.ready_at if t.ready_at.tzinfo else t.ready_at.replace(tzinfo=timezone.utc)
            durations.append((ready - fired).total_seconds())
    avg_prep = int(sum(durations) / len(durations)) if durations else None

    return KitchenStats(
        new=by[KdsStatus.NEW],
        in_progress=by[KdsStatus.IN_PROGRESS],
        ready=by[KdsStatus.READY],
        avg_prep_seconds=avg_prep,
    )
