import type { HeatmapCell } from '../../../api/platform'

interface ActivityHeatmapProps {
  cells: HeatmapCell[]
  maxCount: number
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21]

const CELL = 24
const LABEL_W = 38
const COL_LABEL_H = 18
const ROW_GAP = 2
const COL_GAP = 2
const PAD_RIGHT = 4

export function ActivityHeatmap({ cells, maxCount }: ActivityHeatmapProps) {
  if (!cells || cells.length === 0) {
    return (
      <div style={{ padding: '24px 18px', color: 'var(--p-muted)', fontSize: 13 }}>
        Sin actividad registrada.
      </div>
    )
  }

  // Index cells by [dow][hour] → count
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const c of cells) {
    if (c.dow >= 0 && c.dow < 7 && c.hour >= 0 && c.hour < 24) {
      grid[c.dow][c.hour] = c.count
    }
  }

  const innerW = 24 * (CELL + COL_GAP) - COL_GAP
  const innerH = 7 * (CELL + ROW_GAP) - ROW_GAP
  const totalW = LABEL_W + innerW + PAD_RIGHT
  const totalH = COL_LABEL_H + innerH + 4
  const safeMax = maxCount > 0 ? maxCount : 1

  return (
    <div className="heatmap-wrap">
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width="100%"
        preserveAspectRatio="xMinYMid meet"
        role="img"
        aria-label="Actividad por día y hora"
      >
        {/* Column labels (hours) */}
        {HOUR_TICKS.map(h => {
          const x = LABEL_W + h * (CELL + COL_GAP) + CELL / 2
          return (
            <text
              key={`h-${h}`}
              x={x}
              y={COL_LABEL_H - 4}
              textAnchor="middle"
            >
              {h}
            </text>
          )
        })}

        {/* Row labels + cells */}
        {DAYS.map((dayLabel, dow) => {
          const yLabel = COL_LABEL_H + dow * (CELL + ROW_GAP) + CELL * 0.65
          return (
            <g key={`row-${dow}`}>
              <text x={LABEL_W - 8} y={yLabel} textAnchor="end">
                {dayLabel}
              </text>
              {Array.from({ length: 24 }).map((_, hour) => {
                const count = grid[dow][hour]
                const x = LABEL_W + hour * (CELL + COL_GAP)
                const y = COL_LABEL_H + dow * (CELL + ROW_GAP)
                if (count === 0) {
                  return (
                    <rect
                      key={`c-${dow}-${hour}`}
                      x={x} y={y} width={CELL} height={CELL}
                      rx={3} ry={3}
                      fill="var(--p-border)"
                      fillOpacity={0.35}
                    >
                      <title>{`${dayLabel} ${hour}:00 — 0 ventas`}</title>
                    </rect>
                  )
                }
                const ratio = Math.max(0.1, count / safeMax)
                return (
                  <rect
                    key={`c-${dow}-${hour}`}
                    x={x} y={y} width={CELL} height={CELL}
                    rx={3} ry={3}
                    fill="var(--p-accent)"
                    fillOpacity={ratio}
                  >
                    <title>{`${dayLabel} ${hour}:00 — ${count} ventas`}</title>
                  </rect>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
