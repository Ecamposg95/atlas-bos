import { describe, it, expect } from 'vitest'
import { navMovilPorRol } from './navMovil'

describe('navMovilPorRol', () => {
  it('el dueño puede salir del panel hacia el resto de la aplicación', () => {
    // Regresion: "Inicio" apuntaba a '/', que en movil resuelve al propio
    // panel para estos roles. Desde el telefono no quedaba ninguna via hacia
    // el armazon de escritorio, asi que el cajon lateral era inalcanzable
    // justo para el rol al que iba dirigido.
    for (const rol of ['DUEÑO', 'ADMINISTRADOR']) {
      const destinos = navMovilPorRol(rol, 'ATLAS_ONE_RETAIL').map((i) => i.to)
      expect(destinos).toContain('/mobile/owner')
      expect(destinos).toContain('/home')
      expect(destinos).not.toContain('/')
    }
  })

  it('la salida respeta el destino de escritorio de cada preset', () => {
    const destinos = navMovilPorRol('ADMINISTRADOR', 'ATLAS_POS').map((i) => i.to)
    expect(destinos).toContain('/hq/operations')
  })

  it('los demas roles conservan sus pestañas', () => {
    expect(navMovilPorRol('CAJERO').map((i) => i.to)).toEqual([
      '/', '/mobile/comanda', '/mobile/query', '/mobile/profile',
    ])
    expect(navMovilPorRol('VENDEDOR').map((i) => i.to)).toEqual([
      '/mobile/dashboard', '/mobile/sales', '/mobile/query', '/mobile/profile',
    ])
    expect(navMovilPorRol('CLIENTE').map((i) => i.to)).toEqual(['/portal'])
    expect(navMovilPorRol(undefined).map((i) => i.to)).toEqual(['/', '/mobile/profile'])
  })
})
