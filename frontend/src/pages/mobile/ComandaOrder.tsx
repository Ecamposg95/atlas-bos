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
import { formatCurrency } from '../../utils/currency'
import type { DiningTable } from '../../types/tables'
import type { Product } from '../../types/products'

export function ComandaOrder() {
  const { tableId } = useParams<{ tableId: string }>()
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined

  const [table, setTable] = useState<DiningTable | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [sent, setSent] = useState<CartLine[]>([])       // ya en la cuenta
  const [draft, setDraft] = useState<Record<string, { p: Product; qty: number }>>({}) // por enviar
  const [loading, setLoading] = useState(true)
  const [firing, setFiring] = useState(false)

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
    if (!table?.current_ticket_id || draftList.length === 0) return
    if (!branchId) { toast.error('Tu usuario no tiene sucursal asignada.'); return }
    const toSend = draftList
    setFiring(true)
    // 1) Enviar a cocina. Si falla aquí, nada se disparó: conservamos el draft para reintentar.
    try {
      await kitchenApi.fire({
        branch_id: branchId,
        table_id: table.id,
        parked_ticket_id: table.current_ticket_id,
        items: toSend.map(({ p, qty }) => toFireItem(p, qty)),
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
    // 3) Persistir en la cuenta. Si esto falla, la comida YA está en cocina: avisamos de forma accionable.
    try {
      await parkedTicketsApi.update(table.current_ticket_id, { items: merged })
      toast.success('Comanda enviada a cocina')
    } catch (e: any) {
      toast.error('Se envió a cocina, pero no se pudo actualizar la cuenta. Avisa a caja para revisar el ticket.')
    } finally {
      setFiring(false)
    }
  }

  const requestBill = async () => {
    if (!table) return
    try { await tablesApi.setStatus(table.id, 'BILL_REQUESTED'); toast.success('Cuenta solicitada'); load() }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'No se pudo pedir la cuenta') }
  }

  if (loading) return <Spinner size="lg" text="Cargando comanda..." />
  if (!table) return <div className="p-6 text-slate-400">Mesa no encontrada.</div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        <button onClick={() => nav('/mobile/comanda')} className="text-slate-400"><i className="fa-solid fa-arrow-left" /></button>
        <h1 className="text-lg font-black text-white">Mesa {table.code}</h1>
        <button onClick={requestBill} className="text-sky-300 text-sm font-bold">Pedir cuenta</button>
      </div>

      {/* Categorías */}
      <div className="px-3 py-2 flex gap-2 overflow-x-auto border-b border-slate-800">
        {categories.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs ${cat === c ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-400'}`}>{c}</button>
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

      {/* Resumen "por enviar" */}
      {draftList.length > 0 && (
        <div className="border-t border-slate-800 p-3 space-y-2 max-h-40 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Por enviar</p>
          {draftList.map(({ p, qty }) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-white">{p.name}</span>
              <span className="flex items-center gap-2">
                <button onClick={() => decDraft(p.id)} className="h-6 w-6 rounded bg-slate-700 text-white">−</button>
                <span className="w-5 text-center text-white">{qty}</span>
                <button onClick={() => addDraft(p)} className="h-6 w-6 rounded bg-slate-700 text-white">+</button>
              </span>
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
