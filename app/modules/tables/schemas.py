"""Atlas BOS modules/tables/schemas — Pydantic v2."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.modules.tables.models import TableStatus


# ── DiningArea ────────────────────────────────────────────────────────────────

class AreaBase(BaseModel):
    name: str
    branch_id: int
    sort_order: int = 0
    is_active: bool = True


class AreaCreate(AreaBase):
    pass


class AreaUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class AreaRead(AreaBase):
    id: int
    organization_id: int

    class Config:
        from_attributes = True


# ── DiningTable ───────────────────────────────────────────────────────────────

class TableBase(BaseModel):
    code: str
    branch_id: int
    area_id: Optional[int] = None
    seats: int = 4
    pos_x: Optional[int] = None
    pos_y: Optional[int] = None
    is_active: bool = True


class TableCreate(TableBase):
    pass


class TableUpdate(BaseModel):
    code: Optional[str] = None
    area_id: Optional[int] = None
    seats: Optional[int] = None
    pos_x: Optional[int] = None
    pos_y: Optional[int] = None
    is_active: Optional[bool] = None


class TableRead(TableBase):
    id: int
    organization_id: int
    status: TableStatus
    current_ticket_id: Optional[str] = None
    server_user_id: Optional[int] = None
    opened_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Action payloads ───────────────────────────────────────────────────────────

class OpenTableRequest(BaseModel):
    customer_id: Optional[int] = None
    seats: Optional[int] = None        # comensales reales (opcional)


class TransferTableRequest(BaseModel):
    target_table_id: int


class AssignServerRequest(BaseModel):
    server_user_id: int


class StatusUpdateRequest(BaseModel):
    status: TableStatus


class FloorPlanResponse(BaseModel):
    area: AreaRead
    tables: List[TableRead]
