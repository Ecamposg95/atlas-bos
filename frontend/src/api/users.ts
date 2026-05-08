import client from './client'

export interface SystemUser {
  id: number
  username: string
  full_name: string | null
  role: string
  branch_id: number | null
  branch_name: string | null
  is_active: boolean
  created_at: string
}

export interface CreateUserPayload {
  username: string
  password: string
  full_name?: string
  role: string
  branch_id?: number | null
}

export interface UpdateUserPayload {
  full_name?: string
  role?: string
  branch_id?: number | null
  is_active?: boolean
  password?: string
}

export const usersApi = {
  getAll: async (skip = 0, limit = 100): Promise<SystemUser[]> => {
    const { data } = await client.get<SystemUser[]>('/users/', { params: { skip, limit } })
    return Array.isArray(data) ? data : (data as any)?.items ?? []
  },

  getById: async (id: number): Promise<SystemUser> => {
    const { data } = await client.get<SystemUser>(`/users/${id}`)
    return data
  },

  create: async (payload: CreateUserPayload): Promise<SystemUser> => {
    const { data } = await client.post<SystemUser>('/users/', payload)
    return data
  },

  update: async (id: number, payload: UpdateUserPayload): Promise<SystemUser> => {
    const { data } = await client.put<SystemUser>(`/users/${id}`, payload)
    return data
  },

  delete: async (id: number): Promise<SystemUser> => {
    const { data } = await client.delete<SystemUser>(`/users/${id}`)
    return data
  },
}
