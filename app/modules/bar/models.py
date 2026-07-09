"""Atlas BOS modules/bar/models — inventario líquido.

DOMAIN: Botellas abiertas en barra (control por volumen), pours y merma.
STATUS: MVP

1 tabla:
  - bar_bottles  (cada botella física con volumen restante en ml)

El "pour" (servida) y la "merma" (derrame/rotura) se registran decrementando
`remaining_ml`; el histórico fino se puede añadir después con una tabla ledger.
"""
import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class BottleStatus(str, enum.Enum):
    OPEN = "OPEN"          # abierta, en uso
    EMPTY = "EMPTY"        # vacía (remaining_ml <= 0)
    ARCHIVED = "ARCHIVED"  # retirada / dada de baja


_bottle_status_enum = Enum(BottleStatus, name="bottle_status")


class BarBottle(Base):
    __tablename__ = "bar_bottles"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    # Variante de producto asociada (la botella de licor en catálogo). Opcional
    # para permitir registrar una botella suelta sin producto formal.
    # product_variants.id es UUID (VARCHAR 36), NO integer.
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=True, index=True)

    name = Column(String(160), nullable=False)          # "Tequila Don Julio 70"
    full_volume_ml = Column(Numeric(10, 2), nullable=False, default=750)
    remaining_ml = Column(Numeric(10, 2), nullable=False, default=750)
    pour_size_ml = Column(Numeric(10, 2), nullable=False, default=45)  # servida estándar
    status = Column(_bottle_status_enum, nullable=False, default=BottleStatus.OPEN, index=True)

    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    variant = relationship("ProductVariant")

    @property
    def pct_remaining(self) -> float:
        full = float(self.full_volume_ml or 0)
        if full <= 0:
            return 0.0
        return max(0.0, min(100.0, float(self.remaining_ml or 0) / full * 100.0))
