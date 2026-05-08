import client from './client'

export interface QuoteStats {
  total_count: number
  total_amount: number
  pending_count: number
  pending_amount: number
  cancelled_count: number
}

export interface Quote {
  id: string
  series: string | null
  folio: number | null
  doc_type: string
  status: string
  customer_id: number | null
  customer_name: string | null
  subtotal: number
  tax_amount: number
  total_amount: number
  created_at: string
  lines: QuoteItem[]
  payments: { method: string; amount: number }[]
}

export interface QuoteItem {
  id: string
  variant_id: string
  sku: string | null
  description: string | null
  quantity: number
  unit_price: number
  total_line: number
}

export interface QuoteCreate {
  doc_type?: string
  customer_id?: number | null
  items: { sku: string; quantity: number; unit_price?: number }[]
  payments: { method: string; amount: number; reference?: string }[]
}

export const quotesApi = {
  getStats: async (): Promise<QuoteStats> => {
    const { data } = await client.get<QuoteStats>('/quotes/stats/kpi')
    return data
  },

  list: async (params?: { skip?: number; limit?: number; status?: string }): Promise<{ items: Quote[]; total: number }> => {
    const { data } = await client.get<{ items: Quote[]; total: number }>('/quotes/', {
      params: { doc_type: 'QUOTE', ...params },
    })
    if (Array.isArray(data)) return { items: data, total: data.length }
    return { items: data?.items ?? [], total: data?.total ?? 0 }
  },

  getById: async (id: string): Promise<Quote> => {
    const { data } = await client.get<Quote>(`/quotes/${id}`)
    return data
  },

  create: async (payload: QuoteCreate): Promise<{ status: string; quote_id: string; folio: string }> => {
    const { data } = await client.post<{ status: string; quote_id: string; folio: string }>('/quotes/', payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/quotes/${id}`)
  },

  convertToSale: async (id: string, paymentMethod: string): Promise<{ status: string; new_folio: string }> => {
    const { data } = await client.post<{ status: string; new_folio: string }>(
      `/quotes/${id}/convert-to-sale`,
      null,
      { params: { payment_method: paymentMethod } }
    )
    return data
  },

  getPdf: async (id: number): Promise<Blob> => {
    const { data } = await client.get<Blob>(`/quotes/${id}/pdf`, { responseType: 'blob' })
    return data
  },
}
