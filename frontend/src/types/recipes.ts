export interface RecipeIngredient {
  id?: number
  ingredient_variant_id: string
  qty: number | string
  unit?: string | null
  waste_pct: number | string
}

export interface Recipe {
  id: number
  organization_id: number
  product_variant_id: string
  name: string
  yield_qty: number | string
  notes: string | null
  is_active: boolean
  ingredients: RecipeIngredient[]
}

export interface IngredientCost {
  ingredient_variant_id: string
  description: string | null
  qty_effective: number | string
  unit_cost: number | string
  line_cost: number | string
}

export interface RecipeCost {
  recipe_id: number
  yield_qty: number | string
  total_cost: number | string
  cost_per_portion: number | string
  sale_price: number | string | null
  margin: number | string | null
  margin_pct: number | string | null
  ingredients: IngredientCost[]
}
