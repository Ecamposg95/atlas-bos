import { useCallback, useEffect, useState } from 'react'
import { tablesApi } from '../../api/tables'
import { Button } from '../../components/ui/Button'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import type { DiningArea, DiningTable, TableStatus } from '../../types/tables'

const STATUS_STYLE: Record<TableStatus, { label: string; cls: string }> = {
  AVAILABLE:      { label: 'Libre',        cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  OCCUPIED:       { label: 'Ocupada',      cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  BILL_REQUESTED: { label: 'Pidió cuenta', cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  CLEANING:       { label: 'Limpieza',     cls: 'border-slate-500/40 bg-slate-500/10 text-slate-300' },
  RESERVED:       { label: 'Reservada',    cls: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
}

export function FloorPlan() {
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined

  const [areas, setAreas] = useState<DiningArea[]>([])
  const [tables, setTables] = useState<DiningTable[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, t] = await Promise.all([
        tablesApi.listAreas(branchId),
        tablesApi.listTables(branchId),
      ])
      setAreas(a)
      setTables(t)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al cargar el salón')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const requireBranch = (): number | null => {
    if (!branchId) {
      toast.warning('Tu usuario no tiene sucursal asignada para gestionar mesas.')
      return null
    }
    return branchId
  }

  const handleAddArea = async () => {
    const b = requireBranch()
    if (!b) return
    const name = window.prompt('Nombre del área (Ej: Salón, Terraza, Barra)')
    if (!name) return
    try {
      await tablesApi.createArea({ name, branch_id: b })
      toast.success('Área creada')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo crear el área')
    }
  }

  const handleAddTable = async (areaId: number | null) => {
    const b = requireBranch()
    if (!b) return
    const code = window.prompt('Código de la mesa (Ej: M1)')
    if (!code) return
    try {
      await tablesApi.createTable({ code, branch_id: b, area_id: areaId, seats: 4 })
      toast.success('Mesa creada')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo crear la mesa')
    }
  }

  const act = async (id: number, fn: () => Promise<DiningTable>) => {
    setBusy(id)
    try {
      await fn()
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Acción no permitida')
    } finally {
      setBusy(null)
    }
  }

  const tablesByArea = (areaId: number | null) =>
    tables.filter((t) => t.area_id === areaId)

  const unassigned = tablesByArea(null)

  if (loading) return <Spinner size="lg" text="Cargando salón..." />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-chair text-amber-400 text-xl" />
          <h1 className="text-2xl font-black text-white">Mesas</h1>
        </div>
        <Button variant="secondary" icon="fa-plus" onClick={handleAddArea}>Nueva área</Button>
      </div>

      {areas.length === 0 && tables.length === 0 && (
        <DaxCard>
          <p className="text-slate-400">
            Aún no hay mesas. Crea un área (Salón, Terraza…) y agrega mesas para empezar.
          </p>
        </DaxCard>
      )}

      {[...areas.map((a) => ({ id: a.id, name: a.name })), ...(unassigned.length ? [{ id: null, name: 'Sin área' }] : [])].map((area) => (
        <DaxCard key={area.id ?? 'none'}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">{area.name}</h2>
            <Button variant="ghost" size="sm" icon="fa-plus" onClick={() => handleAddTable(area.id)}>
              Mesa
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tablesByArea(area.id).map((t) => {
              const st = STATUS_STYLE[t.status]
              return (
                <div key={t.id} className={`rounded-xl border p-3 ${st.cls}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white">{t.code}</span>
                    <span className="text-[10px] opacity-80">{t.seats} <i className="fa-solid fa-user" /></span>
                  </div>
                  <p className="text-[11px] font-bold mt-1">{st.label}</p>
                  <div className="mt-2 flex gap-1">
                    {t.status === 'AVAILABLE' ? (
                      <Button
                        variant="primary" size="sm" loading={busy === t.id}
                        onClick={() => act(t.id, () => tablesApi.open(t.id))}
                      >
                        Abrir
                      </Button>
                    ) : (
                      <Button
                        variant="secondary" size="sm" loading={busy === t.id}
                        onClick={() => act(t.id, () => tablesApi.free(t.id))}
                      >
                        Liberar
                      </Button>
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
    </div>
  )
}
