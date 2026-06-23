"""Atlas BOS modules/tables/models — dining floor domain.

DOMAIN: Mesas (DiningArea + DiningTable)
STATUS: Stable

2 tables:
  - dining_areas
  - dining_tables
"""
import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class TableStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"          # Libre
    OCCUPIED = "OCCUPIED"            # Cuenta abierta
    BILL_REQUESTED = "BILL_REQUESTED"  # Pidió la cuenta
    CLEANING = "CLEANING"            # Limpieza
    RESERVED = "RESERVED"            # Reservada


# Shared Postgres enum type object — declared once, reused across columns.
_table_status_enum = Enum(TableStatus, name="table_status")


# ── Models ────────────────────────────────────────────────────────────────────

class DiningArea(Base):
    __tablename__ = "dining_areas"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tables = relationship(
        "DiningTable",
        back_populates="area",
        order_by=lambda: DiningTable.code,
    )


class DiningTable(Base):
    __tablename__ = "dining_tables"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("dining_areas.id"), nullable=True, index=True)
    code = Column(String, nullable=False)              # Ej: "M1", "Barra 3"
    seats = Column(Integer, nullable=False, default=4)
    status = Column(_table_status_enum, nullable=False, default=TableStatus.AVAILABLE)

    # Coordenadas del plano (opcional). NULL = sin posicionar (vista grilla).
    pos_x = Column(Integer, nullable=True)
    pos_y = Column(Integer, nullable=True)

    # Cuenta abierta: apunta al ParkedTicket activo de esta mesa.
    current_ticket_id = Column(String(36), ForeignKey("parked_tickets.id"), nullable=True, index=True)
    server_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    area = relationship("DiningArea", back_populates="tables")
    server = relationship("User")
    current_ticket = relationship("ParkedTicket")
