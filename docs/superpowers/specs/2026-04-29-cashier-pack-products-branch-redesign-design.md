# Cashier Pack — Inventario (branch products view) redesign

**Date:** 2026-04-29
**Module:** 5 of 5 in Cashier Pack
**Target route:** `/products` (CAJERO/GERENTE only — HQ admins see `Products.tsx` instead, out of scope)
**Target file:** `frontend/src/components/branch/ProductsBranchView.tsx`
**PR target:** `release/qa`

---

## Context

The cashier-facing inventory page already has functional create/edit/import/stock-adjust modals and a search+filter bar, but four gaps remain:

1. **No KPIs visible.** The hero only shows `{count} productos`. Backend exposes `GET /api/products/stats/catalog-kpis` (auto-scoped by branch for cashiers) returning 6 metrics, but none are surfaced.
2. **Inactivos tab is noise.** Cashiers don't act on inactive products; the tab exists from a copy-paste of HQ structure. User asked for removal.
3. **Product create/edit modal feels utilitarian.** Tiers and packaging units render as plain gray rows. POS reference (`ProductDetailModal.tsx`) uses a "tiered pricing palette" with semantic colors per tier, which the user wants applied here.
4. **Import modal is single-step** (upload → result). Cashier wants to see what's about to happen before committing, with the option to dry-run.

This redesign keeps existing data flows intact, surfaces the stats endpoint, fixes copy-paste tabs, restructures the product modal into colored sections, and turns the import modal into a 3-step wizard with optional dry-run.

---

## Goals

- Surface 4 cashier-relevant catalog KPIs.
- Remove the Inactivos filter tab.
- Restructure the product create/edit modal into 3 colored sections (Datos básicos / Precios escalonados / Empaques) with semantic palette per tier.
- Turn the import flow into a 3-step wizard (Upload → Preview → Result) with optional dry-run.

## Non-goals

- HQ `Products.tsx` not touched.
- No new product fields, no new pricing logic, no changes to stock-adjust modal.
- No field-mapping wizard for Excel imports (beyond column-name match — the existing template defines columns).
- No server-side caching of upload-in-progress (re-upload pattern; see §4).

---

## Design

### 1. KPIs por sucursal — 4 cards

Inserted between the hero and the search bar. Layout: `grid grid-cols-2 lg:grid-cols-4 gap-3`.

| # | Label | Source | Color | Icon |
|---|---|---|---|---|
| 1 | Total productos | `kpis.total_skus` | white/slate | `fa-cubes` |
| 2 | Activos en POS | `kpis.active_pos` | emerald | `fa-store` |
| 3 | Stock crítico | `kpis.critical_stock` | amber | `fa-triangle-exclamation` |
| 4 | Sin stock | `kpis.zero_stock` | rose | `fa-circle-xmark` |

The other two metrics returned by the endpoint (`pending_approval`, `no_branch`) are admin-relevant; they are not rendered for cashiers/managers in this view.

#### 1a. API call

If `frontend/src/api/products.ts` does not yet expose `getCatalogKpis()`, add it:

```ts
export async function getCatalogKpis(): Promise<CatalogKpis> {
  const { data } = await client.get('/products/stats/catalog-kpis')
  return data
}
```

Type `CatalogKpis`:
```ts
interface CatalogKpis {
  total_skus: number
  active_pos: number
  pending_approval: number
  no_branch: number
  critical_stock: number
  zero_stock: number
}
```

#### 1b. Wiring in `ProductsBranchView`

Add state `const [kpis, setKpis] = useState<CatalogKpis | null>(null)`. In the existing departments+brands fetch effect (line 60), also call `productsApi.getCatalogKpis().then(setKpis).catch(() => {})`. Re-fetch after any save/import (extend `onSaved` / `onDone` callbacks to include a `loadKpis()` call alongside `load(search)`).

If `kpis` is null, render skeleton placeholders or `—` in each card. Don't gate the rest of the page on KPI load.

### 2. Quitar pestaña "Inactivos"

Three localized changes in `ProductsBranchView.tsx`:

- **Line 33**: `useState<'all' | 'low' | 'inactive'>('all')` → `useState<'all' | 'low'>('all')`
- **Line 79**: remove the `if (filter === 'inactive') return items.filter((p) => !p.is_active)` branch.
- **Line 156**: array `(['all', 'low', 'inactive'] as const)` → `(['all', 'low'] as const)`. The label ternary `f === 'inactive' ? 'Inactivos' : ...` becomes dead — simplify to `f === 'all' ? 'Todos' : 'Stock bajo'`.

Mechanical changes. No dependencies on `inactive` filter elsewhere in this file.

### 3. ProductFormModal — section-based redesign

The current form (lines 320–668) is reorganized into three visually distinct cards stacked vertically. Same fields, same submit logic, same `onSaved` callback — only the layout and visual treatment change.

#### 3a. Structure

```
┌─ Modal header (sticky) ────────────────────────┐
│ Nuevo producto / Editar producto         [×]   │
└────────────────────────────────────────────────┘

┌─ Section card 1: Datos básicos (slate) ────────┐
│ [📷 Foto 24x24]  Name *                        │
│                  Description                   │
│ Grid 2-col:  SKU * | Código de barras          │
│              Costo * | Precio *                │
│              Departamento | Marca              │
│              Stock inicial (only on create)    │
└────────────────────────────────────────────────┘

┌─ Section card 2: Precios escalonados (purple) ─┐
│ ⚡ PRECIOS ESCALONADOS         [+ Agregar]     │
│ ┌─ Tier 1 (purple bg) ──────────────────────┐ │
│ │ [tag-icon] Nombre [Min qty] [$/u]    [×]  │ │
│ ┌─ Tier 2 (emerald bg) ─────────────────────┐ │
│ │ [layers-icon] Nombre [Min qty] [$/u]  [×] │ │
│ ┌─ Tier 3 (amber bg) ───────────────────────┐ │
│ │ [box-icon] Nombre [Min qty] [$/u]    [×]  │ │
│ Empty state: "Sin precios escalonados" italic  │
└────────────────────────────────────────────────┘

┌─ Section card 3: Empaques (blue) ──────────────┐
│ 📦 EMPAQUES                    [+ Agregar]     │
│ Pack rows (single blue tone)                   │
│ Empty state: "Sin empaques registrados" italic │
└────────────────────────────────────────────────┘

┌─ Footer (sticky) ──────────────────────────────┐
│ [Cancelar]                       [✓ Guardar]   │
└────────────────────────────────────────────────┘
```

Each section card uses `ui.card` wrapper with `p-4` and a `SectionHeader` at top.

#### 3b. SectionHeader component

Inline component within `ProductsBranchView.tsx`:

```tsx
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

#### 3c. Tier palette

Each tier card is rendered with a color from `TIER_PALETTE` indexed by position:

```ts
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
```

A 6th tier reuses the 5th color (rose). Edge case acceptable; cashiers rarely have >5 tiers per product.

Tier card render:

```tsx
{tiers.map((t, i) => {
  const s = tierStyle(i)
  return (
    <div key={i} className={`rounded-xl border ${s.border} ${s.bg} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <i className={`fa-solid ${s.icon} ${s.text}`} aria-hidden="true" />
        <input
          className={`bg-transparent flex-1 font-bold text-sm outline-none ${s.text}`}
          value={t.price_name}
          onChange={(e) => updateTier(i, { price_name: e.target.value })}
          placeholder="Nombre del precio"
        />
        <button onClick={() => removeTier(i)} className="text-rose-500 hover:text-rose-600 p-1" aria-label="Eliminar">
          <i className="fa-solid fa-trash text-xs" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Cantidad mínima">
          <input className={`${ui.input} text-sm tabular-nums`} type="number" step="1"
                 value={t.min_quantity}
                 onChange={(e) => updateTier(i, { min_quantity: e.target.value })} />
        </Field>
        <Field label="Precio por unidad">
          <input className={`${ui.input} text-sm tabular-nums`} type="number" step="0.01"
                 value={t.unit_price}
                 onChange={(e) => updateTier(i, { unit_price: e.target.value })} />
        </Field>
      </div>
    </div>
  )
})}
```

#### 3d. Pack rows (Empaques)

Single blue tone — packs don't carry semantic meaning per index. Uses the same wrapper pattern but a fixed `bg-blue-500/10 border-blue-500/30` for every pack:

```tsx
{packs.map((u, i) => (
  <div key={i} className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
    {/* same field layout as today, just wrapped in colored card */}
  </div>
))}
```

#### 3e. Submit logic — unchanged

The `submit()` function (lines 389–459) is preserved verbatim. Form state, validation, and API calls do not change. Only JSX is restructured.

### 4. ImportExcelModal — wizard 3-step + dry-run

Three discrete steps with a state machine:

```ts
type ImportStep = 'upload' | 'preview' | 'result'
const [step, setStep] = useState<ImportStep>('upload')
const [file, setFile] = useState<File | null>(null)
const [dryRun, setDryRun] = useState(false)
const [preview, setPreview] = useState<UploadPreviewResponse | null>(null)
const [result, setResult] = useState<UploadResult | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

#### 4a. Step 1 — Upload

Same as today's form with one addition: a checkbox `[ ] Solo simular (no aplicar cambios)` bound to `dryRun`. Also a short helper paragraph explaining what the next step shows.

`Continuar →` button:
- Validate file is selected.
- Call `productsApi.uploadProducts(file, 'branch', { dry_run: true })` — always dry-run on this fetch.
- On success: `setPreview(res); setStep('preview')`.
- On error: `setError(detail)`.

#### 4b. Step 2 — Preview

Shows summary cards + first-20-row table:

```
Análisis del archivo:
  • {preview.total_rows} filas detectadas
  • {preview.to_create} SKUs nuevos (se crearán)
  • {preview.to_update} SKUs existentes (se actualizarán)
  • {preview.errors} con errores (se omiten)

[table — first 20 rows of preview.preview]

[← Atrás]                  [✓ Aplicar {to_create + to_update} cambios]
                                  or
                            [✓ Cerrar simulación]   ← if dryRun=true
```

If `dryRun` was checked in Step 1: the action button reads "Cerrar simulación" and clicking it just closes the modal (no commit). This is the dry-run terminal state.

If `dryRun` was unchecked: the action button reads "Aplicar X cambios" and:
- Re-uploads the same file with `dry_run=false`.
- On success: `setResult(res); setStep('result')`.
- On error: `setError(detail)`.

The button is `disabled` if `to_create + to_update === 0` (only errors).

Preview row table:

```tsx
<table className="text-xs w-full">
  <thead>
    <tr><th>Acción</th><th>SKU</th><th>Nombre</th><th>Precio</th></tr>
  </thead>
  <tbody>
    {preview.preview.map((r, i) => (
      <tr key={i}>
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
        <td>{r.name ?? '—'}</td>
        <td className="text-right tabular-nums">{r.price != null ? fmtMoney(String(r.price)) : '—'}</td>
      </tr>
    ))}
  </tbody>
</table>
```

If `preview.total_rows > 20`, show a footer line: `Mostrando 20 de {total_rows} filas. Se aplicará a todas.`

#### 4c. Step 3 — Result (mostly unchanged)

Reuses today's result UI: created / updated / failed counts + first 20 errors. Add a button `Descargar errores como CSV` that builds a client-side CSV from `result.errors` and triggers download:

```tsx
<button onClick={() => downloadErrorsCsv(result.errors)} className="text-xs text-purple-600 hover:text-purple-700">
  <i className="fa-solid fa-file-csv mr-1" /> Descargar errores como CSV
</button>
```

`downloadErrorsCsv` is a simple helper using `Blob` + `URL.createObjectURL`.

### 5. Backend — extend `/products/upload`

#### 5a. Endpoint signature

`app/routers/products/import_export.py` adds a query parameter:

```python
@router.post("/upload")
def upload_products(
    file: UploadFile,
    scope: str = "branch",
    dry_run: bool = False,
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_org_id),
) -> UploadResponse | UploadPreviewResponse:
    ...
```

The response type is one of two shapes depending on `dry_run`. Pydantic union response is OK; FastAPI handles it via `response_model=Union[UploadResponse, UploadPreviewResponse]` or by setting `response_model=None` and returning explicit Pydantic instances.

#### 5b. New schema `UploadPreviewResponse`

In `app/schemas/products.py` (or wherever import schemas live):

```python
class UploadRowPreview(BaseModel):
    action: Literal["NEW", "UPDATE", "ERROR"]
    sku: str | None = None
    name: str | None = None
    price: Decimal | None = None
    error_message: str | None = None

class UploadPreviewResponse(BaseModel):
    total_rows: int
    to_create: int
    to_update: int
    errors: int
    preview: list[UploadRowPreview]   # first 20 rows
    error_details: list[str]
```

#### 5c. Implementation

When `dry_run=True`:
- Parse the file the same way as today.
- For each row: determine if SKU exists (lookup by SKU within scope) → `UPDATE`; else `NEW`.
- Validation errors → `ERROR` with the message.
- Build the preview list (first 20 rows, all rows counted in totals).
- Return `UploadPreviewResponse`. **Do not write to DB.**

When `dry_run=False`:
- Existing path (current behavior). Returns `UploadResponse`.

The dry-run path reuses the validators of the real path — same parsing, same row-shape checks. Only the writes are skipped.

### 6. Frontend type/API additions

`frontend/src/api/products.ts`:

```ts
export async function uploadProducts(
  file: File,
  scope: string = 'branch',
  options: { dryRun?: boolean } = {}
): Promise<UploadResponse | UploadPreviewResponse> {
  const fd = new FormData()
  fd.append('file', file)
  const params: Record<string, string> = { scope }
  if (options.dryRun) params.dry_run = 'true'
  const { data } = await client.post('/products/upload', fd, { params })
  return data
}

export async function getCatalogKpis(): Promise<CatalogKpis> { ... }
```

`frontend/src/types/products.ts` (or near `UploadResponse`): add `UploadRowPreview` and `UploadPreviewResponse` interfaces matching the backend.

### 7. File-by-file summary

| File | Change |
|---|---|
| `frontend/src/components/branch/ProductsBranchView.tsx` | KPIs row, drop Inactivos tab, restructure ProductFormModal sections + tier palette, rewrite ImportExcelModal as wizard |
| `frontend/src/api/products.ts` | Add `getCatalogKpis()`, extend `uploadProducts()` with `dryRun` option |
| `frontend/src/types/products.ts` | Add `CatalogKpis`, `UploadRowPreview`, `UploadPreviewResponse` |
| `app/routers/products/import_export.py` | Add `dry_run` query param, branch on response type |
| `app/schemas/products.py` (or where import schemas live) | Add `UploadPreviewResponse`, `UploadRowPreview` |

---

## Data flow

```
On page mount
  ├── GET /products              → product list
  ├── GET /products/departments  → dept dropdown
  ├── GET /products/brands       → brand dropdown
  └── GET /products/stats/catalog-kpis → KPIs

On import (wizard)
  ├── Step 1: select file, optional dry_run flag
  ├── POST /products/upload?dry_run=true  → preview
  ├── Step 2: review preview
  ├── If dryRun: terminate (no commit)
  ├── If commit: POST /products/upload?dry_run=false  → result
  └── Step 3: show result + CSV download

After save / import / stock adjust
  └── Refetch product list + KPIs
```

---

## Edge cases

| Case | Handling |
|---|---|
| Backend `kpis` endpoint not deployed | `kpis` stays null → cards show `—` |
| Product with 7 tiers | Tiers 6+ all use rose (5th palette slot) |
| Import with 0 rows | Step 2 shows "0 filas detectadas", action button disabled |
| Import with all errors | Step 2 shows error rows, "Aplicar" button disabled, only "Atrás" works |
| User edits Excel between Step 1 and Step 2's commit | File is re-uploaded, so changes are re-validated. Behavior correct. |
| Product without variants in stock-adjust path | Existing toast "Producto sin variante" still fires — unchanged |

---

## Testing plan

Manual smoke (CAJERO role on `/products`):

1. Verify 4 KPI cards render with branch-scoped numbers.
2. Verify filter chips show only "Todos" and "Stock bajo" — no "Inactivos".
3. Click "Nuevo producto" → modal opens with 3 colored sections (slate, purple, blue).
4. Add 3 tiers → verify they render purple → emerald → amber.
5. Add a 6th tier → verify it renders rose (palette overflow).
6. Save → product appears in list.
7. Click "Importar Excel" → upload a file with 2 NEW + 3 UPDATE + 1 ERROR rows → Step 2 shows correct counts and preview rows colored by action.
8. Click "Aplicar 5 cambios" → Step 3 shows result.
9. Repeat with "Solo simular" checked → Step 2 shows preview, action button reads "Cerrar simulación", clicking it closes modal without writing.
10. In Step 3 with errors: click "Descargar errores como CSV" → file downloads with one error per line.

---

## Risks

- **File re-upload pattern**: same file is sent twice (preview + commit). Acceptable for typical files (<200 KB). If files become large enough that this is a problem, a future iteration can introduce a server-side upload-token cache.
- **Preview ↔ commit drift**: if another user/process modifies products between Step 2 and Step 3, the actual result may differ slightly from the preview. Mitigation: copy in Step 2 reads "El resultado puede variar si otros usuarios editan al mismo tiempo." Acceptable for cashier scale.
- **TIER_PALETTE 5 colors**: 6+ tier collisions. Edge case; documented above.
- **`getCatalogKpis()` import path**: if `frontend/src/api/products.ts` is split into multiple files (per the discovery brief noting `core.py`/`stats.py` split on backend), the import path may differ. Plan-time check.
- **Schema location**: `UploadPreviewResponse` placement depends on where `UploadResponse` already lives. Plan-time discovery resolves.
- **Inactive products visibility after tab removal**: cashiers can still create products; if backend allows them to soft-delete (`is_active=false`), they have no UI to see those any more. Per discovery, branch users don't soft-delete (the field is admin-side). Confirmed safe.

---

## Out of scope (followups)

- Field mapping wizard (column-name remap when Excel headers don't match the template).
- Server-side upload-token cache to avoid re-upload.
- Bulk edit (multi-select rows + apply changes to all).
- Product variants UI for branch users (today only first variant is exposed).
- Replacing `pending_approval` / `no_branch` admin metrics with branch-relevant alternatives in the cashier KPI grid.
