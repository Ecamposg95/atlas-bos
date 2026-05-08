# Platform Reports Module — Design Spec

**Date:** 2026-04-30
**Owner:** Emmanuel
**Status:** Ready for implementation
**Target branch:** feature/platform-reports → release/qa
**Goal:** Cross-tenant analytics layer for SUPERADMIN — slice/dice sales data by product, branch, seller, and customer across all organizations from a single `/platform/reportes` page.

---

## 1. Motivation

Every existing page in `/platform/*` is operational: org management, user admin, health checks, incidents. There is no analytical surface. A SUPERADMIN today cannot answer "which org has the highest return rate this month?" or "which product moved the most units across all branches?" without writing raw SQL. This module closes that gap with a read-only, filterable, exportable analytics layer that crosses tenant boundaries by design.

---

## 2. UX Layout

### 2.1 Top-level structure

```
┌─────────────────────────────────────────────────────────────────┐
│  PlatformPageShell — "Reportes"                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Productos] [Sucursales] [Vendedores] [Clientes]   ← TabBar   │
├─────────────────────────────────────────────────────────────────┤
│  ReportFilterBar:                                               │
│  Fecha: [últimos 30d ▾]  Org: [Todos ▾]  Sucursal: [Todas ▾]  │
│                                          [Export CSV]           │
├─────────────────────────────────────────────────────────────────┤
│  Chart (bar/line, top 10)                                       │
│  ────────────────────────────────────────────────────────────── │
│  DataTable (sortable, pagination 50/page, max 500 rows)        │
│  → click row → ReportDrillDownDrawer (right side-drawer)       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Tab columns

**Productos**: SKU, Nombre, Marca, Depto, Unidades vendidas, Revenue, AOV, % Devoluciones, Margen estimado.
Drill-down: tabla de ventas individuales (Folio, Fecha, Org, Sucursal, Cajero, Cant, Precio Unit, Total).

**Sucursales**: Nombre, Org, Ciudad, Transacciones, Revenue, Ticket Promedio, Cajeros activos, % Devoluciones.
Drill-down: top 10 productos + top 5 vendedores de esa sucursal.

**Vendedores**: Nombre, Role, Sucursal, Org, Transacciones, Revenue, Ticket Promedio, Días activos.
Drill-down: ventas individuales del vendedor.

**Clientes**: Nombre, # Tickets, Revenue Total, Ticket Promedio, Último Ticket, Recurrencia (días promedio).
Drill-down: histórico completo del cliente.

### 2.3 ReportFilterBar

- **Rango**: presets `7d/30d/90d/12m` + custom date-range. Default `30d`.
- **Org selector**: "Todos los orgs" o uno específico. Activa el branch selector.
- **Branch selector**: deshabilitado cuando org=Todos. Fetched on org change.
- **Export CSV**: trigger `GET /api/platform/reports/{tab}.csv?...` con filtros actuales. Streaming download.
- **Banner de warning** cuando no hay org filter: "Esta consulta cubre todos los orgs. Puede tomar 10-20 segundos." Dismissible per session.

### 2.4 URL state

Toda filter state en query string para reports compartibles:
```
/platform/reportes?tab=productos&range=30d&org_id=5&branch_id=12&sort=revenue:desc
```
`useSearchParams` para reads/writes.

---

## 3. API Contract

Todos los endpoints bajo `GET /api/platform/reports/`. El platform router aplica `Depends(require_platform_admin)` a nivel paquete — no hay auth check adicional dentro.

### 3.1 Common query params

| Param | Type | Default | Notes |
|---|---|---|---|
| `start` | ISO date | 30 días atrás | Inclusive |
| `end` | ISO date | hoy 23:59:59 | Inclusive |
| `org_id` | int, opcional | null | Cross-tenant cuando ausente |
| `branch_id` | int, opcional | null | Requiere `org_id` |
| `limit` | int | 100 | Max 500 |
| `offset` | int | 0 | |
| `sort` | `field:asc|desc` | `revenue:desc` | Validado por endpoint |

### 3.2 Pivot endpoints

**GET /api/platform/reports/products** — devuelve `{ items, total, offset, limit }` con shape de fila:
```json
{
  "product_id": "uuid", "sku": "...", "name": "...",
  "brand": "...", "department": "...",
  "units_sold": 342, "revenue": "18450.00",
  "aov": "53.95", "return_rate_pct": "2.34",
  "estimated_margin_pct": "18.50"
}
```

**GET /api/platform/reports/branches** — fila:
```json
{
  "branch_id": 12, "name": "Sucursal Norte",
  "org_id": 5, "org_name": "Comercial XYZ", "city": "Monterrey",
  "transactions": 890, "revenue": "245000.00",
  "avg_ticket": "275.28", "active_cashiers": 4,
  "return_rate_pct": "1.80"
}
```

**GET /api/platform/reports/sellers** — fila:
```json
{
  "user_id": 33, "full_name": "Ana García", "role": "CAJERO",
  "branch_id": 12, "branch_name": "Sucursal Norte",
  "org_id": 5, "org_name": "Comercial XYZ",
  "transactions": 210, "revenue": "57300.00",
  "avg_ticket": "272.86", "active_days": 18
}
```

`active_days` = distinct days con al menos 1 venta del seller.

**GET /api/platform/reports/customers** — fila:
```json
{
  "customer_id": 77, "customer_name": "Roberto Soto",
  "ticket_count": 14, "total_revenue": "8920.00",
  "avg_ticket": "637.14",
  "last_purchase": "2026-04-27T18:34:00Z",
  "avg_days_between_purchases": 6.2
}
```

`avg_days_between_purchases` = `(max_date - min_date) / (ticket_count - 1)`, null si `ticket_count < 2`. Approximación documentada (no requiere window function). Excluye `customer_id IS NULL` (anonymous).

### 3.3 Drill-down detail endpoints

**GET /api/platform/reports/products/{product_id}/detail** — query: `start`, `end`, `org_id?`, `branch_id?`, `limit` (max 500), `offset`.
Returns `{ product_id, product_name, items: [{ document_id, folio, series, created_at, org_name, branch_name, seller_name, quantity, unit_price, total_line }], total, offset, limit }`.

**GET /api/platform/reports/branches/{branch_id}/detail** — `{ branch_id, branch_name, top_products: [...10], top_sellers: [...5] }`.

**GET /api/platform/reports/sellers/{user_id}/detail** — list of `SalesDocument` summary (folio, date, total, branch, customer_name).

**GET /api/platform/reports/customers/{customer_id}/detail** — list de `SalesDocument` (folio, date, branch, total, payment_method, status).

### 3.4 CSV streaming

```
GET /api/platform/reports/products.csv
GET /api/platform/reports/branches.csv
GET /api/platform/reports/sellers.csv
GET /api/platform/reports/customers.csv
```

Acepta mismo filter params que pivot (sin `limit`/`offset` — streams all). Patrón mirror de `app/routers/sales.py:export_sales_csv`: `StreamingResponse`, `Content-Disposition: attachment; filename="..."`. Generator yields header row + data rows. Sin cache.

---

## 4. Backend Implementation

### 4.1 New: `app/routers/platform/reports.py`

Single módulo (12 endpoints, no necesita sub-package).

Helper interno `_apply_report_filters(query, start, end, org_id, branch_id)`:
- Aplica `SalesDocument.created_at >= start, <= end`.
- Si `org_id`: `SalesDocument.organization_id == org_id`.
- Si `branch_id`: `SalesDocument.branch_id == branch_id`. Valida que el branch pertenezca a `org_id` (404 si mismatch).
- Si neither: cross-tenant scan.
- Excluye `DocumentStatus.CANCELLED` y `DocumentStatus.DRAFT` de revenue. Returns counts via `SaleReturn` separadamente.

Cache: in-process TTLCache `{ cache_key: (result, expires_at) }`. Key = `f"{endpoint}:{start}:{end}:{org_id}:{branch_id}:{limit}:{offset}:{sort}"`. TTL = 300 s. CSV bypass cache. Detail endpoints bypass cache.

`limit > 500` → `HTTP 422`.
`sort` field no en `ALLOWED_SORT_FIELDS` por endpoint → `HTTP 422`.
**Range max**: si `org_id IS NULL` y `(end-start) > 365 días` → `HTTP 422` con mensaje claro.

### 4.2 Registration: `app/routers/platform/__init__.py`

Add `from . import reports` + `router.include_router(reports.router)` después de `api_keys`.

### 4.3 Index advisory

`scripts/migrate_add_report_indexes.py` — script idempotente para crear:
- `CREATE INDEX IF NOT EXISTS ix_sales_doc_created_org ON sales_documents(created_at, organization_id);`
- `CREATE INDEX IF NOT EXISTS ix_sales_doc_branch_created ON sales_documents(branch_id, created_at);`

No bloqueante para v1 — documentar en spec, ejecutar manualmente per env.

---

## 5. Frontend Implementation

### 5.1 `frontend/src/pages/platform/PlatformReports.tsx`

Top-level. URL search params via `useSearchParams`. Renders `PlatformPageShell` con:
1. `TabBar` (4 tabs, default `productos`).
2. `ReportFilterBar` (compartido).
3. Tab-specific sub-component (`ProductsReport`, `BranchesReport`, `SellersReport`, `CustomersReport`).
4. `ReportDrillDownDrawer` (conditional render, shared).

### 5.2 `frontend/src/components/platform/ReportFilterBar.tsx`

Props: `onFiltersChange`, `currentFilters`, `onExportCsv`, `isLoading`. Fetches org list (`platformApi.getOrganizations()`) y branch list (`platformApi.getBranches({org_id})`) cuando org cambia. Warning banner cuando `org_id` undefined.

### 5.3 `frontend/src/components/platform/ReportDrillDownDrawer.tsx`

Reusa `SideDrawer.tsx`. Loading + `DataTable` para detail payload. Props: `tab`, `entityId | null`, `entityLabel`, `filters`, `onClose`. Fetcha `reportApi.getDetail(tab, entityId, filters)` on open.

### 5.4 `frontend/src/api/platform.ts` — 12 funciones nuevas

```typescript
reportApi.getProducts(params): Promise<PaginatedReport<ProductRow>>
reportApi.getBranches(params): Promise<PaginatedReport<BranchRow>>
reportApi.getSellers(params): Promise<PaginatedReport<SellerRow>>
reportApi.getCustomers(params): Promise<PaginatedReport<CustomerRow>>
reportApi.getProductDetail(id, params): Promise<ProductDetailResponse>
reportApi.getBranchDetail(id, params): Promise<BranchDetailResponse>
reportApi.getSellerDetail(id, params): Promise<SellerDetailResponse>
reportApi.getCustomerDetail(id, params): Promise<CustomerDetailResponse>
reportApi.exportProductsCsv(params): Promise<void>
reportApi.exportBranchesCsv(params): Promise<void>
reportApi.exportSellersCsv(params): Promise<void>
reportApi.exportCustomersCsv(params): Promise<void>
```

CSV functions usan `client.get(..., { responseType: 'blob' })` + temp `<a>` con `URL.createObjectURL`. Patrón ya en `pages/finance/Reports.tsx`.

Types en `frontend/src/types/reports.ts` (new file).

### 5.5 `frontend/src/App.tsx`

Lazy import + ruta `/platform/reportes` dentro de `SuperAdminRoute`.

### 5.6 `frontend/src/pages/platform/PlatformLayout.tsx`

Nav item "Reportes" → `/platform/reportes`. Icon `BarChart2` (lucide-react).

---

## 6. Affected Files

| File | Action |
|---|---|
| `app/routers/platform/reports.py` | Create — 12 endpoints + helpers |
| `app/routers/platform/__init__.py` | Modify — register router |
| `scripts/migrate_add_report_indexes.py` | Create — advisory index script |
| `frontend/src/pages/platform/PlatformReports.tsx` | Create |
| `frontend/src/components/platform/ReportFilterBar.tsx` | Create |
| `frontend/src/components/platform/ReportDrillDownDrawer.tsx` | Create |
| `frontend/src/types/reports.ts` | Create |
| `frontend/src/api/platform.ts` | Modify — append 12 functions |
| `frontend/src/App.tsx` | Modify — add route |
| `frontend/src/pages/platform/PlatformLayout.tsx` | Modify — add nav |

---

## 7. Performance & Edge Cases

- **Cross-tenant pivot** sin `org_id` filter escanea full `sales_lines`. Mitigaciones: max 365 días range cuando `org_id` null (422 si excede); cache 5 min; advisory indexes en script aparte.
- **`active_days` for sellers**: `func.count(func.distinct(func.date(SalesDocument.created_at)))`. OK con limit=500.
- **`avg_days_between_purchases`**: aprox `(max-min)/(N-1)`, evita window function.
- **CSV streaming**: generator yields fila por fila. `yield_per(500)` en SQLAlchemy query.
- **Product sin cost data**: `estimated_margin_pct = null`. Frontend renderiza "—".
- **Branch with 0 sales**: excluido (HAVING `COUNT > 0`).
- **`customer_id IS NULL`**: excluido del customers pivot.
- **`branch_id` sin `org_id`**: backend valida que el branch existe y extrae su `organization_id` automáticamente.
- **Sort on null fields**: `NULLS LAST` ordering.
- **SUPPORT role**: `require_platform_admin` permite SUPPORT. Read-only OK.

---

## 8. Testing Strategy

6 backend integration tests en `tests/test_platform_reports.py`:

1. `test_products_requires_platform_role` — CAJERO JWT → 403.
2. `test_products_cross_tenant_no_filter` — SUPERADMIN sin `org_id` → rows de múltiples orgs.
3. `test_products_org_filter_isolation` — `org_id=N` → solo rows de N.
4. `test_pagination_limit_max` — `limit=501` → 422.
5. `test_csv_streaming` — `products.csv` → `Content-Type: text/csv`, body inicia con header row, sin `Content-Length` (chunked).
6. `test_branch_filter_wrong_org` — `branch_id` de org 2 con `org_id=1` → 404.

Frontend: smoke manual — switch tabs, apply filters, export CSV, click drill-down, verify drawer.

---

## 9. Out of Scope (v1)

- Saved/named report configurations.
- Scheduled email delivery.
- Excel/XLSX export.
- Filtros por brand/department.
- Auto-refresh real-time.
- Chart libraries adicionales.

---

## 10. Rollout

Feature branch `feature/platform-reports` off `release/qa`. No DB migrations (only the advisory index script, opt-in). No feature flag (SUPERADMIN-only route). Merge to `release/qa` después de los 6 backend tests + smoke manual.
