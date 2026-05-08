import { useEffect, useState } from 'react'
import { reportsApi, type DashboardData } from '../../api/reports'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/currency'
import { todayStr, daysAgoStr } from '../../utils/dates'

export function MobileOwnerDashboard() {
  const user = useAuthStore((s) => s.user)
  const org = useAuthStore((s) => s.org)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    reportsApi.dashboard({ start_date: todayStr(), end_date: todayStr() })
      .then((d) => setData(d))
      .catch(() => setError('No pude cargar el resumen'))
      .finally(() => setLoading(false))
  }, [])

  // Last-7-days fallback if today has no data yet.
  useEffect(() => {
    if (!data) return
    const k = data.kpis
    const empty = !k || (Number(k.sales ?? 0) === 0 && Number(k.orders ?? 0) === 0)
    if (empty) {
      reportsApi.dashboard({ start_date: daysAgoStr(7), end_date: todayStr() })
        .then((d) => setData(d))
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.kpis?.sales, data?.kpis?.orders])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 dark:text-slate-500">
        Cargando…
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500 px-6 text-center text-sm">
        {error}
      </div>
    )
  }

  const k = data?.kpis
  const recent = data?.recent_sales ?? []

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950 max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* Hero */}
      <div className="rounded-3xl bg-purple-600 dark:bg-purple-700 text-white p-5 shadow-2xl shadow-purple-900/20">
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Mi negocio</p>
        <h1 className="text-2xl font-bold">{org?.name ?? 'Organización'}</h1>
        <p className="text-white/80 text-sm mt-1">{user?.full_name ?? user?.username}</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Ventas"
          value={formatCurrency(Number(k?.sales ?? 0))}
          icon="fa-coins"
          color="text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          label="Tickets"
          value={String(k?.orders ?? 0)}
          icon="fa-receipt"
          color="text-purple-600 dark:text-purple-400"
        />
        <KpiCard
          label="Ticket promedio"
          value={formatCurrency(Number(k?.avg_ticket ?? 0))}
          icon="fa-chart-bar"
          color="text-indigo-600 dark:text-indigo-400"
        />
        <KpiCard
          label="Productos"
          value={String(k?.total_products ?? '—')}
          icon="fa-box"
          color="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Top products */}
      {data?.top_products && data.top_products.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg shadow-slate-900/5 dark:shadow-black/30 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Top productos
          </p>
          <div className="space-y-2">
            {data.top_products.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-400 dark:text-slate-600 text-xs w-4 shrink-0">{i + 1}.</span>
                  <span className="text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                </div>
                <span className="text-slate-500 dark:text-slate-400 text-xs tabular-nums shrink-0 ml-2">
                  {p.qty} uds
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sales */}
      {recent.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg shadow-slate-900/5 dark:shadow-black/30 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Ventas recientes
          </p>
          <div className="space-y-2">
            {recent.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex flex-col min-w-0">
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{s.folio}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs truncate">
                    {s.customer || 'Mostrador'}
                  </span>
                </div>
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                  {formatCurrency(Number(s.total ?? 0))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-4">
        Vista de solo lectura. Para acciones, usa la versión de escritorio.
      </p>
    </div>
  )
}

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg shadow-slate-900/5 dark:shadow-black/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <i className={`fa-solid ${icon} text-sm ${color}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
