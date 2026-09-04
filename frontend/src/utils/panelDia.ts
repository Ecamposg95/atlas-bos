import type { DailySummary, SalesByHourResponse } from '../api/reports'
import type { CorteDeSucursal } from '../api/cash'

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

/** Roles de oficina central: los únicos que pueden mirar fuera de su sucursal. */
const ROLES_DE_OFICINA = ['ADMINISTRADOR', 'DUEÑO', 'GERENTE']

/** Lo mínimo que el panel necesita saber de una sucursal. */
export interface SucursalMinima {
  id: number
  name: string
  can_sell?: boolean
  is_active?: boolean
}

export interface AmbitoPanel {
  /**
   * Qué mandar en `branch_id` a `daily-summary` y `sales-by-hour`. `0` es la
   * convención del backend para "toda la organización" y solo la honra un rol
   * de oficina central; `undefined` deja que el backend se quede con la
   * sucursal del usuario.
   */
  branchId: number | undefined
  /** Lo que la cabecera dice que está mirando. La cifra debe decir su ámbito. */
  etiqueta: string
  /** Sucursales cuyo corte se consulta (`/cash/branch-summary` es por sucursal). */
  sucursalesDelCorte: number[]
}

/**
 * De qué habla el panel. Sin esto, un ADMINISTRADOR anclado a la oficina
 * central —la forma canónica en este repo— veía $0.00 en todo el panel bajo el
 * nombre de su organización, y un dueño con varias sucursales veía una sola
 * presentada como el negocio completo.
 */
export function ambitoDelPanel(
  rol: string | null | undefined,
  sucursalDelUsuario: number | null | undefined,
  sucursales: SucursalMinima[],
): AmbitoPanel {
  const activas = sucursales.filter((s) => s.is_active !== false)

  if (!rol || !ROLES_DE_OFICINA.includes(rol)) {
    // Rol sin oficina central: el backend lo deja en su sucursal mande lo que
    // mande, así que el panel ni siquiera manda el parámetro.
    const propia = activas.find((s) => s.id === sucursalDelUsuario)
    return {
      branchId: undefined,
      etiqueta: propia?.name ?? 'Tu sucursal',
      sucursalesDelCorte: sucursalDelUsuario ? [sucursalDelUsuario] : [],
    }
  }

  // Las que venden. Si ninguna está marcada así (dato mal capturado), se cae a
  // todas las activas: es preferible consultar de más que dejar el bloque del
  // corte vacío sin explicación.
  const venden = activas.filter((s) => s.can_sell !== false)
  const delCorte = venden.length > 0 ? venden : activas

  let etiqueta = 'Toda la organización'
  if (delCorte.length === 1) etiqueta = delCorte[0].name
  else if (delCorte.length > 1) etiqueta = `Todas las sucursales (${delCorte.length})`

  return {
    branchId: 0,
    etiqueta,
    sucursalesDelCorte: delCorte.map((s) => s.id),
  }
}

export interface EstadoCorte {
  sucursal: string
  /** No hubo ni un turno de caja en esa sucursal ese día. */
  sinCortes: boolean
  abiertas: number
  cerradas: number
  /** Efectivo esperado de los turnos abiertos. `null` si no hay ninguno. */
  deberiaHaber: number | null
  /** Contado al cerrar, sumando los turnos cerrados. `null` si no hay ninguno. */
  contado: number | null
  esperadoCerrado: number | null
  diferencia: number | null
}

const dosDecimales = (n: number) => Math.round(n * 100) / 100

/**
 * Estado del corte a partir de `GET /api/cash/branch-summary`.
 *
 * Aquí NO se calcula nada del efectivo esperado: `expected_cash` viene de
 * `compute_expected_cash` (app/services/cash_reconciliation.py), fuente única
 * del sistema, con el fondo, el efectivo neto, las entradas y salidas manuales
 * y las devoluciones en efectivo ya aplicadas. La versión anterior replicaba
 * la fórmula en el frontend como `fondo + efectivo del día`: un retiro de
 * $3,000 pintaba $5,500 con $2,500 en el cajón.
 *
 * Esta función solo agrega: suma turnos de la misma sucursal y los separa en
 * abiertos (lo que debería haber ahora) y cerrados (lo que se contó y cuánto
 * se desvió). Los cerrados eran invisibles porque `/cash/status` solo devuelve
 * sesiones OPEN: el dueño que revisaba su corte a las 21:30 leía "No hay caja
 * abierta".
 */
export function estadoDelCorte(resumen: CorteDeSucursal): EstadoCorte {
  const cajeros = resumen.cashiers ?? []
  const abiertas = cajeros.filter((c) => c.status === 'OPEN')
  const cerradas = cajeros.filter((c) => c.status === 'CLOSED')

  const suma = (xs: number[]) => dosDecimales(xs.reduce((a, b) => a + b, 0))

  return {
    sucursal: resumen.branch_name,
    sinCortes: cajeros.length === 0,
    abiertas: abiertas.length,
    cerradas: cerradas.length,
    // Un esperado de $0.00 es una cifra legítima (día sin ventas y sin fondo),
    // distinta de "no hay turno abierto": por eso `null` solo cuando no hay.
    deberiaHaber: abiertas.length ? suma(abiertas.map((c) => c.expected_cash)) : null,
    contado: cerradas.length ? suma(cerradas.map((c) => c.closing_balance)) : null,
    esperadoCerrado: cerradas.length ? suma(cerradas.map((c) => c.expected_cash)) : null,
    // `difference` del endpoint se recalcula en vivo contra el esperado
    // canónico; el `difference` persistido de la sesión no debe leerse.
    diferencia: cerradas.length ? suma(cerradas.map((c) => c.difference)) : null,
  }
}
