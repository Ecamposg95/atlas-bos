import { useEffect, useRef, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'

/**
 * Gauge — semicircular progress/achievement indicator.
 *
 * Internally a Doughnut chart (`cutout: 80%`, `rotation: -90deg`,
 * `circumference: 180`) — Chart.js does not ship a gauge primitive.
 * Center label is overlaid absolutely because Chart.js center plugins
 * aren't included without an external dep.
 *
 * Color thresholds:
 *   < 50%  → rose (danger)
 *   50-80% → amber (warning)
 *   ≥ 80%  → emerald (ok)
 */

interface Props {
  /** Current observed value. */
  current: number
  /** Target/benchmark (the "100%" anchor). */
  benchmark: number
  /** Large centered label (rendered inside). */
  label: string
  /** Small centered subtitle under the percentage. */
  subtitle?: string
  /** Explicit size in px for the chart square; default 200. */
  size?: number
}

function colorFor(pct: number): { track: string; text: string } {
  if (pct >= 80) return { track: '#10b981', text: 'text-emerald-400' }
  if (pct >= 50) return { track: '#f59e0b', text: 'text-amber-400' }
  return { track: '#f43f5e', text: 'text-rose-400' }
}

export function Gauge({ current, benchmark, label, subtitle, size = 200 }: Props) {
  const rawPct = benchmark > 0 ? (current / benchmark) * 100 : 0
  const clamped = Math.max(0, Math.min(150, rawPct))
  const { track, text } = colorFor(rawPct)

  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    const start = performance.now()
    const from = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 800)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(from + (clamped - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [clamped])

  const arcPct = Math.min(100, displayed)
  const chartData = {
    labels: ['progreso', 'resto'],
    datasets: [{
      data: [arcPct, 100 - arcPct],
      backgroundColor: [track, 'rgba(51, 65, 85, 0.4)'],
      borderWidth: 0,
    }],
  }

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 24, margin: '0 auto' }}>
      <Doughnut
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '80%',
          rotation: -90,
          circumference: 180,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          animation: false,
        } as never}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <p className={`text-3xl font-black tabular-nums ${text}`}>{Math.round(displayed)}%</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        {subtitle && <p className="text-[9px] text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
