
# schemas/cash.py
from pydantic import BaseModel, Field
from typing import Optional, Dict
from decimal import Decimal
from datetime import datetime

class CashSessionBase(BaseModel):
    opening_balance: Decimal = Field(ge=0)

class CashSessionCreate(CashSessionBase):
    pass # Solo necesitamos el saldo inicial

class OpeningBalanceCorrection(BaseModel):
    """Correccion del fondo declarado al abrir. No es un movimiento de efectivo."""
    opening_balance: Decimal = Field(ge=0)
    reason: str = Field(min_length=10)

class CashSessionClose(BaseModel):
    closing_balance: Decimal # Lo que el cajero contó físicamente
    notes: Optional[str] = None

class CashMovementCreate(BaseModel):
    session_id: int
    type: str  # 'IN' or 'OUT'
    amount: Decimal
    concept: Optional[str] = None

class CashMovementRead(BaseModel):
    id: int
    session_id: int
    type: str
    amount: Decimal
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CashSessionCloseGuided(BaseModel):
    counted_cash: Decimal = Field(..., ge=0, description="Efectivo contado en caja")
    cash_total_per_method: Dict[str, Decimal] = Field(default_factory=dict, description="Totales por método de pago según el cajero")
    day_expenses_total: Decimal = Field(default=Decimal("0"), ge=0)
    notes: Optional[str] = None


class CashSessionRead(CashSessionBase):
    id: int
    branch_id: int
    user_id: int
    status: str
    opened_at: datetime
    closed_at: Optional[datetime] = None
    
    # Datos de cierre
    closing_balance: Optional[Decimal] = None
    total_cash_sales: Decimal = Decimal(0) # Ventas en efectivo calculadas
    difference: Decimal = Decimal(0)       # Sobrante o Faltante

    class Config:
        from_attributes = True