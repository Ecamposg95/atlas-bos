import { useState, useRef, useCallback } from 'react'
import { productsApi } from '../../api/products'
import { customersApi, type Customer } from '../../api/customers'
import { quotesApi } from '../../api/quotes'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import type { Product } from '../../types/products'
import { formatCurrency } from '../../utils/currency'

interface CartItem {
  product_id: string; sku: string; name: string
  price: number; quantity: number; subtotal: number
}

export function MobileSales() {
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doProductSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await productsApi.search(q, 0, 10)
      // Backend ya filtra por visibilidad (active + active_in_branch) — no duplicar aquí.
      setSearchResults(res.items ?? [])
    } catch { setSearchResults([]) } finally { setSearching(false) }
  }, [])

  const doCustSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setCustomerResults([]); return }
    try {
      const data = await customersApi.search(q, 6)
      setCustomerResults(data); setShowCustomerDrop(true)
    } catch { setCustomerResults([]) }
  }, [])

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id)
      if (existing) return prev.map((i) => i.product_id === p.id
        ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
        : i
      )
      return [...prev, { product_id: p.id, sku: p.sku, name: p.name, price: p.price, quantity: 1, subtotal: p.price }]
    })
    setProductSearch(''); setSearchResults([])
  }

  const updateQty = (product_id: string, qty: number) => {
    if (qty <= 0) { setCart((prev) => prev.filter((i) => i.product_id !== product_id)); return }
    setCart((prev) => prev.map((i) => i.product_id === product_id
      ? { ...i, quantity: qty, subtotal: qty * i.price } : i
    ))
  }

  const total = cart.reduce((s, i) => s + i.subtotal, 0)

  const handleSave = async () => {
    if (cart.length === 0) return
    setSaving(true)
    try {
      const res = await quotesApi.create({
        doc_type: 'QUOTE',
        customer_id: customer?.id ?? null,
        items: cart.map((i) => ({ sku: i.sku, quantity: i.quantity })),
        payments: [],
      })
      setSuccess(res.folio)
      setCart([]); setCustomer(null); setNotes(''); setCustomerSearch('')
    } catch { alert('Error al crear cotización') } finally { setSaving(false) }
  }

  if (success) {
    return (
      <div className="space-y-5 max-w-lg mx-auto">
        <DaxCard>
          <div className="py-8 text-center">
            <i className="fa-solid fa-circle-check text-5xl text-sem-success mb-4 block" />
            <p className="text-dax-text font-black text-xl">Cotización creada</p>
            <p className="text-dax-muted mt-1 font-mono">{success}</p>
            <button onClick={() => setSuccess(null)} className="mt-6 dax-btn-primary justify-center">
              <i className="fa-solid fa-plus" /> Nueva cotización
            </button>
          </div>
        </DaxCard>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-file-invoice-dollar text-indigo-400 text-xl" />
        <h1 className="text-2xl font-black text-dax-text">Cotización Móvil</h1>
      </div>

      {/* Búsqueda de producto */}
      <DaxCard>
        <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest mb-2">Agregar producto</p>
        <div className="relative">
          <input
            type="text"
            placeholder="Nombre, SKU o código..."
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value)
              if (searchTimer.current) clearTimeout(searchTimer.current)
              searchTimer.current = setTimeout(() => doProductSearch(e.target.value), 300)
            }}
            className="dax-input w-full text-sm"
          />
          {searching && <div className="absolute right-3 top-3"><i className="fa-solid fa-spinner fa-spin text-dax-muted text-xs" /></div>}
          {searchResults.length > 0 && (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-dax-card border border-dax-border rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-dax-surface transition-colors text-left border-b border-dax-border last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-dax-text">{p.name}</p>
                    <p className="text-[10px] text-dax-muted font-mono">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sem-success font-bold text-sm">{formatCurrency(p.price ?? 0)}</p>
                    <p className="text-xs text-dax-muted">Stock: {p.stock_total ?? 0}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DaxCard>

      {/* Carrito */}
      {cart.length > 0 && (
        <DaxCard padding={false}>
          <div className="divide-y divide-slate-700/40">
            {cart.map((item) => (
              <div key={item.product_id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-dax-text text-sm">{item.name}</p>
                    <p className="text-[10px] font-mono text-dax-muted">{item.sku}</p>
                  </div>
                  <button onClick={() => setCart((p) => p.filter((i) => i.product_id !== item.product_id))}
                    className="text-dax-faint hover:text-sem-critical mt-0.5 flex-shrink-0">
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 bg-dax-surface rounded text-sm hover:bg-slate-600 flex items-center justify-center">−</button>
                    <span className="w-8 text-center font-bold text-dax-text">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 bg-dax-surface rounded text-sm hover:bg-slate-600 flex items-center justify-center">+</button>
                  </div>
                  <p className="text-sem-success font-bold tabular-nums">{formatCurrency(item.subtotal)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-dax-border flex justify-between">
            <span className="font-bold text-dax-text">Total</span>
            <span className="font-black text-sem-success tabular-nums text-lg">{formatCurrency(total)}</span>
          </div>
        </DaxCard>
      )}

      {/* Cliente */}
      <DaxCard>
        <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest mb-2">Cliente (opcional)</p>
        {customer ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-dax-text">{customer.name}</p>
              <p className="text-xs text-dax-muted">{customer.phone ?? '—'}</p>
            </div>
            <button onClick={() => { setCustomer(null); setCustomerSearch('') }} className="text-dax-muted hover:text-sem-critical text-xs">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input type="text" placeholder="Buscar cliente..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                if (custTimer.current) clearTimeout(custTimer.current)
                custTimer.current = setTimeout(() => doCustSearch(e.target.value), 300)
              }}
              className="dax-input w-full text-sm" />
            {showCustomerDrop && customerResults.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-dax-card border border-dax-border rounded-lg shadow-xl overflow-hidden">
                {customerResults.map((c) => (
                  <button key={c.id} onClick={() => { setCustomer(c); setCustomerSearch(''); setCustomerResults([]); setShowCustomerDrop(false) }}
                    className="w-full px-3 py-2 hover:bg-dax-surface text-left text-sm border-b border-dax-border last:border-0">
                    <p className="text-dax-text font-semibold">{c.name}</p>
                    <p className="text-dax-muted text-xs">{c.phone ?? '—'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DaxCard>

      {/* Notas */}
      <DaxCard>
        <p className="text-[10px] font-bold text-dax-muted uppercase tracking-widest mb-2">Notas</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          rows={2} className="dax-input w-full text-sm resize-none" placeholder="Observaciones..." />
      </DaxCard>

      {/* Botón guardar */}
      <button
        onClick={handleSave}
        disabled={saving || cart.length === 0}
        className="dax-btn-primary w-full justify-center disabled:opacity-40">
        {saving
          ? <><i className="fa-solid fa-spinner fa-spin" /> Guardando...</>
          : <><i className="fa-solid fa-file-invoice" /> Crear Cotización ({formatCurrency(total)})</>}
      </button>

      {cart.length === 0 && (
        <div className="text-center py-8 text-dax-faint">
          <i className="fa-solid fa-cart-plus text-3xl mb-3 block" />
          Busca y agrega productos para comenzar
        </div>
      )}
    </div>
  )
}
