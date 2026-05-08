interface DeltaProps {
  value?: number | null
  label?: string
  asPercent?: boolean
}

function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(1)}%`
}

export function Delta({ value, label = 'vs. 30d', asPercent = true }: DeltaProps) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="delta flat">—</span>
  }
  const up = value >= 0
  const text = asPercent ? fmtPct(value) : `${up ? '+' : ''}${value}`
  return (
    <span className={'delta ' + (up ? 'up' : 'down')}>
      <i className={'fa-solid ' + (up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down')} />
      {text}
      <span className="lbl">{label}</span>
    </span>
  )
}
