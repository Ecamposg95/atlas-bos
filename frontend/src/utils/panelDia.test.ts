import { describe, it, expect } from 'vitest'
import { resumirDia, barrasPorHora, estadoDelCorte } from './panelDia'

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

describe('barrasPorHora', () => {
  it('escala cada barra contra la franja mas alta', () => {
    const b = barrasPorHora({
      date: '2026-09-03', current_hour: 19, current_hour_amount: 0, current_hour_tickets: 0,
      hourly: [{ hour: 17, amount: 446, tickets: 8 }, { hour: 18, amount: 223, tickets: 7 }],
    })
    expect(b[0].porcentaje).toBe(100)
    expect(b[1].porcentaje).toBe(50)
  })

  it('descarta las franjas sin ventas', () => {
    const b = barrasPorHora({
      date: '2026-09-03', current_hour: 19, current_hour_amount: 0, current_hour_tickets: 0,
      hourly: [{ hour: 9, amount: 0, tickets: 0 }, { hour: 17, amount: 100, tickets: 1 }],
    })
    expect(b).toHaveLength(1)
    expect(b[0].hora).toBe(17)
  })

  it('no divide entre cero en un dia sin ventas', () => {
    expect(barrasPorHora({
      date: '2026-09-03', current_hour: 9, current_hour_amount: 0, current_hour_tickets: 0, hourly: [],
    })).toEqual([])
  })
})

describe('estadoDelCorte', () => {
  it('sin caja abierta lo dice, sin inventar cifras', () => {
    expect(estadoDelCorte(null, 992.78).situacion).toBe('SIN_CAJA')
  })

  it('con la caja abierta calcula cuanto deberia haber', () => {
    const e = estadoDelCorte(
      { id: 97, status: 'OPEN', opening_balance: 0.01, closing_balance: null } as never, 992.78)
    expect(e.situacion).toBe('ABIERTA')
    expect(e.deberiaHaber).toBeCloseTo(992.79, 2)
  })

  it('cerrada reporta el contado y la diferencia tal como quedaron', () => {
    const e = estadoDelCorte(
      { id: 97, status: 'CLOSED', opening_balance: 0.01, closing_balance: 1020, difference: 27.21 } as never, 992.78)
    expect(e.situacion).toBe('CERRADA')
    expect(e.contado).toBe(1020)
    expect(e.diferencia).toBeCloseTo(27.21, 2)
  })

  it('con la caja abierta y el efectivo del dia desconocido, no inventa cuanto deberia haber', () => {
    const e = estadoDelCorte(
      { id: 97, status: 'OPEN', opening_balance: 500, closing_balance: null } as never, null)
    expect(e.situacion).toBe('ABIERTA')
    expect(e.fondo).toBe(500)
    expect(e.deberiaHaber).toBeUndefined()
  })
})
