import client from './client'

export interface Employee {
  id: number
  user_id: number | null
  first_name: string | null
  last_name: string | null
  employee_type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN'
  hire_date: string | null
  base_branch_id: number | null
  is_active: boolean
  curp: string | null
  rfc: string | null
  nss: string | null
  birth_date: string | null
  civil_status: string | null
  gender: string | null
  phone: string | null
  email_personal: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  bank_name: string | null
  bank_account: string | null
}

export interface EmployeeCreate {
  first_name: string
  last_name: string
  employee_type?: Employee['employee_type']
  hire_date?: string
  base_branch_id?: number | null
  phone?: string
  email_personal?: string
}

export interface AttendanceRecord {
  id: number
  employee_id: number
  employee_name: string | null
  check_in: string
  check_out: string | null
  branch_id: number
  notes: string | null
}

export const hrApi = {
  getMe: async (): Promise<Employee> => {
    const { data } = await client.get<Employee>('/hr/employees/me')
    return data
  },

  updateMe: async (payload: Partial<Employee>): Promise<Employee> => {
    const { data } = await client.put<Employee>('/hr/employees/me', payload)
    return data
  },

  getAll: async (params?: { skip?: number; limit?: number; active_only?: boolean }): Promise<Employee[]> => {
    const { data } = await client.get<Employee[]>('/hr/employees', { params })
    return Array.isArray(data) ? data : (data as any)?.items ?? []
  },

  getById: async (id: number): Promise<Employee> => {
    const { data } = await client.get<Employee>(`/hr/employees/${id}`)
    return data
  },

  create: async (payload: EmployeeCreate): Promise<Employee> => {
    const { data } = await client.post<Employee>('/hr/employees', payload)
    return data
  },

  update: async (id: number, payload: Partial<Employee>): Promise<Employee> => {
    const { data } = await client.put<Employee>(`/hr/employees/${id}`, payload)
    return data
  },

  getAttendanceReport: async (params: { start_date: string; end_date: string; branch_id?: number; employee_id?: number }): Promise<AttendanceRecord[]> => {
    const { data } = await client.get<AttendanceRecord[]>('/hr/attendance/report', { params })
    return Array.isArray(data) ? data : (data as any)?.items ?? []
  },
}

/** Helper: construye nombre completo desde first_name + last_name */
export function employeeFullName(e: Pick<Employee, 'first_name' | 'last_name'>): string {
  return [e.first_name, e.last_name].filter(Boolean).join(' ') || '—'
}
