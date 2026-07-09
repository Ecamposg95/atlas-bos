import client from './client'

export type BottleStatus = 'OPEN' | 'EMPTY' | 'ARCHIVED'

export interface BarBottle {
  id: number
  branch_id: number
  variant_id: number | null
  name: string
  full_volume_ml: number
  remaining_ml: number
  pour_size_ml: number
  status: BottleStatus
  pct_remaining: number
}

export interface BottleCreate {
  branch_id: number
  name: string
  variant_id?: number | null
  full_volume_ml?: number
  pour_size_ml?: number
}

export const barApi = {
  list: async (params?: { branch_id?: number; include_archived?: boolean }): Promise<BarBottle[]> => {
    const { data } = await client.get<BarBottle[]>('/bar/bottles', { params })
    return data
  },
  open: async (payload: BottleCreate): Promise<BarBottle> => {
    const { data } = await client.post<BarBottle>('/bar/bottles', payload)
    return data
  },
  pour: async (id: number, body: { ml?: number; count?: number }): Promise<BarBottle> => {
    const { data } = await client.post<BarBottle>(`/bar/bottles/${id}/pour`, body)
    return data
  },
  waste: async (id: number, body: { ml: number; reason?: string }): Promise<BarBottle> => {
    const { data } = await client.post<BarBottle>(`/bar/bottles/${id}/waste`, body)
    return data
  },
  refill: async (id: number, remaining_ml: number): Promise<BarBottle> => {
    const { data } = await client.post<BarBottle>(`/bar/bottles/${id}/refill`, { remaining_ml })
    return data
  },
  archive: async (id: number): Promise<void> => {
    await client.delete(`/bar/bottles/${id}`)
  },
}
