// frontend/src/pages/mobile/ComandaTables.tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tablesApi } from '../../api/tables'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { minutesOpen } from '../tables/tableUtils'
import type { DiningTable } from '../../types/tables'
import { StatusChip, TABLE_STATUS } from '../../components/ui/StatusChip'

export function ComandaTables() {
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined
  const [tables, setTables] = useState<DiningTable[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [busy, setBusy] = useState<number | null>(null)
  const now = Date.now()

  const load = useCallback(async () => {
    setLoading(true)
    try { setTables(await tablesApi.listTables(branchId)) }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'Error al cargar mesas') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  const visible = tables.filter((t) =>
    scope === 'all' ? true : (t.server_user_id === user?.id || t.status === 'AVAILABLE'))

  const openAndGo = async (t: DiningTable) => {
    if (t.status !== 'AVAILABLE') { nav(`/mobile/comanda/${t.id}`); return }
    setBusy(t.id)
    try { await tablesApi.open(t.id); nav(`/mobile/comanda/${t.id}`) }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'No se pudo abrir la mesa') }
    finally { setBusy(null) }
  }

  if (loading) return <Spinner size="lg" text="Cargando mesas..." />

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-dax-text"><i className="fa-solid fa-utensils text-sem-warning mr-2" />Comanda</h1>
        <div className="flex rounded-lg overflow-hidden border border-dax-border text-xs">
          <button className={`px-3 py-1.5 ${scope === 'mine' ? 'bg-amber-500 text-black font-bold' : 'text-dax-muted'}`}
            onClick={() => setScope('mine')}>Mis mesas</button>
          <button className={`px-3 py-1.5 ${scope === 'all' ? 'bg-amber-500 text-black font-bold' : 'text-dax-muted'}`}
            onClick={() => setScope('all')}>Todas</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visible.map((t) => (
          <button key={t.id} disabled={busy === t.id} onClick={() => openAndGo(t)}
            className="dax-card text-left active:scale-95 transition-transform disabled:opacity-50">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-dax-text">{t.code}</span>
              <StatusChip tone={TABLE_STATUS[t.status].tone} dotOnly style={{ transform: 'scale(1.15)' }} />
            </div>
            <p className="mt-1 text-xs text-dax-muted">
              <i className="fa-solid fa-user" /> {t.seats}
              {t.opened_at && <span className="ml-2"><i className="fa-solid fa-clock" /> {minutesOpen(t.opened_at, now)}m</span>}
            </p>
            <p className="mt-2 text-xs font-bold text-sem-warning">
              {t.status === 'AVAILABLE' ? 'Tocar para abrir' : 'Ver comanda'}
            </p>
          </button>
        ))}
        {visible.length === 0 && <p className="col-span-2 text-sm text-dax-muted">No hay mesas para mostrar.</p>}
      </div>
    </div>
  )
}
