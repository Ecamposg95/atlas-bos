"""Atlas BOS module - recipes.

DOMAIN: Recetas / BOM (Recipe + RecipeIngredient, costing, inventory consumption)
STATUS: Stable

Used by presets: ATLAS_ONE_RESTAURANT, ATLAS_ONE_BAR.

A recipe maps one sellable product variant (the dish) to its raw-material
ingredients. On sale, `app/subscribers/recipes.py` deducts ingredient stock
via InventoryMovement (MovementType.RECIPE_CONSUMPTION).
"""
