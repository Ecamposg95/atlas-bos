"""Atlas BOS modules/appointments/schemas — Pydantic v2."""
from datetime import datetime, time
from typing import List, Optional

from pydantic import BaseModel, Field

from app.modules.appointments.models import (
    AppointmentEventType,
    AppointmentStatus,
    BookingChannel,
    ResourceType,
)


# ── Resource ─────────────────────────────────────────────────────────────────

class ResourceBase(BaseModel):
    name: str
    resource_type: ResourceType
    branch_id: int
    capacity: int = 1
    is_active: bool = True


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    resource_type: Optional[ResourceType] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class ResourceRead(ResourceBase):
    id: int
    organization_id: int

    class Config:
        from_attributes = True


# ── Professional ─────────────────────────────────────────────────────────────

class ProfessionalBase(BaseModel):
    user_id: int
    branch_id: int
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    is_bookable: bool = True
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    default_resource_id: Optional[int] = None


class ProfessionalCreate(ProfessionalBase):
    pass


class ProfessionalUpdate(BaseModel):
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    is_bookable: Optional[bool] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    default_resource_id: Optional[int] = None


class ProfessionalRead(ProfessionalBase):
    id: int
    organization_id: int
    user_full_name: Optional[str] = None  # populated by router for convenience

    class Config:
        from_attributes = True


# ── Schedule ─────────────────────────────────────────────────────────────────

class ScheduleSlot(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time


class ScheduleReplaceRequest(BaseModel):
    slots: List[ScheduleSlot]


# ── Block ────────────────────────────────────────────────────────────────────

class BlockBase(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: Optional[str] = None


class BlockCreate(BlockBase):
    pass


class BlockRead(BlockBase):
    id: int
    professional_id: int

    class Config:
        from_attributes = True


# ── Service ──────────────────────────────────────────────────────────────────

class ServiceBase(BaseModel):
    duration_minutes: int = Field(gt=0)
    buffer_minutes_after: int = 0
    requires_resource_type: Optional[ResourceType] = None
    is_bookable_online: bool = True


class ServiceFromVariant(ServiceBase):
    variant_id: str  # ProductVariant.id is UUID string


class ServiceUpdate(BaseModel):
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    buffer_minutes_after: Optional[int] = None
    requires_resource_type: Optional[ResourceType] = None
    is_bookable_online: Optional[bool] = None


class ServiceRead(ServiceBase):
    id: int
    organization_id: int
    product_variant_id: str
    variant_name: Optional[str] = None  # populated by router

    class Config:
        from_attributes = True


# ── Availability ─────────────────────────────────────────────────────────────

class AvailabilityQuery(BaseModel):
    branch_id: int
    date: str  # ISO date "YYYY-MM-DD" — parsed in service layer
    service_ids: List[int]
    professional_id: Optional[int] = None
    resource_id: Optional[int] = None
    slot_minutes: int = 15


class AvailabilitySlot(BaseModel):
    start: datetime
    end: datetime
    professional_id: int
    resource_id: Optional[int] = None


# ── Appointment ──────────────────────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    customer_id: int
    professional_id: int
    resource_id: Optional[int] = None
    service_ids: List[int]
    starts_at: datetime
    notes: Optional[str] = None
    branch_id: int


class AppointmentUpdate(BaseModel):
    professional_id: Optional[int] = None
    resource_id: Optional[int] = None
    starts_at: Optional[datetime] = None
    notes: Optional[str] = None
    service_ids: Optional[List[int]] = None


class AppointmentEventRead(BaseModel):
    id: int
    event_type: AppointmentEventType
    actor_user_id: Optional[int] = None
    payload: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AppointmentServiceRead(BaseModel):
    service_id: int
    duration_minutes: int
    sort_order: int

    class Config:
        from_attributes = True


class AppointmentRead(BaseModel):
    id: int
    organization_id: int
    branch_id: int
    customer_id: int
    professional_id: int
    resource_id: Optional[int] = None
    starts_at: datetime
    ends_at: datetime
    status: AppointmentStatus
    notes: Optional[str] = None
    booking_channel: BookingChannel
    actual_professional_id: Optional[int] = None
    sales_document_id: Optional[str] = None
    services: List[AppointmentServiceRead] = []
    events: List[AppointmentEventRead] = []

    class Config:
        from_attributes = True


class CompleteAppointment(BaseModel):
    sales_document_id: Optional[str] = None
    actual_professional_id: Optional[int] = None


class CancelAppointment(BaseModel):
    reason: Optional[str] = None
