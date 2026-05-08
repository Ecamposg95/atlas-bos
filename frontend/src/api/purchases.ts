import client from './client'

export type POStatus = 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrder {
  id: number
  folio: string | null
  supplier_name: string
  supplier_contact: string | null
  branch_id: number | null
  branch_name: string | null
  status: POStatus
  notes: string | null
  total: number
  received_total: number
  created_by: string | null
  created_at: string
  received_at: string | null
  lines: POLine[]
}

export interface POLine {
  id: number
  variant_id: string | null
  product_name: string
  sku: string | null
  qty_ordered: number
  qty_received: number
  unit_cost: number
  line_total: number
}

export interface POStats {
  total_month: number
  active_orders: number
  total_historic: number
  top_supplier: string | null
}

export interface POCreate {
  supplier_name: string
  supplier_contact?: string
  branch_id?: number
  notes?: string
  lines: { variant_id?: string; product_name: string; sku?: string; qty_ordered: number; unit_cost: number }[]
}

export const purchasesApi = {
  getStats: async (): Promise<POStats> => {
    const { data } = await client.get<POStats>('/purchases/stats')
    return data
  },

  list: async (params?: { status?: POStatus; skip?: number; limit?: number; date_start?: string; date_end?: string }): Promise<{ total: number; items: PurchaseOrder[] }> => {
    const { data } = await client.get<{ total: number; items: PurchaseOrder[] }>('/purchases/', { params })
    if (Array.isArray(data)) return { items: data, total: data.length }
    return { items: data?.items ?? [], total: data?.total ?? 0 }
  },

  getById: async (id: number): Promise<PurchaseOrder> => {
    const { data } = await client.get<PurchaseOrder>(`/purchases/${id}`)
    return data
  },

  create: async (payload: POCreate): Promise<PurchaseOrder> => {
    const { data } = await client.post<PurchaseOrder>('/purchases/', payload)
    return data
  },

  updateStatus: async (id: number, status: POStatus): Promise<PurchaseOrder> => {
    const { data } = await client.patch<PurchaseOrder>(`/purchases/${id}/status`, null, { params: { new_status: status } })
    return data
  },

  receive: async (id: number, lines: { line_id: number; qty_received: number }[]): Promise<PurchaseOrder> => {
    const { data } = await client.post<PurchaseOrder>(`/purchases/${id}/receive`, { lines })
    return data
  },

  cancel: async (id: number): Promise<void> => {
    await client.delete(`/purchases/${id}`)
  },
}
