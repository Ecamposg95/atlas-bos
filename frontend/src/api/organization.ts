import client from './client'

export interface Organization {
  id: number
  name: string
  tax_id: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  ticket_header: string | null
  ticket_footer: string | null
  industry_type: string | null
}

export interface Branch {
  id: number
  name: string
  branch_type: 'HQ' | 'STORE' | 'WAREHOUSE' | 'OFFICE'
  address: string | null
  phone: string | null
  is_headquarters: boolean
  is_active: boolean
  // El backend siempre lo manda (BranchRead); opcional aquí porque varias
  // pantallas construyen sucursales parciales para sus propios listados.
  can_sell?: boolean
}

export interface BranchCreate {
  name: string
  branch_type: Branch['branch_type']
  address?: string
  phone?: string
}

export const organizationApi = {
  getOrg: async (): Promise<Organization> => {
    const { data } = await client.get<Organization>('/organization/')
    return data
  },

  updateOrg: async (payload: Partial<Organization>): Promise<Organization> => {
    const { data } = await client.put<Organization>('/organization/', payload)
    return data
  },

  getBranches: async (): Promise<Branch[]> => {
    const { data } = await client.get<Branch[]>('/branches/')
    return Array.isArray(data) ? data : (data as any)?.items ?? []
  },

  createBranch: async (payload: BranchCreate): Promise<Branch> => {
    const { data } = await client.post<Branch>('/branches/', payload)
    return data
  },

  updateBranch: async (id: number, payload: Partial<BranchCreate>): Promise<Branch> => {
    const { data } = await client.put<Branch>(`/branches/${id}`, payload)
    return data
  },

  deleteBranch: async (id: number): Promise<void> => {
    await client.delete(`/branches/${id}`)
  },
}
