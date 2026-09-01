import client from './client'
import type {
  KdsStatus,
  KitchenStation,
  KitchenStats,
  KitchenTicket,
} from '../types/kitchen'

export interface FireItem {
  variant_id?: string | null
  description: string
  qty?: number
  modifiers?: string[]
  station_id?: number
}

export interface FirePayload {
  branch_id: number
  table_id?: number | null
  parked_ticket_id?: string | null
  notes?: string | null
  items: FireItem[]
}

export const kitchenApi = {
  listStations: (branchId?: number) =>
    client.get<KitchenStation[]>('/kitchen/stations', { params: { branch_id: branchId } }).then((r) => r.data),

  createStation: (payload: { name: string; branch_id: number; sort_order?: number }) =>
    client.post<KitchenStation>('/kitchen/stations', payload).then((r) => r.data),

  fire: (payload: FirePayload) =>
    client.post<KitchenTicket>('/kitchen/tickets', payload).then((r) => r.data),

  feed: (params: { branch_id?: number; station_id?: number; status?: KdsStatus } = {}) =>
    client.get<KitchenTicket[]>('/kitchen/tickets', { params }).then((r) => r.data),

  bumpTicket: (id: number, stationId?: number) =>
    client.post<KitchenTicket>(`/kitchen/tickets/${id}/bump`, null, { params: { station_id: stationId } }).then((r) => r.data),

  recallTicket: (id: number) =>
    client.post<KitchenTicket>(`/kitchen/tickets/${id}/recall`).then((r) => r.data),

  cancelTicket: (id: number) =>
    client.post<KitchenTicket>(`/kitchen/tickets/${id}/cancel`).then((r) => r.data),

  bumpItem: (itemId: number) =>
    client.post<KitchenTicket>(`/kitchen/items/${itemId}/bump`).then((r) => r.data),

  voidItem: (itemId: number) =>
    client.post<KitchenTicket>(`/kitchen/items/${itemId}/void`).then((r) => r.data),

  stats: (branchId?: number) =>
    client.get<KitchenStats>('/kitchen/stats', { params: { branch_id: branchId } }).then((r) => r.data),
}
