type Status = 'active' | 'inactive' | 'beta' | 'stable' | 'archived' | 'superadmin' | 'support'

// v2: pill redondo con dot inicial. Colores solo para estado.
const CFG: Record<Status, { label: string; color: string }> = {
  active:     { label: 'Activo',     color: 'var(--p-success)' },
  inactive:   { label: 'Inactivo',   color: 'var(--p-warning)' },
  beta:       { label: 'BETA',       color: 'var(--p-warning)' },
  stable:     { label: 'Stable',     color: 'var(--p-success)' },
  archived:   { label: 'Archivado',  color: 'var(--p-muted)'   },
  superadmin: { label: 'SUPERADMIN', color: 'var(--p-magenta)' },
  support:    { label: 'SUPPORT',    color: 'var(--p-accent)'  },
}

const FALLBACK = { label: 'N/A', color: 'var(--p-muted)' }

export function StatusBadge({ status, label }: { status: Status | string; label?: string }) {
  const key = (status ?? '').toString().toLowerCase() as Status
  const c = CFG[key] ?? FALLBACK
  const text = label ?? c.label ?? String(status)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontWeight: 500,
      padding: '3px 8px',
      borderRadius: 999,
      border: '1px solid var(--p-border)',
      background: 'var(--p-surface-2)',
      color: c.color,
      whiteSpace: 'nowrap',
      fontFamily: 'var(--font-sans)',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'currentColor',
        flexShrink: 0,
      }} />
      {text}
    </span>
  )
}
