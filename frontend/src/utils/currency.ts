/**
 * Módulo único de formato de moneda para el frontend.
 *
 * Reemplaza instancias inline de `Intl.NumberFormat` dispersas por la app.
 * Maneja entradas nulas/inválidas devolviendo un fallback configurable
 * ("$0.00" por defecto) en lugar de `$NaN`.
 */

export interface FormatCurrencyOptions {
  /** BCP-47 locale. Default: `"es-MX"`. */
  locale?: string
  /** ISO 4217 currency code. Default: `"MXN"`. */
  currency?: string
  /** Valor que se devuelve cuando la entrada no es un número finito. Default: `"$0.00"`. */
  fallback?: string
}

// Cache de formatters — el constructor de Intl.NumberFormat es caro.
const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: 'currency', currency })
    formatterCache.set(key, fmt)
  }
  return fmt
}

/**
 * Formatea un valor numérico como moneda.
 *
 * Acepta números, strings numéricos ("1234.5"), `null` y `undefined`.
 * Si la entrada no puede convertirse a un número finito, devuelve el fallback
 * (por defecto `"$0.00"`) en lugar de `"$NaN"`.
 *
 * @example
 *   formatCurrency(1234.5)                    // "$1,234.50"
 *   formatCurrency("1234.5")                  // "$1,234.50"
 *   formatCurrency(null)                      // "$0.00"
 *   formatCurrency(42, { currency: "USD" })   // "US$42.00"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: FormatCurrencyOptions = {},
): string {
  const { locale = 'es-MX', currency = 'MXN', fallback = '$0.00' } = options
  if (value === null || value === undefined || value === '') return fallback
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return getFormatter(locale, currency).format(num)
}

/**
 * Convierte un string con formato de moneda en un número.
 *
 * Elimina símbolos comunes (`$`, espacios, separadores de miles) y parsea
 * lo restante. Si no puede extraer un número finito, devuelve `0`.
 *
 * @example
 *   parseCurrency("$1,234.50")  // 1234.5
 *   parseCurrency("MX$ 42.00")  // 42
 *   parseCurrency("abc")        // 0
 *   parseCurrency(null)         // 0
 */
export function parseCurrency(str: string | number | null | undefined): number {
  if (str === null || str === undefined || str === '') return 0
  if (typeof str === 'number') return Number.isFinite(str) ? str : 0
  // Quita todo lo que no sea dígito, punto decimal o signo negativo.
  // Elimina comas (separador de miles en es-MX).
  const cleaned = str.replace(/[^\d.,-]/g, '').replace(/,/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

/**
 * @deprecated Usa `formatCurrency` en lugar de este alias.
 * Mantenido temporalmente para compatibilidad con código existente.
 */
export const MXN = (value: number | string | null | undefined): string =>
  formatCurrency(value)

export default { formatCurrency, parseCurrency, MXN }
