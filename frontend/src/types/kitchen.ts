export type KdsStatus = 'NEW' | 'IN_PROGRESS' | 'READY' | 'SERVED' | 'CANCELED'
export type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'VOIDED'

export interface KitchenStation {
  id: number
  organization_id: number
  name: string
  branch_id: number
  sort_order: number
  is_active: boolean
}

export interface KitchenTicketItem {
  id: number
  variant_id: string | null
  description: string
  qty: number | string
  modifiers: string[] | null
  station_id: number | null
  status: ItemStatus
}

export interface KitchenTicket {
  id: number
  organization_id: number
  branch_id: number
  table_id: number | null
  parked_ticket_id: string | null
  status: KdsStatus
  notes: string | null
  fired_at: string | null
  ready_at: string | null
  age_seconds: number | null
  items: KitchenTicketItem[]
}

export interface KitchenStats {
  new: number
  in_progress: number
  ready: number
  avg_prep_seconds: number | null
}
