import client from './client'

export interface Expense {
  id: number
  amount: number
  category: string
  description: string | null
  branch_id: number
  branch_name: string | null
  user_name: string | null
  created_at: string
}

export interface ExpenseStats {
  total_month: number
  total_week: number
  count_month: number
  avg_daily: number
  top_category: string | null
  by_category: { category: string; total: number }[]
}

export interface ExpenseCreate {
  amount: number
  category: string
  description?: string
}

export const expensesApi = {
  getStats: async (): Promise<ExpenseStats> => {
    const { data } = await client.get<ExpenseStats>('/expenses/stats')
    return data
  },

  list: async (params?: { category?: string; date_start?: string; date_end?: string; skip?: number; limit?: number }): Promise<{ total: number; items: Expense[] }> => {
    const { data } = await client.get<{ total: number; items: Expense[] }>('/expenses/', { params })
    if (Array.isArray(data)) return { items: data, total: data.length }
    return { items: data?.items ?? [], total: data?.total ?? 0 }
  },

  getCategories: async (): Promise<string[]> => {
    const { data } = await client.get<string[]>('/expenses/categories')
    return Array.isArray(data) ? data : (data as any)?.items ?? []
  },

  create: async (payload: ExpenseCreate): Promise<Expense> => {
    const { data } = await client.post<Expense>('/expenses/', payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/expenses/${id}`)
  },
}
