import type { DailySummary } from '../api/reports'

export interface ResumenDia {
  venta: number
  tickets: number
  utilidad: number
  ticketPromedio: number
  pagos: { metodo: string; total: number }[]
  masVendidos: { nombre: string; piezas: number }[]
}

/** Traduce la respuesta cruda de `daily-summary` a lo que el panel dibuja. */
export function resumirDia(s: DailySummary): ResumenDia {
  const tickets = s.transactions_count ?? 0
  const venta = s.total_revenue ?? 0
  return {
    venta,
    tickets,
    utilidad: s.gross_profit ?? 0,
    ticketPromedio: tickets > 0 ? venta / tickets : 0,
    pagos: Object.entries(s.payments ?? {})
      .map(([metodo, total]) => ({ metodo, total }))
      .sort((a, b) => b.total - a.total),
    masVendidos: (s.top_selling_items ?? []).map((p) => ({
      nombre: p.name,
      piezas: p.quantity,
    })),
  }
}
