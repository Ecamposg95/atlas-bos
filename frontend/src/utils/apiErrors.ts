/**
 * Traduce el error de un 422 en marcas por campo.
 *
 * FastAPI responde a un fallo de validación con `detail` como **lista** de
 * objetos `{loc, msg}`. Varias pantallas solo mostraban `detail` cuando era
 * texto, así que ante un 422 enseñaban un mensaje genérico —"No se pudo crear
 * el producto"— y el usuario no tenía forma de saber qué corregir. Le pasó al
 * dueño de una tienda intentando dar de alta un producto tres veces seguidas.
 */

/** Forma de un error de validación de FastAPI. */
interface ValidationItem {
  loc?: (string | number)[]
  msg?: string
}

/** Traducción de los mensajes de Pydantic a algo que un tendero entienda. */
const MENSAJES: Array<[RegExp, string]> = [
  [/field required/i, 'Requerido'],
  // Pydantic tiene dos redacciones para lo mismo: "Input should be a valid
  // decimal" y "Decimal input should be an integer, float, string...". Las dos
  // salieron al reproducir el fallo contra produccion.
  [/valid decimal|valid number|valid integer/i, 'Escribe un número'],
  [/decimal input should be|int input should be|float input should be/i, 'Escribe un número'],
  [/should be a valid string/i, 'Texto inválido'],
  [/greater than or equal to 0/i, 'No puede ser negativo'],
  [/at least \d+ character/i, 'Muy corto'],
]

function traducir(msg: string): string {
  for (const [patron, texto] of MENSAJES) if (patron.test(msg)) return texto
  return msg
}

/**
 * Convierte el `detail` de una respuesta en un mapa `campo → mensaje`.
 *
 * La primera posición de `loc` es el origen (`body`, `query`) y se descarta:
 * al formulario le interesa el nombre del campo. Un `detail` de texto o
 * ausente devuelve un mapa vacío — quien llama decide qué mostrar entonces.
 */
export function fieldErrorsFromDetail(detail: unknown): Record<string, string> {
  if (!Array.isArray(detail)) return {}
  const out: Record<string, string> = {}
  for (const item of detail as ValidationItem[]) {
    const loc = Array.isArray(item?.loc) ? item.loc.slice(1) : []
    if (loc.length === 0) continue
    const campo = loc.join('.')
    if (!(campo in out)) out[campo] = traducir(item?.msg ?? 'Inválido')
  }
  return out
}

/**
 * Resumen legible para un aviso, cuando el formulario no puede marcar el campo
 * —por ejemplo si el error viene de un renglón anidado que no está en pantalla—.
 */
export function summarizeFieldErrors(errores: Record<string, string>): string {
  const campos = Object.keys(errores)
  if (campos.length === 0) return ''
  if (campos.length === 1) return `Revisa el campo ${campos[0]}: ${errores[campos[0]]}`
  return `Revisa estos campos: ${campos.join(', ')}`
}
