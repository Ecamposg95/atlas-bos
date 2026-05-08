# Cashier Cockpit Redesign — Design Spec

**Date:** 2026-04-27
**Branch:** `feat/cashier-cockpit-redesign` (cut from `release/qa` @ `fb2db5f`)
**Target roles:** `CAJERO`, `GERENTE` (context `BRANCH`)
**Author:** Emmanuel
**Status:** Draft for review

## 1. Problem

The Product Owner reports that branch-level users (CAJERO, GERENTE) face too much information across all three dimensions:

- **Navigation** — sidebar is technical and not workflow-ordered.
- **Screen density** — every page (Sales, Cash, Returns, Products) was designed for HQ/admin and exposes columns, filters and aggregates that the cashier does not need.
- **Language** — labels are technical (`SalesHistory`, `CashHistory`, `Variance`) and not semantic for someone whose mental model is "selling and closing the shift".

In practice, ADMINISTRADOR and DUEÑO rarely visit stores. The cashier acts as the de-facto floor manager. The redesign must therefore **simplify the UX without removing operational power**, and **add tools the floor manager needs and does not have today**.

## 2. Goals

1. Cashier opens the app and immediately sees the state of their day.
2. Every screen the cashier touches uses semantic, second-person Spanish copy.
3. Cashier never has to assemble information manually from multiple tabs to know how the day is going.
4. HQ users (ADMINISTRADOR, DUEÑO, SUPERADMIN) experience zero regression — their UI is unchanged.
5. Multi-tenancy guarantees are preserved: every query continues to filter by `organization_id` (and `branch_id` where applicable).

## 3. Non-goals

- Not redesigning the POS itself (`/pos`) — it is already operative.
- Not building a separate `/branch/*` shell — same routes, role-aware variants.
- Not duplicating endpoints — reuse existing `/api/*` and add a single aggregator.
- Not adding a feature flag system — gating happens by role + context.
- Not touching the mobile (VENDEDOR / SOPORTE_OPERATIVO) experience.

## 4. Architecture

Three layers, no new shell:

1. **Cockpit (DataXPOS rediseñado)** — Mandatory home for branch users on login. Every widget links into the deep page.
2. **Role-aware page variants** — Each cashier-consumed page (`POS`, `SalesHistory`, `CashHistory`, `Returns`, `Products`) detects `role ∈ {CAJERO, GERENTE}` + context `BRANCH` and renders a `*BranchView` component. Otherwise it renders the existing HQ view. Same route, same parent file, internal branch by role.
3. **Sidebar reorganisation** — Same routes, new labels and order driven by cashier workflow.

No new routes. No duplicated endpoints. One new aggregator endpoint (`/api/branch/dashboard`) to keep the cockpit fast.

```
┌──────────────────────────────────────────────┐
│  Login (CAJERO/GERENTE)                      │
│         ↓                                    │
│  /dataxpos  ←  Cockpit (5 zones)             │
│         ↓ deep links                         │
│  /pos · /sales · /cash-history ·             │
│  /returns · /products  ←  *BranchView        │
└──────────────────────────────────────────────┘
```

## 5. Cockpit (DataXPOS) — 5 zones

Single page, vertical scroll, ordered by frequency of use.

### Zone 1 — Greeting + shift status (sticky top)
- "Hola, {nombre}. {sucursal}."
- Shift badge: `Caja abierta · 4h 12m` or `Sin caja · Abrir turno →`.
- Primary CTA (large): **Cobrar** → `/pos`.

### Zone 2 — Mi día (4 KPI cards)
- Ventas de hoy (`$` + `# tickets`)
- Vs. meta del día (progress bar, % colored: red < 50, amber < 80, green ≥ 80). Hidden if `Branch.daily_sales_goal` is null.
- Ticket promedio
- Devoluciones de hoy (`# · $`)

### Zone 3 — Alertas accionables (max 5)
List of click-through alerts:
- **Stock bajo** — products where `stock < min_stock` in this branch → `/products?filter=low_stock`.
- **Productos sin precio en sucursal** → `/products?filter=no_price`.
- **Cotizaciones por vencer hoy** → `/quotes?expiring=today`.
- **Diferencia de caja en último cierre** → `/cash-history`.
- Empty state: "Sin pendientes" (no decorations).

### Zone 4 — Cierre asistido (conditional)
Visible only when `shift.is_open === true` AND current time ≥ `branch.closing_time - 1h`.
- Checklist: contar efectivo, conciliar terminal, imprimir Z, registrar gastos del día.
- CTA: **Cerrar mi turno** → guided wizard (`POST /api/cash/sessions/{id}/close-guided`).

### Zone 5 — Accesos rápidos (6 tiles)
Mis ventas de hoy · Mi caja · Devolución · Buscar producto · Reportes · Impresora.

### Out of cockpit
HQ filters, multi-branch comparisons, long lists, historical charts. Those live in the deep pages with the cashier variant.

## 6. Role-aware page variants

Each parent file detects `role ∈ {CAJERO, GERENTE}` + context `BRANCH` → renders `*BranchView`. Otherwise current HQ view is preserved.

### `/pos` — `POS.tsx`
- No structural change. Header gains: active-shift indicator + prominent **"Volver a Mi día"** button.

### `/sales` — `SalesHistory.tsx` → `SalesBranchView.tsx`
- Title: **Mis ventas**.
- Default filter: `desde = hoy 00:00`, `branch = mine` (locked, no branch selector).
- Columns: Folio · Hora · Cliente · Total · Pago · Acción.
- Removed: vendedor (it's the user), sucursal (it's their own), tax breakdown.
- Row CTA: **Ver / Reimprimir / Devolver** (Devolver opens the wizard, not the dense page).

### `/cash-history` — `CashHistory.tsx` → `CashBranchView.tsx`
- Title: **Mi caja**.
- Two sections: **Turno actual** (if open: ventas, efectivo esperado, diferencia parcial, "Cerrar mi turno") and **Mis turnos pasados** (last 7 days, list).
- Removed: multi-cashier aggregates, multi-branch comparisons, historical charts.

### `/returns` — `Returns.tsx` → `ReturnsBranchView.tsx`
- Title: **Devoluciones**.
- 3-step wizard: **(1) Buscar venta** (folio o teléfono) → **(2) Marcar productos** (qty + motivo desde dropdown) → **(3) Confirmar reembolso** (efectivo/tarjeta/nota). Replaces the dense screen.

### `/products` — `Products.tsx` → `ProductsBranchView.tsx`
- Title: **Buscar producto**.
- Search + product card: nombre, foto, código, precio en mi sucursal, existencia en mi sucursal, categoría.
- CTA: **Crear producto** (existing `/products/new` simplified form).
- Removed: bulk edit, cost columns, multi-branch view, HQ filters.

### `/printer-settings`, `/hr/me`
- No code changes.
- `/hr/me` is hidden from the sidebar but the route remains accessible.

### File location
`*BranchView.tsx` lives in `frontend/src/components/branch/`. Each parent becomes a 3-line `if/else`.

## 7. Sidebar reorganisation

Same routes, new labels and order. Branch sidebar (CAJERO + GERENTE) becomes:

```
1. Mi día        → /dataxpos          (Cockpit, default landing)
2. Cobrar        → /pos               (pinned)
─────────
3. Mi caja       → /cash-history
4. Mis ventas    → /sales
5. Devolución    → /returns
─────────
6. Inventario    → /products
7. Reportes      → /reports
─────────
8. Impresora     → /printer-settings
```

`hr_me.html` is removed from `_NAV_GROUP` for branch-context display but **kept** in `ROLE_TEMPLATE_ACCESS[CAJERO]` so the route still works.

### Backend change
`app/core/role_permissions.py` gains:
```python
TEMPLATE_LABEL_OVERRIDES_BY_ROLE: dict[Role, dict[str, str]] = {
    Role.CAJERO: {
        "dataxpos.html":      "Mi día",
        "pos.html":           "Cobrar",
        "cash_history.html":  "Mi caja",
        "sales.html":         "Mis ventas",
        "returns.html":       "Devolución",
        "products.html":      "Inventario",
        "reports.html":       "Reportes",
        "printer_config.html":"Impresora",
    },
    Role.GERENTE: { ... same as CAJERO ... },
}
```
`nav_for_role()` (or its frontend equivalent) consults this map after resolving the base template, so HQ users see the original labels.

`_NAV_GROUP` gains new groups: `Mi día` (-2), `Cobrar` (-1), `Mi turno` (1), `Inventario` (3). The branch-only `hr_me.html` entry — if any — is removed from the nav map, not from access.

HQ sidebar (ADMINISTRADOR, DUEÑO) is untouched.

## 8. New backend endpoints

### `GET /api/branch/dashboard`
New router `app/routers/branch.py`. Aggregates today's branch state in one call.

Response:
```json
{
  "user": { "name": "...", "branch_name": "..." },
  "shift": {
    "is_open": true,
    "session_id": 123,
    "opened_at": "2026-04-27T08:30:00",
    "duration_minutes": 252
  },
  "today": {
    "sales_total": 18750.50,
    "sales_count": 47,
    "avg_ticket": 398.95,
    "returns_total": 320.00,
    "returns_count": 2,
    "goal": 25000.00,
    "goal_progress_pct": 75.0
  },
  "alerts": [
    { "kind": "low_stock",       "count": 8, "deeplink": "/products?filter=low_stock" },
    { "kind": "no_branch_price", "count": 2, "deeplink": "/products?filter=no_price" },
    { "kind": "quote_expiring",  "count": 1, "deeplink": "/quotes?expiring=today" },
    { "kind": "cash_variance",   "amount": -45.00, "deeplink": "/cash-history" }
  ],
  "closing_visible": false
}
```

Rules:
- Filter by `organization_id` and `branch_id` from the current user. HQ users with no `branch_id` must send `X-Branch-ID` header; otherwise `400`.
- `closing_visible = true` only when `shift.is_open` AND `now >= branch.closing_time - 1h`.
- `goal` reads `Branch.daily_sales_goal` (new nullable column, see §9). Omit `goal` and `goal_progress_pct` when null.
- Alerts are count-only queries (no payloads), executed in series with indexed filters.
- Validation chain: `get_current_user` + `get_current_active_organization` + branch resolution.

### `POST /api/cash/sessions/{id}/close-guided`
Wraps existing `cash_service.close_session()` with a wizard payload (counted cash, totals per method, day expenses). Does not rewrite logic — adds UX layer + payload validation.

### Existing endpoints — reused, not duplicated
- `/api/sales?from=today&branch_id=mine` → "Mis ventas de hoy"
- `/api/cash/sessions/current` → "Turno actual"
- `/api/inventory?low_stock=true` → "Stock bajo"
- `/api/returns?from=today&branch_id=mine` → "Devoluciones del día"

## 9. Schema changes

Single migration: `scripts/migrate_add_branch_daily_goal.py`.

- `branches` table gains: `daily_sales_goal NUMERIC(12,2) NULL`.
- Default null. UI in HQ branch detail to set it (out of scope here, but the field must exist).

No other schema changes. `closing_time` already exists on `Branch`.

## 10. Copy and language

Mandatory glossary. All cashier-visible labels use the right column. Applies to page titles, breadcrumbs, buttons, table headers, status messages, error messages.

| Today (technical/HQ)     | Cashier (semantic)         |
|--------------------------|----------------------------|
| Sales History            | Mis ventas                 |
| Cash History             | Mi caja                    |
| Cash Session             | Turno                      |
| Open / Close session     | Abrir turno / Cerrar turno |
| Variance                 | Diferencia                 |
| Returns                  | Devoluciones               |
| Refund                   | Reembolso                  |
| Quote                    | Cotización                 |
| Quote Maker              | Nueva cotización           |
| Inventory                | Inventario                 |
| Low stock                | Por agotarse               |
| Out of stock             | Agotado                    |
| Stock                    | Existencia                 |
| Department               | Categoría                  |
| Brand                    | Marca                      |
| Product                  | Producto                   |
| SKU / Code               | Código                     |
| Customer                 | Cliente                    |
| Folio                    | Folio                      |
| Total / Subtotal         | Total / Subtotal           |
| Payment method           | Forma de pago              |
| Branch                   | Sucursal                   |
| Reports                  | Reportes                   |
| Printer settings         | Impresora                  |
| Dashboard / DataXPOS     | Mi día                     |
| Goal                     | Meta del día               |
| Avg ticket               | Ticket promedio            |
| Loading…                 | Cargando…                  |
| No data                  | Sin movimientos            |
| Error                    | Algo salió mal. Reintentar |

Rules:
- Spanish neutral, second person ("Tu turno", "Tus ventas") in personal cockpit zones.
- No technical acronyms visible: no "POS", "HQ", "SKU", "RBAC". `pos.html` becomes "Cobrar" in nav; "POS" remains as the brand name only inside the POS app itself.
- Buttons: verb + object ("Cerrar mi turno", not "Cerrar"). Max 3 words.
- Errors: explain what happened + what to do ("No pude cargar tus ventas. Reintenta o avisa al admin").
- No emojis in production.

Implementation: centralised in `frontend/src/copy/branchCopy.ts`. Sidebar labels live in backend via `TEMPLATE_LABEL_OVERRIDES_BY_ROLE`.

## 11. Testing strategy

The repo uses runnable script-style tests under `tests/`. No pytest formal suite. No frontend E2E framework.

### Backend (automated, AI executes)
- `tests/test_branch_dashboard.py` (new):
  - Multi-tenancy: a user from Org A cannot see Org B data. **Critical**.
  - Branch-scoping: CAJERO from branch X only sees their sales/cash/returns, not branch Y.
  - `shift.is_open=false` when no open session for the user.
  - `today.sales_total` excludes returns; returns are surfaced separately.
  - `goal_progress_pct` omitted when `Branch.daily_sales_goal` is null.
  - `closing_visible=true` only when shift open AND within last hour.
  - 5 alert kinds: empty case (count=0), populated case (count=N), each with correct deeplink.
  - HQ user with no `branch_id` and no `X-Branch-ID` header: `400`.
- `tests/test_cash_close_guided.py` (new):
  - Valid wizard payload closes session and records variance.
  - Mismatched totals: `422` with actionable detail.
  - Only the shift owner (or branch GERENTE) can close.
- Regression: re-run `tests/stress_test.py` and `tests/test_cash_variance.py` before PR.

### Frontend (manual, human executes)
Smoke checklist (documented here, no test files):
- Login as CAJERO → lands on `/dataxpos` and sees the cockpit.
- Sidebar shows the 8 items in §7 order. `/hr/me` not in sidebar but `GET /hr/me` works.
- Click "Cobrar" → POS. Click "Volver a Mi día" → DataXPOS.
- Each `*BranchView` loads with branch filter locked to user's branch.
- Login as ADMINISTRADOR HQ → original HQ sidebar (no regression).
- Login as GERENTE → same cockpit as CAJERO.
- Returns wizard: complete the 3-step flow with a real sale.
- Cierre asistido: appears only in last hour (test with branch whose `closing_time = now+30min`).
- DAXPOS preset (golden rule): test with `superadmin/admin123` org "QA" before merging to `release/qa`.

### Performance target
Cockpit on `/dataxpos` loads with **one** principal call (`/api/branch/dashboard`) under 2s on QA Postgres.

## 12. Rollout

- Implicit feature gate: cockpit only renders when `role ∈ {CAJERO, GERENTE}` and context `BRANCH`. ADMIN/DUEÑO/SUPERADMIN never see it. Zero risk for HQ.
- Branch: `feat/cashier-cockpit-redesign` (cut from `release/qa`, PR back to `release/qa`).
- Merge freeze rule: no pushes to `release/beta` or `release/production` between 9:00 and 19:00. `release/qa` is free.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Multi-tenancy regression in new `/api/branch/dashboard` | Dedicated multi-org and multi-branch tests; reuse existing scoping helpers from `app/dependencies.py`. |
| `Products.tsx` is 1465 LOC; introducing the variant could destabilise admin flow | `ProductsBranchView` is a separate file; parent gets a guarded `if/else` with the original flow as the default. No edits inside the existing tree. |
| Label override map drifts from access map over time | Single source of truth in `role_permissions.py`; lint that every key in `TEMPLATE_LABEL_OVERRIDES_BY_ROLE[role]` exists in `ROLE_TEMPLATE_ACCESS[role]` (assertion at import time). |
| Cockpit endpoint becomes a bottleneck | Count-only alert queries; index on `(organization_id, branch_id, created_at)` for sales/returns; measure on QA before launch. |
| GERENTE expects more than CAJERO | Initial scope: same UX. If product later differentiates, the role check is the single point to branch on. |

## 14. Out of scope (to track separately)

- HQ UI to set `Branch.daily_sales_goal` (depends on this spec landing first).
- E2E tests via Playwright (separate sprint if approved).
- Mobile (VENDEDOR/SOPORTE_OPERATIVO) cockpit equivalent.
- Internationalisation framework (this redesign hardcodes Spanish copy).

## 15. Open decisions

None at this point. Confirmed during brainstorming:
- Approach A (Cockpit + role-aware variants + nav reorg) — confirmed.
- Scope B (simplify + add) — confirmed.
- Hide `/hr/me` from sidebar but keep route — confirmed.
- AI runs backend tests; human runs frontend smoke (Option 1) — confirmed.
