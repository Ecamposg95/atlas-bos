import { rutaInicioPorRol } from './rutaInicio'

/**
 * Pestañas de la barra inferior del armazón móvil. Vive fuera de
 * `MobileLayout.tsx` para poder probarse: vitest está configurado con
 * `include: ['src/**\/*.test.ts']`, solo .ts.
 */
export interface ItemNavMovil {
  label: string
  icon: string
  to: string
  end?: boolean
}

const PERFIL: ItemNavMovil = { label: 'Perfil', icon: 'fa-user', to: '/mobile/profile' }

export function navMovilPorRol(rol?: string | null, preset?: string | null): ItemNavMovil[] {
  switch (rol) {
    case 'VENDEDOR':
    case 'SOPORTE_OPERATIVO':
      return [
        { label: 'Inicio', icon: 'fa-house', to: '/mobile/dashboard' },
        { label: 'Cotizar', icon: 'fa-file-invoice', to: '/mobile/sales' },
        { label: 'Consultar', icon: 'fa-magnifying-glass', to: '/mobile/query' },
        PERFIL,
      ]
    case 'CAJERO':
    case 'GERENTE':
      return [
        { label: 'Inicio', icon: 'fa-house', to: '/', end: true },
        { label: 'Comanda', icon: 'fa-utensils', to: '/mobile/comanda' },
        { label: 'Consultar', icon: 'fa-magnifying-glass', to: '/mobile/query' },
        PERFIL,
      ]
    case 'DUEÑO':
    case 'ADMINISTRADOR':
      // "Inicio → /" era un callejón sin salida: `/` resuelve al panel para
      // estos dos roles en móvil, así que la pestaña devolvía a la pantalla en
      // la que ya estaban y no quedaba ninguna vía hacia el armazón de
      // escritorio —donde vive el cajón lateral y las demás vistas—. "Menú"
      // apunta al inicio de ese armazón (el mismo destino que en escritorio,
      // que depende del preset).
      return [
        { label: 'Resumen', icon: 'fa-chart-line', to: '/mobile/owner' },
        { label: 'Menú', icon: 'fa-bars', to: rutaInicioPorRol(rol, false, preset) },
        { label: 'Comanda', icon: 'fa-utensils', to: '/mobile/comanda' },
        PERFIL,
      ]
    case 'CLIENTE':
      return [{ label: 'Mi cuenta', icon: 'fa-id-card', to: '/portal' }]
    default:
      return [
        { label: 'Inicio', icon: 'fa-house', to: '/', end: true },
        PERFIL,
      ]
  }
}
