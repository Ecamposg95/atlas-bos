import { describe, it, expect } from 'vitest'
import { rutaInicioPorRol } from './rutaInicio'

describe('rutaInicioPorRol', () => {
  it('manda al ADMINISTRADOR en movil a su panel', () => {
    // Regresion: la condicion solo contemplaba DUEÑO, asi que Jesus
    // —ADMINISTRADOR— aterrizaba en el armazon de escritorio.
    expect(rutaInicioPorRol('ADMINISTRADOR', true, 'ATLAS_POS')).toBe('/mobile/owner')
  })

  it('manda al DUEÑO en movil a su panel', () => {
    expect(rutaInicioPorRol('DUEÑO', true, 'ATLAS_POS')).toBe('/mobile/owner')
  })

  it('en escritorio el ADMINISTRADOR no cambia de destino', () => {
    expect(rutaInicioPorRol('ADMINISTRADOR', false, 'ATLAS_POS')).toBe('/hq/operations')
    expect(rutaInicioPorRol('ADMINISTRADOR', false, 'ATLAS_ONE_RETAIL')).toBe('/home')
  })

  it('los demas roles no cambian', () => {
    expect(rutaInicioPorRol('VENDEDOR', true)).toBe('/mobile/dashboard')
    expect(rutaInicioPorRol('SOPORTE_OPERATIVO', false)).toBe('/mobile/dashboard')
    expect(rutaInicioPorRol('CLIENTE', true)).toBe('/portal')
    expect(rutaInicioPorRol('CAJERO', true)).toBe('/atlas-pos')
    expect(rutaInicioPorRol(undefined, false)).toBe('/atlas-pos')
  })
})
