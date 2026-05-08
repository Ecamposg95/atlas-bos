import client from './client'

export type CashAuditEventType =
  | 'SALE_CREATED'
  | 'PAYMENT_RECORDED'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED'
  | 'MANUAL_INFLOW'
  | 'MANUAL_OUTFLOW'
  | 'SESSION_OPENED'
  | 'SESSION_CLOSED'
  | 'INVARIANT_FAILED'
  | 'CLOSURE_WARNING'

export interface CashAuditEvent {
  id: number
  ts: string | null
  event_type: CashAuditEventType | string
  amount: number | null
  user_id: number | null
  related_table: string | null
  related_id: string | null
  payload: Record<string, any> | null
  expected_running_total: number | null
}

export interface CashAuditLogResponse {
  session_id: number
  branch_id: number
  events: CashAuditEvent[]
}

export interface CashSessionSummary {
  session: {
    id: number
    user_name: string
    branch_name: string
    organization_name: string
    opened_at: string
    closed_at: string | null
    opening_balance: number
    closing_balance: number
  }
  payments: Record<string, { total: number; count: number }>
  movements: { inflows: number; outflows: number; list: any[] }
  returns: { count: number; total: number; cash_refunds: number }
  kpis: {
    total_sales: number
    total_tickets: number
    avg_ticket: number
    total_taxes: number
    subtotal: number
  }
  expected: { cash_physical: number; total_system: number }
  reconciliation: { reported: number; difference: number; diff_percent: number }
}

export const cashAuditApi = {
  getAuditLog: (sessionId: number) =>
    client
      .get<CashAuditLogResponse>(`/cash/${sessionId}/audit-log`)
      .then((r) => r.data),

  getSummary: (sessionId: number) =>
    client
      .get<CashSessionSummary>(`/cash/summary`, { params: { session_id: sessionId } })
      .then((r) => r.data),
}
