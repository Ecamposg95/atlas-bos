"""Atlas BOS modules/appointments/models — agenda domain.

DOMAIN: Appointments (Resource + Professional + Service + Appointment + Event)
STATUS: Stable

8 tables:
  - appointments_resources
  - appointments_professionals
  - appointments_schedules
  - appointments_blocks
  - appointments_services
  - appointments
  - appointments_services_link
  - appointments_events
"""
import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class ResourceType(str, enum.Enum):
    CHAIR = "CHAIR"
    CABIN = "CABIN"
    CONSULTORY = "CONSULTORY"
    BAY = "BAY"
    TABLE = "TABLE"


class AppointmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELED = "CANCELED"
    NO_SHOW = "NO_SHOW"


class BookingChannel(str, enum.Enum):
    STAFF = "STAFF"
    PORTAL = "PORTAL"


class AppointmentEventType(str, enum.Enum):
    CREATED = "CREATED"
    CONFIRMED = "CONFIRMED"
    STARTED = "STARTED"
    COMPLETED = "COMPLETED"
    CANCELED = "CANCELED"
    NO_SHOW = "NO_SHOW"
    RESCHEDULED = "RESCHEDULED"


# Shared Postgres enum type objects — declared once, reused across columns
# so Alembic autogenerate doesn't emit duplicate CREATE TYPE statements.
_appt_resource_type_enum = Enum(ResourceType, name="appt_resource_type")
_appt_status_enum = Enum(AppointmentStatus, name="appt_status")
_appt_booking_channel_enum = Enum(BookingChannel, name="appt_booking_channel")
_appt_event_type_enum = Enum(AppointmentEventType, name="appt_event_type")


# ── Models ────────────────────────────────────────────────────────────────────

class Resource(Base):
    __tablename__ = "appointments_resources"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    resource_type = Column(_appt_resource_type_enum, nullable=False)
    capacity = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Professional(Base):
    __tablename__ = "appointments_professionals"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    default_resource_id = Column(Integer, ForeignKey("appointments_resources.id"), nullable=True)
    color = Column(String(7), nullable=True)
    is_bookable = Column(Boolean, nullable=False, default=True)
    bio = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    default_resource = relationship("Resource")


class ProfessionalSchedule(Base):
    __tablename__ = "appointments_schedules"
    __table_args__ = (
        UniqueConstraint("professional_id", "weekday", name="uq_sched_prof_weekday"),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    weekday = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)


class ProfessionalBlock(Base):
    __tablename__ = "appointments_blocks"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Service(Base):
    __tablename__ = "appointments_services"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    product_variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False, unique=True)
    duration_minutes = Column(Integer, nullable=False)
    buffer_minutes_after = Column(Integer, nullable=False, default=0)
    requires_resource_type = Column(_appt_resource_type_enum, nullable=True)
    is_bookable_online = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    variant = relationship("ProductVariant")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("appointments_resources.id"), nullable=True, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(_appt_status_enum, nullable=False, default=AppointmentStatus.PENDING)
    notes = Column(String, nullable=True)
    booking_channel = Column(_appt_booking_channel_enum, nullable=False, default=BookingChannel.STAFF)
    actual_professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=True)
    sales_document_id = Column(String(36), ForeignKey("sales_documents.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    professional = relationship(
        "Professional",
        foreign_keys=[professional_id],
    )
    actual_professional = relationship(
        "Professional",
        foreign_keys=[actual_professional_id],
    )
    resource = relationship("Resource")
    services = relationship(
        "AppointmentService",
        back_populates="appointment",
        cascade="all, delete-orphan",
    )
    events = relationship(
        "AppointmentEvent",
        back_populates="appointment",
        cascade="all, delete-orphan",
        order_by=lambda: AppointmentEvent.created_at,
    )


class AppointmentService(Base):
    __tablename__ = "appointments_services_link"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("appointments_services.id"), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=False)

    appointment = relationship("Appointment", back_populates="services")
    service = relationship("Service")


class AppointmentEvent(Base):
    __tablename__ = "appointments_events"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    event_type = Column(_appt_event_type_enum, nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    appointment = relationship("Appointment", back_populates="events")
