import { describe, it, expect } from 'vitest'
import { resumirDia, barrasPorHora, estadoDelCorte, ambitoDelPanel } from './panelDia'
import type { CorteDeCajero, CorteDeSucursal } from '../api/cash'

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

const CAJERO_ABIERTO: CorteDeCajero = {
  session_id: 97, user_id: 3, username: 'kaory', full_name: 'Kaory',
  status: 'OPEN', opened_at: '2026-09-03T15:00:00Z', closed_at: null,
  opening_balance: 500, closing_balance: 0, difference: 0,
  expected_cash: 2500, sales: 5000, tickets: 19, cash: 5000, card: 0, transfer: 0,
  change_given: 0, inflows: 0, outflows: 3000, cash_refunds: 0, returns_count: 0,
}

function resumenSucursal(cajeros: CorteDeCajero[]): CorteDeSucursal {
  return {
    branch_id: 2, branch_name: 'Novedades Kaory', date: '2026-09-03',
    sessions_count: cajeros.length, cashiers: cajeros,
    totals: {
      sales: 0, tickets: 0, cash: 0, card: 0, transfer: 0, inflows: 0,
      outflows: 0, cash_refunds: 0, opening_total: 0, closing_total: 0,
      difference_total: 0,
    },
  }
}

describe('estadoDelCorte', () => {
  it('lo que deberia haber sale del esperado canonico, con los retiros ya restados', () => {
    // Fondo 500 + 5,000 de efectivo - 3,000 de retiro = 2,500. El panel viejo
    // sumaba fondo + efectivo del dia y pintaba 5,500 con 2,500 en el cajon.
    const e = estadoDelCorte(resumenSucursal([CAJERO_ABIERTO]))
    expect(e.sucursal).toBe('Novedades Kaory')
    expect(e.abiertas).toBe(1)
    expect(e.deberiaHaber).toBe(2500)
  })

  it('un esperado de cero legitimo no se confunde con "no lo se"', () => {
    // El dia sin ventas y sin fondo: deberia haber $0.00, no un hueco.
    const e = estadoDelCorte(resumenSucursal([
      { ...CAJERO_ABIERTO, opening_balance: 0, expected_cash: 0, sales: 0, cash: 0, outflows: 0 },
    ]))
    expect(e.deberiaHaber).toBe(0)
    expect(e.sinCortes).toBe(false)
  })

  it('suma los turnos abiertos de la sucursal, no mezcla ambitos', () => {
    const e = estadoDelCorte(resumenSucursal([
      CAJERO_ABIERTO,
      { ...CAJERO_ABIERTO, session_id: 98, user_id: 4, username: 'ana', expected_cash: 1200 },
    ]))
    expect(e.abiertas).toBe(2)
    expect(e.deberiaHaber).toBe(3700)
  })

  it('la caja ya cerrada reporta contado, esperado y diferencia', () => {
    // El dueno revisa el corte a las 21:30: antes leia "No hay caja abierta".
    const e = estadoDelCorte(resumenSucursal([
      {
        ...CAJERO_ABIERTO, status: 'CLOSED', closed_at: '2026-09-03T21:00:00Z',
        closing_balance: 2480, expected_cash: 2500, difference: -20,
      },
    ]))
    expect(e.cerradas).toBe(1)
    expect(e.abiertas).toBe(0)
    expect(e.contado).toBe(2480)
    expect(e.esperadoCerrado).toBe(2500)
    expect(e.diferencia).toBe(-20)
    expect(e.deberiaHaber).toBeNull()
  })

  it('un dia sin ningun corte lo dice, sin inventar cifras', () => {
    const e = estadoDelCorte(resumenSucursal([]))
    expect(e.sinCortes).toBe(true)
    expect(e.deberiaHaber).toBeNull()
    expect(e.contado).toBeNull()
    expect(e.diferencia).toBeNull()
  })
})

describe('ambitoDelPanel', () => {
  const tienda = { id: 2, name: 'Kaory Centro', can_sell: true, is_active: true }
  const otra = { id: 3, name: 'Kaory Norte', can_sell: true, is_active: true }
  const hq = { id: 1, name: 'Oficina', can_sell: false, is_active: true }

  it('un rol de oficina pide toda la organizacion, no la sucursal donde esta anclado', () => {
    // Regresion: el ADMINISTRADOR anclado a HQ (can_sell=false) veia $0.00 en
    // todo el panel bajo el nombre de su organizacion.
    const a = ambitoDelPanel('ADMINISTRADOR', hq.id, [hq, tienda])
    expect(a.branchId).toBe(0)
    expect(a.sucursalesDelCorte).toEqual([tienda.id])
  })

  it('con una sola sucursal que vende, la cabecera la nombra', () => {
    expect(ambitoDelPanel('DUEÑO', 1, [hq, tienda]).etiqueta).toBe('Kaory Centro')
  })

  it('con varias sucursales lo dice en vez de pintar una como si fuera el negocio', () => {
    const a = ambitoDelPanel('DUEÑO', 1, [hq, tienda, otra])
    expect(a.etiqueta).toBe('Todas las sucursales (2)')
    expect(a.sucursalesDelCorte).toEqual([tienda.id, otra.id])
  })

  it('un rol sin oficina central se queda en su sucursal y no manda el parametro', () => {
    const a = ambitoDelPanel('CAJERO', tienda.id, [hq, tienda, otra])
    expect(a.branchId).toBeUndefined()
    expect(a.etiqueta).toBe('Kaory Centro')
    expect(a.sucursalesDelCorte).toEqual([tienda.id])
  })

  it('sin la lista de sucursales no inventa un ambito', () => {
    const a = ambitoDelPanel('ADMINISTRADOR', 1, [])
    expect(a.branchId).toBe(0)
    expect(a.etiqueta).toBe('Toda la organización')
    expect(a.sucursalesDelCorte).toEqual([])
  })
})
