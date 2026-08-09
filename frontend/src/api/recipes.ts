import client from './client'
import type { Recipe, RecipeCost, RecipeIngredient } from '../types/recipes'

export interface RecipePayload {
  product_variant_id: string
  name: string
  yield_qty?: number
  notes?: string | null
  is_active?: boolean
  ingredients?: RecipeIngredient[]
}

export const recipesApi = {
  list: (activeOnly = true) =>
    client.get<Recipe[]>('/recipes/', { params: { active_only: activeOnly } }).then((r) => r.data),

  getById: (id: number) =>
    client.get<Recipe>(`/recipes/${id}`).then((r) => r.data),

  create: (payload: RecipePayload) =>
    client.post<Recipe>('/recipes/', payload).then((r) => r.data),

  update: (id: number, payload: Partial<RecipePayload>) =>
    client.put<Recipe>(`/recipes/${id}`, payload).then((r) => r.data),

  remove: (id: number) =>
    client.delete(`/recipes/${id}`).then((r) => r.data),

  cost: (id: number) =>
    client.get<RecipeCost>(`/recipes/${id}/cost`).then((r) => r.data),
}
