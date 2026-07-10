import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../utils/currency'

interface Branch {
  id: number
  name: string
  branch_type: string
  address: string | null
  phone: string | null
  is_active: boolean
}

interface BranchKPIs {
  kpis: {
    sales: number
    orders: number
    avg_ticket: number
    pending: number
  }
  top_products: { name: string; qty: number }[]
  low_stock: { name: string; sku: string; stock: number }[]
  recent_sales: { folio: string; total: number; time: string; customer: string }[]
}


const today = () => new Date().toLocaleDateString('en-CA')

export function HQBranchDetail() {
  const { branchId } = useParams<{ branchId: string }>()
  const navigate = useNavigate()

  const [branch, setBranch] = useState<Branch | null>(null)
  const [kpis, setKpis] = useState<BranchKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [branchesRes, kpisRes] = await Promise.all([
        client.get<Branch[]>('/branches/'),
        client.get<BranchKPIs>('/reports/dashboard', {
          params: { start_date: today(), end_date: today(), branch_id: branchId },
        }),
      ])
      const found = branchesRes.data.find((b) => b.id === Number(branchId))
      if (!found) { setError('Sucursal no encontrada'); return }
      setBranch(found)
      setKpis(kpisRes.data)
    } catch {
      setError('Error al cargar datos de la sucursal')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" text="Cargando sucursal..." />
    </div>
  )

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-400 mb-4">{error}</p>
      <button onClick={() => navigate('/hq/branches')} className="dax-btn-secondary">
        <i className="fa-solid fa-arrow-left" /> Volver
      </button>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/hq/branches')}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700"
            >
              <i className="fa-solid fa-arrow-left text-xs" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-store text-emerald-400" />
                {branch?.name}
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ID #{branchId} · {branch?.branch_type}</p>
            </div>
          </div>
        </div>
        <button
          onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
        >
          <i className="fa-solid fa-rotate-right text-xs" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Ventas Hoy', value: formatCurrency(kpis?.kpis.sales ?? 0), icon: 'fa-cash-register', color: 'text-emerald-400' },
          { label: 'Tickets', value: kpis?.kpis.orders ?? 0, icon: 'fa-receipt', color: 'text-blue-400' },
          { label: 'Ticket Prom.', value: formatCurrency(kpis?.kpis.avg_ticket ?? 0), icon: 'fa-chart-line', color: 'text-indigo-400' },
          { label: 'Pendientes', value: kpis?.kpis.pending ?? 0, icon: 'fa-clock', color: 'text-amber-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="dax-card p-4">
            <p className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">{kpi.label}</p>
            <div className="flex items-end justify-between mt-2">
              <h2 className="text-2xl font-bold text-white font-mono">{kpi.value}</h2>
              <i className={`fa-solid ${kpi.icon} ${kpi.color} text-lg opacity-60`} />
            </div>
          </div>
        ))}
      </div>

      {/* Info + Top productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info sucursal */}
        <div className="dax-card p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Información</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Tipo</span>
              <span className="text-white font-medium">{branch?.branch_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Estado</span>
              <span className={branch?.is_active ? 'text-emerald-400' : 'text-red-400'}>
                {branch?.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            {branch?.address && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Dirección</span>
                <span className="text-white text-right">{branch.address}</span>
              </div>
            )}
            {branch?.phone && (
              <div className="flex justify-between">
                <span className="text-slate-500">Teléfono</span>
                <span className="text-white">{branch.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Top productos */}
        <div className="dax-card p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Top Productos Hoy</h3>
          {kpis?.top_products.length ? (
            <div className="space-y-2">
              {kpis.top_products.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{p.name}</span>
                  <span className="text-slate-500 font-mono ml-2 flex-shrink-0">{p.qty} uds</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-sm">Sin ventas registradas hoy</p>
          )}
        </div>
      </div>

      {/* Stock bajo */}
      {(kpis?.low_stock?.length ?? 0) > 0 && (
        <div className="dax-card p-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
            <i className="fa-solid fa-triangle-exclamation mr-1" /> Stock Bajo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {kpis!.low_stock.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 text-sm">
                <div>
                  <p className="text-white font-medium truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{item.sku}</p>
                </div>
                <span className="text-amber-400 font-bold font-mono">{item.stock}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas transacciones */}
      {(kpis?.recent_sales?.length ?? 0) > 0 && (
        <div className="dax-card p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Últimas Transacciones</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-700/50">
                  <th className="pb-2 text-left">Hora</th>
                  <th className="pb-2 text-left">Folio</th>
                  <th className="pb-2 text-left">Cliente</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {kpis!.recent_sales.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-800/20 transition">
                    <td className="py-2 text-slate-500 font-mono">{s.time}</td>
                    <td className="py-2 font-mono text-indigo-400">{s.folio}</td>
                    <td className="py-2">{s.customer || 'Público general'}</td>
                    <td className="py-2 text-right font-bold text-emerald-400">{formatCurrency(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
