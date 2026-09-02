export type CashSessionStatus = 'OPEN' | 'CLOSED'

// Alerta de cierre (Task 6): antes se calculaba en el backend y se descartaba
// sin llegar nunca al HTTP response. Ver app/schemas/cash.py::CashSessionRead.
export interface CashWarning {
  code: string
  severity: string
  message: string
  threshold?: number
  actual?: number
}

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
  warnings?: CashWarning[]         // solo poblado por /cash/close y /cash/sessions/{id}/close-guided
}

export interface CashMovement {
  id: number
  session_id: number
  type: 'IN' | 'OUT'
  amount: number
  concept: string
  created_at: string
}
