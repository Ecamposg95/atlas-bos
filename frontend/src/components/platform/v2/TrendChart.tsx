import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import { formatCurrency } from '../../../utils/currency'

export interface TrendPoint {
  date: string
  label: string
  revenue: number
  ma7?: number | null
  sales?: number
  signups?: number
}

interface Props {
  data: TrendPoint[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  /** Optional secondary series (sales count). When provided + toggled on, renders a second line. */
  salesSeries?: TrendPoint[]
  /** Optional tertiary series (signups count). When provided + toggled on, renders a third line. */
  signupsSeries?: TrendPoint[]
  /** When true, render 3 toggle pills above the chart (Revenue / Sales / Signups). Default false. */
  showSeriesToggles?: boolean
}

function chartCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

function intShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return `${value.toFixed(0)}`
}

export function TrendChart({
  data,
  height = 300,
  showGrid = true,
  showLegend = true,
  salesSeries,
  signupsSeries,
  showSeriesToggles = false,
}: Props) {
  const [revOn, setRevOn] = useState(true)
  const [salesOn, setSalesOn] = useState(false)
  const [signupsOn, setSignupsOn] = useState(false)

  // Merge optional series into a single dataset by index, so Recharts can plot
  // multiple lines off the same array.
  const merged = useMemo(() => {
    if (!data || data.length === 0) return []
    return data.map((p, i) => ({
      ...p,
      sales: salesSeries?.[i]?.revenue ?? salesSeries?.[i]?.sales ?? p.sales ?? 0,
      signups: signupsSeries?.[i]?.revenue ?? signupsSeries?.[i]?.signups ?? p.signups ?? 0,
    }))
  }, [data, salesSeries, signupsSeries])

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', color: 'var(--p-muted)', fontSize: 13 }}>
        Sin datos de tendencia.
      </div>
    )
  }

  const hasSales = !!salesSeries && salesSeries.length > 0
  const hasSignups = !!signupsSeries && signupsSeries.length > 0

  return (
    <div className="chart-wrap">
      {showSeriesToggles && (
        <div className="series-toggles" role="group" aria-label="Series">
          <button
            type="button"
            className={'pill ' + (revOn ? 'active' : '')}
            aria-pressed={revOn}
            onClick={() => setRevOn(v => !v)}
          >
            Revenue
          </button>
          {hasSales && (
            <button
              type="button"
              className={'pill ' + (salesOn ? 'active' : '')}
              aria-pressed={salesOn}
              onClick={() => setSalesOn(v => !v)}
            >
              Sales
            </button>
          )}
          {hasSignups && (
            <button
              type="button"
              className={'pill ' + (signupsOn ? 'active' : '')}
              aria-pressed={signupsOn}
              onClick={() => setSignupsOn(v => !v)}
            >
              Signups
            </button>
          )}
        </div>
      )}
      {showLegend && (
        <div className="chart-caption">
          <span className="legend-inline">
            <span className="a"><span className="sw" />Ventas diarias</span>
            <span className="b"><span className="sw" />Promedio móvil 7d</span>
          </span>
          <span className="mono">USD</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <AreaChart data={merged} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pv2TrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--p-accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--p-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid
              stroke="var(--p-border)"
              strokeDasharray="2 4"
              vertical={false}
            />
          )}
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--p-hint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={chartCurrencyShort}
            tick={{ fill: 'var(--p-hint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          {(hasSales || hasSignups) && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={intShort}
              tick={{ fill: 'var(--p-hint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
          )}
          <Tooltip
            contentStyle={{
              background: 'var(--p-sidebar)',
              border: '1px solid var(--p-border)',
              borderRadius: 8,
              color: 'var(--p-text)',
              fontSize: 12,
            }}
            cursor={{ stroke: 'var(--p-accent-line)' }}
            formatter={(value: any, name: any) => {
              const v = typeof value === 'number' ? value : Number(value) || 0
              if (name === 'revenue') return [formatCurrency(v), 'Ventas diarias']
              if (name === 'ma7') return [formatCurrency(v), 'Promedio móvil 7d']
              if (name === 'sales') return [v, 'Tickets']
              if (name === 'signups') return [v, 'Signups']
              return [v, name]
            }}
            labelFormatter={(label) => `Día ${label}`}
          />
          {revOn && (
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="var(--p-accent)"
              strokeWidth={1.75}
              fill="url(#pv2TrendFill)"
            />
          )}
          {revOn && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="ma7"
              stroke="var(--p-muted)"
              strokeWidth={1.25}
              strokeDasharray="3 3"
              dot={false}
              connectNulls
            />
          )}
          {hasSales && salesOn && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="sales"
              stroke="var(--p-success, #4ade80)"
              strokeWidth={1.5}
              dot={false}
            />
          )}
          {hasSignups && signupsOn && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="signups"
              stroke="var(--p-warning, #fbbf24)"
              strokeWidth={1.5}
              dot={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
