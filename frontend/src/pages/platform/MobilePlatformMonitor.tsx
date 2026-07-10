import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { formatCurrency } from '../../utils/currency'

interface OrgSummary {
  id: number
  name: string
  branches_count?: number
  active_users_count?: number
  sales_today?: number
  alerts_count?: number
}

export function MobilePlatformMonitor() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    client.get('/platform/organizations')
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : (r.data?.items ?? [])
        setOrgs(items)
      })
      .catch(() => setError('No pude cargar organizaciones'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Cargando…</div>
  if (error) return <div className="min-h-screen flex items-center justify-center text-rose-500 px-6 text-center text-sm">{error}</div>

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950 max-w-lg mx-auto px-4 py-6 space-y-3">
      <div className="rounded-3xl bg-slate-900 dark:bg-slate-800 text-white p-5">
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Plataforma</p>
        <h1 className="text-2xl font-bold">Organizaciones</h1>
        <p className="text-white/70 text-sm mt-1">{orgs.length} activas</p>
      </div>

      <div className="space-y-2">
        {orgs.map((o) => (
          <Link
            key={o.id}
            to={`/mobile/platform/org/${o.id}`}
            className="block rounded-2xl bg-white dark:bg-slate-900 shadow p-4 active:bg-stone-100 dark:active:bg-slate-800 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{o.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {o.branches_count ?? '—'} sucursales · {o.active_users_count ?? '—'} usuarios
                </p>
                {o.sales_today != null && (
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                    {formatCurrency(Number(o.sales_today))} hoy
                  </p>
                )}
              </div>
              <i className="fa-solid fa-chevron-right text-slate-300 dark:text-slate-600 mt-1" />
            </div>
            {o.alerts_count != null && o.alerts_count > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                {o.alerts_count} alerta{o.alerts_count === 1 ? '' : 's'}
              </p>
            )}
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-4">
        Vista de solo lectura. Acciones administrativas en escritorio.
      </p>
    </div>
  )
}
