import { useCallback, useEffect, useRef, useState } from 'react'
import { kitchenApi } from '../../api/kitchen'
import { Button } from '../../components/ui/Button'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import type { KitchenStation, KitchenTicket } from '../../types/kitchen'
import { StatusChip, KDS_STATUS, ITEM_STATUS, toneBorder } from '../../components/ui/StatusChip'

function ageLabel(seconds: number | null): string {
  if (seconds == null) return ''
  const m = Math.floor(seconds / 60)
  return m < 1 ? 'recién' : `${m} min`
}

export function KDS() {
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined

  const [tickets, setTickets] = useState<KitchenTicket[]>([])
  const [stations, setStations] = useState<KitchenStation[]>([])
  const [loading, setLoading] = useState(true)
  const firstLoad = useRef(true)

  const load = useCallback(async () => {
    try {
      const [feed, st] = await Promise.all([
        kitchenApi.feed({ branch_id: branchId }),
        firstLoad.current ? kitchenApi.listStations(branchId) : Promise.resolve(stations),
      ])
      setTickets(feed)
      if (firstLoad.current) setStations(st)
    } catch (e: any) {
      if (firstLoad.current) toast.error(e?.response?.data?.detail ?? 'Error al cargar la cocina')
    } finally {
      if (firstLoad.current) {
        setLoading(false)
        firstLoad.current = false
      }
    }
  }, [branchId, stations])

  useEffect(() => {
    load()
    const id = setInterval(load, 8000) // auto-refresh del tablero
    return () => clearInterval(id)
  }, [load])

  const ensureStation = async () => {
    if (!branchId) {
      toast.warning('Tu usuario no tiene sucursal asignada.')
      return
    }
    const name = window.prompt('Nombre de la estación (Ej: Cocina caliente, Barra)')
    if (!name) return
    try {
      const s = await kitchenApi.createStation({ name, branch_id: branchId })
      setStations((prev) => [...prev, s])
      toast.success('Estación creada')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo crear la estación')
    }
  }

  const bumpItem = async (itemId: number) => {
    try {
      await kitchenApi.bumpItem(itemId)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo avanzar el item')
    }
  }

  const bumpTicket = async (id: number) => {
    try {
      await kitchenApi.bumpTicket(id)
      load()
    } catch {
      toast.error('No se pudo avanzar la comanda')
    }
  }

  if (loading) return <Spinner size="lg" text="Cargando cocina..." />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-fire-burner text-orange-400 text-xl" />
          <h1 className="text-2xl font-black text-white">Cocina (KDS)</h1>
        </div>
        <Button variant="secondary" icon="fa-plus" onClick={ensureStation}>Estación</Button>
      </div>

      {stations.length === 0 && (
        <DaxCard>
          <p className="text-slate-400">
            Crea al menos una estación de cocina para enrutar las comandas. Luego envía
            platillos desde el punto de venta.
          </p>
        </DaxCard>
      )}

      {tickets.length === 0 ? (
        <DaxCard>
          <p className="text-slate-400">No hay comandas activas. 🍳</p>
        </DaxCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tickets.map((t) => (
            <div key={t.id} className="dax-card p-4 border-2"
              style={{ borderColor: toneBorder(KDS_STATUS[t.status].tone) }}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="font-black text-white">
                  {t.table_id ? `Mesa ${t.table_id}` : `Comanda #${t.id}`}
                </span>
                <div className="flex items-center gap-2">
                  <StatusChip tone={KDS_STATUS[t.status].tone} label={KDS_STATUS[t.status].label} size="sm" onDark />
                  <span className="text-[11px] text-slate-400">{ageLabel(t.age_seconds)}</span>
                </div>
              </div>
              <ul className="space-y-1.5">
                {t.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        <span className="font-bold">{Number(it.qty)}×</span> {it.description}
                      </p>
                      {it.modifiers && it.modifiers.length > 0 && (
                        <p className="text-[11px] text-amber-300/80 truncate">{it.modifiers.join(', ')}</p>
                      )}
                    </div>
                    <button
                      onClick={() => bumpItem(it.id)}
                      disabled={it.status === 'SERVED' || it.status === 'VOIDED'}
                      className="text-[10px] font-bold px-2 py-1 rounded bg-slate-700/60 text-slate-200 hover:bg-slate-600 disabled:opacity-40"
                      title="Avanzar item"
                    >
                      {ITEM_STATUS[it.status].label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Button variant="primary" size="sm" onClick={() => bumpTicket(t.id)}>
                  Avanzar comanda
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
