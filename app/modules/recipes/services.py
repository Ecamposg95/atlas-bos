"""Atlas BOS modules/recipes/services — costing + inventory consumption.

`compute_cost` prices a recipe from its ingredients' base costs.
`consume_for_variant` deducts ingredient stock when a dish is sold — invoked
by the sales subscriber so the kitchen's raw materials draw down automatically.
"""
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import ProductVariant
from app.models.inventory import InventoryMovement, MovementType, StockOnHand
from app.modules.recipes.models import Recipe, RecipeIngredient
from app.modules.recipes.schemas import IngredientCost, RecipeCost

_ZERO = Decimal("0")


def _effective_qty(ingredient: RecipeIngredient) -> Decimal:
    """Ingredient qty inflated by its waste percentage."""
    waste = Decimal(ingredient.waste_pct or 0) / Decimal("100")
    return Decimal(ingredient.qty) * (Decimal("1") + waste)


def compute_cost(db: Session, recipe: Recipe) -> RecipeCost:
    """Cost the full recipe yield + margin against the dish's sale price."""
    lines: List[IngredientCost] = []
    total = _ZERO
    for ing in recipe.ingredients:
        variant = ing.ingredient_variant
        unit_cost = Decimal(variant.cost) if variant and variant.cost is not None else _ZERO
        qty_eff = _effective_qty(ing)
        line_cost = (qty_eff * unit_cost).quantize(Decimal("0.0001"))
        total += line_cost
        lines.append(IngredientCost(
            ingredient_variant_id=ing.ingredient_variant_id,
            description=variant.variant_name if variant else None,
            qty_effective=qty_eff,
            unit_cost=unit_cost,
            line_cost=line_cost,
        ))

    yield_qty = Decimal(recipe.yield_qty) if recipe.yield_qty else Decimal("1")
    cost_per_portion = (total / yield_qty).quantize(Decimal("0.0001")) if yield_qty else total

    sale_price: Optional[Decimal] = None
    margin: Optional[Decimal] = None
    margin_pct: Optional[Decimal] = None
    if recipe.variant and recipe.variant.price is not None:
        sale_price = Decimal(recipe.variant.price)
        margin = (sale_price - cost_per_portion).quantize(Decimal("0.01"))
        if sale_price > 0:
            margin_pct = ((margin / sale_price) * Decimal("100")).quantize(Decimal("0.01"))

    return RecipeCost(
        recipe_id=recipe.id,
        yield_qty=yield_qty,
        total_cost=total.quantize(Decimal("0.01")),
        cost_per_portion=cost_per_portion.quantize(Decimal("0.01")),
        sale_price=sale_price,
        margin=margin,
        margin_pct=margin_pct,
        ingredients=lines,
    )


def consume_for_variant(
    db: Session,
    *,
    organization_id: int,
    branch_id: int,
    variant_id: str,
    qty_sold: Decimal,
    reference: Optional[str] = None,
    user_id: Optional[int] = None,
) -> List[InventoryMovement]:
    """Deduct recipe ingredients from inventory for a sold dish.

    Looks up the recipe for `variant_id`. For each ingredient, the consumed
    quantity is `qty_sold / yield × qty × (1 + waste)`. Writes a
    RECIPE_CONSUMPTION InventoryMovement per ingredient and updates StockOnHand
    (creating the stock row if missing; stock may go negative — raw materials
    aren't blocked at the POS). Does NOT commit — the caller owns the txn.

    Returns the movements created (empty list if the variant has no recipe).
    """
    recipe = (
        db.query(Recipe)
        .filter(
            Recipe.organization_id == organization_id,
            Recipe.product_variant_id == variant_id,
            Recipe.is_active == True,  # noqa: E712
        )
        .first()
    )
    if recipe is None:
        return []

    qty_sold = Decimal(qty_sold)
    yield_qty = Decimal(recipe.yield_qty) if recipe.yield_qty else Decimal("1")
    factor = qty_sold / yield_qty if yield_qty else qty_sold

    movements: List[InventoryMovement] = []
    for ing in recipe.ingredients:
        qty_needed = (_effective_qty(ing) * factor).quantize(Decimal("0.01"))
        if qty_needed == _ZERO:
            continue

        stock = (
            db.query(StockOnHand)
            .filter(
                StockOnHand.branch_id == branch_id,
                StockOnHand.variant_id == ing.ingredient_variant_id,
            )
            .first()
        )
        qty_before = Decimal(stock.qty_on_hand) if stock else _ZERO
        qty_after = qty_before - qty_needed

        if stock is None:
            stock = StockOnHand(
                organization_id=organization_id,
                branch_id=branch_id,
                variant_id=ing.ingredient_variant_id,
                qty_on_hand=qty_after,
            )
            db.add(stock)
        else:
            stock.qty_on_hand = qty_after

        mv = InventoryMovement(
            organization_id=organization_id,
            branch_id=branch_id,
            variant_id=ing.ingredient_variant_id,
            user_id=user_id,
            movement_type=MovementType.RECIPE_CONSUMPTION,
            qty_change=-qty_needed,
            qty_before=qty_before,
            qty_after=qty_after,
            reference=reference,
            notes=f"Receta: {recipe.name}",
        )
        db.add(mv)
        movements.append(mv)

    return movements
