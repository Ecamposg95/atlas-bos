export type CashSessionStatus = 'OPEN' | 'CLOSED'

export interface CashSession {
  id: number
  branch_id: number
  branch_name?: string | null      // enriched by some endpoints
  user_id: number
  user_name?: string | null        // enriched by some endpoints
  opening_balance: number          // matches backend CashSessionRead
  closing_balance: number | null   // matches backend CashSessionRead
  total_cash_sales?: number        // calculated field in backend
  difference?: number              // variance on close
  status: CashSessionStatus
  opened_at: string
  closed_at: string | null
  notes?: string | null
}

export interface CashMovement {
  id: number
  session_id: number
  type: 'IN' | 'OUT'
  amount: number
  concept: string
  created_at: string
}
