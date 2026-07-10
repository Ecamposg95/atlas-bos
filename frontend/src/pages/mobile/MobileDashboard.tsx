import { useEffect, useState } from 'react'
import { reportsApi, type DailySummary } from '../../api/reports'
import { Link } from 'react-router-dom'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../utils/currency'
import { todayStr } from '../../utils/dates'

export function MobileDashboard() {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    reportsApi.dailySummary(todayStr())
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false))
    const tick = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(tick)
  }, [])

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-dax-muted text-sm">{greeting}</p>
          <h1 className="text-2xl font-black text-dax-text">Dashboard</h1>
          <p className="text-dax-muted text-xs mt-0.5">
            {now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="h-12 w-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
          <i className="fa-solid fa-mobile-screen text-indigo-400 text-xl" />
        </div>
      </div>

      {loading ? <Spinner text="Cargando..." /> : summary ? (
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest">Hoy</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="dax-card">
              <p className="text-[10px] text-dax-muted uppercase tracking-wider mb-1">Ventas</p>
              <p className="text-xl font-black text-sem-success tabular-nums">{formatCurrency(summary.total_sales)}</p>
            </div>
            <div className="dax-card">
              <p className="text-[10px] text-dax-muted uppercase tracking-wider mb-1">Transacciones</p>
              <p className="text-xl font-black text-dax-text tabular-nums">{summary.transaction_count}</p>
            </div>
          </div>

          {summary.by_method.length > 0 && (
            <div className="dax-card space-y-2">
              <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest mb-2">Por método</p>
              {summary.by_method.map((m) => (
                <div key={m.method} className="flex justify-between text-sm">
                  <span className="text-dax-muted">{m.method}</span>
                  <span className="font-semibold text-dax-text tabular-nums">{formatCurrency(m.total)}</span>
                </div>
              ))}
            </div>
          )}

          {summary.top_5_products.length > 0 && (
            <div className="dax-card">
              <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest mb-3">Top productos</p>
              <div className="space-y-2">
                {summary.top_5_products.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-dax-faint text-xs w-4">{i + 1}.</span>
                      <span className="text-dax-muted">{p.name}</span>
                    </div>
                    <span className="text-dax-muted text-xs">{p.qty} uds · {formatCurrency(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="dax-card p-8 text-center text-dax-faint">Sin datos disponibles hoy</div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest">Accesos rápidos</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Comanda', icon: 'fa-utensils', to: '/mobile/comanda', color: 'text-sem-warning' },
            { label: 'Consulta', icon: 'fa-magnifying-glass', to: '/mobile/query', color: 'text-indigo-400' },
            { label: 'Cotización', icon: 'fa-file-invoice', to: '/mobile/sales', color: 'text-sem-success' },
            { label: 'Mi perfil', icon: 'fa-user-circle', to: '/mobile/profile', color: 'text-dax-muted' },
            { label: 'Clientes', icon: 'fa-users', to: '/customers', color: 'text-sem-warning' },
          ].map((link) => (
            <Link key={link.to} to={link.to} className="dax-card flex items-center gap-3 hover:border-indigo-500/40 transition-colors">
              <i className={`fa-solid ${link.icon} ${link.color} text-lg`} />
              <span className="text-sm font-semibold text-dax-muted">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
