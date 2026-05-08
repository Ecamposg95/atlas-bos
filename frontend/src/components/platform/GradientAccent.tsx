/**
 * @deprecated v2 — el gradient rainbow se eliminó del lenguaje visual.
 * Si necesitas una línea decorativa, usa borde sólido azul:
 *   <div style={{ borderTop: '2px solid var(--p-accent)' }} />
 *
 * Este componente ahora renderiza un line sólido azul (no gradient) para
 * preservar usos existentes sin romper layout.
 */
export function GradientAccent({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--p-accent)',
        height: vertical ? '100%' : 2,
        width: vertical ? 2 : '100%',
        border: 'none',
        margin: vertical ? 0 : '1.5rem 0',
        opacity: 0.6,
      }}
    />
  )
}
