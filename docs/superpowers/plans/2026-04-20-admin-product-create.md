# Admin Product Create — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated admin-only product creation page at `/admin/products/new` so admins stop landing on the cashier `Products.tsx` view.

**Architecture:** Frontend-only. A new page `AdminProductCreate.tsx` self-contained under `pages/admin/`, a new route guarded by `RequireRole`, and a fix to the existing "Nuevo producto" link in `AdminCatalog.tsx`. Backend `POST /api/products/` already supports the full payload (`target_branch_ids`, admin approval, auto-PBS creation).

**Tech Stack:** React 18 + TypeScript + Vite + React Router v6 + Zustand + Axios + Tailwind.

**Spec:** `docs/superpowers/specs/2026-04-20-admin-product-create-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/api/products.ts` | Modify (lines 11-19) | Extend `ProductCreate` interface with admin-only optional fields. |
| `frontend/src/pages/admin/AdminProductCreate.tsx` | Create | Isolated admin product creation page. Loads brands/depts/branches, renders form, submits to `productsApi.create`, redirects on success. |
| `frontend/src/App.tsx` | Modify (lines 29-34 and 196-204) | Lazy-import the new page and register `/admin/products/new` guarded by `RequireRole(['ADMINISTRADOR','DUEÑO'])`. |
| `frontend/src/pages/core/AdminCatalog.tsx` | Modify (line 214) | Change `to="/products?new=1"` to `to="/admin/products/new"`. |

No test files — `frontend/` has no unit test setup; smoke-testing happens manually per the spec.

---

## Task 1: Extend `ProductCreate` interface

**Files:**
- Modify: `frontend/src/api/products.ts:11-19`

- [ ] **Step 1: Extend the interface**

Replace the current `ProductCreate` interface (lines 11-19) with:

```ts
interface ProductCreate {
  sku: string
  name: string
  cost: number
  price: number
  brand_id?: string | null       // UUID
  department_id?: string | null  // UUID
  unit?: string
  image_url?: string | null
  description?: string | null
  barcode?: string | null
  // Admin-only extensions — all optional to keep existing callers working
  has_iva?: boolean
  tax_rate?: number
  initial_stock?: number
  branch_id?: number | null
  target_branch_ids?: number[]
  uses_inventory?: boolean
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors (pre-existing errors, if any, are unrelated).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/products.ts
git commit -m "feat(products-api): extend ProductCreate with admin fields"
```

---

## Task 2: Create `AdminProductCreate.tsx` — skeleton + data loads

**Files:**
- Create: `frontend/src/pages/admin/AdminProductCreate.tsx`

- [ ] **Step 1: Create the directory and file with a minimal skeleton**

```bash
mkdir -p frontend/src/pages/admin
```

Write `frontend/src/pages/admin/AdminProductCreate.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { productsApi } from '../../api/products'
import { organizationApi } from '../../api/organization'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { toast } from '../../store/toastStore'
import type { Brand, Department } from '../../types/products'
import type { Branch } from '../../types/auth'

interface BranchActivation {
  enabled: boolean
  is_active_pos: boolean
  is_active_hq: boolean
  is_visible: boolean
}

export function AdminProductCreate() {
  const navigate = useNavigate()

  const [departments, setDepartments] = useState<Department[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    unit: 'pza',
    description: '',
    image_url: '',
    department_id: '',
    brand_id: '',
    price: '',
    cost: '',
    has_iva: false,
    tax_rate: '16',
    initial_stock: '0',
    initial_stock_branch_id: '' as string,
  })

  const [branchActivation, setBranchActivation] = useState<Record<number, BranchActivation>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      productsApi.getDepartments(),
      productsApi.getBrands(),
      organizationApi.getBranches(),
    ])
      .then(([depts, brs, bchs]) => {
        if (cancelled) return
        setDepartments(depts)
        setBrands(brs)
        setBranches(bchs)
        const init: Record<number, BranchActivation> = {}
        for (const b of bchs) {
          init[b.id] = { enabled: false, is_active_pos: true, is_active_hq: false, is_visible: true }
        }
        setBranchActivation(init)
      })
      .catch(() => toast.error('No se pudo cargar el formulario.'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-plus text-indigo-400 text-xl" />
        <h1 className="text-2xl font-black text-white">Nuevo producto — Administración</h1>
      </div>
      <DaxCard>
        <div className="p-4 text-slate-400 text-sm">Formulario en construcción (tareas siguientes).</div>
      </DaxCard>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors related to this file. (It's not imported yet, so you must also verify the file parses alone.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/AdminProductCreate.tsx
git commit -m "feat(admin): scaffold AdminProductCreate page with data loads"
```

---

## Task 3: Wire the route and fix the link

**Files:**
- Modify: `frontend/src/App.tsx` (add lazy import + route)
- Modify: `frontend/src/pages/core/AdminCatalog.tsx:214`

- [ ] **Step 1: Add lazy import in App.tsx**

After line 34 (the `Organization` lazy import), add:

```tsx
const AdminProductCreate = lazy(() => import('./pages/admin/AdminProductCreate').then(m => ({ default: m.AdminProductCreate })))
```

- [ ] **Step 2: Register the route in App.tsx**

Right after the `admin/catalog` route block (after line 204), add:

```tsx
<Route
  path="admin/products/new"
  element={
    <RequireRole roles={['ADMINISTRADOR', 'DUEÑO']}>
      <Suspense fallback={<PageLoader />}><AdminProductCreate /></Suspense>
    </RequireRole>
  }
/>
```

- [ ] **Step 3: Fix the link in AdminCatalog.tsx**

In `frontend/src/pages/core/AdminCatalog.tsx` line 214, change:

```tsx
            to="/products?new=1"
```

to:

```tsx
            to="/admin/products/new"
```

- [ ] **Step 4: Type-check and run dev server briefly**

```bash
cd frontend && npx tsc --noEmit
```

Then start the dev server (`npm run dev`) in one terminal and the backend (`uvicorn app.main:app --reload`) in another. Login as admin, go to `/admin/catalog`, click "Nuevo producto". Expected: the new page renders with the "Formulario en construcción" placeholder.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/core/AdminCatalog.tsx
git commit -m "feat(admin): wire /admin/products/new route and fix catalog link"
```

---

## Task 4: Build form sections 1-2 (Básicos + Comerciales)

**Files:**
- Modify: `frontend/src/pages/admin/AdminProductCreate.tsx`

- [ ] **Step 1: Replace the placeholder card with the real form sections**

In `AdminProductCreate.tsx`, replace the `<DaxCard>` placeholder block with the following. Keep everything outside the `<DaxCard>` intact.

Helpers to add above the `return`:

```tsx
  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key as string]) setErrors((e) => { const { [key as string]: _, ...rest } = e; return rest })
  }
```

Markup (replace the placeholder `<DaxCard>`):

```tsx
      <DaxCard>
        <div className="p-4 space-y-6">
          {/* Sección 1 — Básicos */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Básicos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-slate-400 space-y-1">
                Nombre *
                <input className="dax-input w-full" value={form.name}
                  onChange={(e) => setField('name', e.target.value)} />
                {errors.name && <span className="text-rose-400 text-[11px]">{errors.name}</span>}
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                SKU *
                <input className="dax-input w-full font-mono" value={form.sku}
                  onChange={(e) => setField('sku', e.target.value.toUpperCase().trim())} />
                {errors.sku && <span className="text-rose-400 text-[11px]">{errors.sku}</span>}
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                Código de barras
                <input className="dax-input w-full font-mono" value={form.barcode}
                  onChange={(e) => setField('barcode', e.target.value)} />
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                Unidad
                <select className="dax-input w-full" value={form.unit}
                  onChange={(e) => setField('unit', e.target.value)}>
                  <option value="pza">pza</option>
                  <option value="kg">kg</option>
                  <option value="lt">lt</option>
                  <option value="mt">mt</option>
                  <option value="caja">caja</option>
                </select>
              </label>
              <label className="text-xs text-slate-400 space-y-1 md:col-span-2">
                Descripción
                <textarea className="dax-input w-full" rows={2} value={form.description}
                  onChange={(e) => setField('description', e.target.value)} />
              </label>
              <label className="text-xs text-slate-400 space-y-1 md:col-span-2">
                URL de imagen
                <input className="dax-input w-full" placeholder="https://..." value={form.image_url}
                  onChange={(e) => setField('image_url', e.target.value)} />
              </label>
            </div>
          </section>

          {/* Sección 2 — Comerciales */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Comerciales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-slate-400 space-y-1">
                Departamento
                <select className="dax-input w-full" value={form.department_id}
                  onChange={(e) => setField('department_id', e.target.value)}>
                  <option value="">— Ninguno —</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                Marca
                <select className="dax-input w-full" value={form.brand_id}
                  onChange={(e) => setField('brand_id', e.target.value)}>
                  <option value="">— Ninguna —</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                Precio *
                <input type="number" step="0.01" min="0" className="dax-input w-full" value={form.price}
                  onChange={(e) => setField('price', e.target.value)} />
                {errors.price && <span className="text-rose-400 text-[11px]">{errors.price}</span>}
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                Costo *
                <input type="number" step="0.01" min="0" className="dax-input w-full" value={form.cost}
                  onChange={(e) => setField('cost', e.target.value)} />
                {errors.cost && <span className="text-rose-400 text-[11px]">{errors.cost}</span>}
              </label>
              <label className="text-xs text-slate-400 flex items-center gap-2">
                <input type="checkbox" checked={form.has_iva}
                  onChange={(e) => setField('has_iva', e.target.checked)} />
                Aplica IVA
              </label>
              {form.has_iva && (
                <label className="text-xs text-slate-400 space-y-1">
                  Tasa IVA (%)
                  <input type="number" step="0.01" min="0" className="dax-input w-full" value={form.tax_rate}
                    onChange={(e) => setField('tax_rate', e.target.value)} />
                </label>
              )}
            </div>
          </section>
        </div>
      </DaxCard>
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Smoke check in browser**

Navigate to `/admin/products/new` as admin and confirm both sections render and inputs accept values.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/AdminProductCreate.tsx
git commit -m "feat(admin): add básicos + comerciales sections to product form"
```

---

## Task 5: Build section 3 (branch activation matrix)

**Files:**
- Modify: `frontend/src/pages/admin/AdminProductCreate.tsx`

- [ ] **Step 1: Add helper `toggleBranch` above the `return`**

```tsx
  const toggleBranch = (branchId: number, patch: Partial<BranchActivation>) => {
    setBranchActivation((prev) => ({ ...prev, [branchId]: { ...prev[branchId], ...patch } }))
  }
  const setAllBranches = (enabled: boolean) => {
    setBranchActivation((prev) => {
      const next: Record<number, BranchActivation> = {}
      for (const id of Object.keys(prev)) {
        next[Number(id)] = { ...prev[Number(id)], enabled }
      }
      return next
    })
  }
  const anyNonDefaultFlag = Object.values(branchActivation).some(
    (b) => b.enabled && (!b.is_active_pos || b.is_active_hq || !b.is_visible),
  )
```

- [ ] **Step 2: Append the matrix section inside the same `<DaxCard>` container, after section 2**

```tsx
          {/* Sección 3 — Activación por sucursal */}
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Activación por sucursal</h2>
              <div className="flex gap-2">
                <button type="button" className="dax-btn-secondary text-[11px]"
                  onClick={() => setAllBranches(true)}>Seleccionar todas</button>
                <button type="button" className="dax-btn-secondary text-[11px]"
                  onClick={() => setAllBranches(false)}>Ninguna</button>
              </div>
            </div>
            {errors.target_branch_ids && (
              <div className="text-rose-400 text-[11px]">{errors.target_branch_ids}</div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left py-1">Sucursal</th>
                    <th className="py-1">Activar</th>
                    <th className="py-1">POS</th>
                    <th className="py-1">HQ</th>
                    <th className="py-1">Visible</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => {
                    const row = branchActivation[b.id] ?? { enabled: false, is_active_pos: true, is_active_hq: false, is_visible: true }
                    return (
                      <tr key={b.id} className="border-t border-slate-800/60">
                        <td className="py-1.5 text-slate-300">{b.name} <span className="text-slate-600">({b.branch_type})</span></td>
                        <td className="py-1.5 text-center">
                          <input type="checkbox" checked={row.enabled}
                            onChange={(e) => toggleBranch(b.id, { enabled: e.target.checked })} />
                        </td>
                        <td className="py-1.5 text-center">
                          <input type="checkbox" disabled={!row.enabled} checked={row.is_active_pos}
                            onChange={(e) => toggleBranch(b.id, { is_active_pos: e.target.checked })} />
                        </td>
                        <td className="py-1.5 text-center">
                          <input type="checkbox" disabled={!row.enabled} checked={row.is_active_hq}
                            onChange={(e) => toggleBranch(b.id, { is_active_hq: e.target.checked })} />
                        </td>
                        <td className="py-1.5 text-center">
                          <input type="checkbox" disabled={!row.enabled} checked={row.is_visible}
                            onChange={(e) => toggleBranch(b.id, { is_visible: e.target.checked })} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {anyNonDefaultFlag && (
              <div className="text-amber-400 text-[11px]">
                Las banderas por sucursal (POS/HQ/Visible) con valores no-default se ajustarán desde la matriz de catálogo después de crear.
              </div>
            )}
          </section>
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Smoke check in browser**

Verify each branch row renders, the "Activar" checkbox toggles the disabled state on POS/HQ/Visible, the quick-toggles work, and the amber note appears when a non-default flag is set.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AdminProductCreate.tsx
git commit -m "feat(admin): add branch activation matrix to product form"
```

---

## Task 6: Build section 4 (initial stock) + section 5 note, plus submit logic

**Files:**
- Modify: `frontend/src/pages/admin/AdminProductCreate.tsx`

- [ ] **Step 1: Add helpers `validate` and `submit` above the `return`**

```tsx
  const enabledBranchIds = Object.entries(branchActivation)
    .filter(([, v]) => v.enabled)
    .map(([k]) => Number(k))

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Requerido'
    if (!form.sku.trim()) e.sku = 'Requerido'
    const priceNum = Number(form.price)
    const costNum = Number(form.cost)
    if (!Number.isFinite(priceNum) || priceNum < 0) e.price = 'Número ≥ 0'
    if (!Number.isFinite(costNum) || costNum < 0) e.cost = 'Número ≥ 0'
    const stockNum = Number(form.initial_stock || '0')
    if (!Number.isFinite(stockNum) || stockNum < 0) e.initial_stock = 'Número ≥ 0'
    if (stockNum > 0 && !form.initial_stock_branch_id) e.initial_stock_branch_id = 'Requerido con stock > 0'
    return e
  }

  const handleSubmit = async () => {
    const clientErrors = validate()
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      toast.error('Revisa los campos marcados.')
      return
    }
    setSubmitting(true)
    const stockNum = Number(form.initial_stock || '0')
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || null,
      unit: form.unit,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      department_id: form.department_id || null,
      brand_id: form.brand_id || null,
      price: Number(form.price),
      cost: Number(form.cost),
      has_iva: form.has_iva,
      tax_rate: form.has_iva ? Number(form.tax_rate) : 0,
      initial_stock: stockNum,
      branch_id: stockNum > 0 ? Number(form.initial_stock_branch_id) : null,
      target_branch_ids: enabledBranchIds,
      uses_inventory: true,
    }
    try {
      await productsApi.create(payload)
      toast.success('Producto creado.')
      navigate('/admin/catalog')
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      if (status === 409 || (typeof detail === 'string' && detail.toLowerCase().includes('sku'))) {
        setErrors((e) => ({ ...e, sku: typeof detail === 'string' ? detail : 'SKU duplicado' }))
      }
      toast.error(typeof detail === 'string' ? detail : 'No se pudo crear el producto.')
    } finally {
      setSubmitting(false)
    }
  }
```

- [ ] **Step 2: Add sections 4 and 5 + action bar inside the same `<DaxCard>`, after section 3**

```tsx
          {/* Sección 4 — Inventario inicial */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Inventario inicial (opcional)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-slate-400 space-y-1">
                Stock inicial
                <input type="number" step="0.01" min="0" className="dax-input w-full" value={form.initial_stock}
                  onChange={(e) => setField('initial_stock', e.target.value)} />
                {errors.initial_stock && <span className="text-rose-400 text-[11px]">{errors.initial_stock}</span>}
              </label>
              {Number(form.initial_stock || '0') > 0 && (
                <label className="text-xs text-slate-400 space-y-1">
                  Sucursal destino *
                  <select className="dax-input w-full" value={form.initial_stock_branch_id}
                    onChange={(e) => setField('initial_stock_branch_id', e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {enabledBranchIds.map((id) => {
                      const b = branches.find((x) => x.id === id)
                      return b ? <option key={id} value={id}>{b.name}</option> : null
                    })}
                  </select>
                  {errors.initial_stock_branch_id && <span className="text-rose-400 text-[11px]">{errors.initial_stock_branch_id}</span>}
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Para stock en múltiples sucursales, usa el módulo de inventario tras crear.</p>
          </section>

          {/* Sección 5 — Nota sobre extras */}
          <p className="text-[11px] text-slate-500">
            Precios escalonados y empaques se configuran desde el catálogo tras crear el producto.
          </p>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
            <button type="button" className="dax-btn-secondary text-xs"
              onClick={() => navigate('/admin/catalog')} disabled={submitting}>
              Cancelar
            </button>
            <button type="button" className="dax-btn-primary text-xs inline-flex items-center gap-1.5"
              onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : <i className="fa-solid fa-save" />}
              Crear producto
            </button>
          </div>
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/AdminProductCreate.tsx
git commit -m "feat(admin): add stock section + submit logic to product form"
```

---

## Task 7: End-to-end smoke test

**Files:** none modified.

- [ ] **Step 1: Start backend + frontend dev servers**

```bash
# terminal 1
uvicorn app.main:app --reload
# terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Happy path — create with multi-branch activation**

1. Login as admin (`superadmin/admin123` from `init_users.py`).
2. Go to `/admin/catalog` → click "Nuevo producto" → URL becomes `/admin/products/new`.
3. Fill: name=`Producto Demo`, sku=`DEMO-001`, price=`100`, cost=`60`.
4. Activate 2 branches in the matrix. Leave all per-branch flags at defaults.
5. Set initial_stock=`5`, select one of the activated branches as destino.
6. Click "Crear producto".
7. Expected: redirects to `/admin/catalog`, toast "Producto creado", new row visible with PBS for 2 branches.

- [ ] **Step 3: Duplicate SKU path**

Re-submit the same form with SKU `DEMO-001`. Expected: inline error on SKU, toast with backend detail, form stays filled.

- [ ] **Step 4: RBAC path**

Log out, log in as CAJERO. Navigate to `/admin/products/new` directly. Expected: `RequireRole` redirects away (per existing `RequireRole` behavior).

- [ ] **Step 5: No commit needed — smoke test only**

If any step fails, open a fix commit referencing the failing step before proceeding.

---

## Notes for the Implementer

- The backend auto-creates `ProductBranchStatus` with model defaults (`is_active_pos=true`, `is_active_hq=false`, `is_visible=true`) for each entry in `target_branch_ids`. The per-branch flag checkboxes in the UI are intentionally UI-only in v1 — they don't travel to the backend. The amber note informs the user.
- The `dax-input`, `dax-btn-primary`, `dax-btn-secondary` classes are project-wide Tailwind utility classes already used across admin pages (see `AdminCatalog.tsx`). Don't redefine them.
- `toast` is imported from `'../../store/toastStore'` (the same source `AdminCatalog.tsx` uses). Don't introduce a new toast library.
- If `frontend && npx tsc --noEmit` reports pre-existing errors, verify they're not caused by your changes by diffing against `main`. Don't fix unrelated errors in this plan.
