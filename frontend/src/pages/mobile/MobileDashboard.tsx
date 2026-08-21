import { useCallback, useEffect, useState } from 'react'
import { reportsApi, type DailySummary } from '../../api/reports'
import { Link } from 'react-router-dom'
import { Spinner } from '../../components/ui/Spinner'
import { ErrorState } from '../../components/ui/ErrorState'
import { formatCurrency } from '../../utils/currency'
import { todayStr } from '../../utils/dates'

export function MobileDashboard() {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [now, setNow] = useState(new Date())

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    reportsApi.dailySummary(todayStr())
      .then(setSummary)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const tick = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(tick)
  }, [load])

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{greeting}</p>
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="h-12 w-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
          <i className="fa-solid fa-mobile-screen text-indigo-400 text-xl" />
        </div>
      </div>

      {loading ? <Spinner text="Cargando..." /> : loadError ? (
        <div className="dax-card">
          <ErrorState onRetry={load} compact />
        </div>
      ) : summary ? (
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hoy</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="dax-card">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ventas</p>
              <p className="text-xl font-black text-emerald-400 tabular-nums">{formatCurrency(summary.total_sales)}</p>
            </div>
            <div className="dax-card">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Transacciones</p>
              <p className="text-xl font-black text-white tabular-nums">{summary.transaction_count}</p>
            </div>
          </div>

          {summary.by_method.length > 0 && (
            <div className="dax-card space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Por método</p>
              {summary.by_method.map((m) => (
                <div key={m.method} className="flex justify-between text-sm">
                  <span className="text-slate-400">{m.method}</span>
                  <span className="font-semibold text-white tabular-nums">{formatCurrency(m.total)}</span>
                </div>
              ))}
            </div>
          )}

          {summary.top_5_products.length > 0 && (
            <div className="dax-card">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Top productos</p>
              <div className="space-y-2">
                {summary.top_5_products.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-xs w-4">{i + 1}.</span>
                      <span className="text-slate-300">{p.name}</span>
                    </div>
                    <span className="text-slate-500 text-xs">{p.qty} uds · {formatCurrency(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="dax-card p-8 text-center text-slate-600">Sin datos disponibles hoy</div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Accesos rápidos</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Comanda', icon: 'fa-utensils', to: '/mobile/comanda', color: 'text-amber-400' },
            { label: 'Consulta', icon: 'fa-magnifying-glass', to: '/mobile/query', color: 'text-indigo-400' },
            { label: 'Cotización', icon: 'fa-file-invoice', to: '/mobile/sales', color: 'text-emerald-400' },
            { label: 'Mi perfil', icon: 'fa-user-circle', to: '/mobile/profile', color: 'text-slate-400' },
            // '/customers' era una vista de escritorio fuera del allowlist del
            // VENDEDOR; la consulta móvil cubre búsqueda de clientes/productos.
          ].map((link) => (
            <Link key={link.to} to={link.to} className="dax-card flex items-center gap-3 hover:border-indigo-500/40 transition-colors">
              <i className={`fa-solid ${link.icon} ${link.color} text-lg`} />
              <span className="text-sm font-semibold text-slate-300">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
