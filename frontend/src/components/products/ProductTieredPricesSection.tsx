import type { PriceRow, ProductErrors } from './types'
import { emptyPriceRow } from './types'

interface Props {
  prices: PriceRow[]
  onChange: (next: PriceRow[]) => void
  errors?: ProductErrors
  /** Copy de ayuda opcional bajo el header. */
  help?: string
}

export function ProductTieredPricesSection({ prices, onChange, help }: Props) {
  const add = () => onChange([...prices, emptyPriceRow()])
  const remove = (i: number) => onChange(prices.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof PriceRow, val: string | number) =>
    onChange(prices.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)))

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Precios escalonados</h2>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded hover:bg-indigo-500/10 transition-colors"
        >
          <i className="fa-solid fa-plus" /> Agregar precio
        </button>
      </div>
      {help && <p className="text-[11px] text-slate-500">{help}</p>}

      {prices.length === 0 ? (
        <p className="text-xs py-3 text-center text-slate-500 italic">
          Sin precios adicionales — se usa solo el precio base.
        </p>
      ) : (
        <div className="space-y-2">
          {prices.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_110px_28px] gap-2 items-end">
              <div>
                {i === 0 && <label className="block text-[10px] mb-0.5 text-slate-400">Nombre</label>}
                <input
                  className="dax-input w-full text-xs"
                  value={p.price_name}
                  onChange={(e) => update(i, 'price_name', e.target.value)}
                  placeholder="ej. Mayoreo"
                />
              </div>
              <div>
                {i === 0 && <label className="block text-[10px] mb-0.5 text-slate-400">Mín. piezas</label>}
                <input
                  className="dax-input w-full text-xs"
                  type="number" min="1"
                  value={p.min_quantity}
                  onChange={(e) => update(i, 'min_quantity', Number(e.target.value))}
                />
              </div>
              <div>
                {i === 0 && <label className="block text-[10px] mb-0.5 text-slate-400">Precio / unidad</label>}
                <input
                  className="dax-input w-full text-xs"
                  type="number" min="0" step="0.01"
                  value={p.unit_price}
                  onChange={(e) => update(i, 'unit_price', Number(e.target.value))}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="h-8 w-7 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors rounded"
                title="Eliminar"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
