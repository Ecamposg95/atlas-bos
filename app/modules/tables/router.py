"""Atlas BOS modules/tables/router — dine-in floor REST API."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant_query import _resolve_org_id, get_tenant_scoped, scoped_query
from app.models import User
from app.modules.tables import services
from app.modules.tables.models import DiningArea, DiningTable, TableStatus
from app.modules.tables.schemas import (
    AreaCreate,
    AreaRead,
    AreaUpdate,
    AssignServerRequest,
    OpenTableRequest,
    StatusUpdateRequest,
    TableCreate,
    TableRead,
    TableUpdate,
    TransferTableRequest,
)

router = APIRouter()


def _org_id(user: User) -> int:
    org = _resolve_org_id(user)
    if org is None:
        raise HTTPException(status_code=400, detail="No active organization in context")
    return org


# ── Areas ─────────────────────────────────────────────────────────────────────

@router.get("/areas", response_model=List[AreaRead])
def list_areas(
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, DiningArea, current_user).filter(DiningArea.is_active == True)  # noqa: E712
    if branch_id is not None:
        q = q.filter(DiningArea.branch_id == branch_id)
    return q.order_by(DiningArea.sort_order, DiningArea.name).all()


@router.post("/areas", response_model=AreaRead, status_code=status.HTTP_201_CREATED)
def create_area(
    payload: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    area = DiningArea(organization_id=_org_id(current_user), **payload.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.put("/areas/{area_id}", response_model=AreaRead)
def update_area(
    area_id: int,
    payload: AreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    area = get_tenant_scoped(db, DiningArea, area_id, current_user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(area, k, v)
    db.commit()
    db.refresh(area)
    return area


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    area = get_tenant_scoped(db, DiningArea, area_id, current_user)
    area.is_active = False
    db.commit()


# ── Tables (floor plan) ───────────────────────────────────────────────────────

@router.get("/", response_model=List[TableRead])
def list_tables(
    branch_id: Optional[int] = None,
    area_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Floor plan: every active table with its live status."""
    q = scoped_query(db, DiningTable, current_user).filter(DiningTable.is_active == True)  # noqa: E712
    if branch_id is not None:
        q = q.filter(DiningTable.branch_id == branch_id)
    if area_id is not None:
        q = q.filter(DiningTable.area_id == area_id)
    return q.order_by(DiningTable.code).all()


@router.post("/", response_model=TableRead, status_code=status.HTTP_201_CREATED)
def create_table(
    payload: TableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    table = DiningTable(organization_id=_org_id(current_user), **payload.model_dump())
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.put("/{table_id}", response_model=TableRead)
def update_table(
    table_id: int,
    payload: TableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    table = get_tenant_scoped(db, DiningTable, table_id, current_user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(table, k, v)
    db.commit()
    db.refresh(table)
    return table


@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    table = get_tenant_scoped(db, DiningTable, table_id, current_user)
    if table.current_ticket_id:
        raise HTTPException(status_code=409, detail="No se puede eliminar una mesa con cuenta abierta")
    table.is_active = False
    db.commit()


# ── Table actions ─────────────────────────────────────────────────────────────

@router.post("/{table_id}/open", response_model=TableRead)
def open_table(
    table_id: int,
    payload: OpenTableRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    table = get_tenant_scoped(db, DiningTable, table_id, current_user)
    return services.open_table(
        db, table, user_id=current_user.id, customer_id=payload.customer_id
    )


@router.post("/{table_id}/free", response_model=TableRead)
def free_table(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    table = get_tenant_scoped(db, DiningTable, table_id, current_user)
    return services.free_table(db, table)


@router.post("/{table_id}/transfer", response_model=TableRead)
def transfer_table(
    table_id: int,
    payload: TransferTableRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = get_tenant_scoped(db, DiningTable, table_id, current_user)
    target = get_tenant_scoped(db, DiningTable, payload.target_table_id, current_user)
    return services.transfer_table(db, source, target)


@router.post("/{table_id}/assign-server", response_model=TableRead)
def assign_server(
    table_id: int,
    payload: AssignServerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    table = get_tenant_scoped(db, DiningTable, table_id, current_user)
    return services.assign_server(db, table, payload.server_user_id)


@router.patch("/{table_id}/status", response_model=TableRead)
def set_status(
    table_id: int,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    table = get_tenant_scoped(db, DiningTable, table_id, current_user)
    table.status = payload.status
    db.commit()
    db.refresh(table)
    return table
