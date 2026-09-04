import { describe, it, expect } from 'vitest'
import { estiloCajon, cajonEsInerte } from './cajonLateral'

describe('estiloCajon', () => {
  it('en escritorio no posiciona nada: el sidebar es un hermano en el flujo', () => {
    const e = estiloCajon(false, false)
    expect(e.position).toBeUndefined()
    expect(e.transform).toBeUndefined()
  })

  it('en movil cerrado saca el cajon de la pantalla', () => {
    const e = estiloCajon(true, false)
    expect(e.position).toBe('fixed')
    expect(e.transform).toBe('translateX(-100%)')
  })

  it('en movil abierto lo trae a la pantalla', () => {
    expect(estiloCajon(true, true).transform).toBe('translateX(0)')
  })

  it('en movil siempre queda por encima del contenido', () => {
    expect(Number(estiloCajon(true, false).zIndex)).toBeGreaterThan(0)
    expect(Number(estiloCajon(true, true).zIndex)).toBeGreaterThan(0)
  })
})

describe('cajonEsInerte', () => {
  it('en escritorio nunca es inerte, abierto o cerrado', () => {
    expect(cajonEsInerte(false, false)).toBe(false)
    expect(cajonEsInerte(false, true)).toBe(false)
  })

  it('en movil cerrado es inerte: no debe alcanzarse con Tab ni lector de pantalla', () => {
    expect(cajonEsInerte(true, false)).toBe(true)
  })

  it('en movil abierto deja de ser inerte', () => {
    expect(cajonEsInerte(true, true)).toBe(false)
  })
})
