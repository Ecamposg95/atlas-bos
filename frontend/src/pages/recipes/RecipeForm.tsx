import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { productsApi } from '../../api/products'
import { recipesApi } from '../../api/recipes'
import { Button } from '../../components/ui/Button'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { toast } from '../../store/toastStore'
import type { RecipeCost, RecipeIngredient } from '../../types/recipes'

interface VariantOption {
  id: string
  label: string
}

interface IngredientRow {
  ingredient_variant_id: string
  qty: string
  unit: string
  waste_pct: string
}

const emptyRow = (): IngredientRow => ({ ingredient_variant_id: '', qty: '1', unit: '', waste_pct: '0' })

export function RecipeForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const [options, setOptions] = useState<VariantOption[]>([])
  const [variantId, setVariantId] = useState('')
  const [name, setName] = useState('')
  const [yieldQty, setYieldQty] = useState('1')
  const [rows, setRows] = useState<IngredientRow[]>([emptyRow()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cost, setCost] = useState<RecipeCost | null>(null)

  const loadOptions = useCallback(async () => {
    try {
      const res = await productsApi.list({ limit: 500 })
      const opts: VariantOption[] = []
      for (const p of res.items ?? []) {
        for (const v of p.variants ?? []) {
          opts.push({ id: v.id, label: `${p.name} (${v.sku})` })
        }
      }
      setOptions(opts)
    } catch {
      // Non-fatal: selectors fall back to manual UUID entry.
    }
  }, [])

  const loadRecipe = useCallback(async () => {
    if (!id) return
    const r = await recipesApi.getById(Number(id))
    setVariantId(r.product_variant_id)
    setName(r.name)
    setYieldQty(String(r.yield_qty))
    setRows(
      r.ingredients.length
        ? r.ingredients.map((i: RecipeIngredient) => ({
            ingredient_variant_id: i.ingredient_variant_id,
            qty: String(i.qty),
            unit: i.unit ?? '',
            waste_pct: String(i.waste_pct ?? 0),
          }))
        : [emptyRow()],
    )
    try {
      setCost(await recipesApi.cost(Number(id)))
    } catch {
      /* costo opcional */
    }
  }, [id])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await loadOptions()
      try {
        if (isEdit) await loadRecipe()
      } catch (e: any) {
        toast.error(e?.response?.data?.detail ?? 'Error al cargar la receta')
      } finally {
        setLoading(false)
      }
    })()
  }, [isEdit, loadOptions, loadRecipe])

  const updateRow = (idx: number, patch: Partial<IngredientRow>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const buildPayload = () => ({
    product_variant_id: variantId,
    name,
    yield_qty: Number(yieldQty) || 1,
    ingredients: rows
      .filter((r) => r.ingredient_variant_id)
      .map((r) => ({
        ingredient_variant_id: r.ingredient_variant_id,
        qty: Number(r.qty) || 0,
        unit: r.unit || null,
        waste_pct: Number(r.waste_pct) || 0,
      })),
  })

  const handleSave = async () => {
    if (!variantId || !name.trim()) {
      toast.warning('Selecciona el platillo y dale un nombre a la receta')
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await recipesApi.update(Number(id), buildPayload())
        toast.success('Receta actualizada')
      } else {
        await recipesApi.create(buildPayload())
        toast.success('Receta creada')
      }
      navigate('/recipes')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const variantSelect = (value: string, onChange: (v: string) => void) =>
    options.length > 0 ? (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
      >
        <option value="">— Selecciona —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    ) : (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ID de variante (UUID)"
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
      />
    )

  if (loading) return <Spinner size="lg" text="Cargando..." />

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">{isEdit ? 'Editar receta' : 'Nueva receta'}</h1>
        <Button variant="secondary" onClick={() => navigate('/recipes')}>Cancelar</Button>
      </div>

      <DaxCard className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1">Platillo (producto vendible)</label>
          {variantSelect(variantId, setVariantId)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1">Nombre de la receta</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1">Rinde (porciones)</label>
            <input
              type="number" min="1"
              value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
        </div>
      </DaxCard>

      <DaxCard className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Insumos</h2>
          <Button variant="ghost" size="sm" icon="fa-plus" onClick={() => setRows((p) => [...p, emptyRow()])}>
            Insumo
          </Button>
        </div>
        {rows.map((r, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-6">{variantSelect(r.ingredient_variant_id, (v) => updateRow(idx, { ingredient_variant_id: v }))}</div>
            <input
              type="number" step="0.0001" value={r.qty} placeholder="Cant."
              onChange={(e) => updateRow(idx, { qty: e.target.value })}
              className="col-span-2 px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <input
              value={r.unit} placeholder="Unidad"
              onChange={(e) => updateRow(idx, { unit: e.target.value })}
              className="col-span-2 px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <input
              type="number" step="0.01" value={r.waste_pct} placeholder="Merma %"
              onChange={(e) => updateRow(idx, { waste_pct: e.target.value })}
              className="col-span-1 px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <button
              onClick={() => setRows((p) => p.filter((_, i) => i !== idx))}
              className="col-span-1 text-slate-500 hover:text-red-400"
              title="Quitar"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        ))}
      </DaxCard>

      {cost && (
        <DaxCard>
          <h2 className="font-bold text-white mb-2">Costeo</h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-slate-400">Costo / porción</p><p className="text-white font-black">${Number(cost.cost_per_portion).toFixed(2)}</p></div>
            <div><p className="text-slate-400">Precio venta</p><p className="text-white font-black">{cost.sale_price != null ? `$${Number(cost.sale_price).toFixed(2)}` : '—'}</p></div>
            <div><p className="text-slate-400">Margen</p><p className="text-emerald-400 font-black">{cost.margin != null ? `$${Number(cost.margin).toFixed(2)}` : '—'}{cost.margin_pct != null ? ` (${Number(cost.margin_pct).toFixed(0)}%)` : ''}</p></div>
          </div>
        </DaxCard>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/recipes')}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={handleSave}>
          {isEdit ? 'Guardar' : 'Crear receta'}
        </Button>
      </div>
    </div>
  )
}
