interface SparklineProps {
  data: { v: number }[]
  w?: number
  h?: number
  stroke?: string
}

export function Sparkline({ data, w = 64, h = 24, stroke = 'currentColor' }: SparklineProps) {
  if (!data || data.length === 0) {
    return <svg className="spark" viewBox={`0 0 ${w} ${h}`} />
  }
  const values = data.map(d => d.v)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const pts = data.map((p, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w
    const y = h - ((p.v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
