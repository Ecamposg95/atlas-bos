import { useEffect, useRef, useState } from 'react'
import { Line } from 'react-chartjs-2'

/**
 * KPICard — premium animated KPI with sparkline and delta vs. previous period.
 *
 * Count-up animation uses `requestAnimationFrame` + ease-out cubic for a
 * natural feel over ~800ms. Sparkline is a minimal (no-axes) 30-point line
 * with a gradient area fill. Hover lifts the card and adds a colored glow
 * matching the tone.
 */

export type KPITone = 'emerald' | 'indigo' | 'violet' | 'amber' | 'sky' | 'neutral'

interface Props {
  label: string
  value: number
  previous?: number
  icon: string // font-awesome class (e.g. "fa-coins")
  tone?: KPITone
  /** Values to render as a sparkline. Up to 30 points used. */
  trend?: number[]
  /** Custom formatter for the displayed value (e.g. currency). */
  format?: (n: number) => string
  /** Disable count-up animation (useful for non-numeric displays). */
  noAnimate?: boolean
}

const TONE_STYLES: Record<KPITone, { text: string; grad: string; border: string; ring: string; sparkle: string }> = {
  emerald: {
    text: 'text-sem-success',
    grad: 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent',
    border: 'hover:border-emerald-500/40',
    ring: 'hover:shadow-emerald-500/20',
    sparkle: 'rgba(52,211,153,0.9)',
  },
  indigo: {
    text: 'text-indigo-400',
    grad: 'bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent',
    border: 'hover:border-indigo-500/40',
    ring: 'hover:shadow-indigo-500/20',
    sparkle: 'rgba(129,140,248,0.9)',
  },
  violet: {
    text: 'text-violet-400',
    grad: 'bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent',
    border: 'hover:border-violet-500/40',
    ring: 'hover:shadow-violet-500/20',
    sparkle: 'rgba(167,139,250,0.9)',
  },
  amber: {
    text: 'text-sem-warning',
    grad: 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent',
    border: 'hover:border-amber-500/40',
    ring: 'hover:shadow-amber-500/20',
    sparkle: 'rgba(251,191,36,0.9)',
  },
  sky: {
    text: 'text-sem-info',
    grad: 'bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent',
    border: 'hover:border-sky-500/40',
    ring: 'hover:shadow-sky-500/20',
    sparkle: 'rgba(56,189,248,0.9)',
  },
  neutral: {
    text: 'text-dax-text',
    grad: 'bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent',
    border: 'hover:border-slate-400/40',
    ring: 'hover:shadow-slate-400/20',
    sparkle: 'rgba(203,213,225,0.9)',
  },
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function useCountUp(target: number, enabled: boolean, durationMs = 800): number {
  const [value, setValue] = useState(enabled ? 0 : target)
  const rafRef = useRef<number | null>(null)
  const fromRef = useRef(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!enabled) { setValue(target); return }
    if (!Number.isFinite(target)) { setValue(0); return }
    fromRef.current = value
    startRef.current = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs)
      const eased = easeOutCubic(t)
      setValue(fromRef.current + (target - fromRef.current) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // Only re-run when target changes; intentionally ignore value in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled, durationMs])

  return value
}

export function KPICard({ label, value, previous, icon, tone = 'neutral', trend, format, noAnimate = false }: Props) {
  const styles = TONE_STYLES[tone]
  const displayed = useCountUp(value, !noAnimate)

  const delta = previous && previous > 0 ? ((value - previous) / previous) * 100 : null
  const up = delta != null && delta >= 0

  const sparkData = (trend ?? []).slice(-30)
  const hasSpark = sparkData.length >= 2

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-dax-border ${styles.grad} p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${styles.border} ${styles.ring}`}
      style={{ backdropFilter: 'blur(6px)' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 20% 0%, ${styles.sparkle.replace(/,[^,]+\)$/, ',0.10)')} 0%, transparent 60%)` }}
      />
      <div className="relative">
        <div className="mb-1 flex items-center gap-1.5">
          <i className={`fa-solid ${icon} ${styles.text} text-[11px]`} />
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-dax-muted">{label}</p>
        </div>
        <p className={`text-xl font-black tabular-nums leading-tight ${styles.text}`}>
          {format ? format(displayed) : Math.round(displayed).toLocaleString('es-MX')}
        </p>
        {delta != null && (
          <p className={`mt-0.5 text-[10px] font-bold tabular-nums ${up ? 'text-sem-success' : 'text-sem-critical'}`}>
            <span aria-hidden>{up ? '▲' : '▼'}</span> {Math.abs(delta).toFixed(1)}%
            <span className="ml-1 text-[9px] font-medium text-dax-muted">vs. período anterior</span>
          </p>
        )}
        {hasSpark && (
          <div className="mt-1" style={{ height: 20 }}>
            <Line
              data={{
                labels: sparkData.map((_, i) => String(i)),
                datasets: [{
                  data: sparkData,
                  borderColor: styles.sparkle,
                  backgroundColor: ((ctx: { chart: { ctx: CanvasRenderingContext2D } }) => {
                    const c = ctx.chart.ctx
                    const gradient = c.createLinearGradient(0, 0, 0, 20)
                    gradient.addColorStop(0, styles.sparkle.replace(/,[^,]+\)$/, ',0.35)'))
                    gradient.addColorStop(1, styles.sparkle.replace(/,[^,]+\)$/, ',0)'))
                    return gradient
                  }) as unknown as string,
                  borderWidth: 1.2,
                  pointRadius: 0,
                  tension: 0.35,
                  fill: true,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                elements: { line: { borderCapStyle: 'round' } },
                animation: false,
              } as never}
            />
          </div>
        )}
      </div>
    </div>
  )
}
