"""
MOONSHOT_ENGINE: Inventory Engine
DOMAIN: Supply Chain / Logistics
STATUS: Core
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Numeric, DateTime, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

from app.models.mixins import TenantMixin


class MovementType(str, enum.Enum):
    PURCHASE_IN = "PURCHASE_IN"      # Entrada por Compra
    SALE_OUT = "SALE_OUT"            # Salida por Venta
    ADJUSTMENT_IN = "ADJUSTMENT_IN"  # Ajuste Inventario (+)
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"# Ajuste Inventario (-)
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    SALE_RETURN = "SALE_RETURN" # Devolución de Venta


class InventoryMovement(Base, TenantMixin):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    movement_type = Column(Enum(MovementType), nullable=False)
    qty_change = Column(Numeric(10, 2), nullable=False) # +10 o -5
    qty_before = Column(Numeric(10, 2), nullable=False)
    qty_after = Column(Numeric(10, 2), nullable=False)

    reference = Column(String, nullable=True) # ID Venta, ID Compra...
    from_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    to_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    variant = relationship("ProductVariant")
    branch = relationship("Branch", foreign_keys=[branch_id])
    from_branch = relationship("Branch", foreign_keys=[from_branch_id], back_populates="outgoing_movements")
    to_branch = relationship("Branch", foreign_keys=[to_branch_id], back_populates="incoming_movements")


class StockOnHand(Base, TenantMixin):
    __tablename__ = "stock_on_hand"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False, index=True)

    qty_on_hand = Column(Numeric(10, 2), default=0, nullable=False)
    is_active = Column(Boolean, default=True, server_default="true") # Habilitado/Deshabilitado para venta en esta sucursal
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('branch_id', 'variant_id', name='uq_stock_branch_variant'),
        {'extend_existing': True}
    )

    branch = relationship("Branch")
    variant = relationship("ProductVariant", backref="stock_levels")
