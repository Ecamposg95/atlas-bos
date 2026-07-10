"""Atlas BOS modules/tables/services — dine-in floor logic.

Open/free/transfer a table. A table's open check IS a `ParkedTicket`
(the same buffer the POS uses for paused tickets), so the cashier can resume
the table's cart at any terminal and convert it to a sale.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.models.sales import ParkedTicket
from app.modules.tables.models import DiningTable, TableStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Máquina de estados de la mesa: transiciones MANUALES permitidas vía
# PATCH /status. OCCUPIED se entra solo por /open (crea la cuenta) y se sale a
# AVAILABLE solo por /free o el cobro (cierra la cuenta) — nunca a mano.
_ALLOWED_TRANSITIONS = {
    TableStatus.AVAILABLE:      {TableStatus.RESERVED, TableStatus.CLEANING},
    TableStatus.RESERVED:       {TableStatus.AVAILABLE, TableStatus.CLEANING},
    TableStatus.OCCUPIED:       {TableStatus.BILL_REQUESTED},
    TableStatus.BILL_REQUESTED: {TableStatus.OCCUPIED},
    TableStatus.CLEANING:       {TableStatus.AVAILABLE},
}


def set_status(db: Session, table: DiningTable, new_status: TableStatus) -> DiningTable:
    """Aplica una transición de estado validada por la máquina de estados.

    Reemplaza al setter crudo (cualquier estado → cualquier estado), que dejaba
    marcar AVAILABLE una mesa con cuenta abierta (fuga de la cuenta) u OCCUPIED
    sin cuenta.
    """
    current = table.status
    if new_status == current:
        return table  # idempotente
    if new_status not in _ALLOWED_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Transición inválida: {current.value} → {new_status.value}. "
                "Abre la mesa para ocupar y cóbrala/libérala para desocupar."
            ),
        )
    table.status = new_status
    db.commit()
    db.refresh(table)
    return table


def open_table(
    db: Session,
    table: DiningTable,
    *,
    user_id: int,
    customer_id: Optional[int] = None,
) -> DiningTable:
    """Open a check on a table by creating a fresh ParkedTicket and linking it."""
    if table.current_ticket_id:
        raise HTTPException(status_code=409, detail="La mesa ya tiene una cuenta abierta")

    pt = ParkedTicket(
        organization_id=table.organization_id,
        branch_id=table.branch_id,
        user_id=user_id,
        customer_id=customer_id,
        cart_json={"items": []},
        notes=f"Mesa {table.code}",
    )
    db.add(pt)
    db.flush()  # populate pt.id (UUID) before linking

    table.current_ticket_id = pt.id
    table.status = TableStatus.OCCUPIED
    table.server_user_id = user_id
    table.opened_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(table)
    return table


def _detach_table(table: DiningTable) -> None:
    """Regresa la mesa a AVAILABLE y suelta su cuenta (sin tocar la cuenta)."""
    table.status = TableStatus.AVAILABLE
    table.current_ticket_id = None
    table.opened_at = None
    table.server_user_id = None


def _close_parked_ticket(db: Session, ticket_id: str) -> None:
    """Marca la cuenta (ParkedTicket) como cancelada por abandono.

    `status` es una columna raw (railway_init), ausente del ORM y de esquemas
    viejos/tests; la tocamos dentro de un SAVEPOINT para que su ausencia no
    aborte la transacción. La soft-delete (`deleted_at`, sí en el ORM) es la
    señal cross-schema. No abandona una cuenta ya CONVERTED (pagada).
    """
    pt = db.query(ParkedTicket).filter(ParkedTicket.id == ticket_id).first()
    if pt is None:
        return
    db.flush()  # persiste cambios previos (KDS) en la txn externa antes del savepoint
    converted = False
    try:
        with db.begin_nested():
            row = db.execute(
                text("SELECT status FROM parked_tickets WHERE id = :id"),
                {"id": ticket_id},
            ).first()
            converted = bool(row and row[0] == "CONVERTED")
            if not converted:
                db.execute(
                    text(
                        "UPDATE parked_tickets SET status = 'CANCELLED' "
                        "WHERE id = :id AND status = 'ACTIVE'"
                    ),
                    {"id": ticket_id},
                )
    except Exception:
        converted = False  # esquema sin columna status — seguimos con soft-delete
    if converted:
        return
    pt.deleted_at = _now()


def _abandon_open_check(db: Session, table: DiningTable) -> None:
    """Cancela las comandas de cocina vivas de la cuenta y cierra la cuenta.

    Es la semántica de "liberar sin cobrar": antes, liberar una mesa ocupada
    dejaba el ParkedTicket huérfano (ACTIVE) y las comandas KDS disparándose.
    """
    ticket_id = table.current_ticket_id
    # 1) Cancelar comandas KDS vivas de esta cuenta (por ticket o por mesa).
    from app.modules.kitchen.models import ItemStatus, KdsStatus, KitchenTicket
    from app.modules.kitchen.services import ACTIVE_TICKET_STATUSES

    live = (
        db.query(KitchenTicket)
        .filter(
            KitchenTicket.organization_id == table.organization_id,
            or_(
                KitchenTicket.parked_ticket_id == ticket_id,
                KitchenTicket.table_id == table.id,
            ),
            KitchenTicket.status.in_(ACTIVE_TICKET_STATUSES),
        )
        .all()
    )
    for kt in live:
        for item in kt.items:
            if item.status != ItemStatus.VOIDED:
                item.status = ItemStatus.VOIDED
        kt.status = KdsStatus.CANCELED
    # 2) Cerrar la cuenta.
    _close_parked_ticket(db, ticket_id)


def free_table(db: Session, table: DiningTable) -> DiningTable:
    """Liberación MANUAL: abandona la cuenta abierta (sin pago) y cancela sus
    comandas de cocina vivas, luego regresa la mesa a AVAILABLE."""
    if table.current_ticket_id:
        _abandon_open_check(db, table)
    _detach_table(table)
    db.commit()
    db.refresh(table)
    return table


def transfer_table(db: Session, source: DiningTable, target: DiningTable) -> DiningTable:
    """Move the open check from `source` to `target` (e.g. guests changed table)."""
    if not source.current_ticket_id:
        raise HTTPException(status_code=409, detail="La mesa origen no tiene cuenta abierta")
    if target.current_ticket_id:
        raise HTTPException(status_code=409, detail="La mesa destino ya está ocupada")

    target.current_ticket_id = source.current_ticket_id
    target.status = TableStatus.OCCUPIED
    target.server_user_id = source.server_user_id
    target.opened_at = source.opened_at

    source.current_ticket_id = None
    source.status = TableStatus.AVAILABLE
    source.server_user_id = None
    source.opened_at = None
    db.commit()
    db.refresh(target)
    return target


def assign_server(db: Session, table: DiningTable, server_user_id: int) -> DiningTable:
    table.server_user_id = server_user_id
    db.commit()
    db.refresh(table)
    return table


def free_by_ticket_id(db: Session, organization_id: int, ticket_id: str) -> Optional[DiningTable]:
    """Free whichever table holds `ticket_id` as its open check.

    Called by the sales subscriber when a parked ticket converts to a sale, so
    the table returns to AVAILABLE automatically on payment. Returns the freed
    table or None if no table referenced the ticket.
    """
    table = (
        db.query(DiningTable)
        .filter(
            DiningTable.organization_id == organization_id,
            DiningTable.current_ticket_id == ticket_id,
        )
        .first()
    )
    if table is None:
        return None
    # La cuenta ya se convirtió en venta (pago): solo soltamos la mesa. NO
    # llamamos free_table() para no intentar "abandonar/cancelar" una cuenta
    # que en realidad fue pagada.
    _detach_table(table)
    db.commit()
    db.refresh(table)
    return table
