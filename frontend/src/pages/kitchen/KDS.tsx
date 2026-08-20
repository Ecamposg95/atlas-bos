import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { kitchenApi } from '../../api/kitchen'
import { tablesApi } from '../../api/tables'
import { Button } from '../../components/ui/Button'
import { DaxCard } from '../../components/ui/DaxCard'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import type { KitchenStation, KitchenTicket } from '../../types/kitchen'
import { StatusChip, KDS_STATUS, ITEM_STATUS, toneBorder } from '../../components/ui/StatusChip'

// Semáforo de cocina: a partir de estos minutos la comanda pide atención.
const WARN_MIN = 10
const LATE_MIN = 15

function ageMinutes(seconds: number | null): number | null {
  return seconds == null ? null : Math.floor(seconds / 60)
}

/** Borde y etiqueta de edad según el semáforo; si no aplica, el tono del status. */
function ticketUrgency(mins: number | null): 'late' | 'warn' | null {
  if (mins == null) return null
  if (mins >= LATE_MIN) return 'late'
  if (mins >= WARN_MIN) return 'warn'
  return null
}

export function KDS() {
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined

  const [tickets, setTickets] = useState<KitchenTicket[]>([])
  const [stations, setStations] = useState<KitchenStation[]>([])
  const [stationFilter, setStationFilter] = useState<number | null>(null)
  const [tableCodes, setTableCodes] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [connLost, setConnLost] = useState(false)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [busyTicket, setBusyTicket] = useState<number | null>(null)
  const [busyItem, setBusyItem] = useState<number | null>(null)
  const [stationModal, setStationModal] = useState(false)
  const [stationName, setStationName] = useState('')
  const [stationSaving, setStationSaving] = useState(false)
  const firstLoad = useRef(true)

  // Estaciones y códigos de mesa: una vez al montar. El feed usa polling aparte.
  useEffect(() => {
    kitchenApi.listStations(branchId)
      .then(setStations)
      .catch(() => { /* el feed reporta la conexión; aquí no duplicamos toasts */ })
    tablesApi.listTables(branchId)
      .then((ts) => setTableCodes(Object.fromEntries(ts.map((t) => [t.id, t.code]))))
      .catch(() => { /* fallback: se muestra el id interno */ })
  }, [branchId])

  const load = useCallback(async () => {
    try {
      const feed = await kitchenApi.feed({
        branch_id: branchId,
        station_id: stationFilter ?? undefined,
      })
      setTickets(feed)
      setConnLost(false)
      setLastSync(Date.now())
    } catch (e: any) {
      // Nunca silencioso: el tablero congelado debe ANUNCIAR que está congelado.
      setConnLost(true)
      if (firstLoad.current) toast.error(e?.response?.data?.detail ?? 'Error al cargar la cocina')
    } finally {
      if (firstLoad.current) {
        setLoading(false)
        firstLoad.current = false
      }
    }
  }, [branchId, stationFilter])

  useEffect(() => {
    load()
    const id = setInterval(load, 8000) // auto-refresh del tablero
    return () => clearInterval(id)
  }, [load])

  const createStation = async () => {
    if (!branchId) { toast.warning('Tu usuario no tiene sucursal asignada.'); return }
    const name = stationName.trim()
    if (!name) return
    setStationSaving(true)
    try {
      const s = await kitchenApi.createStation({ name, branch_id: branchId })
      setStations((prev) => [...prev, s])
      setStationModal(false)
      setStationName('')
      toast.success(`Estación "${s.name}" creada`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo crear la estación')
    } finally {
      setStationSaving(false)
    }
  }

  const bumpItem = async (itemId: number) => {
    if (busyItem != null) return // anti doble-tap
    setBusyItem(itemId)
    try {
      await kitchenApi.bumpItem(itemId)
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo avanzar el item')
    } finally {
      setBusyItem(null)
    }
  }

  const bumpTicket = async (id: number) => {
    if (busyTicket != null) return // anti doble-tap
    setBusyTicket(id)
    try {
      // Con filtro activo solo se avanzan los items de ESTA estación.
      await kitchenApi.bumpTicket(id, stationFilter ?? undefined)
      await load()
    } catch {
      toast.error('No se pudo avanzar la comanda')
    } finally {
      setBusyTicket(null)
    }
  }

  const staleSeconds = useMemo(
    () => (connLost && lastSync ? Math.round((Date.now() - lastSync) / 1000) : null),
    [connLost, lastSync, tickets],
  )

  if (loading) return <Spinner size="lg" text="Cargando cocina..." />

  return (
    <div className="space-y-5">
      {/* Banner de desconexión — visible desde el otro lado de la cocina */}
      {connLost && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border-2 border-red-500/60 bg-red-500/15 px-4 py-3 animate-pulse"
        >
          <i className="fa-solid fa-triangle-exclamation text-red-400 text-xl" />
          <p className="text-base font-black text-red-200 m-0">
            SIN CONEXIÓN CON COCINA — reintentando…
            {staleSeconds != null && staleSeconds > 15 && (
              <span className="font-semibold"> Datos de hace {staleSeconds}s.</span>
            )}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-fire-burner text-orange-400 text-xl" />
          <h1 className="text-2xl font-black text-white">Cocina (KDS)</h1>
        </div>
        <Button variant="secondary" icon="fa-plus" onClick={() => setStationModal(true)}>Estación</Button>
      </div>

      {/* Filtro por estación — cada pantalla de cocina elige la suya */}
      {stations.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[{ id: null as number | null, name: 'Todas' }, ...stations].map((s) => (
            <button
              key={s.id ?? 'all'}
              onClick={() => setStationFilter(s.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-colors min-h-[44px] ${
                stationFilter === s.id
                  ? 'bg-orange-500 text-black'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

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
          <p className="text-slate-400">
            {stationFilter != null ? 'No hay comandas para esta estación. 🍳' : 'No hay comandas activas. 🍳'}
          </p>
        </DaxCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tickets.map((t) => {
            const mins = ageMinutes(t.age_seconds)
            const urgency = ticketUrgency(mins)
            const borderColor =
              urgency === 'late' ? '#ef4444'
              : urgency === 'warn' ? '#f59e0b'
              : toneBorder(KDS_STATUS[t.status].tone)
            return (
              <div
                key={t.id}
                className={`dax-card p-4 border-2 ${urgency === 'late' ? 'animate-pulse' : ''}`}
                style={{ borderColor }}
              >
                <div className="flex items-center justify-between mb-3 gap-2">
                  <span className="font-black text-white text-2xl leading-none">
                    {t.table_id ? `Mesa ${tableCodes[t.table_id] ?? t.table_id}` : `#${t.id}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusChip tone={KDS_STATUS[t.status].tone} label={KDS_STATUS[t.status].label} size="sm" onDark />
                    <span
                      className={`font-black tabular-nums ${
                        urgency === 'late' ? 'text-red-400 text-xl'
                        : urgency === 'warn' ? 'text-amber-400 text-lg'
                        : 'text-slate-400 text-base'
                      }`}
                    >
                      {mins == null ? '' : mins < 1 ? 'recién' : `${mins}′`}
                    </span>
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {t.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg text-white leading-snug">
                          <span className="font-black">{Number(it.qty)}×</span> {it.description}
                        </p>
                        {it.modifiers && it.modifiers.length > 0 && (
                          <p className="text-sm font-bold text-amber-300">{it.modifiers.join(', ')}</p>
                        )}
                      </div>
                      <button
                        onClick={() => bumpItem(it.id)}
                        disabled={it.status === 'SERVED' || it.status === 'VOIDED' || busyItem === it.id}
                        className="text-sm font-bold px-4 min-h-[44px] rounded-lg bg-slate-700/60 text-slate-100 hover:bg-slate-600 disabled:opacity-40 flex-shrink-0"
                        title="Avanzar item"
                      >
                        {ITEM_STATUS[it.status].label}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={busyTicket === t.id}
                    onClick={() => bumpTicket(t.id)}
                  >
                    Avanzar comanda
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={stationModal}
        onClose={() => !stationSaving && setStationModal(false)}
        title="Nueva estación de cocina"
        size="sm"
        footer={
          <>
            <button className="dax-btn-secondary" onClick={() => setStationModal(false)} disabled={stationSaving}>
              Cancelar
            </button>
            <Button variant="primary" loading={stationSaving} onClick={createStation} disabled={!stationName.trim()}>
              Crear estación
            </Button>
          </>
        }
      >
        <label htmlFor="kds-station-name" className="block text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--dax-text-muted)' }}>
          Nombre
        </label>
        <input
          id="kds-station-name"
          className="dax-input w-full"
          placeholder="Cocina caliente, Barra…"
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createStation() }}
        />
      </Modal>
    </div>
  )
}
