import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reportsApi, type CommandCenterStats } from '../../api/reports'
import { organizationApi, type Branch } from '../../api/organization'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { formatCurrency } from '../../utils/currency'
import { todayStr } from '../../utils/dates'

export function HQBranches() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [stats, setStats] = useState<CommandCenterStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = todayStr()
    Promise.all([
      organizationApi.getBranches(),
      reportsApi.commandCenterStats({ start_date: today, end_date: today }),
    ]).then(([b, s]) => { setBranches(b); setStats(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const branchStats = (id: number) => stats?.branches?.find((b) => b.id === id)

  const branchTypeLabel = (t: string) =>
    ({ HQ: 'Casa Matriz', STORE: 'Sucursal', WAREHOUSE: 'Almacén', OFFICE: 'Oficina' }[t] ?? t)

  if (loading) return <Spinner text="Cargando sucursales..." />

  const online = stats?.branches?.filter((b) => b.pending_cuts > 0).length ?? 0
  const offline = (stats?.branches?.length ?? 0) - online
  const totalAlerts = stats?.alerts?.length ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-store text-indigo-400 text-xl" />
        <h1 className="text-2xl font-black text-white">Sucursales</h1>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DaxCard>
          <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Total Sucursales</p>
          <p className="text-2xl font-bold text-white tabular-nums">{branches.length}</p>
        </DaxCard>
        <DaxCard>
          <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Online</p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{online}</p>
        </DaxCard>
        <DaxCard>
          <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Offline</p>
          <p className="text-2xl font-bold text-rose-400 tabular-nums">{offline}</p>
        </DaxCard>
        <DaxCard>
          <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Alertas Activas</p>
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{totalAlerts}</p>
        </DaxCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b) => {
          const bStats = branchStats(b.id)
          const isOpen = bStats ? bStats.pending_cuts > 0 : false
          return (
            <Link key={b.id} to={`/hq/branches/${b.id}`} className="block hover:opacity-90 transition-opacity">
              <DaxCard className={`h-full ${isOpen ? 'hover:border-emerald-500/30' : 'hover:border-slate-600/50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-black text-white text-sm">{b.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{branchTypeLabel(b.branch_type)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${isOpen ? 'text-emerald-400' : 'text-slate-600'}`}>
                      <i className="fa-solid fa-circle text-[8px]" />
                      {isOpen ? 'Abierta' : 'Cerrada'}
                    </div>
                    <Badge variant={b.is_active ? 'green' : 'slate'}>{b.is_active ? 'Activa' : 'Inactiva'}</Badge>
                  </div>
                </div>

                {bStats ? (
                  <div className="space-y-1.5 text-sm border-t border-slate-700/30 pt-3">
                    <div className="flex justify-between text-slate-400">
                      <span>Ventas hoy</span>
                      <span className="text-emerald-400 font-semibold">{formatCurrency(bStats.total_sales)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Sesiones abiertas</span>
                      <span className="text-indigo-400 font-semibold">{bStats.pending_cuts ?? 0}</span>
                    </div>
                    {bStats.critical_stock > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Stock crítico</span>
                        <span className="text-amber-400 font-semibold">{bStats.critical_stock}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-slate-700/30 pt-3 space-y-1.5 text-sm">
                    {b.phone && <div className="flex items-center gap-2 text-slate-500"><i className="fa-solid fa-phone text-xs" />{b.phone}</div>}
                    {b.address && <div className="flex items-center gap-2 text-slate-500 text-xs"><i className="fa-solid fa-location-dot" />{b.address}</div>}
                  </div>
                )}
              </DaxCard>
            </Link>
          )
        })}
      </div>

      {branches.length === 0 && (
        <DaxCard>
          <div className="p-12 text-center text-slate-600">Sin sucursales configuradas</div>
        </DaxCard>
      )}
    </div>
  )
}
