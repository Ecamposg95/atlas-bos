"""Atlas BOS modules/bar/schemas."""
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class BottleCreate(BaseModel):
    branch_id: int
    name: str
    variant_id: Optional[str] = None
    full_volume_ml: Decimal = Decimal("750")
    pour_size_ml: Decimal = Decimal("45")


class BottleRead(BaseModel):
    id: int
    branch_id: int
    variant_id: Optional[str] = None
    name: str
    full_volume_ml: Decimal
    remaining_ml: Decimal
    pour_size_ml: Decimal
    status: str
    pct_remaining: float

    class Config:
        from_attributes = True


class PourRequest(BaseModel):
    # ml a servir; si se omite usa pour_size_ml de la botella
    ml: Optional[Decimal] = Field(default=None, gt=0)
    count: int = Field(default=1, ge=1)


class WasteRequest(BaseModel):
    ml: Decimal = Field(gt=0)
    reason: Optional[str] = None


class RefillRequest(BaseModel):
    # reajuste manual del volumen restante (conteo físico)
    remaining_ml: Decimal = Field(ge=0)
