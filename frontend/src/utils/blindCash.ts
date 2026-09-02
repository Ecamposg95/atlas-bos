/**
 * Corte de caja — CONTEO CIEGO.
 *
 * El monto esperado se oculta hasta que el cajero captura su conteo físico.
 *
 * Por qué: al abrir el modal de cierre se pre-llenaba el campo "contado" con
 * el esperado, así que bastaba dar clic para cerrar con diferencia $0.00.
 * Un faltante real quedaba enmascarado por el auto-cuadre y el control de caja
 * dejaba de detectar nada.
 *
 * No toca el backend ni el cálculo de `expected_cash`: cambia CUÁNDO y CÓMO
 * se muestra.
 *
 * Portado de Atlas-Rmazh (F2 · S13-fe).
 */

/** Valor enmascarado que ocupa el lugar del monto mientras rige el conteo ciego. */
export const BLIND_MASK = '****'

/** Nota corta que acompaña al valor enmascarado. */
export const BLIND_LABEL = 'Conteo ciego'

/**
 * ¿El texto capturado es un conteo numérico válido?
 *
 * Guard del botón de cierre: sin esto, un campo vacío o con basura se convertía
 * en `NaN` y podía cerrar el turno en $0.00 silenciosamente.
 */
export function isValidCount(counted: string): boolean {
  const t = (counted ?? '').trim()
  if (t === '') return false
  const n = Number(t)
  return Number.isFinite(n) && n >= 0
}

/**
 * En el modal de cierre: el esperado y la diferencia se revelan sólo cuando el
 * cajero ya capturó un conteo válido.
 */
export function shouldRevealExpected(counted: string): boolean {
  return isValidCount(counted)
}

/**
 * En el tablero de sucursal: el indicador "Efectivo esperado" se enmascara
 * mientras hay un turno abierto. Una vez cerrado no hay nada que adivinar.
 */
export function shouldShowExpectedKpi(hasOpenSession: boolean): boolean {
  return !hasOpenSession
}
