// frontend/src/pages/mobile/ComandaOrder.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tablesApi } from '../../api/tables'
import { parkedTicketsApi } from '../../api/sales'
import { kitchenApi } from '../../api/kitchen'
import { productsApi } from '../../api/products'
import { toFireItem, toCartItem, type CartLine } from '../../api/comanda'
import { ticketTotal } from '../tables/tableUtils'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { confirm as confirmDialog } from '../../components/ui/ConfirmDialog'
import { formatCurrency } from '../../utils/currency'
import type { DiningTable } from '../../types/tables'
import type { Product } from '../../types/products'
import { StatusChip, TABLE_STATUS } from '../../components/ui/StatusChip'

export function ComandaOrder() {
  const { tableId } = useParams<{ tableId: string }>()
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined

  const [table, setTable] = useState<DiningTable | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [sent, setSent] = useState<CartLine[]>([])       // ya en la cuenta
  const [draft, setDraft] = useState<Record<string, { p: Product; qty: number; note?: string }>>({}) // por enviar
  const [loading, setLoading] = useState(true)
  const [firing, setFiring] = useState(false)
  const [billBusy, setBillBusy] = useState(false)
  const [noteOpen, setNoteOpen] = useState<string | null>(null) // línea con editor de nota abierto

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await tablesApi.listTables(branchId)
      const t = all.find((x) => String(x.id) === tableId) ?? null
      setTable(t)
      if (t?.current_ticket_id) {
        const pt = await parkedTicketsApi.get(t.current_ticket_id)
        const items = Array.isArray((pt.cart_json as any)?.items) ? (pt.cart_json as any).items : []
        setSent(items as CartLine[])
      }
      const res = await productsApi.list({ limit: 200 })
      setProducts(res.items ?? [])
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al cargar la comanda')
    } finally { setLoading(false) }
  }, [branchId, tableId])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const names = new Set<string>()
    products.forEach((p) => names.add(p.department?.name ?? p.department_name ?? 'General'))
    return ['Todas', ...Array.from(names)]
  }, [products])
  const [cat, setCat] = useState('Todas')
  const menu = products.filter((p) =>
    cat === 'Todas' ? true : (p.department?.name ?? p.department_name ?? 'General') === cat)

  const addDraft = (p: Product) =>
    setDraft((d) => ({ ...d, [p.id]: { p, qty: (d[p.id]?.qty ?? 0) + 1 } }))
  const decDraft = (id: string) =>
    setDraft((d) => {
      const cur = d[id]; if (!cur) return d
      const qty = cur.qty - 1
      const next = { ...d }
      if (qty <= 0) delete next[id]; else next[id] = { ...cur, qty }
      return next
    })

  const draftList = Object.values(draft)
  const draftTotal = draftList.reduce((s, { p, qty }) => s + p.price * qty, 0)
  const accountTotal = ticketTotal({ items: sent }) + draftTotal

  const fire = async () => {
    if (!table || draftList.length === 0 || firing) return
    if (!branchId) { toast.error('Tu usuario no tiene sucursal asignada.'); return }
    setFiring(true)

    // 0) Mesa sin cuenta abierta: se abre aquí mismo (antes el botón moría en silencio).
    let ticketId = table.current_ticket_id
    if (!ticketId) {
      try {
        const opened = await tablesApi.open(table.id)
        ticketId = opened.current_ticket_id
        setTable(opened)
      } catch (e: any) {
        setFiring(false)
        toast.error(e?.response?.data?.detail ?? 'No se pudo abrir la mesa para enviar la comanda')
        return
      }
      if (!ticketId) {
        setFiring(false)
        toast.error('La mesa se abrió pero no tiene cuenta activa. Reintenta desde la lista de mesas.')
        return
      }
    }

    const toSend = draftList
    // 1) Enviar a cocina. Si falla aquí, nada se disparó: conservamos el draft para reintentar.
    try {
      await kitchenApi.fire({
        branch_id: branchId,
        table_id: table.id,
        parked_ticket_id: ticketId,
        items: toSend.map(({ p, qty, note }) => toFireItem(p, qty, note)),
      })
    } catch (e: any) {
      setFiring(false)
      toast.error(e?.response?.data?.detail ?? 'No se pudo enviar la comanda a cocina')
      return
    }
    // 2) Cocina ya recibió. Limpiamos el draft de inmediato para NO volver a disparar los mismos platillos.
    const merged = [...sent, ...toSend.map(({ p, qty }) => toCartItem(p, qty))]
    setSent(merged)
    setDraft({})
    setNoteOpen(null)
    // 3) Persistir en la cuenta. Si esto falla, la comida YA está en cocina: avisamos de forma accionable.
    try {
      await parkedTicketsApi.update(ticketId, { items: merged })
      toast.success('Comanda enviada a cocina')
    } catch (e: any) {
      toast.error('Se envió a cocina, pero no se pudo actualizar la cuenta. Avisa a caja para revisar el ticket.')
    } finally {
      setFiring(false)
    }
  }

  const requestBill = async () => {
    if (!table || billBusy) return
    const ok = await confirmDialog({
      title: `Pedir la cuenta — Mesa ${table.code}`,
      message: `Total actual: ${formatCurrency(accountTotal)}. La mesa se marcará como "cuenta solicitada" para caja.`,
      variant: 'info',
      confirmText: 'Pedir cuenta',
    })
    if (!ok) return
    setBillBusy(true)
    try {
      await tablesApi.setStatus(table.id, 'BILL_REQUESTED')
      toast.success('Cuenta solicitada')
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo pedir la cuenta')
    } finally {
      setBillBusy(false)
    }
  }

  if (loading) return <Spinner size="lg" text="Cargando comanda..." />
  if (!table) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-slate-400">Mesa no encontrada.</p>
        <Button variant="secondary" icon="fa-arrow-left" onClick={() => nav('/mobile/comanda')}>
          Volver a mesas
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex items-center justify-between gap-2 border-b border-slate-800">
        <button
          onClick={() => nav('/mobile/comanda')}
          aria-label="Volver a mesas"
          className="text-slate-400 min-h-[44px] min-w-[44px] grid place-items-center"
        >
          <i className="fa-solid fa-arrow-left text-lg" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-black text-white truncate">Mesa {table.code}</h1>
          <StatusChip tone={TABLE_STATUS[table.status].tone} label={TABLE_STATUS[table.status].label} size="sm" onDark />
        </div>
        <button
          onClick={requestBill}
          disabled={billBusy || table.status === 'BILL_REQUESTED'}
          className="text-sky-300 text-sm font-bold min-h-[44px] px-2 disabled:opacity-50"
        >
          {table.status === 'BILL_REQUESTED' ? 'Cuenta pedida' : billBusy ? 'Pidiendo…' : 'Pedir cuenta'}
        </button>
      </div>

      {/* Categorías */}
      <div className="px-3 py-2 flex gap-2 overflow-x-auto border-b border-slate-800">
        {categories.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`whitespace-nowrap px-4 py-2.5 rounded-full text-sm min-h-[44px] ${cat === c ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-400'}`}>{c}</button>
        ))}
      </div>

      {/* Menú */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
        {menu.map((p) => (
          <button key={p.id} onClick={() => addDraft(p)}
            className="dax-card text-left active:scale-95 transition-transform">
            <p className="text-sm font-bold text-white leading-tight">{p.name}</p>
            <p className="mt-1 text-xs text-amber-300 font-black">{formatCurrency(p.price)}</p>
            {draft[p.id] && <p className="mt-1 text-[11px] text-emerald-300">× {draft[p.id].qty}</p>}
          </button>
        ))}
        {menu.length === 0 && <p className="col-span-2 text-sm text-slate-500">Sin platillos en esta categoría.</p>}
      </div>

      {/* Ya enviado a cocina (en la cuenta) */}
      {sent.length > 0 && (
        <div className="border-t border-slate-800 px-3 py-2 max-h-28 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">En cuenta</p>
          {sent.map((l, i) => (
            <div key={`${l.product_id}-${i}`} className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">{l.quantity}× {l.name}</span>
              <span className="tabular-nums">{formatCurrency(l.subtotal)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Resumen "por enviar" */}
      {draftList.length > 0 && (
        <div className="border-t border-slate-800 p-3 space-y-2 max-h-56 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Por enviar</p>
          {draftList.map(({ p, qty, note }) => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-white truncate">{p.name}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setNoteOpen((cur) => (cur === p.id ? null : p.id))}
                    aria-label={`Nota para ${p.name}`}
                    className={`h-11 w-11 rounded-lg grid place-items-center ${note ? 'bg-amber-500/25 text-amber-300' : 'bg-slate-800 text-slate-400'}`}
                  >
                    <i className="fa-solid fa-pen" />
                  </button>
                  <button onClick={() => decDraft(p.id)} aria-label={`Quitar uno de ${p.name}`}
                    className="h-11 w-11 rounded-lg bg-slate-700 text-white text-lg font-bold">−</button>
                  <span className="w-7 text-center text-white text-base font-bold tabular-nums">{qty}</span>
                  <button onClick={() => addDraft(p)} aria-label={`Agregar uno de ${p.name}`}
                    className="h-11 w-11 rounded-lg bg-slate-700 text-white text-lg font-bold">+</button>
                </span>
              </div>
              {(noteOpen === p.id || note) && (
                <input
                  autoFocus={noteOpen === p.id}
                  value={note ?? ''}
                  onChange={(e) =>
                    setDraft((d) => (d[p.id] ? { ...d, [p.id]: { ...d[p.id], note: e.target.value } } : d))
                  }
                  onBlur={() => setNoteOpen(null)}
                  placeholder="Nota para cocina: sin cebolla, término medio…"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-amber-200 placeholder:text-slate-500"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer fijo */}
      <div className="border-t border-slate-800 p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-slate-500">Cuenta</p>
          <p className="text-lg font-black text-white">{formatCurrency(accountTotal)}</p>
        </div>
        <Button variant="primary" size="lg" loading={firing} disabled={draftList.length === 0}
          onClick={fire} icon="fa-fire-burner">
          Enviar a cocina{draftList.length ? ` (${draftList.length})` : ''}
        </Button>
      </div>
    </div>
  )
}
