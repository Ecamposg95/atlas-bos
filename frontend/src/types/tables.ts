export type TableStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'BILL_REQUESTED'
  | 'CLEANING'
  | 'RESERVED'

export interface DiningArea {
  id: number
  organization_id: number
  name: string
  branch_id: number
  sort_order: number
  is_active: boolean
}

export interface DiningTable {
  id: number
  organization_id: number
  code: string
  branch_id: number
  area_id: number | null
  seats: number
  status: TableStatus
  pos_x: number | null
  pos_y: number | null
  current_ticket_id: string | null
  server_user_id: number | null
  opened_at: string | null
  is_active: boolean
}
