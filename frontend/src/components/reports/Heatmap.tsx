import { useMemo, useState } from 'react'
import { formatCurrency } from '../../utils/currency'

/**
 * SalesHeatmap — weekday × hour grid with green intensity.
 *
 * PostgreSQL convention: day 0=Sunday ... 6=Saturday. We re-order so Mon
 * sits at the top (matches es-MX calendar ergonomics). Hours default to
 * 8h..21h to mirror the backend business-hours window.
 *
 * Color scale is eyeballed from `bg-emerald-500` with progressive alpha,
 * NOT computed at runtime — keeps Tailwind's JIT happy. We bucket each
 * cell's `amount / max` into 5 discrete intensities.
 */

export interface HeatmapCell {
  day: number // 0..6 (0=Sunday)
  hour: number // 0..23
  amount: number
  tickets: number
}

interface Props {
  data: HeatmapCell[]
  hourStart?: number
  hourEnd?: number
}

// Order that puts Monday first (L, M, X, J, V, S, D).
const WEEK_ORDER_PG = [1, 2, 3, 4, 5, 6, 0]
const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const WEEK_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Pre-baked Tailwind classes (no runtime interpolation — JIT-safe).
const INTENSITY_CLASSES = [
  'bg-dax-card',
  'bg-emerald-500/20',
  'bg-emerald-500/40',
  'bg-emerald-500/60',
  'bg-emerald-500/80',
  'bg-emerald-500',
]

export function SalesHeatmap({ data, hourStart = 8, hourEnd = 21 }: Props) {
  const hours = useMemo(
    () => Array.from({ length: hourEnd - hourStart + 1 }, (_, i) => hourStart + i),
    [hourStart, hourEnd],
  )

  const { cells, maxAmount } = useMemo(() => {
    const map = new Map<string, HeatmapCell>()
    let max = 0
    for (const c of data) {
      const key = `${c.day}-${c.hour}`
      map.set(key, c)
      if (c.amount > max) max = c.amount
    }
    return { cells: map, maxAmount: max }
  }, [data])

  const [hover, setHover] = useState<{ dayIdx: number; hour: number; amount: number; tickets: number } | null>(null)

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: '3px' }}>
          <thead>
            <tr>
              <th className="w-6" />
              {hours.map((h) => (
                <th key={h} className="text-[9px] font-mono font-bold text-dax-faint text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEK_ORDER_PG.map((pgDay, rowIdx) => (
              <tr key={pgDay}>
                <td className="text-[10px] font-bold text-dax-muted pr-1 w-6 text-right align-middle">
                  {WEEK_LABELS[rowIdx]}
                </td>
                {hours.map((h) => {
                  const c = cells.get(`${pgDay}-${h}`)
                  const amt = c?.amount ?? 0
                  const ratio = maxAmount > 0 ? amt / maxAmount : 0
                  const bucket = ratio === 0
                    ? 0
                    : ratio < 0.2 ? 1
                    : ratio < 0.4 ? 2
                    : ratio < 0.6 ? 3
                    : ratio < 0.8 ? 4
                    : 5
                  return (
                    <td
                      key={`${pgDay}-${h}`}
                      className={`relative h-6 rounded-sm ${INTENSITY_CLASSES[bucket]} cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-emerald-300 hover:scale-110`}
                      onMouseEnter={() => setHover({ dayIdx: rowIdx, hour: h, amount: amt, tickets: c?.tickets ?? 0 })}
                      onMouseLeave={() => setHover(null)}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-dax-faint">Menos</span>
        {INTENSITY_CLASSES.map((cls, i) => (
          <div key={i} className={`h-2 w-4 rounded-sm ${cls}`} />
        ))}
        <span className="text-[9px] font-bold uppercase tracking-wider text-dax-faint">Más</span>
      </div>

      {hover && (
        <div className="pointer-events-none absolute top-0 right-0 bg-dax-bg border border-emerald-500/40 rounded-lg px-3 py-2 shadow-lg shadow-emerald-500/10 z-10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sem-success">
            {WEEK_LONG[hover.dayIdx]} · {hover.hour}:00
          </p>
          <p className="text-sm font-black tabular-nums text-dax-text">{formatCurrency(hover.amount)}</p>
          <p className="text-[10px] text-dax-muted">{hover.tickets} {hover.tickets === 1 ? 'ticket' : 'tickets'}</p>
        </div>
      )}
    </div>
  )
}
