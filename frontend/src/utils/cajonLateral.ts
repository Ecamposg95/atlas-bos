import type { CSSProperties } from 'react'

/**
 * Cómo se posiciona el sidebar según el ancho. En escritorio no se toca: sigue
 * siendo un hermano en el flujo con sus 244px. Por debajo de 768px se sale de
 * la pantalla y vuelve al abrirse.
 */
export function estiloCajon(esMovil: boolean, abierto: boolean): CSSProperties {
  if (!esMovil) return {}
  return {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    zIndex: 50,
    transform: abierto ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 200ms ease',
  }
}
