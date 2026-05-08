import client from './client'

export interface KardexMovement {
  id: number
  movement_type: string
  qty_change: number
  qty_after: number
  reference: string | null
  created_at: string
  user_name: string
}

export interface AdjustmentCreate {
  variant_id: string
  quantity: number
  branch_id: number
  reason: string
  notes?: string
}

export interface TransferCreate {
  variant_id: string
  from_branch_id: number
  to_branch_id: number
  quantity: number
  reason?: string
}

export const inventoryApi = {
  getKardex: async (variantId: string, branchId?: number): Promise<KardexMovement[]> => {
    const { data } = await client.get<KardexMovement[]>(`/inventory/kardex/${variantId}`, {
      params: branchId ? { branch_id: branchId } : undefined,
    })
    return data
  },

  createAdjustment: async (payload: AdjustmentCreate): Promise<KardexMovement> => {
    const { data } = await client.post<KardexMovement>('/inventory/adjust', payload)
    return data
  },

  transferStock: async (payload: TransferCreate): Promise<{ message: string }> => {
    const { data } = await client.post<{ message: string }>('/inventory/transfer', payload)
    return data
  },
}
