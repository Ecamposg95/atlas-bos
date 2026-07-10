import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import client from '../../api/client'
import { formatCurrency } from '../../utils/currency'

interface BranchSummary {
  id: number
  name: string
  branch_type?: string
  sales_today?: number
  active_users?: number
}

interface OrgDetail {
  id: number
  name: string
  branches: BranchSummary[]
}

export function MobileOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>()
  const [data, setData] = useState<OrgDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    client.get(`/platform/organizations/${orgId}`)
      .then((r) => setData(r.data))
      .catch(() => setError('No pude cargar la organización'))
      .finally(() => setLoading(false))
  }, [orgId])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-dax-muted">Cargando…</div>
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-sem-critical px-6 text-center text-sm">{error ?? 'No encontrada'}</div>

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-dax-bg max-w-lg mx-auto px-4 py-6 space-y-3">
      <Link to="/mobile/platform" className="inline-flex items-center gap-2 text-sm text-dax-faint dark:text-dax-muted">
        <i className="fa-solid fa-arrow-left" /> Organizaciones
      </Link>

      <div className="rounded-3xl bg-dax-bg dark:bg-dax-card text-dax-text p-5">
        <p className="text-dax-text text-xs font-semibold uppercase tracking-widest mb-1">Organización</p>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p className="text-dax-text text-sm mt-1">{(data.branches ?? []).length} sucursales</p>
      </div>

      <div className="space-y-2">
        {(data.branches ?? []).map((b) => (
          <div key={b.id} className="rounded-2xl bg-white dark:bg-dax-bg shadow p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-dax-text truncate">{b.name}</p>
                <p className="text-xs text-dax-muted dark:text-dax-muted mt-0.5">
                  {b.branch_type ?? 'STORE'} · {b.active_users ?? '—'} usuarios activos
                </p>
                {b.sales_today != null && (
                  <p className="text-sm font-semibold text-sem-success dark:text-sem-success mt-1 tabular-nums">
                    {formatCurrency(Number(b.sales_today))} hoy
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
