import type { DailySummary, SalesByHourResponse } from '../api/reports'
import type { CashSession } from '../types/cash'

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

export interface BarraHora {
  hora: number
  importe: number
  tickets: number
  porcentaje: number
}

/** Franjas con venta, escaladas contra la más alta del día. */
export function barrasPorHora(r: SalesByHourResponse): BarraHora[] {
  const conVenta = (r.hourly ?? []).filter((h) => h.amount > 0)
  if (conVenta.length === 0) return []
  const tope = Math.max(...conVenta.map((h) => h.amount))
  return conVenta.map((h) => ({
    hora: h.hour,
    importe: h.amount,
    tickets: h.tickets,
    porcentaje: (h.amount / tope) * 100,
  }))
}

export interface EstadoCorte {
  situacion: 'SIN_CAJA' | 'ABIERTA' | 'CERRADA'
  fondo?: number
  deberiaHaber?: number
  contado?: number
  diferencia?: number
}

/**
 * Estado del corte para el panel. Con la caja abierta, lo que debería haber es
 * el fondo declarado más el efectivo neto del día — el mismo criterio del corte
 * (`net_cash`, ya sin el vuelto). Con la caja cerrada se reporta lo que quedó.
 *
 * `efectivoDelDia` es `number | null` a propósito: `null` significa "no lo sé"
 * (la fuente de la venta del día falló), no "no hubo efectivo". Confundir
 * ambos casos produciría un `deberiaHaber` plausible pero falso — con la caja
 * abierta, sin el dato no se calcula `deberiaHaber` en absoluto.
 */
export function estadoDelCorte(s: CashSession | null, efectivoDelDia: number | null): EstadoCorte {
  if (!s) return { situacion: 'SIN_CAJA' }
  const fondo = Number(s.opening_balance ?? 0)
  if (s.status === 'CLOSED') {
    return {
      situacion: 'CERRADA',
      fondo,
      contado: Number(s.closing_balance ?? 0),
      diferencia: Number(s.difference ?? 0),
    }
  }
  return {
    situacion: 'ABIERTA',
    fondo,
    deberiaHaber: efectivoDelDia === null ? undefined : fondo + efectivoDelDia,
  }
}
