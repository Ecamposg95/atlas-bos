"""Atlas BOS modules/kitchen/schemas — Pydantic v2."""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel

from app.modules.kitchen.models import ItemStatus, KdsStatus


# ── Stations ──────────────────────────────────────────────────────────────────

class StationBase(BaseModel):
    name: str
    branch_id: int
    sort_order: int = 0
    is_active: bool = True


class StationCreate(StationBase):
    pass


class StationUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class StationRead(StationBase):
    id: int
    organization_id: int

    class Config:
        from_attributes = True


# ── Routes ────────────────────────────────────────────────────────────────────

class RouteCreate(BaseModel):
    branch_id: int
    department_id: str
    station_id: int


class RouteRead(RouteCreate):
    id: int
    organization_id: int

    class Config:
        from_attributes = True


# ── Fire (create) ─────────────────────────────────────────────────────────────

class FireItem(BaseModel):
    variant_id: Optional[str] = None
    description: str
    qty: Decimal = Decimal("1")
    modifiers: Optional[List[str]] = None
    station_id: Optional[int] = None   # override de enrutado


class FireTicketRequest(BaseModel):
    branch_id: int
    table_id: Optional[int] = None
    parked_ticket_id: Optional[str] = None
    notes: Optional[str] = None
    items: List[FireItem]


# ── Read ──────────────────────────────────────────────────────────────────────

class TicketItemRead(BaseModel):
    id: int
    variant_id: Optional[str] = None
    description: str
    qty: Decimal
    modifiers: Optional[List[str]] = None
    station_id: Optional[int] = None
    status: ItemStatus

    class Config:
        from_attributes = True


class TicketRead(BaseModel):
    id: int
    organization_id: int
    branch_id: int
    table_id: Optional[int] = None
    parked_ticket_id: Optional[str] = None
    status: KdsStatus
    notes: Optional[str] = None
    fired_at: Optional[datetime] = None
    ready_at: Optional[datetime] = None
    age_seconds: Optional[int] = None
    items: List[TicketItemRead] = []

    class Config:
        from_attributes = True


class KitchenStats(BaseModel):
    new: int
    in_progress: int
    ready: int
    avg_prep_seconds: Optional[int] = None
