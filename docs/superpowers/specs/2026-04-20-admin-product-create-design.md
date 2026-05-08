# Admin Product Create — Design Spec

**Date:** 2026-04-20
**Status:** Approved for implementation planning
**Scope:** Frontend-only. Backend `POST /api/products/` already supports the full admin flow.

## Problem

Admin users (`ADMINISTRADOR`, `DUEÑO`) clicking "Nuevo producto" from `/admin/catalog` are sent to `/products?new=1`, which renders the cashier-facing `Products.tsx` page and doesn't even read the `new=1` query param. There is no admin-dedicated create screen.

## Goals

- Isolated admin product creation screen — **no shared code paths with the cashier `Products.tsx` flow**.
- Single-submit creation: product data + multi-branch activation in one POST.
- Admin-only fields exposed (e.g., `target_branch_ids`, multi-branch PBS flags) that cashier flow hides.
- Keep scope tight: **only creation**. Editing stays out (covered by existing flows).

## Non-Goals

- Edit flow (`AdminProductEdit`) — not in this spec.
- Image upload via multipart — keep the existing `image_url` string field.
- SKU autogeneration — SKU stays manual, backend validates uniqueness.
- Touching the cashier `Products.tsx` page.
- Refactoring shared components unless strictly required.

## User Flow

1. Admin lands on `/admin/catalog`.
2. Clicks "Nuevo producto" → navigates to `/admin/products/new`.
3. Fills the form (sections below).
4. Submits → `POST /api/products/` with `target_branch_ids` populated.
5. On success: toast + redirect to `/admin/catalog`.
6. On error: inline field errors (SKU duplicado, validación de precios, etc.) + toast.

## Architecture

### New files

| Path | Purpose |
|---|---|
| `frontend/src/pages/admin/AdminProductCreate.tsx` | Isolated admin create page. Self-contained — uses `productsApi.create`, `branchesApi.list`, `brandsApi.list`, `departmentsApi.list`. |

### Modified files

| Path | Change |
|---|---|
| `frontend/src/App.tsx` | Register route `/admin/products/new` guarded by `RequireRole(['ADMINISTRADOR','DUEÑO'])`, lazy-loaded. |
| `frontend/src/pages/core/AdminCatalog.tsx:214` | `Link to="/products?new=1"` → `to="/admin/products/new"`. |
| `frontend/src/api/products.ts:11-19` | Extend `ProductCreate` interface with the admin-only fields the backend already accepts (`has_iva`, `tax_rate`, `initial_stock`, `target_branch_ids`, `uses_inventory`). Keep existing callers working (all new fields optional). |

### Backend contract (already in place — no changes)

`POST /api/products/` accepts (`app/schemas/products.py:65`):

- `name`, `description`, `unit`, `image_url`
- `sku` (unique per org, required), `barcode`
- `price`, `cost`, `has_iva`, `tax_rate`
- `department_id`, `brand_id` (UUIDs)
- `initial_stock`, `branch_id`, `target_branch_ids: List[int]` (admin-only activation)
- `uses_inventory`

Admin users get `approval_status='APPROVED'` server-side (`app/routers/products.py:1205`). ProductBranchStatus rows for each `target_branch_ids` entry are created automatically.

## Form Sections

### 1. Básicos

- `name` (required, text)
- `sku` (required, text, trimmed uppercase). Client-side validation: non-empty. Server validates uniqueness.
- `barcode` (optional)
- `unit` (select: `pza`, `kg`, `lt`, `mt`, `caja`; default `pza`)
- `description` (optional textarea)
- `image_url` (optional text — paste URL; no uploader in v1)

### 2. Comerciales

- `department_id` (select, loaded from `departmentsApi.list`)
- `brand_id` (select, loaded from `brandsApi.list`)
- `price` (required, number, ≥ 0)
- `cost` (required, number, ≥ 0). Warn client-side if `cost > price` but don't block.
- `has_iva` (checkbox, default false)
- `tax_rate` (number, default 16, shown only if `has_iva=true`)

### 3. Activación por sucursal (admin-only)

- Table of org branches (from `branchesApi.list`).
- One row per branch with checkboxes: **Activar** (master — if off, the branch is excluded from `target_branch_ids`).
- Per-branch PBS flags shown when **Activar** is on:
  - `is_active_pos` (default true)
  - `is_active_hq` (default false — matches model default)
  - `is_visible` (default true)
- "Seleccionar todas" / "Ninguna" quick-toggles.
- **v1 simplification:** the backend today auto-creates PBS rows for each `target_branch_ids` with model defaults. Per-branch flag overrides in the form are **UI-only in v1** — they don't travel to the backend, because the current `POST` payload doesn't accept per-branch flags. If the user checks non-default flags, show a small note: "Las banderas por sucursal se ajustarán desde la matriz de catálogo después de crear." This keeps scope tight.
- **Activar** checkboxes DO travel (as `target_branch_ids`).

### 4. Inventario inicial (opcional)

- `initial_stock` (number, default 0).
- `initial_stock_branch_id` (select, shown only if `initial_stock > 0`). Options: the branches marked **Activar** in section 3. Required when `initial_stock > 0`.
- Submitted as `branch_id` in the payload (backend uses it to create the opening stock movement).
- One-line note: "Para stock en múltiples sucursales, usa el módulo de inventario tras crear."

### 5. Precios escalonados / Empaques / Variantes

**Out of scope for v1.** Send empty arrays (`prices: []`, `packaging_units: []`, `extra_variants: []`). A one-line note in the form: "Precios escalonados y empaques se configuran desde el catálogo tras crear el producto."

## Data Flow

```
[AdminProductCreate mount]
  ↓ parallel loads
  ├── departmentsApi.list() → departments[]
  ├── brandsApi.list() → brands[]
  └── branchesApi.list() → branches[]
  ↓
[User fills form]
  ↓ submit
validateClient() → { ok, errors }
  ↓ if ok
productsApi.create({
  name, sku, barcode, unit, description, image_url,
  department_id, brand_id,
  price, cost, has_iva, tax_rate,
  initial_stock: number,
  target_branch_ids: branches.filter(b => form.activated[b.id]).map(b => b.id),
  uses_inventory: true,
  prices: [], packaging_units: [], extra_variants: []
})
  ↓ 201
toast.success('Producto creado') → navigate('/admin/catalog')
  ↓ 4xx
  ├── 409 SKU duplicado → field error on `sku`
  └── else → toast.error(detail)
```

## Error Handling

- Network / 5xx: toast with retry hint, form stays filled.
- 400 validation: map `detail` to field errors when possible; otherwise toast.
- 409 SKU conflict: inline error on `sku` field.
- Missing required fields: blocked at client-side validation before POST.

## RBAC

- Route guarded by `RequireRole(['ADMINISTRADOR','DUEÑO'])` in `App.tsx`.
- Backend enforces same rule via `approval_status` + `target_branch_ids` path (`app/routers/products.py:1144-1158`).
- Cashiers/managers hitting the URL directly get the standard role-guard redirect.

## Testing

- Manual smoke test after implementation:
  1. Login as admin → `/admin/catalog` → "Nuevo producto" → `/admin/products/new` loads.
  2. Create a product with 2 `target_branch_ids` → verify `ProductBranchStatus` rows exist for both branches (via `/admin/catalog` filter or DB).
  3. Duplicate SKU → inline error.
  4. Login as CAJERO → `/admin/products/new` → redirected by role guard.
- No new automated tests for v1 (follows existing pattern for admin pages — no unit tests in `frontend/`).

## Open Questions

None. Decisions captured above.

## Out of Scope / Future

- `AdminProductEdit` page (reuse the form as a shared `AdminProductForm` component if/when needed).
- Image upload (multipart).
- Per-branch PBS flags on create (requires backend payload extension).
- Scaled prices / packaging in the create form.
- Bulk create / import (already exists via `/api/products/upload`).
