import { describe, it, expect } from 'vitest'
import { resumirDia } from './panelDia'

const respuestaReal = {
  date: '2026-09-03',
  transactions_count: 19,
  total_revenue: 992.78,
  gross_profit: 448.48,
  payments: { CASH: 992.78 },
  top_selling_items: [{ name: 'folder tamaño carta', quantity: 14 }],
}

describe('resumirDia', () => {
  it('lee los nombres que el backend manda de verdad', () => {
    const r = resumirDia(respuestaReal)
    expect(r.venta).toBe(992.78)
    expect(r.tickets).toBe(19)
    expect(r.utilidad).toBe(448.48)
  })

  it('calcula el ticket promedio', () => {
    expect(resumirDia(respuestaReal).ticketPromedio).toBeCloseTo(52.25, 2)
  })

  it('no divide entre cero cuando no hubo ventas', () => {
    const r = resumirDia({ ...respuestaReal, transactions_count: 0, total_revenue: 0 })
    expect(r.ticketPromedio).toBe(0)
  })

  it('convierte el objeto de pagos en una lista ordenada de mayor a menor', () => {
    const r = resumirDia({ ...respuestaReal, payments: { CARD: 100, CASH: 500 } })
    expect(r.pagos).toEqual([
      { metodo: 'CASH', total: 500 },
      { metodo: 'CARD', total: 100 },
    ])
  })

  it('tolera que falten pagos o productos', () => {
    const r = resumirDia({ ...respuestaReal, payments: undefined, top_selling_items: undefined } as never)
    expect(r.pagos).toEqual([])
    expect(r.masVendidos).toEqual([])
  })
})
