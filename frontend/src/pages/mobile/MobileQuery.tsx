import { useState, useCallback, useRef } from 'react'
import { productsApi } from '../../api/products'
import { Spinner } from '../../components/ui/Spinner'
import { DaxCard } from '../../components/ui/DaxCard'
import type { Product } from '../../types/products'
import { formatCurrency } from '../../utils/currency'

export function MobileQuery() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await productsApi.search(q, 0, 20)
      setResults(res.items ?? [])
    } catch { setResults([]) } finally { setLoading(false) }
  }, [])

  const onType = (val: string) => {
    setQuery(val)
    setSelected(null)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(val), 350)
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-magnifying-glass text-indigo-400 text-xl" />
        <h1 className="text-2xl font-black text-dax-text">Consulta Móvil</h1>
      </div>

      <input
        type="text"
        placeholder="Nombre, SKU o código de barras..."
        value={query}
        onChange={(e) => onType(e.target.value)}
        className="dax-input w-full text-base"
        autoFocus
      />

      {loading && <Spinner text="Buscando..." />}

      {/* Detalle del producto seleccionado */}
      {selected && (
        <DaxCard>
          <div className="flex items-start gap-4">
            {selected.image_url ? (
              <img src={selected.image_url} alt={selected.name} className="h-20 w-20 object-contain rounded-lg border border-dax-border" />
            ) : (
              <div className="h-20 w-20 bg-dax-card rounded-lg border border-dax-border flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-box text-dax-faint text-2xl" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-black text-dax-text text-lg leading-tight">{selected.name}</p>
              <p className="text-indigo-400 font-mono text-sm mt-0.5">{selected.sku}</p>
              {selected.description && <p className="text-dax-muted text-xs mt-1 line-clamp-2">{selected.description}</p>}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-dax-card rounded-lg p-3 text-center">
              <p className="text-[10px] text-dax-muted uppercase tracking-wider">Precio</p>
              <p className="text-xl font-black text-sem-success tabular-nums">{formatCurrency(selected.price)}</p>
            </div>
            <div className="bg-dax-card rounded-lg p-3 text-center">
              <p className="text-[10px] text-dax-muted uppercase tracking-wider">Stock</p>
              <p className={`text-xl font-black tabular-nums ${(selected.stock_total ?? 0) > 0 ? 'text-dax-text' : 'text-sem-critical'}`}>
                {selected.stock_total ?? 0}
              </p>
            </div>
          </div>

          {selected.prices && selected.prices.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-dax-border pt-3">
              {selected.prices.map((tp) => (
                <div key={tp.id} className="flex justify-between text-sm">
                  <span className="text-dax-muted">{tp.price_name} ({tp.min_quantity}+)</span>
                  <span className="text-dax-muted font-semibold">{formatCurrency(tp.unit_price)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-1 border-t border-dax-border pt-3 text-xs text-dax-muted">
            {selected.brand_name && <div className="flex gap-2"><i className="fa-solid fa-tag w-4" />{selected.brand_name}</div>}
            {selected.department_name && <div className="flex gap-2"><i className="fa-solid fa-layer-group w-4" />{selected.department_name}</div>}
            {selected.unit && <div className="flex gap-2"><i className="fa-solid fa-ruler w-4" />Unidad: {selected.unit}</div>}
          </div>

          <button onClick={() => setSelected(null)} className="mt-4 w-full dax-btn-secondary text-xs">
            <i className="fa-solid fa-arrow-left" /> Volver a resultados
          </button>
        </DaxCard>
      )}

      {/* Lista de resultados */}
      {!selected && results.length > 0 && (
        <DaxCard padding={false}>
          <div className="divide-y divide-slate-700/40">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dax-surface transition-colors text-left"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-10 w-10 object-contain rounded flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 bg-dax-card rounded flex-shrink-0 flex items-center justify-center">
                    <i className="fa-solid fa-box text-dax-faint text-xs" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-dax-text text-sm truncate">{p.name}</p>
                  <p className="text-dax-muted text-xs font-mono">{p.sku}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sem-success font-bold text-sm tabular-nums">{formatCurrency(p.price ?? 0)}</p>
                  <p className={`text-xs tabular-nums ${(p.stock_total ?? 0) > 0 ? 'text-dax-muted' : 'text-sem-critical'}`}>
                    Stock: {p.stock_total ?? 0}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </DaxCard>
      )}

      {!loading && !selected && results.length === 0 && query && (
        <DaxCard><div className="p-12 text-center text-dax-faint">Sin resultados para "{query}"</div></DaxCard>
      )}

      {!query && (
        <div className="text-center py-12 text-dax-faint">
          <i className="fa-solid fa-barcode text-4xl mb-3 block" />
          Escribe para buscar un producto
        </div>
      )}
    </div>
  )
}
