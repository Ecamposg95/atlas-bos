import type { ProductErrors, ProductFormValue, SetField } from './types'

interface Props {
  value: ProductFormValue
  onChange: SetField
  errors: ProductErrors
}

export function ProductBasicsSection({ value, onChange, errors }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Básicos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs text-slate-400 space-y-1">
          Nombre *
          <input className="dax-input w-full" value={value.name}
            onChange={(e) => onChange('name', e.target.value)} />
          {errors.name && <span className="text-rose-400 text-[11px]">{errors.name}</span>}
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          SKU *
          <input className="dax-input w-full font-mono" value={value.sku}
            onChange={(e) => onChange('sku', e.target.value.toUpperCase().trim())} />
          {errors.sku && <span className="text-rose-400 text-[11px]">{errors.sku}</span>}
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          Código de barras
          <input className="dax-input w-full font-mono" value={value.barcode}
            onChange={(e) => onChange('barcode', e.target.value)} />
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          Unidad
          <select className="dax-input w-full" value={value.unit}
            onChange={(e) => onChange('unit', e.target.value)}>
            <option value="pza">pza</option>
            <option value="kg">kg</option>
            <option value="lt">lt</option>
            <option value="mt">mt</option>
            <option value="caja">caja</option>
          </select>
        </label>
        <label className="text-xs text-slate-400 space-y-1 md:col-span-2">
          Descripción
          <textarea className="dax-input w-full" rows={2} value={value.description}
            onChange={(e) => onChange('description', e.target.value)} />
        </label>
        <label className="text-xs text-slate-400 space-y-1 md:col-span-2">
          URL de imagen
          <input className="dax-input w-full" placeholder="https://..." value={value.image_url}
            onChange={(e) => onChange('image_url', e.target.value)} />
        </label>
      </div>
    </section>
  )
}
