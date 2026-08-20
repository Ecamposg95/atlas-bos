import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tablesApi } from '../../api/tables'
import { parkedTicketsApi } from '../../api/sales'
import { kitchenApi } from '../../api/kitchen'
import { Button } from '../../components/ui/Button'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { TableFormModal } from '../../components/tables/TableFormModal'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { confirm as confirmDialog } from '../../components/ui/ConfirmDialog'
import { formatCurrency } from '../../utils/currency'
import { ticketTotal, minutesOpen, cartItemCount } from './tableUtils'
import type { DiningArea, DiningTable } from '../../types/tables'
import { StatusChip, TABLE_STATUS, toneBorder, toneBg } from '../../components/ui/StatusChip'

interface Enriched {
  total: number
  items: number
  kitchenCount: number
}

export function FloorPlan() {
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined

  const [areas, setAreas] = useState<DiningArea[]>([])
  const [tables, setTables] = useState<DiningTable[]>([])
  const [meta, setMeta] = useState<Record<number, Enriched>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [modal, setModal] = useState<null | { mode: 'area' | 'table'; areaId: number | null }>(null)

  // Timer vivo para los minutos abiertos.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const loadingRef = useRef(false)

  // `background: true` = refresco silencioso del polling — sin spinner que
  // reemplace todo el salón, y sin solaparse si el anterior sigue corriendo.
  const load = useCallback(async (background = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!background) setLoading(true)
    try {
      const [a, t] = await Promise.all([
        tablesApi.listAreas(branchId),
        tablesApi.listTables(branchId),
      ])
      setAreas(a)
      setTables(t)

      // Enriquecer mesas ocupadas: total de cuenta + comandas en cocina.
      const feed = await kitchenApi.feed({ branch_id: branchId }).catch(() => [])
      const kitchenByTable: Record<number, number> = {}
      for (const tk of feed) {
        if (tk.table_id && ['NEW', 'IN_PROGRESS'].includes(tk.status)) {
          kitchenByTable[tk.table_id] = (kitchenByTable[tk.table_id] ?? 0) + 1
        }
      }
      const enriched: Record<number, Enriched> = {}
      await Promise.all(
        t.filter((x) => x.current_ticket_id).map(async (x) => {
          try {
            const pt = await parkedTicketsApi.get(x.current_ticket_id as string)
            enriched[x.id] = {
              total: ticketTotal(pt.cart_json),
              items: cartItemCount(pt.cart_json),
              kitchenCount: kitchenByTable[x.id] ?? 0,
            }
          } catch {
            enriched[x.id] = { total: 0, items: 0, kitchenCount: kitchenByTable[x.id] ?? 0 }
          }
        }),
      )
      setMeta(enriched)
    } catch (e: any) {
      if (!background) toast.error(e?.response?.data?.detail ?? 'Error al cargar el salón')
    } finally {
      loadingRef.current = false
      if (!background) setLoading(false)
    }
  }, [branchId])

  useEffect(() => { load() }, [load])

  // Auto-refresh: la tablet de piso debe reflejar lo que hacen los meseros
  // desde el teléfono sin tocar nada. Pausa cuando la pestaña está oculta.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) load(true)
    }, 15000)
    return () => clearInterval(id)
  }, [load])

  const requireBranch = (): number | null => {
    if (!branchId) { toast.warning('Tu usuario no tiene sucursal asignada para gestionar mesas.'); return null }
    return branchId
  }

  const handleCreateArea = async (name: string) => {
    const b = requireBranch(); if (!b) return
    try { await tablesApi.createArea({ name, branch_id: b }); toast.success('Área creada'); load() }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'No se pudo crear el área') }
  }

  const handleCreateTable = async (code: string, seats: number) => {
    const b = requireBranch(); if (!b) return
    const areaId = modal?.areaId ?? null
    try { await tablesApi.createTable({ code, branch_id: b, area_id: areaId, seats }); toast.success('Mesa creada'); load() }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'No se pudo crear la mesa') }
  }

  const act = async (id: number, fn: () => Promise<DiningTable>) => {
    setBusy(id)
    try { await fn(); await load() }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'Acción no permitida') }
    finally { setBusy(null) }
  }

  // Liberar una mesa con cuenta abierta merece confirmación: un toque
  // accidental en tablet soltaba la mesa con consumo activo.
  const handleFree = async (t: DiningTable) => {
    const m = meta[t.id]
    const hasAccount = Boolean(t.current_ticket_id) || (m?.total ?? 0) > 0
    if (hasAccount) {
      const ok = await confirmDialog({
        title: `Liberar mesa ${t.code}`,
        message: m?.total
          ? `La mesa tiene una cuenta abierta por ${formatCurrency(m.total)}. Al liberarla, el ticket queda pausado sin mesa.`
          : 'La mesa tiene una cuenta abierta. Al liberarla, el ticket queda pausado sin mesa.',
        variant: 'warning',
        confirmText: 'Liberar mesa',
      })
      if (!ok) return
    }
    await act(t.id, () => tablesApi.free(t.id))
  }

  const tablesByArea = (areaId: number | null) => tables.filter((t) => t.area_id === areaId)
  const unassigned = tablesByArea(null)

  // KPIs
  const occupied = tables.filter((t) => t.status !== 'AVAILABLE').length
  const free = tables.filter((t) => t.status === 'AVAILABLE').length
  const openSales = Object.values(meta).reduce((s, m) => s + m.total, 0)
  const openTables = tables.filter((t) => t.opened_at)
  const avgMin = openTables.length
    ? Math.round(openTables.reduce((s, t) => s + minutesOpen(t.opened_at, now), 0) / openTables.length)
    : 0

  if (loading) return <Spinner size="lg" text="Cargando salón..." />

  return (
    <div className="space-y-5">
      {/* Header + KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-chair text-amber-400 text-xl" />
          <h1 className="text-2xl font-black text-white">Mesas</h1>
        </div>
        <Button variant="secondary" icon="fa-plus" onClick={() => setModal({ mode: 'area', areaId: null })}>
          Nueva área
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ocupadas', value: occupied, icon: 'fa-users', tint: 'text-amber-300' },
          { label: 'Libres', value: free, icon: 'fa-circle-check', tint: 'text-emerald-300' },
          { label: 'Cuentas abiertas', value: formatCurrency(openSales), icon: 'fa-receipt', tint: 'text-sky-300' },
          { label: 'Tiempo prom.', value: `${avgMin} min`, icon: 'fa-clock', tint: 'text-violet-300' },
        ].map((k) => (
          <DaxCard key={k.label}>
            <div className="flex items-center gap-3">
              <i className={`fa-solid ${k.icon} ${k.tint} text-lg`} />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{k.label}</p>
                <p className="text-lg font-black text-white">{k.value}</p>
              </div>
            </div>
          </DaxCard>
        ))}
      </div>

      {areas.length === 0 && tables.length === 0 && (
        <DaxCard>
          <p className="text-slate-400">Aún no hay mesas. Crea un área (Salón, Terraza…) y agrega mesas para empezar.</p>
        </DaxCard>
      )}

      {[...areas.map((a) => ({ id: a.id as number | null, name: a.name })),
        ...(unassigned.length ? [{ id: null, name: 'Sin área' }] : [])].map((area) => (
        <DaxCard key={area.id ?? 'none'}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">{area.name}</h2>
            <Button variant="ghost" size="sm" icon="fa-plus"
              onClick={() => setModal({ mode: 'table', areaId: area.id })}>
              Mesa
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tablesByArea(area.id).map((t) => {
              const meta_t = TABLE_STATUS[t.status]
              const m = meta[t.id]
              const mins = minutesOpen(t.opened_at, now)
              return (
                <div key={t.id} className="rounded-xl border p-3 transition-colors"
                  style={{ borderColor: toneBorder(meta_t.tone), background: toneBg(meta_t.tone) }}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white text-lg">{t.code}</span>
                    <StatusChip tone={meta_t.tone} label={meta_t.label} size="sm" onDark />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                    <span><i className="fa-solid fa-user" /> {t.seats}</span>
                    {t.opened_at && <span><i className="fa-solid fa-clock" /> {mins}m</span>}
                  </div>
                  {m && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-black text-white">{formatCurrency(m?.total ?? 0)}</p>
                      {m?.kitchenCount ? (
                        <p className="text-[11px] text-orange-300"><i className="fa-solid fa-fire-burner" /> {m.kitchenCount} en cocina</p>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {t.status === 'AVAILABLE' ? (
                      <Button variant="primary" size="sm" loading={busy === t.id}
                        onClick={() => act(t.id, () => tablesApi.open(t.id))}>Abrir</Button>
                    ) : (
                      <>
                        <Button variant="primary" size="sm" icon="fa-utensils"
                          onClick={() => nav(`/mobile/comanda/${t.id}`)}>Comanda</Button>
                        {t.current_ticket_id && (
                          <Button variant="secondary" size="sm" icon="fa-cash-register"
                            onClick={() => nav(`/pos?parked=${t.current_ticket_id}`)}>Cobrar</Button>
                        )}
                        <Button variant="ghost" size="sm" loading={busy === t.id}
                          onClick={() => handleFree(t)}>Liberar</Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {tablesByArea(area.id).length === 0 && (
              <p className="text-xs text-slate-500 col-span-full">Sin mesas en esta área.</p>
            )}
          </div>
        </DaxCard>
      ))}

      <TableFormModal
        open={!!modal}
        mode={modal?.mode ?? 'area'}
        onClose={() => setModal(null)}
        onSubmitArea={handleCreateArea}
        onSubmitTable={handleCreateTable}
      />
    </div>
  )
}
