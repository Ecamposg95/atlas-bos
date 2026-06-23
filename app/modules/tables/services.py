"""Atlas BOS modules/tables/services — dine-in floor logic.

Open/free/transfer a table. A table's open check IS a `ParkedTicket`
(the same buffer the POS uses for paused tickets), so the cashier can resume
the table's cart at any terminal and convert it to a sale.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.sales import ParkedTicket
from app.modules.tables.models import DiningTable, TableStatus


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


def free_table(db: Session, table: DiningTable) -> DiningTable:
    """Release a table back to AVAILABLE and detach its check."""
    table.status = TableStatus.AVAILABLE
    table.current_ticket_id = None
    table.opened_at = None
    table.server_user_id = None
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
    free_table(db, table)
    return table
