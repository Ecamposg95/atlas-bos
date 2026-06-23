import client from './client'
import type { DiningArea, DiningTable, TableStatus } from '../types/tables'

export interface AreaPayload {
  name: string
  branch_id: number
  sort_order?: number
}

export interface TablePayload {
  code: string
  branch_id: number
  area_id?: number | null
  seats?: number
}

export const tablesApi = {
  listAreas: (branchId?: number) =>
    client.get<DiningArea[]>('/tables/areas', { params: { branch_id: branchId } }).then((r) => r.data),

  createArea: (payload: AreaPayload) =>
    client.post<DiningArea>('/tables/areas', payload).then((r) => r.data),

  listTables: (branchId?: number, areaId?: number) =>
    client.get<DiningTable[]>('/tables/', { params: { branch_id: branchId, area_id: areaId } }).then((r) => r.data),

  createTable: (payload: TablePayload) =>
    client.post<DiningTable>('/tables/', payload).then((r) => r.data),

  open: (id: number, body: { customer_id?: number } = {}) =>
    client.post<DiningTable>(`/tables/${id}/open`, body).then((r) => r.data),

  free: (id: number) =>
    client.post<DiningTable>(`/tables/${id}/free`).then((r) => r.data),

  transfer: (id: number, targetTableId: number) =>
    client.post<DiningTable>(`/tables/${id}/transfer`, { target_table_id: targetTableId }).then((r) => r.data),

  setStatus: (id: number, status: TableStatus) =>
    client.patch<DiningTable>(`/tables/${id}/status`, { status }).then((r) => r.data),

  remove: (id: number) => client.delete(`/tables/${id}`).then((r) => r.data),
}
