import { describe, expect, it } from 'vitest'
import { fieldErrorsFromDetail, summarizeFieldErrors } from './apiErrors'

const detalle422 = [
  { loc: ['body', 'sku'], msg: 'Field required' },
  { loc: ['body', 'cost'], msg: 'Field required' },
  { loc: ['body', 'prices', 0, 'unit_price'], msg: 'Decimal input should be an integer, float, string or Decimal object' },
]

describe('fieldErrorsFromDetail', () => {
  it('convierte el detalle de FastAPI en marcas por campo', () => {
    const e = fieldErrorsFromDetail(detalle422)
    expect(e['sku']).toBe('Requerido')
    expect(e['cost']).toBe('Requerido')
  })

  it('conserva la ruta de un renglon anidado', () => {
    expect(fieldErrorsFromDetail(detalle422)['prices.0.unit_price']).toBe('Escribe un número')
  })

  it('descarta el origen (body/query) del nombre del campo', () => {
    const e = fieldErrorsFromDetail([{ loc: ['query', 'amount'], msg: 'Field required' }])
    expect(e['amount']).toBe('Requerido')
    expect(e['query.amount']).toBeUndefined()
  })

  it('devuelve vacio cuando el detalle es texto', () => {
    expect(fieldErrorsFromDetail('SKU duplicado')).toEqual({})
  })

  it('devuelve vacio cuando no hay detalle', () => {
    expect(fieldErrorsFromDetail(undefined)).toEqual({})
    expect(fieldErrorsFromDetail(null)).toEqual({})
  })

  it('no revienta con un detalle mal formado', () => {
    expect(fieldErrorsFromDetail([{}, { loc: [] }, null])).toEqual({})
  })
})

describe('summarizeFieldErrors', () => {
  it('nombra el campo cuando es uno solo', () => {
    expect(summarizeFieldErrors({ cost: 'Requerido' })).toContain('cost')
  })

  it('enumera cuando son varios', () => {
    const r = summarizeFieldErrors({ sku: 'Requerido', cost: 'Requerido' })
    expect(r).toContain('sku')
    expect(r).toContain('cost')
  })

  it('devuelve vacio si no hay errores', () => {
    expect(summarizeFieldErrors({})).toBe('')
  })
})
