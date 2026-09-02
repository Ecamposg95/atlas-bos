
# schemas/cash.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Literal
from decimal import Decimal
from datetime import datetime

class CashSessionBase(BaseModel):
    # Hallazgo (revisión final): `ge=0` vivía aquí, y `CashSessionRead` (más
    # abajo) hereda de esta clase — Pydantic aplica la cota también al
    # response_model de /status, /history, /open y /close. Una fila
    # histórica con `opening_balance` negativo (dato ya persistido, por la
    # razón que sea) hacía que FastAPI lanzara ResponseValidationError → 500
    # al leerla, y en /history una sola fila mala tumbaba la lista completa.
    # La cota solo tiene sentido en la entrada (no dejar CREAR una sesión con
    # fondo negativo); las respuestas deben poder leer lo que ya esté en BD
    # tal cual, sin revalidar. Por eso vive en `CashSessionCreate`, no aquí.
    opening_balance: Decimal

class CashSessionCreate(CashSessionBase):
    opening_balance: Decimal = Field(ge=0)

class OpeningBalanceCorrection(BaseModel):
    """Correccion del fondo declarado al abrir. No es un movimiento de efectivo."""
    opening_balance: Decimal = Field(ge=0)
    reason: str = Field(min_length=10)

class CashSessionClose(BaseModel):
    closing_balance: Decimal # Lo que el cajero contó físicamente
    notes: Optional[str] = None

class CashMovementCreate(BaseModel):
    session_id: int
    # Hallazgo (revisión final): era `str` libre. Un valor como "out" en
    # minúsculas no bloqueaba la fila en /movements, no pasaba por
    # `_validar_salida` (sin motivo, sin saldo, sin umbral por rol) porque esa
    # rama solo se activa con `payload.type == "OUT"` exacto, y el cálculo del
    # esperado tampoco lo contaba porque `compute_expected_cash` solo
    # reconoce "IN"/"OUT" exactos — quedaba un retiro sin control y sin
    # efecto en el corte. `Literal` hace que FastAPI rechace cualquier otro
    # valor con 422 antes de llegar al router.
    type: Literal["IN", "OUT"]
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

    # Alertas del cierre (código/severidad/mensaje), pobladas solo al cerrar
    # (`_apply_close_to_session` en app/routers/cash.py). Vacío en /status,
    # /history, /open: esos endpoints devuelven CashSession sin pasar por el
    # cálculo de warnings, así que el default [] es correcto ahí.
    warnings: List[dict] = Field(default_factory=list)

    class Config:
        from_attributes = True