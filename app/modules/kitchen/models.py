"""Atlas BOS modules/kitchen/models — KDS domain.

DOMAIN: Kitchen Display System
STATUS: Stable

4 tables:
  - kitchen_stations
  - kitchen_routes
  - kitchen_tickets
  - kitchen_ticket_items
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
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class KdsStatus(str, enum.Enum):
    NEW = "NEW"                  # Recién enviado a cocina
    IN_PROGRESS = "IN_PROGRESS"  # Al menos un item en preparación
    READY = "READY"              # Todos los items listos
    SERVED = "SERVED"            # Entregado a la mesa
    CANCELED = "CANCELED"


class ItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    PREPARING = "PREPARING"
    READY = "READY"
    SERVED = "SERVED"
    VOIDED = "VOIDED"


# Shared Postgres enum type objects — declared once, reused across columns.
_kds_status_enum = Enum(KdsStatus, name="kds_status")
_kds_item_status_enum = Enum(ItemStatus, name="kds_item_status")


# ── Models ────────────────────────────────────────────────────────────────────

class KitchenStation(Base):
    __tablename__ = "kitchen_stations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    name = Column(String, nullable=False)          # Ej: "Cocina caliente", "Barra"
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KitchenRoute(Base):
    """Routes a product department to a kitchen station.

    When a ticket is fired, each item resolves its station from its product's
    department via this table; falls back to the branch's default station.
    """
    __tablename__ = "kitchen_routes"
    __table_args__ = (
        UniqueConstraint("branch_id", "department_id", name="uq_kroute_branch_dept"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=False, index=True)
    station_id = Column(Integer, ForeignKey("kitchen_stations.id"), nullable=False)

    station = relationship("KitchenStation")


class KitchenTicket(Base):
    __tablename__ = "kitchen_tickets"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    table_id = Column(Integer, ForeignKey("dining_tables.id"), nullable=True, index=True)
    parked_ticket_id = Column(String(36), ForeignKey("parked_tickets.id"), nullable=True, index=True)
    status = Column(_kds_status_enum, nullable=False, default=KdsStatus.NEW)
    notes = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    fired_at = Column(DateTime(timezone=True), server_default=func.now())
    ready_at = Column(DateTime(timezone=True), nullable=True)
    served_at = Column(DateTime(timezone=True), nullable=True)

    table = relationship("DiningTable")
    items = relationship(
        "KitchenTicketItem",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by=lambda: KitchenTicketItem.id,
    )


class KitchenTicketItem(Base):
    __tablename__ = "kitchen_ticket_items"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    ticket_id = Column(Integer, ForeignKey("kitchen_tickets.id"), nullable=False, index=True)
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=True)
    description = Column(String, nullable=False)   # snapshot del nombre del platillo
    qty = Column(Numeric(10, 2), nullable=False, default=1)
    modifiers = Column(JSON, nullable=True)        # Ej: ["sin cebolla", "término medio"]
    station_id = Column(Integer, ForeignKey("kitchen_stations.id"), nullable=True, index=True)
    status = Column(_kds_item_status_enum, nullable=False, default=ItemStatus.PENDING)
    bumped_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("KitchenTicket", back_populates="items")
    station = relationship("KitchenStation")
