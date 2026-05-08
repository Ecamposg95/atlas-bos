interface KPICardProps {
  label: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  /** v1 legacy — retained for API compatibility. Ignored in v2 (mono-azul).
   *  Casos semánticos críticos (warning/danger) aún tintan el número. */
  accent?: 'teal' | 'cyan' | 'purple' | 'magenta' | 'warning' | 'danger' | 'accent'
  icon?: string
}

const NUMBER_TINT: Partial<Record<NonNullable<KPICardProps['accent']>, string>> = {
  warning: 'var(--p-warning)',
  danger:  'var(--p-danger)',
}

export function KPICard({ label, value, delta, deltaPositive, accent, icon }: KPICardProps) {
  const numberColor = (accent && NUMBER_TINT[accent]) || 'var(--p-text)'
  const deltaUp = !!deltaPositive
  return (
    <div style={{
      background: 'var(--p-surface)',
      border: '1px solid var(--p-border)',
      borderRadius: 14,
      padding: '16px 18px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minWidth: 0,
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}>
        <span style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: 'var(--p-muted)',
        }}>
          {label}
        </span>
        {icon && (
          <span style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--p-accent-soft)',
            color: 'var(--p-accent)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
          }}>
            <i className={`fa-solid ${icon}`} />
          </span>
        )}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 34,
        letterSpacing: '-0.03em',
        fontWeight: 600,
        color: numberColor,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 11,
        color: 'var(--p-muted)',
        fontFamily: 'var(--font-mono)',
        minHeight: 14,
      }}>
        {delta ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 600,
            color: deltaUp ? 'var(--p-success)' : 'var(--p-danger)',
          }}>
            <i className={'fa-solid ' + (deltaUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down')} />
            {delta}
          </span>
        ) : (
          <span style={{ color: 'var(--p-hint)' }}>—</span>
        )}
      </div>
    </div>
  )
}
