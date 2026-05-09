from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, Enum, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime, timezone
import enum

class TransactionType(str, enum.Enum):
    CHARGE = "CHARGE"
    PAYMENT = "PAYMENT"
    ADJUSTMENT = "ADJUSTMENT"

from app.models.mixins import TenantMixin

class AccountTransaction(Base, TenantMixin):
    __tablename__ = "account_transactions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    tx_type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    current_balance = Column(Numeric(10, 2), nullable=False)
    reference = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    customer = relationship("Customer", backref="account_transactions")


# ──────────────────────────────────────────────
#  Expenses
# ──────────────────────────────────────────────

class Expense(Base, TenantMixin):
    """Registro de egresos operativos (limpieza, papelería, servicios, etc.)"""
    __tablename__ = "expenses"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    branch = relationship("Branch")
    user = relationship("User")


# ──────────────────────────────────────────────
#  Purchase Orders
# ──────────────────────────────────────────────

class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ORDERED = "ORDERED"
    PARTIAL = "PARTIAL"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class PurchaseOrder(Base, TenantMixin):
    """Orden de compra a proveedor."""
    __tablename__ = "purchase_orders"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    folio = Column(String(20), nullable=False, index=True)           # OC-00001
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    supplier_name = Column(String(200), nullable=False)
    supplier_contact = Column(String(200), nullable=True)
    status = Column(Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    received_at = Column(DateTime(timezone=True), nullable=True)

    branch = relationship("Branch")
    created_by = relationship("User")
    lines = relationship("PurchaseOrderLine", back_populates="purchase_order", cascade="all, delete-orphan")


class PurchaseOrderLine(Base):
    """Línea de una orden de compra."""
    __tablename__ = "purchase_order_lines"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=True)
    product_name = Column(String(300), nullable=False)   # snapshot
    sku = Column(String(100), nullable=True)              # snapshot
    qty_ordered = Column(Numeric(10, 2), nullable=False)
    qty_received = Column(Numeric(10, 2), default=0, nullable=False)
    unit_cost = Column(Numeric(10, 4), nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="lines")
    variant = relationship("ProductVariant")
