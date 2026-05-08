# Inventario — Branch Products View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** PR 4 of 5 in Cashier Pack — implement spec `2026-04-29-cashier-pack-products-branch-redesign-design.md`: 4 catalog KPIs, drop Inactivos tab, sectioned product modal with tier palette, import wizard with preview + dry-run.

**Architecture:** Frontend rewrite of `ProductsBranchView.tsx` plus minor backend addition to `/products/upload` (dry-run flag using `db.rollback()` to skip commits without restructuring the function). Existing `/products/stats/catalog-kpis` endpoint surfaces the KPIs with no backend changes.

**Tech Stack:** React 18 + TypeScript + Tailwind on frontend; FastAPI + SQLAlchemy on backend.

**Branch:** `feat/cashier-inventario-products` off `release/qa` at the latest tip. Independent of PRs in flight (Mi Caja, Mis Ventas) — different files.

**Worktree:** `.claude/worktrees/cashier-inventario`

---

## File structure (locked)

| File | Action |
|---|---|
| `app/routers/products/import_export.py` | **Modify** — add `dry_run` Form param + `UploadPreviewResponse`; rollback on dry-run |
| `app/schemas/products/__init__.py` (or wherever import schemas live) | **Modify or create** — `UploadPreviewResponse`, `UploadRowPreview` |
| `frontend/src/api/products.ts` | **Modify** — `uploadProducts(file, scope, options: { dryRun? })`, add `getCatalogKpis()`, add types |
| `frontend/src/types/products.ts` | **Modify** — add `CatalogKpis`, `UploadRowPreview`, `UploadPreviewResponse` |
| `frontend/src/components/branch/ProductsBranchView.tsx` | **Modify** — KPIs row, drop Inactivos tab, restructure ProductFormModal sections + tier palette, rewrite ImportExcelModal as wizard |

---

## Task 0: Setup branch + worktree

- [ ] **Step 1: Sync + create worktree**

```bash
cd /home/atlas-tech/Devs/Atlas-API
git fetch origin --quiet
git worktree add /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/cashier-inventario -b feat/cashier-inventario-products origin/release/qa
```

- [ ] **Step 2: Symlink node_modules + verify build**

```bash
cd /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/cashier-inventario/frontend
ln -s ../../../../frontend/node_modules ./node_modules
npm run build 2>&1 | tail -3
```

Expected: `✓ built in N s`.

---

## Task 1: Backend — `dry_run` flag with rollback

**File:** `app/routers/products/import_export.py`

The existing `upload_products` function (line 253) parses, validates, and commits row-by-row. Adding `dry_run` is simplest as a "track-and-rollback" pattern: track which rows were created/updated/errored as the function runs, then either commit or rollback at the end.

- [ ] **Step 1: Add `dry_run` Form parameter**

Find the signature (line 253-262):

```python
@router.post("/upload")
async def upload_products(
    branch_id: Optional[int] = Form(None),
    target_branch_ids: Optional[str] = Form(None),
    scope: str = Form("branch"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
```

Add `dry_run: bool = Form(False)` BEFORE `file`:

```python
@router.post("/upload")
async def upload_products(
    branch_id: Optional[int] = Form(None),
    target_branch_ids: Optional[str] = Form(None),
    scope: str = Form("branch"),
    dry_run: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
```

- [ ] **Step 2: Track preview rows + rollback at end**

The function already accumulates `created_count`, `updated_count`, `failed_count`, `failed_details`. Add a parallel `preview_rows: list[dict]` that captures the first 20 rows that processed successfully (NEW or UPDATE) plus all errors.

Find the row-processing loop (it iterates `rows` and builds Products / ProductVariants). Inside that loop, AFTER each row is classified as create/update/error, append to `preview_rows` if `len(preview_rows) < 20`:

```python
        if len(preview_rows) < 20:
            preview_rows.append({
                "action": "NEW" if is_new else "UPDATE",
                "sku": sku_value,
                "name": name_value,
                "price": float(price_value) if price_value is not None else None,
                "error_message": None,
            })
```

(The exact variable names — `is_new`, `sku_value`, etc. — depend on the existing code. Read the function first; map the existing per-row branch-of-logic into this dict shape. The tracker happens inside the same try/except where `created_count` and `updated_count` are bumped.)

For ERROR rows (where the existing code does `failed_count += 1` and appends to `failed_details`), also append to `preview_rows` if under 20:

```python
        if len(preview_rows) < 20:
            preview_rows.append({
                "action": "ERROR",
                "sku": (row.get("sku") or row.get("código") or None),
                "name": row.get("nombre") or row.get("name"),
                "price": None,
                "error_message": str(row_error),
            })
```

Initialize `preview_rows = []` near the other counters.

- [ ] **Step 3: Branch on `dry_run` at end of function**

At the existing end of the function (where it returns the response dict — search for the final `return` that includes `created`, `updated`, `failed`, `errors` keys), wrap with:

```python
    if dry_run:
        db.rollback()
        return {
            "total_rows": created_count + updated_count + failed_count,
            "to_create": created_count,
            "to_update": updated_count,
            "errors": failed_count,
            "preview": preview_rows,
            "error_details": failed_details,
        }

    db.commit()  # if there isn't already an explicit commit; keep existing commit logic if there is
    return {
        "created": created_count,
        "updated": updated_count,
        "failed": failed_count,
        "errors": failed_details,
    }
```

If the existing function commits row-by-row inside the loop (autoflush), an explicit `db.rollback()` after-the-fact won't undo committed rows. **Read the existing function first**: if it does per-row commits, refactor into a single transaction (only commit at the end). If it already only commits once at the end, the dry_run branch is straightforward.

If the function already returns a different shape, adapt to keep backward compatibility for non-dry-run callers.

- [ ] **Step 4: Verify**

```bash
python -m py_compile app/routers/products/import_export.py && echo "compile OK"
```

- [ ] **Step 5: Commit**

```bash
git add app/routers/products/import_export.py
git commit -m "feat(products): add dry_run flag to /products/upload — preview without commit"
```

---

## Task 2: Frontend — types + API extension

**Files:**
- Modify: `frontend/src/types/products.ts`
- Modify: `frontend/src/api/products.ts`

- [ ] **Step 1: Add types in `frontend/src/types/products.ts`**

Append to the file:

```ts
export interface CatalogKpis {
  total_skus: number
  active_pos: number
  pending_approval: number
  no_branch: number
  critical_stock: number
  zero_stock: number
}

export interface UploadRowPreview {
  action: 'NEW' | 'UPDATE' | 'ERROR'
  sku: string | null
  name: string | null
  price: number | null
  error_message: string | null
}

export interface UploadPreviewResponse {
  total_rows: number
  to_create: number
  to_update: number
  errors: number
  preview: UploadRowPreview[]
  error_details: string[]
}
```

- [ ] **Step 2: Extend `uploadProducts` and add `getCatalogKpis` in `frontend/src/api/products.ts`**

Find the existing `uploadProducts` function (around line 357). Replace it with:

```ts
  /**
   * POST /api/products/upload — importación masiva desde Excel/CSV.
   *
   * options.dryRun=true → returns UploadPreviewResponse without committing.
   */
  uploadProducts: async (
    file: File,
    scope: 'branch' | 'all' | 'selected' = 'branch',
    targetBranchIds?: string,
    options: { dryRun?: boolean } = {},
  ): Promise<
    | { created: number; updated: number; failed: number; errors: string[] }
    | UploadPreviewResponse
  > => {
    const form = new FormData()
    form.append('file', file)
    form.append('scope', scope)
    if (targetBranchIds) form.append('target_branch_ids', targetBranchIds)
    if (options.dryRun) form.append('dry_run', 'true')
    const { data } = await client.post('/products/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (options.dryRun) {
      return data as UploadPreviewResponse
    }
    return {
      created: data.created ?? 0,
      updated: data.updated ?? 0,
      failed: data.failed ?? 0,
      errors: data.errors ?? [],
    }
  },

  /**
   * GET /api/products/stats/catalog-kpis — branch-scoped catalog KPIs.
   */
  getCatalogKpis: async (): Promise<CatalogKpis> => {
    const { data } = await client.get<CatalogKpis>('/products/stats/catalog-kpis')
    return data ?? { total_skus: 0, active_pos: 0, pending_approval: 0, no_branch: 0, critical_stock: 0, zero_stock: 0 }
  },
```

Add the type imports at the top of `products.ts`:

```ts
import type { CatalogKpis, UploadPreviewResponse } from '../types/products'
```

(Check the existing import block — add the two type imports, don't remove existing imports.)

- [ ] **Step 3: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/products.ts frontend/src/api/products.ts
git commit -m "feat(products): add CatalogKpis + UploadPreviewResponse types and API"
```

---

## Task 3: ProductsBranchView — add KPIs + drop Inactivos tab

**File:** `frontend/src/components/branch/ProductsBranchView.tsx`

- [ ] **Step 1: Add KPI state and fetch**

Inside `ProductsBranchView()`, add a new state alongside the existing ones:

```ts
const [kpis, setKpis] = useState<CatalogKpis | null>(null)
```

Import the type at top of file:

```ts
import type { Product, Brand, Department, ProductPrice, PackagingUnit, CatalogKpis } from '../../types/products'
```

In the existing `useEffect` that loads departments and brands (line ~59-62), add a third call:

```ts
  useEffect(() => {
    productsApi.getDepartments().then(setDepartments).catch(() => {})
    productsApi.getBrands().then(setBrands).catch(() => {})
    productsApi.getCatalogKpis().then(setKpis).catch(() => {})
  }, [])
```

Also add a `loadKpis` helper to refresh after save/import:

```ts
const loadKpis = useCallback(() => {
  productsApi.getCatalogKpis().then(setKpis).catch(() => {})
}, [])
```

Wire `loadKpis()` into the `onSaved` handlers of the create/edit modals (after `load(search)`):

```tsx
onSaved={() => { setCreating(false); load(search); loadKpis() }}
// ...
onSaved={() => { setEditing(null); load(search); loadKpis() }}
// ... (also for stockTarget and import)
```

- [ ] **Step 2: Render the KPI grid**

Insert this block AFTER the hero band (around line 142, between hero and the search-card) and BEFORE `{/* Search + filters */}`:

```tsx
        {/* ── KPIs por sucursal — 4 cards ───────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon="fa-cubes"
            label="Total productos"
            value={kpis ? String(kpis.total_skus) : '—'}
            iconBg="rgba(148,163,184,0.15)"
            iconColor="#94a3b8"
          />
          <KpiCard
            icon="fa-store"
            label="Activos en POS"
            value={kpis ? String(kpis.active_pos) : '—'}
            iconBg="rgba(16,185,129,0.12)"
            iconColor="#10b981"
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            icon="fa-triangle-exclamation"
            label="Stock crítico"
            value={kpis ? String(kpis.critical_stock) : '—'}
            iconBg="rgba(245,158,11,0.12)"
            iconColor="#f59e0b"
            valueClass="text-amber-600 dark:text-amber-400"
          />
          <KpiCard
            icon="fa-circle-xmark"
            label="Sin stock"
            value={kpis ? String(kpis.zero_stock) : '—'}
            iconBg="rgba(244,63,94,0.12)"
            iconColor="#f43f5e"
            valueClass="text-rose-600 dark:text-rose-400"
          />
        </div>
```

This requires a `KpiCard` component. If `frontend/src/components/branch/CashBranchView.tsx` exposes one (it does — defined inline), copy that small definition into a shared spot, OR define a local `KpiCard` inline in `ProductsBranchView.tsx` (matching the same 7-prop signature). The cleanest path: define a small local component at the top of `ProductsBranchView.tsx`:

```tsx
interface KpiCardProps {
  icon: string
  label: string
  value: string
  valueClass?: string
  iconBg?: string
  iconColor?: string
}

function KpiCard({ icon, label, value, valueClass, iconBg, iconColor }: KpiCardProps) {
  return (
    <div className={`${ui.card} p-5 flex flex-col gap-1`}>
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{ background: iconBg ?? 'rgba(139,92,246,0.12)' }}
        >
          <i className={`fa-solid ${icon} text-sm`} style={{ color: iconColor ?? '#a78bfa' }} />
        </div>
        <span className={ui.kpiLabel}>{label}</span>
      </div>
      <span className={`${ui.kpiValue} text-2xl ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}
```

- [ ] **Step 3: Drop Inactivos tab**

Three localized changes:

Line 33 — change filter type:

```ts
const [filter, setFilter] = useState<'all' | 'low'>('all')
```

(was: `'all' | 'low' | 'inactive'`)

Lines 70-81 — remove the inactive branch in the `visible` useMemo:

```ts
  const visible = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'low') {
      return items.filter((p) => {
        const min = p.min_stock ?? 0
        const qty = p.stock_total ?? p.stock ?? 0
        return qty <= min
      })
    }
    return items
  }, [items, filter])
```

(removes the `if (filter === 'inactive') return items.filter((p) => !p.is_active)` line)

Lines ~155-169 — change the tab buttons array and label ternary:

```tsx
          <div className="flex gap-1 bg-stone-100 dark:bg-slate-800 rounded-xl p-1">
            {(['all', 'low'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f === 'all' ? 'Todos' : 'Stock bajo'}
              </button>
            ))}
          </div>
```

- [ ] **Step 4: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/branch/ProductsBranchView.tsx
git commit -m "feat(inventario): 4 catalog KPIs surfaced + drop Inactivos tab"
```

---

## Task 4: ProductFormModal — sectioned + tier palette

**File:** `frontend/src/components/branch/ProductsBranchView.tsx`

This is a layout/styling refactor of the existing `ProductFormModal` function (around lines 320-668). Submit logic stays IDENTICAL. Only the JSX rendering changes.

- [ ] **Step 1: Add helper components and constants**

Near the top of the file (after imports), add:

```tsx
const TIER_PALETTE = [
  { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-700 dark:text-purple-300',   icon: 'fa-tag' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-300', icon: 'fa-layer-group' },
  { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-700 dark:text-amber-300',     icon: 'fa-box' },
  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-700 dark:text-indigo-300',   icon: 'fa-warehouse' },
  { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-700 dark:text-rose-300',       icon: 'fa-percent' },
] as const

function tierStyle(i: number) {
  return TIER_PALETTE[Math.min(i, TIER_PALETTE.length - 1)]
}

function SectionHeader({ icon, label, accentColor }: {
  icon: string
  label: string
  accentColor: 'slate' | 'purple' | 'blue'
}) {
  const colorClass = {
    slate: 'text-slate-500',
    purple: 'text-purple-500',
    blue: 'text-blue-500',
  }[accentColor]
  return (
    <div className="flex items-center gap-2 mb-3">
      <i className={`fa-solid ${icon} ${colorClass}`} aria-hidden="true" />
      <p className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">
        {label}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the body of `ProductFormModal`**

Inside the `ProductFormModal` function, between the `<Modal>` open tag and the closing `</Modal>`, replace the body (foto + datos + tiers + packs sections) with a 3-section structure. Each section uses `ui.card p-4` wrapping with a `SectionHeader` at top.

Section 1 — Datos básicos (slate accent):

```tsx
      <section className={`${ui.card} p-4`}>
        <SectionHeader icon="fa-info-circle" label="Datos básicos" accentColor="slate" />
        <div className="flex gap-4 mb-3">
          <div className="flex-shrink-0">
            {/* keep existing image uploader block — copy it over verbatim */}
            <div
              onClick={() => mode === 'edit' && fileRef.current?.click()}
              className={`w-24 h-24 rounded-2xl bg-stone-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-stone-300 dark:border-slate-700 ${
                mode === 'edit' ? 'cursor-pointer hover:border-purple-500' : 'opacity-60'
              }`}
              title={mode === 'edit' ? 'Cambiar foto' : 'Crea el producto primero'}
            >
              {imgUploading ? (
                <i className="fa-solid fa-spinner fa-spin text-purple-500" />
              ) : imageUrl ? (
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <i className="fa-solid fa-camera text-slate-400 text-xl block mb-1" />
                  <span className="text-[9px] text-slate-500 font-semibold">Subir foto</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadImage(f)
                e.target.value = ''
              }}
            />
            {imageUrl && mode === 'edit' && (
              <button
                onClick={deleteImage}
                type="button"
                className="mt-2 w-full text-[10px] font-semibold text-rose-600 hover:text-rose-700"
              >
                Quitar foto
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Field label="Nombre *">
              <input className={ui.input} value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
            </Field>
            <Field label="Descripción">
              <input className={ui.input} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Opcional" />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU *">
            <input className={ui.input} value={form.sku} onChange={(e) => set('sku', e.target.value)} />
          </Field>
          <Field label="Código de barras">
            <input className={ui.input} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          </Field>
          <Field label="Costo *">
            <input className={ui.input} type="number" step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
          </Field>
          <Field label="Precio *">
            <input className={ui.input} type="number" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </Field>
          <Field label="Departamento">
            <select className={ui.input} value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Marca">
            <select className={ui.input} value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          {mode === 'create' && (
            <Field label="Stock inicial">
              <input className={ui.input} type="number" step="1" value={form.initial_stock} onChange={(e) => set('initial_stock', e.target.value)} placeholder="Opcional" />
            </Field>
          )}
        </div>
      </section>
```

Section 2 — Precios escalonados (purple accent, tier palette):

```tsx
      <section className={`${ui.card} p-4 mt-3`}>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader icon="fa-bolt" label="Precios escalonados" accentColor="purple" />
          <button
            type="button"
            onClick={() => setTiers((t) => [...t, { price_name: `Precio ${t.length + 1}`, min_quantity: '', unit_price: '' }])}
            className="text-[10px] font-bold text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-200"
          >
            <i className="fa-solid fa-plus mr-1" /> Agregar
          </button>
        </div>
        {tiers.length === 0 ? (
          <p className={`text-xs italic ${ui.muted}`}>Sin precios escalonados — solo se usa el precio base.</p>
        ) : (
          <div className="space-y-2">
            {tiers.map((t, i) => {
              const s = tierStyle(i)
              return (
                <div key={i} className={`rounded-xl border ${s.border} ${s.bg} p-3`}>
                  <div className="flex items-center gap-2 mb-2">
                    <i className={`fa-solid ${s.icon} ${s.text}`} aria-hidden="true" />
                    <input
                      className={`bg-transparent flex-1 font-bold text-sm outline-none ${s.text}`}
                      value={t.price_name}
                      onChange={(e) => setTiers((arr) => arr.map((x, idx) => idx === i ? { ...x, price_name: e.target.value } : x))}
                      placeholder="Nombre del precio (ej. Mayoreo)"
                    />
                    <button
                      type="button"
                      onClick={() => setTiers((arr) => arr.filter((_, idx) => idx !== i))}
                      className="text-rose-500 hover:text-rose-600 p-1"
                      aria-label="Eliminar"
                    >
                      <i className="fa-solid fa-trash text-xs" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Cantidad mínima">
                      <input
                        className={`${ui.input} text-sm tabular-nums`}
                        type="number"
                        step="1"
                        value={t.min_quantity}
                        onChange={(e) => setTiers((arr) => arr.map((x, idx) => idx === i ? { ...x, min_quantity: e.target.value } : x))}
                      />
                    </Field>
                    <Field label="Precio por unidad">
                      <input
                        className={`${ui.input} text-sm tabular-nums`}
                        type="number"
                        step="0.01"
                        value={t.unit_price}
                        onChange={(e) => setTiers((arr) => arr.map((x, idx) => idx === i ? { ...x, unit_price: e.target.value } : x))}
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
```

Section 3 — Empaques (blue accent, single tone):

```tsx
      <section className={`${ui.card} p-4 mt-3`}>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader icon="fa-box-open" label="Empaques (caja, paquete)" accentColor="blue" />
          <button
            type="button"
            onClick={() => setPacks((u) => [...u, { name: 'Caja', barcode: '', units_per_package: '', package_price: '' }])}
            className="text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200"
          >
            <i className="fa-solid fa-plus mr-1" /> Agregar
          </button>
        </div>
        {packs.length === 0 ? (
          <p className={`text-xs italic ${ui.muted}`}>Sin empaques registrados.</p>
        ) : (
          <div className="space-y-2">
            {packs.map((u, i) => (
              <div key={i} className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fa-solid fa-box-open text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  <input
                    className="bg-transparent flex-1 font-bold text-sm outline-none text-blue-700 dark:text-blue-300"
                    value={u.name}
                    onChange={(e) => setPacks((arr) => arr.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                    placeholder="Caja"
                  />
                  <button
                    type="button"
                    onClick={() => setPacks((arr) => arr.filter((_, idx) => idx !== i))}
                    className="text-rose-500 hover:text-rose-600 p-1"
                    aria-label="Eliminar"
                  >
                    <i className="fa-solid fa-trash text-xs" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Código">
                    <input
                      className={`${ui.input} text-sm`}
                      value={u.barcode}
                      onChange={(e) => setPacks((arr) => arr.map((x, idx) => idx === i ? { ...x, barcode: e.target.value } : x))}
                      placeholder="Opcional"
                    />
                  </Field>
                  <Field label="Unidades / caja">
                    <input
                      className={`${ui.input} text-sm tabular-nums`}
                      type="number"
                      step="1"
                      value={u.units_per_package}
                      onChange={(e) => setPacks((arr) => arr.map((x, idx) => idx === i ? { ...x, units_per_package: e.target.value } : x))}
                    />
                  </Field>
                  <Field label="$ por caja">
                    <input
                      className={`${ui.input} text-sm tabular-nums`}
                      type="number"
                      step="0.01"
                      value={u.package_price}
                      onChange={(e) => setPacks((arr) => arr.map((x, idx) => idx === i ? { ...x, package_price: e.target.value } : x))}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
```

Footer (sticky cancel/save):

```tsx
      <div className="flex gap-2 mt-6 sticky bottom-0 bg-white dark:bg-slate-900 pt-3">
        <button onClick={onClose} className={`${ui.btnSecondary} flex-1`} disabled={saving}>Cancelar</button>
        <button onClick={submit} disabled={saving} className={`${ui.btnPrimary} flex-1`}>
          {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" /> Guardar</>}
        </button>
      </div>
```

`submit()`, `uploadImage()`, `deleteImage()` functions stay UNCHANGED. Only JSX is reorganized.

- [ ] **Step 3: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/branch/ProductsBranchView.tsx
git commit -m "feat(inventario): sectioned product modal with tier palette"
```

---

## Task 5: ImportExcelModal — wizard 3-step + dry-run

**File:** `frontend/src/components/branch/ProductsBranchView.tsx`

Replace the existing `ImportExcelModal` function (around lines 813-877) with a wizard.

- [ ] **Step 1: Rewrite ImportExcelModal**

Replace the entire `ImportExcelModal` function with:

```tsx
function ImportExcelModal({ onClose, onDone }: ImportModalProps) {
  type Step = 'upload' | 'preview' | 'result'
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dryRun, setDryRun] = useState(false)
  const [preview, setPreview] = useState<UploadPreviewResponse | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; failed: number; errors: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchPreview() {
    if (!file) return
    setLoading(true); setError(null)
    try {
      const res = await productsApi.uploadProducts(file, 'branch', undefined, { dryRun: true })
      setPreview(res as UploadPreviewResponse)
      setStep('preview')
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Error al analizar el archivo.')
    } finally {
      setLoading(false)
    }
  }

  async function commit() {
    if (!file) return
    if (dryRun) {
      // Simulation only — close without writing
      onClose()
      return
    }
    setLoading(true); setError(null)
    try {
      const res = await productsApi.uploadProducts(file, 'branch', undefined, { dryRun: false })
      setResult(res as { created: number; updated: number; failed: number; errors: string[] })
      setStep('result')
      if ((res as { created: number; updated: number }).created > 0 || (res as { created: number; updated: number }).updated > 0) {
        onDone()
      }
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Error al importar.')
    } finally {
      setLoading(false)
    }
  }

  function downloadErrorsCsv(errors: string[]) {
    const csv = ['error', ...errors].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import-errors-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal title="Importar productos desde Excel" onClose={onClose} size="xl">
      {step === 'upload' && (
        <>
          <p className={`text-sm ${ui.muted} mb-4`}>
            Sube tu archivo Excel/CSV. En el siguiente paso verás qué se va a crear, actualizar o omitir antes de aplicar.
          </p>
          <Field label="Archivo">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={ui.input}
            />
          </Field>
          <label className="flex items-center gap-2 mt-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded"
            />
            Solo simular (no aplicar cambios)
          </label>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400 mt-3">{error}</p>}
          <div className="flex gap-2 mt-6">
            <button onClick={onClose} className={`${ui.btnSecondary} flex-1`} disabled={loading}>Cancelar</button>
            <button onClick={fetchPreview} disabled={loading || !file} className={`${ui.btnPrimary} flex-1`}>
              {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <>Continuar <i className="fa-solid fa-arrow-right" /></>}
            </button>
          </div>
        </>
      )}

      {step === 'preview' && preview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-sm">
            <div className={`${ui.card} p-3`}>
              <p className={ui.kpiLabel}>Filas</p>
              <p className="text-xl font-bold tabular-nums">{preview.total_rows}</p>
            </div>
            <div className={`${ui.card} p-3`}>
              <p className={ui.kpiLabel}>Nuevos</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{preview.to_create}</p>
            </div>
            <div className={`${ui.card} p-3`}>
              <p className={ui.kpiLabel}>Actualizar</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">{preview.to_update}</p>
            </div>
            <div className={`${ui.card} p-3`}>
              <p className={ui.kpiLabel}>Errores</p>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{preview.errors}</p>
            </div>
          </div>

          {preview.preview.length > 0 && (
            <div className={`${ui.card} p-3 max-h-64 overflow-y-auto mb-4`}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr>
                    <th className="text-left">Acción</th>
                    <th className="text-left">SKU</th>
                    <th className="text-left">Nombre</th>
                    <th className="text-right">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((r, i) => (
                    <tr key={i} className="border-t border-stone-100 dark:border-slate-800">
                      <td>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.action === 'NEW' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                          r.action === 'UPDATE' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400' :
                          'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                        }`}>
                          {r.action === 'NEW' ? 'NUEVO' : r.action === 'UPDATE' ? 'ACTUALIZA' : 'ERROR'}
                        </span>
                      </td>
                      <td className="font-mono">{r.sku ?? '—'}</td>
                      <td>{r.name ?? r.error_message ?? '—'}</td>
                      <td className="text-right tabular-nums">{r.price != null ? fmtMoney(String(r.price)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.total_rows > 20 && (
                <p className={`text-xs ${ui.muted} mt-2 text-center`}>
                  Mostrando 20 de {preview.total_rows} filas. Se aplicará a todas.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>}

          <div className="flex gap-2 mt-4">
            <button onClick={() => setStep('upload')} className={`${ui.btnSecondary} flex-1`} disabled={loading}>
              <i className="fa-solid fa-arrow-left" /> Atrás
            </button>
            <button
              onClick={commit}
              disabled={loading || preview.to_create + preview.to_update === 0}
              className={`${ui.btnPrimary} flex-1`}
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin" /> :
                dryRun ? 'Cerrar simulación' :
                <><i className="fa-solid fa-check" /> Aplicar {preview.to_create + preview.to_update} cambios</>
              }
            </button>
          </div>
        </>
      )}

      {step === 'result' && result && (
        <>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between"><span className={ui.muted}>Creados</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{result.created}</span></div>
            <div className="flex justify-between"><span className={ui.muted}>Actualizados</span><span className="font-bold text-purple-600 dark:text-purple-400">{result.updated}</span></div>
            <div className="flex justify-between"><span className={ui.muted}>Fallidos</span><span className="font-bold text-rose-600 dark:text-rose-400">{result.failed}</span></div>
          </div>
          {result.errors.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className={ui.kpiLabel}>Errores</p>
                <button onClick={() => downloadErrorsCsv(result.errors)} className="text-xs text-purple-600 hover:text-purple-700">
                  <i className="fa-solid fa-file-csv mr-1" /> Descargar CSV
                </button>
              </div>
              <ul className="text-xs text-rose-600 dark:text-rose-400 max-h-32 overflow-y-auto space-y-1">
                {result.errors.slice(0, 20).map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
          <button onClick={onClose} className={`${ui.btnPrimary} w-full`}>Cerrar</button>
        </>
      )}
    </Modal>
  )
}
```

Add the import at the top of the file:

```ts
import type { CatalogKpis, UploadPreviewResponse } from '../../types/products'
```

(Combine with the existing types-products import line if there already is one.)

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/branch/ProductsBranchView.tsx
git commit -m "feat(inventario): import wizard 3-step + dry-run preview"
```

---

## Task 6: Final build + push + PR

- [ ] **Step 1: Final clean build**

```bash
cd /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/cashier-inventario
cd frontend && rm -rf dist && npm run build 2>&1 | tail -10
```

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin feat/cashier-inventario-products
gh pr create --base release/qa --head feat/cashier-inventario-products \
  --title "feat(inventario): KPIs + drop Inactivos + sectioned modal + import wizard" \
  --body "PR 4 of 5 in Cashier Pack. Spec: docs/superpowers/specs/2026-04-29-cashier-pack-products-branch-redesign-design.md. Plan: docs/superpowers/plans/2026-04-29-cashier-inventario-products.md.

- 4 catalog KPIs (Total / Activos en POS / Stock crítico / Sin stock) sourced from existing /products/stats/catalog-kpis endpoint, branch-scoped.
- Drops Inactivos filter tab (cashiers don't act on inactive products).
- Product create/edit modal restructured into 3 colored sections (Datos básicos slate / Precios escalonados purple+tier-palette / Empaques blue).
- Tier palette: 5 distinct colors per tier index (purple/emerald/amber/indigo/rose); 6+ tiers reuse last color.
- Import modal becomes 3-step wizard: Upload → Preview → Result. Dry-run checkbox in step 1 closes after preview without writing.
- Backend: /products/upload accepts dry_run=true Form param; tracks would-create/would-update/error rows, builds preview, then db.rollback() instead of commit.

Independent of Mi Caja and Mis Ventas PRs.

Test plan in spec § 'Testing plan'.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-review

**Spec coverage:**
- §1 KPIs por sucursal → Task 3
- §2 Quitar pestaña Inactivos → Task 3
- §3 ProductFormModal redesign con secciones de color → Task 4
- §3a-3e Tier palette + SectionHeader → Task 4
- §4 ImportExcelModal wizard → Task 5
- §5 Backend extend /products/upload → Task 1
- §6 Frontend type/API additions → Task 2

**Placeholder scan:** "TBD" appears once in §3a context — flagged inside an intentional self-review note acknowledging the row-tracker variable names depend on existing code. The implementer reads the function before editing.

**Type consistency:** `UploadPreviewResponse` shape matches between Task 1 (backend dict), Task 2 (TypeScript interface), and Task 5 (consumer in ImportExcelModal). `CatalogKpis` matches between Task 2 (type) and Task 3 (consumer). `KpiCard` props match between definition (Task 3 step 2) and 4 usages.

**Risk notes:**
- `db.rollback()` in dry_run path assumes the existing function is single-transaction (or close to it). If the implementer finds row-by-row commits, refactor to a single transaction before adding dry_run support.
- `KpiCard` is duplicated from `CashBranchView.tsx` (where it lives inline). Extracting to a shared component is a follow-up; in-line copy is fine for this PR.
- `Field` and `Modal` components are already defined inside `ProductsBranchView.tsx` — reused, not redefined.
