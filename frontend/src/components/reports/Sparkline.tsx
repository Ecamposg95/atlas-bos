import { Line } from 'react-chartjs-2'

/**
 * Sparkline — minimal no-axes line chart for inline cells (top products, etc.).
 *
 * Implemented with chart.js to reuse the bundle already shipped by the
 * dashboard. Uses `animation: false` since each row re-renders on filter
 * change and per-row animations stack up badly.
 */

interface Props {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ data, color = 'rgba(52,211,153,0.9)', width = 60, height = 20 }: Props) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="opacity-30" />
  }
  return (
    <div style={{ width, height }}>
      <Line
        data={{
          labels: data.map((_, i) => String(i)),
          datasets: [{
            data,
            borderColor: color,
            backgroundColor: ((ctx: { chart: { ctx: CanvasRenderingContext2D } }) => {
              const c = ctx.chart.ctx
              const gradient = c.createLinearGradient(0, 0, 0, height)
              gradient.addColorStop(0, color.replace(/,[^,]+\)$/, ',0.35)'))
              gradient.addColorStop(1, color.replace(/,[^,]+\)$/, ',0)'))
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
  )
}
