"""Atlas BOS modules/recipes/schemas — Pydantic v2."""
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


# ── Ingredient ────────────────────────────────────────────────────────────────

class IngredientBase(BaseModel):
    ingredient_variant_id: str
    qty: Decimal
    unit: Optional[str] = None
    waste_pct: Decimal = Decimal("0")


class IngredientCreate(IngredientBase):
    pass


class IngredientRead(IngredientBase):
    id: int

    class Config:
        from_attributes = True


# ── Recipe ────────────────────────────────────────────────────────────────────

class RecipeBase(BaseModel):
    product_variant_id: str
    name: str
    yield_qty: Decimal = Decimal("1")
    notes: Optional[str] = None
    is_active: bool = True


class RecipeCreate(RecipeBase):
    ingredients: List[IngredientCreate] = []


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    yield_qty: Optional[Decimal] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    # When provided, replaces the full ingredient list.
    ingredients: Optional[List[IngredientCreate]] = None


class RecipeRead(RecipeBase):
    id: int
    organization_id: int
    ingredients: List[IngredientRead] = []

    class Config:
        from_attributes = True


# ── Costing ───────────────────────────────────────────────────────────────────

class IngredientCost(BaseModel):
    ingredient_variant_id: str
    description: Optional[str] = None
    qty_effective: Decimal       # qty × (1 + waste)
    unit_cost: Decimal
    line_cost: Decimal


class RecipeCost(BaseModel):
    recipe_id: int
    yield_qty: Decimal
    total_cost: Decimal          # costo total del rendimiento
    cost_per_portion: Decimal
    sale_price: Optional[Decimal] = None
    margin: Optional[Decimal] = None        # precio - costo_por_porción
    margin_pct: Optional[Decimal] = None
    ingredients: List[IngredientCost] = []
