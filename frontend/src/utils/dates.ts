/**
 * Utilities de fecha/hora para el frontend.
 *
 * Consolida helpers que vivían duplicados en varias pantallas
 * (`todayStr`, `daysAgoStr`) y agrega formateo con presets, parseo
 * y comparaciones comunes. Locale por defecto `es-MX`.
 */

export const DEFAULT_LOCALE = 'es-MX'

// Cache de formatters — Intl.DateTimeFormat tiene costo de construcción.
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getDateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`
  let fmt = dateTimeFormatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    dateTimeFormatterCache.set(key, fmt)
  }
  return fmt
}

/**
 * Devuelve la fecha actual local en formato `YYYY-MM-DD`
 * (el formato ISO-like que aceptan los `<input type="date">` y los
 * filtros de endpoints tipo `?start_date=...`).
 *
 * Usa `en-CA` porque ese locale produce exactamente `YYYY-MM-DD`.
 *
 * @example
 *   todayStr() // "2026-04-17"
 */
export function todayStr(): string {
  return new Date().toLocaleDateString('en-CA')
}

/**
 * Devuelve la fecha de hace `days` días (local) en formato `YYYY-MM-DD`.
 *
 * @example
 *   daysAgoStr(7)  // "2026-04-10"
 *   daysAgoStr(0)  // today
 */
export function daysAgoStr(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('en-CA')
}

/** Presets soportados por `formatDate`. */
export type DateFormat =
  | 'short' // "17 abr"
  | 'medium' // "17 abr 2026"
  | 'long' // "17 de abril de 2026"
  | 'iso' // "2026-04-17"
  | 'datetime' // "17 abr 2026, 15:42"
  | 'time' // "15:42"
  | 'relative' // "hace 2 días"

const PRESETS: Record<Exclude<DateFormat, 'relative' | 'iso'>, Intl.DateTimeFormatOptions> = {
  short: { day: '2-digit', month: 'short' },
  medium: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  datetime: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  time: { hour: '2-digit', minute: '2-digit' },
}

/**
 * Formatea una fecha (Date o string ISO) con un preset común.
 *
 * @example
 *   formatDate(new Date(), 'medium')  // "17 abr 2026"
 *   formatDate('2026-04-17', 'long')  // "17 de abril de 2026"
 *   formatDate(new Date(), 'relative') // "hace un momento"
 *   formatDate(null)                  // "—"
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  format: DateFormat = 'medium',
  locale: string = DEFAULT_LOCALE,
): string {
  if (value === null || value === undefined || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(d.getTime())) return '—'
  if (format === 'iso') return d.toLocaleDateString('en-CA')
  if (format === 'relative') return formatRelative(d, locale)
  return getDateTimeFormatter(locale, PRESETS[format]).format(d)
}

function formatRelative(d: Date, locale: string): string {
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(diffMin) < 1) return 'hace un momento'
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute')
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, 'hour')
  const diffDay = Math.round(diffHr / 24)
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, 'day')
  const diffMonth = Math.round(diffDay / 30)
  if (Math.abs(diffMonth) < 12) return rtf.format(-diffMonth, 'month')
  return rtf.format(-Math.round(diffMonth / 12), 'year')
}

/**
 * Parsea un string de fecha. Acepta ISO (`2026-04-17`), con hora
 * (`2026-04-17T15:42:00Z`) y formato local. Devuelve `null` si el
 * string no es parseable.
 */
export function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null
  const d = new Date(str)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Diferencia en días enteros entre dos fechas (b - a). Ignora horas. */
export function daysBetween(a: Date | string, b: Date | string): number {
  const da = a instanceof Date ? a : new Date(a)
  const db = b instanceof Date ? b : new Date(b)
  const ms = db.getTime() - da.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/** Devuelve `true` si la fecha es hoy (en zona local). */
export function isToday(value: Date | string): boolean {
  const d = value instanceof Date ? value : new Date(value)
  const today = new Date()
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
}

/** Devuelve `true` si la fecha es anterior al momento actual. */
export function isPast(value: Date | string): boolean {
  const d = value instanceof Date ? value : new Date(value)
  return d.getTime() < Date.now()
}

export default {
  todayStr,
  daysAgoStr,
  formatDate,
  parseDate,
  daysBetween,
  isToday,
  isPast,
}
