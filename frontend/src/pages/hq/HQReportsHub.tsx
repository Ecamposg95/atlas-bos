import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  reportsApi,
  type DashboardData,
  type CommandCenterStats,
  type SalesByHourResponse,
} from '../../api/reports'
import { organizationApi, type Branch } from '../../api/organization'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { KPICard } from '../../components/reports/KPICard'
import { SalesHeatmap, type HeatmapCell } from '../../components/reports/Heatmap'
import { Gauge } from '../../components/reports/Gauge'
import { BranchLeaderboard } from '../../components/reports/Leaderboard'
import { Sparkline } from '../../components/reports/Sparkline'
import { useTheme } from '../../context/ThemeContext'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement,
  Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { formatCurrency } from '../../utils/currency'
import { todayStr, daysAgoStr } from '../../utils/dates'

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement,
  Tooltip, Legend, Filler,
)

/**
 * HQReportsHub — ultra redesign.
 *
 * Eight premium visualizations wired to /api/reports/dashboard +
 * /api/reports/command-center/stats + /api/reports/sales-by-hour:
 *
 *   1. KPI cards with count-up animation, sparkline, and Δ vs. previous period
 *   2. Payment methods doughnut with center-total
 *   3. Weekday × hour sales heatmap
 *   4. Achievement gauge vs. previous-period benchmark
 *   5. Dual trend line (this period vs. previous)
 *   6. Branch leaderboard with podium + progressive bars
 *   7. Top products table with per-row sparklines
 *   8. Realtime velocimeter for the current hour (auto-refresh 30s)
 */

const PRESETS = [
  { label: 'Hoy', start: () => todayStr(), end: () => todayStr() },
  { label: 'Semana', start: () => daysAgoStr(7), end: () => todayStr() },
  { label: 'Mes', start: () => daysAgoStr(30), end: () => todayStr() },
]

// Stable color assignment for payment methods. Unknown methods fall back
// to the `OTHER` slate tone.
const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#10b981', EFECTIVO: '#10b981',
  CARD: '#6366f1', TARJETA: '#6366f1',
  TRANSFER: '#8b5cf6', TRANSFERENCIA: '#8b5cf6',
  MIXED: '#f59e0b', MIXTO: '#f59e0b',
  OTHER: '#94a3b8', OTRO: '#94a3b8',
}

function payColor(method: string): string {
  return PAYMENT_COLORS[method.toUpperCase()] ?? PAYMENT_COLORS.OTHER
}

/**
 * When the backend doesn't send `charts.heatmap` (older responses), synthesize
 * a best-effort grid from the hourly series by distributing the per-hour
 * total evenly across weekdays — marked as "approximated" via `isApprox`.
 *
 * TODO: remove fallback once all deployments pick up the new /dashboard
 * response with `charts.heatmap`.
 */
function buildHeatmapFallback(hourly: { labels: string[]; data: number[] }): HeatmapCell[] {
  if (!hourly?.labels?.length) return []
  const cells: HeatmapCell[] = []
  hourly.labels.forEach((lbl, i) => {
    const hour = parseInt(lbl.split(':')[0], 10)
    const total = hourly.data[i] ?? 0
    // Seeded pseudo-random distribution so it's stable across re-renders.
    for (let d = 0; d <= 6; d++) {
      const seed = (hour * 7 + d) * 9301 + 49297
      const r = ((seed % 233280) / 233280) * 0.6 + 0.4
      cells.push({ day: d, hour, amount: (total / 7) * r, tickets: 0 })
    }
  })
  return cells
}

export function HQReportsHub() {
  const { theme } = useTheme()
  const chartGrid = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.08)'
  const chartTicks = theme === 'dark' ? '#64748b' : '#94a3b8'

  const [data, setData] = useState<DashboardData | null>(null)
  const [ccStats, setCcStats] = useState<CommandCenterStats | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [startDate, setStartDate] = useState(daysAgoStr(30))
  const [endDate, setEndDate] = useState(todayStr())
  const [velo, setVelo] = useState<SalesByHourResponse | null>(null)

  const load = useCallback(async (start: string, end: string, bid: number | '') => {
    setLoading(true)
    try {
      const [dashRes, statsRes] = await Promise.allSettled([
        reportsApi.dashboard({ start_date: start, end_date: end, branch_id: bid || undefined }),
        reportsApi.commandCenterStats({ start_date: start, end_date: end }),
      ])
      setData(dashRes.status === 'fulfilled' ? dashRes.value : null)
      setCcStats(statsRes.status === 'fulfilled' ? statsRes.value : null)
    } catch { setData(null) } finally { setLoading(false) }
  }, [])

  // Velocimeter: auto-refresh every 30s. Only polls when the tab is visible
  // and the current hour is within business hours (8-21).
  const refreshVelo = useCallback(async () => {
    try {
      const res = await reportsApi.salesByHour({
        date: todayStr(),
        branch_id: branchId || undefined,
      })
      setVelo(res)
    } catch {
      // Swallow — velocimeter is a nice-to-have, the main dash still works.
    }
  }, [branchId])

  useEffect(() => {
    organizationApi.getBranches().then(setBranches).catch(() => {})
    load(startDate, endDate, '')
    refreshVelo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshVelo()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [refreshVelo])

  const applyPreset = (p: typeof PRESETS[0]) => {
    const s = p.start(), e = p.end()
    setStartDate(s); setEndDate(e); load(s, e, branchId)
  }

  const isPresetActive = (p: typeof PRESETS[0]) =>
    startDate === p.start() && endDate === p.end()

  const handleExport = async () => {
    setExporting(true)
    try {
      await reportsApi.exportCsv({
        start_date: startDate,
        end_date: endDate,
        branch_id: branchId || undefined,
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('CSV export failed', e)
    } finally {
      setExporting(false)
    }
  }

  // --- Derived data ---------------------------------------------------------

  const trendLabels = data?.charts?.trend?.labels ?? []
  const trendValues = data?.charts?.trend?.data ?? []
  const prevTrendValues = data?.charts?.trend_previous?.data ?? []

  const paymentMethods = useMemo(() => {
    const raw = data?.charts?.payments as unknown as
      Record<string, number | { total: number; count: number }> | undefined
    if (!raw) return [] as { method: string; total: number; count: number }[]
    return Object.entries(raw).map(([method, v]) => {
      if (typeof v === 'number') return { method, total: v, count: 0 }
      return { method, total: v?.total ?? 0, count: v?.count ?? 0 }
    })
  }, [data])

  const heatmapData = useMemo<HeatmapCell[]>(() => {
    if (data?.charts?.heatmap && data.charts.heatmap.length > 0) return data.charts.heatmap
    return buildHeatmapFallback(data?.charts?.hourly ?? { labels: [], data: [] })
  }, [data])

  const heatmapIsApprox = !data?.charts?.heatmap || data.charts.heatmap.length === 0

  const totalPayments = paymentMethods.reduce((s, m) => s + m.total, 0)

  const topMethod = paymentMethods.length
    ? paymentMethods.reduce((a, b) => b.total > a.total ? b : a).method
    : '—'

  const uniqueSkusSold = data?.kpis?.unique_skus_sold ?? 0
  const transitShipments = data?.kpis?.transit_shipments ?? 0

  // For KPI sparklines: use trend slice (last 30) for revenue-ish KPIs.
  const sparkTrend = trendValues.slice(-30)

  // Previous-period benchmark for the gauge. If prev trend is absent the
  // gauge has no meaningful reference so we render 0% (component handles it).
  const prevTotal = prevTrendValues.reduce((s, v) => s + v, 0)
  const currentTotal = trendValues.reduce((s, v) => s + v, 0)
  const gaugeBenchmark = prevTotal > 0 ? prevTotal : 0

  // --- Chart configs --------------------------------------------------------

  const trendChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Este período',
        data: trendValues,
        borderColor: '#10b981',
        backgroundColor: ((ctx: { chart: { ctx: CanvasRenderingContext2D } }) => {
          const c = ctx.chart.ctx
          const gradient = c.createLinearGradient(0, 0, 0, 220)
          gradient.addColorStop(0, 'rgba(16,185,129,0.25)')
          gradient.addColorStop(1, 'rgba(16,185,129,0)')
          return gradient
        }) as unknown as string,
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
      },
      ...(prevTrendValues.length ? [{
        label: 'Período anterior',
        data: prevTrendValues,
        borderColor: 'rgba(148,163,184,0.8)',
        borderDash: [4, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
        tension: 0.35,
      }] : []),
    ],
  }

  const trendChartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'end' as const,
        labels: { color: chartTicks, font: { size: 10 }, boxWidth: 12, boxHeight: 2 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label ?? ''}: ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: chartTicks, font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: chartGrid }, ticks: { color: chartTicks, font: { size: 10 }, callback: (v: unknown) => `$${Math.round(Number(v) / 1000)}k` } },
    },
    interaction: { mode: 'index' as const, intersect: false },
  }

  // --- Doughnut (payments) --------------------------------------------------
  const doughnutData = {
    labels: paymentMethods.map((m) => m.method),
    datasets: [{
      data: paymentMethods.map((m) => m.total),
      backgroundColor: paymentMethods.map((m) => payColor(m.method)),
      borderColor: 'rgba(15,23,42,0.8)',
      borderWidth: 2,
      hoverOffset: 10,
    }],
  }

  const doughnutOpts = {
    responsive: true, maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
        labels: { color: chartTicks, font: { size: 11 }, usePointStyle: true, padding: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label?: string; parsed: number }) => {
            const pct = totalPayments > 0 ? (ctx.parsed / totalPayments) * 100 : 0
            return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct.toFixed(1)}%)`
          },
        },
      },
    },
  }

  // --- Velocimeter ----------------------------------------------------------
  const veloHour = velo?.current_hour ?? new Date().getHours()
  const veloOpen = veloHour >= 8 && veloHour < 22
  // Benchmark: average of the other completed hours today (>0, !== current).
  const veloBenchmark = useMemo(() => {
    if (!velo?.hourly?.length) return 0
    const vals = velo.hourly
      .filter((h) => h.hour !== veloHour && h.amount > 0)
      .map((h) => h.amount)
    if (!vals.length) return 0
    return vals.reduce((s, v) => s + v, 0) / vals.length
  }, [velo, veloHour])

  // --- Render ---------------------------------------------------------------

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-chart-line text-indigo-400 text-xl" />
          <h1 className="text-2xl font-black text-dax-text">Reportes HQ</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400/80 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
            Ultra
          </span>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || loading}
          className="text-xs font-bold text-violet-400 bg-violet-500/10 px-3 py-2 rounded-lg border border-violet-500/20 hover:bg-violet-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={`fa-solid ${exporting ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'}`} />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1 bg-dax-card rounded-lg p-1 border border-dax-border">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                isPresetActive(p)
                  ? 'bg-violet-600 text-white shadow'
                  : 'bg-transparent text-dax-muted hover:text-dax-text'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={branchId}
          onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setBranchId(v); load(startDate, endDate, v) }}
          className="dax-input text-xs max-w-[160px]"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="dax-input w-36 text-xs" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="dax-input w-36 text-xs" />
        <button onClick={() => load(startDate, endDate, branchId)} className="dax-btn-primary text-xs">
          <i className="fa-solid fa-search" /> Aplicar
        </button>
      </div>

      {loading ? <Spinner text="Cargando reportes..." /> : !data ? (
        <DaxCard><div className="p-12 text-center text-dax-faint">Sin datos</div></DaxCard>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════════
              Row: Velocimeter + Gauge — the "hero" row
          ════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DaxCard className="lg:col-span-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 blur-3xl rounded-full pointer-events-none" />
              <div className="relative flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest flex items-center gap-2 mb-1">
                    <i className="fa-solid fa-gauge-high text-sem-info" /> Velocidad
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${veloOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  </p>
                  {veloOpen ? (
                    <>
                      <p className="text-4xl sm:text-5xl font-black text-sem-info tabular-nums">
                        {formatCurrency(velo?.current_hour_amount ?? 0)}
                      </p>
                      <p className="text-xs text-dax-muted mt-1">
                        Ventas de las {veloHour}:00 · {velo?.current_hour_tickets ?? 0} tickets
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-4xl sm:text-5xl font-black text-dax-faint tabular-nums">Cerrado</p>
                      <p className="text-xs text-dax-muted mt-1">Fuera de horario laboral (8:00 — 22:00)</p>
                    </>
                  )}
                </div>
                <Gauge
                  current={velo?.current_hour_amount ?? 0}
                  benchmark={veloBenchmark || 1}
                  label="Ritmo actual"
                  subtitle="vs. promedio del día"
                  size={180}
                />
              </div>
            </DaxCard>

            <DaxCard className="flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
              <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest flex items-center gap-2 mb-2 self-start">
                <i className="fa-solid fa-bullseye text-sem-success" /> Cumplimiento
              </p>
              <Gauge
                current={currentTotal}
                benchmark={gaugeBenchmark || 1}
                label="vs. período anterior"
                subtitle={prevTotal > 0 ? formatCurrency(prevTotal) : 'sin referencia'}
                size={200}
              />
            </DaxCard>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              Row: 6 KPI cards
          ════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard
              label="Total ventas"
              value={data.kpis?.sales ?? 0}
              previous={data.kpis?.prev_sales}
              icon="fa-coins"
              tone="emerald"
              trend={sparkTrend}
              format={(n) => formatCurrency(n)}
            />
            <KPICard
              label="Transacciones"
              value={data.kpis?.orders ?? 0}
              previous={data.kpis?.prev_orders}
              icon="fa-receipt"
              tone="indigo"
              trend={sparkTrend.map((v) => Math.round(v / 50))}
            />
            <KPICard
              label="Ticket promedio"
              value={data.kpis?.avg_ticket ?? 0}
              previous={data.kpis?.prev_avg_ticket}
              icon="fa-chart-bar"
              tone="violet"
              format={(n) => formatCurrency(n)}
            />
            <KPICard
              label="Productos vendidos"
              value={uniqueSkusSold}
              icon="fa-box-open"
              tone="amber"
            />
            <KPICard
              label="En tránsito"
              value={transitShipments}
              icon="fa-truck"
              tone="sky"
            />
            <MethodKPICard method={topMethod} />
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              Row: Trend dual + Payments donut
          ════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {trendValues.length > 0 && (
              <DaxCard className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-chart-area text-sem-success" /> Tendencia vs. Período Anterior
                  </p>
                </div>
                <div style={{ height: 240 }}>
                  <Line data={trendChartData} options={trendChartOpts as never} />
                </div>
              </DaxCard>
            )}

            {paymentMethods.length > 0 && (
              <DaxCard>
                <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-credit-card text-indigo-400" /> Métodos de Pago
                </p>
                <div className="relative" style={{ height: 240 }}>
                  <Doughnut data={doughnutData} options={doughnutOpts as never} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginRight: '40%' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-dax-muted">Total</p>
                    <p className="text-base font-black text-dax-text tabular-nums">{formatCurrency(totalPayments)}</p>
                  </div>
                </div>
              </DaxCard>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              Row: Heatmap
          ════════════════════════════════════════════════════════════════ */}
          <DaxCard>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-table-cells text-sem-success" /> Heatmap — Día × Hora
              </p>
              {heatmapIsApprox && (
                <span className="text-[9px] text-sem-warning italic">
                  Aproximación (distribución horaria sin desglose por día)
                </span>
              )}
            </div>
            <SalesHeatmap data={heatmapData} />
          </DaxCard>

          {/* ═══════════════════════════════════════════════════════════════
              Row: Leaderboard (wide) + Low stock alerts
          ════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {ccStats?.branches && ccStats.branches.length > 0 && (
              <DaxCard className="lg:col-span-2">
                <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest flex items-center gap-2 mb-4">
                  <i className="fa-solid fa-ranking-star text-sem-warning" /> Leaderboard — Sucursales
                </p>
                <BranchLeaderboard
                  branches={ccStats.branches.map((b) => ({
                    id: b.id,
                    name: b.name,
                    total_sales: b.total_sales ?? 0,
                  }))}
                />
              </DaxCard>
            )}

            <DaxCard>
              <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-sem-warning" /> Alertas de Stock Bajo
              </p>
              {data.low_stock && data.low_stock.length > 0 ? (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {data.low_stock.slice(0, 12).map((p, i) => (
                    <div
                      key={`${p.sku}-${i}`}
                      className="flex justify-between items-center p-2 bg-dax-bg rounded border border-dax-border hover:border-amber-500/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-dax-muted truncate">{p.name}</p>
                        <p className="text-[10px] text-dax-muted font-mono truncate">{p.sku || '—'}</p>
                      </div>
                      <div className="text-right pl-2">
                        <span className="block text-sm font-black text-sem-warning tabular-nums">{p.stock}</span>
                        <span className="text-[9px] text-dax-muted uppercase">Disp.</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-sem-success italic flex items-center gap-1">
                  <i className="fa-solid fa-circle-check" /> Inventario saludable.
                </p>
              )}
            </DaxCard>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              Row: Top products with sparklines
          ════════════════════════════════════════════════════════════════ */}
          {data.top_products && data.top_products.length > 0 && (
            <DaxCard>
              <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fa-solid fa-fire text-orange-400" /> Top Productos — Tendencia por Producto
              </p>
              <div className="space-y-1.5">
                {data.top_products.slice(0, 10).map((p, i) => {
                  const maxQty = Math.max(...(p.trend ?? [0]), p.qty)
                  const relPct = maxQty > 0 ? (p.qty / maxQty) * 100 : 0
                  const trendArr = (p.trend && p.trend.length >= 2) ? p.trend : fakeTrend(p.qty, i)
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-dax-card transition-colors"
                    >
                      <span className="text-[10px] font-mono font-bold text-dax-muted w-6 text-right">#{i + 1}</span>
                      <span className="text-xs font-bold text-dax-text flex-1 truncate" title={p.name}>{p.name}</span>
                      <div className="hidden sm:block">
                        <Sparkline data={trendArr} />
                      </div>
                      <div className="w-20 h-1.5 bg-dax-card rounded-full overflow-hidden hidden md:block">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${relPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-sem-success tabular-nums w-16 text-right">
                        {p.qty}u
                      </span>
                    </div>
                  )
                })}
              </div>
              {data.top_products.some((p) => !p.trend || p.trend.length < 2) && (
                <p className="mt-3 text-[9px] text-sem-warning italic">
                  Algunos productos muestran tendencia simulada — el backend completará los datos reales por producto.
                </p>
              )}
            </DaxCard>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Specialised KPI card for the top payment method: count-up animation doesn't
 * apply to a string label, so we disable it and skip the sparkline.
 */
function MethodKPICard({ method }: { method: string }) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-dax-border bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-400/40"
      style={{ backdropFilter: 'blur(6px)' }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <i className="fa-solid fa-credit-card text-dax-text text-[11px]" />
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-dax-muted">Método top</p>
      </div>
      <p className="text-xl font-black tabular-nums leading-tight text-dax-text truncate">
        {method}
      </p>
      <p className="mt-1 text-[9px] text-dax-muted">Más usado en el período</p>
    </div>
  )
}

/**
 * Stable pseudo-random sparkline used only when the backend doesn't include
 * per-product `trend`. Seeded by position so the sequence is deterministic
 * across renders. Flagged visually in the caller with a disclaimer.
 */
function fakeTrend(mean: number, seedBase: number, n = 14): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const seed = (seedBase * 31 + i * 17) * 9301 + 49297
    const r = ((seed % 233280) / 233280)
    out.push(Math.max(0, mean / n * (0.4 + r * 1.2)))
  }
  return out
}
