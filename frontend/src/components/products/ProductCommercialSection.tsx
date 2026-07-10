import type { Brand, Department, ProductErrors, ProductFormValue, SetField } from './types'

interface Props {
  value: ProductFormValue
  onChange: SetField
  errors: ProductErrors
  departments: Department[]
  brands: Brand[]
}

export function ProductCommercialSection({ value, onChange, errors, departments, brands }: Props) {
  const costOverPrice =
    !errors.cost && Number(value.cost) > 0 && Number(value.price) > 0 && Number(value.cost) > Number(value.price)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-dax-muted uppercase tracking-wide">Comerciales</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs text-dax-muted space-y-1">
          Departamento
          <select className="dax-input w-full" value={value.department_id}
            onChange={(e) => onChange('department_id', e.target.value)}>
            <option value="">— Ninguno —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-dax-muted space-y-1">
          Marca
          <select className="dax-input w-full" value={value.brand_id}
            onChange={(e) => onChange('brand_id', e.target.value)}>
            <option value="">— Ninguna —</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-dax-muted space-y-1">
          Precio *
          <input type="number" step="0.01" min="0" className="dax-input w-full" value={value.price}
            onChange={(e) => onChange('price', e.target.value)} />
          {errors.price && <span className="text-sem-critical text-[11px]">{errors.price}</span>}
        </label>
        <label className="text-xs text-dax-muted space-y-1">
          Costo *
          <input type="number" step="0.01" min="0" className="dax-input w-full" value={value.cost}
            onChange={(e) => onChange('cost', e.target.value)} />
          {errors.cost && <span className="text-sem-critical text-[11px]">{errors.cost}</span>}
          {costOverPrice && (
            <span className="text-sem-warning text-[11px]">Costo mayor al precio — verifica.</span>
          )}
        </label>
        <label className="text-xs text-dax-muted flex items-center gap-2">
          <input type="checkbox" checked={value.has_iva}
            onChange={(e) => onChange('has_iva', e.target.checked)} />
          Aplica IVA
        </label>
        {value.has_iva && (
          <label className="text-xs text-dax-muted space-y-1">
            Tasa IVA (%)
            <input type="number" step="0.01" min="0" className="dax-input w-full" value={value.tax_rate}
              onChange={(e) => onChange('tax_rate', e.target.value)} />
          </label>
        )}
      </div>
    </section>
  )
}
