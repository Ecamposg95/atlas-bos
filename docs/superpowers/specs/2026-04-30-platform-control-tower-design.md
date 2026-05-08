# Platform Control Tower — Design Spec

**Date:** 2026-04-30
**Owner:** Emmanuel / Atlas Platform Team
**Status:** Ready for implementation
**Target branch:** `feature/platform-control-tower` → `release/qa`

**Target files (new):**
- `app/routers/platform/control_tower.py`
- `frontend/src/pages/platform/PlatformControlTower.tsx`
- `frontend/src/components/platform/v2/WidgetCard.tsx`
- `frontend/src/components/platform/v2/SalesNowWidget.tsx`
- `frontend/src/components/platform/v2/DeltasWidget.tsx`
- `frontend/src/components/platform/v2/ActiveSessionsWidget.tsx`
- `frontend/src/components/platform/v2/SystemHealthWidget.tsx`
- `frontend/src/components/platform/v2/TopTenantsWidget.tsx`
- `frontend/src/components/platform/v2/AlertsWidget.tsx`
- `frontend/src/components/platform/v2/IncidentsWidget.tsx`
- `frontend/src/components/platform/v2/AnnouncementsWidget.tsx`

**Target files (modified):**
- `app/routers/platform/__init__.py`
- `frontend/src/api/platform.ts`
- `frontend/src/App.tsx`
- `frontend/src/pages/platform/PlatformLayout.tsx`

**Goal:** Single-screen operational dashboard that consolidates the state currently spread across PlatformMetrics, PlatformAlerts, PlatformIncidents, PlatformAnnouncements, and PlatformHealth into one live-refreshing view with inline action capabilities.

---

## 1. Motivation

Today a SUPERADMIN who wants to assess platform health must navigate to five separate pages: Métricas (KPIs + trends), Health (matrix per org), Alerts (anomaly inbox), Incidents (kill-switch status), and Announcements (active banners). There is no single page that answers "is anything on fire right now?" without multi-tab navigation. The Control Tower consolidates the most actionable signals into one view and adds inline mutations (ack alert, resolve incident, unpublish announcement) so the on-call admin never has to leave the page to act.

---

## 2. UX Layout — Desktop Grid (4 col × 3 row)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Torre de Control                                      [● live] última sync 12s │
├──────────────────┬──────────────────┬──────────────────┬────────────────────────┤
│  ROW 1 — NOW                                                                    │
│  Sales NOW       │  Active Sessions │  Active Tenants  │  System Health         │
│  (últimas 6h)    │  (cash OPEN)     │  (orgs con venta │  (summary badge)       │
│  sparkline 6pts  │  count + badge   │  hoy)            │  OK / WARN / CRIT      │
│  [30s TTL]       │  [30s TTL]       │  [60s TTL]       │  [60s TTL]             │
├──────────────────┴──────────────────┴──────────────────┴────────────────────────┤
│  ROW 2 — DELTAS                                                                 │
│  Δ Revenue       │  Δ New Signups   │  Δ New Branches  │  Δ Critical Alerts     │
│  vs ayer         │  vs ayer         │  vs ayer         │  (alerts critical)     │
│  +% sparkline    │  +N sparkline    │  +N sparkline    │  +% delta              │
│  [60s TTL]       │  [60s TTL]       │  [60s TTL]       │  [60s TTL]             │
├────────────────────────────┬────────────────────────────┬───────────────────────┤
│  ROW 3 — OPERATIVA                                                              │
│  Top 5 Alerts              │  Top 5 Incidents           │  Top 5 Tenants HOY    │
│  severity badge + title    │  title + scope + [Resolve] │  revenue + Δ vs ayer  │
│  [Ack] button per row      │  button per row            │  link → org detail    │
│  [30s TTL]                 │  [30s TTL]                 │  [5min TTL]           │
│                            ├────────────────────────────┤                       │
│                            │  Active Announcements      │                       │
│                            │  title + severity          │                       │
│                            │  [Unpublish] button        │                       │
│                            │  [60s TTL]                 │                       │
└────────────────────────────┴────────────────────────────┴───────────────────────┘
```

Mobile: single column stack, same order. Row 1 widgets collapse to 2-col grid on `sm`. Row 3 panels each full-width, stacked.

Each widget is wrapped in `WidgetCard` which renders: title, last-updated timestamp, a pulsing dot when a fetch is in-flight, and the widget's content slot.

---

## 3. Auto-Refresh

Each widget manages its own `setInterval` in a `useEffect` independently. Intervals:

| Widget | TTL |
|---|---|
| SalesNowWidget | 30 s |
| ActiveSessionsWidget | 30 s |
| AlertsWidget | 30 s |
| IncidentsWidget | 30 s |
| SystemHealthWidget | 60 s |
| DeltasWidget | 60 s |
| AnnouncementsWidget | 60 s |
| TopTenantsWidget | 300 s |

`WidgetCard` receives `updatedAt: Date | null` and renders "actualizado hace Ns" via a `useRelativeTime(updatedAt)` hook that re-ticks every 5 s independently of fetch cycles.

A global `[● live]` indicator in the page header turns amber while any widget fetch is in-flight. Implemented via `LiveIndicatorContext` (local to `PlatformControlTower.tsx`): `{ activeFetches: Set<string>, registerFetch(id), resolveFetch(id) }`. Each widget calls these around its fetch.

---

## 4. API Contract

### New module: `app/routers/platform/control_tower.py`

All endpoints inherit `require_platform_admin` from the platform router's dependency chain. An in-process TTL cache uses a module-level `_cache: dict[str, tuple[float, Any]]` keyed by `"endpoint_name[:param]"` with `time.time()` for expiry. Mutations bypass cache entirely.

Auth-fail: `require_platform_admin` raises `HTTP 403` when `platform_role` is `NONE`. No extra guard needed — already enforced at router level in `app/routers/platform/__init__.py`.

---

**`GET /api/platform/control-tower/sales-now`**

Queries `SalesDocument` for `created_at >= now - 6h`, `status != CANCELLED`, cross-tenant. Groups by `date_trunc('hour', created_at)`. Returns all 6 hour-buckets including zeros (hours with no sales must still appear). Cache TTL: 30 s.

```json
{
  "buckets": [{ "hour": "10:00", "revenue": 12450.0, "count": 38 }],
  "total_revenue": 0.0,
  "total_count": 0,
  "window_hours": 6
}
```

---

**`GET /api/platform/control-tower/active-sessions`**

Counts `CashSession` rows with `status = OPEN`, cross-tenant. `CashSession` has `organization_id` directly via `TenantMixin` — no branch join needed. Returns count + up to 20 rows for the widget list. Cache TTL: 30 s.

```json
{
  "count": 14,
  "sessions": [{ "id": 42, "branch_id": 7, "organization_id": 3, "org_name": "Tienda ABC", "opened_at": "2026-04-30T08:12:00Z" }]
}
```

---

**`GET /api/platform/control-tower/deltas?period=daily`**

`period`: `daily` (default) | `weekly` | `monthly`. Compares current period vs. prior period of same length. Four metrics:

- `revenue` — `SalesDocument.total_amount` sum, non-cancelled.
- `new_orgs` — `Organization.created_at` count.
- `new_branches` — `Branch.created_at` count.
- `critical_alerts` — `PlatformAlert` with `severity='critical'`, `resolved_at IS NULL`, `first_seen` in window.

Also returns `sparkline: [{ "date": str, "revenue": float }]` covering the last 7 days for the revenue delta tile. Cache TTL: 60 s.

---

**`GET /api/platform/control-tower/top-tenants-today`**

Top 5 orgs by revenue from `today_start` to `now`, non-cancelled. Also fetches same window shifted -1 day for `yesterday_revenue`. Existing `GET /stats/top-tenants` is all-time — this endpoint is distinct. Cache TTL: 300 s.

---

**`GET /api/platform/control-tower/system-health-summary`**

Lightweight badge derived from three counts: (a) `PlatformAlert` critical unresolved; (b) `PlatformIncident` unresolved; (c) orgs with `status='SUSPENDED'` that had `SalesDocument` in prior 7 days. Status logic: any `active_incidents > 0` → `critical`; `critical_alerts > 0` → `warning`; `unexpected_suspensions > 0` → `warning`; else `ok`. Cache TTL: 60 s.

---

### Reused mutation endpoints (verified in source):

| Action | Endpoint | Verified in |
|---|---|---|
| Ack alert | `POST /api/platform/alerts/{id}/ack` | `alerts.py:298` |
| Resolve alert | `POST /api/platform/alerts/{id}/resolve` | `alerts.py:319` |
| Resolve incident | `POST /api/platform/incidents/{id}/resolve` | `incidents.py:244` |
| Unpublish announcement | `POST /api/platform/announcements/{id}/unpublish` | `announcements.py:306` |

Note: no `/silence` verb exists — the tower uses `/ack`. No `/acknowledge` verb exists for incidents — the tower uses `/resolve` directly.

---

## 5. Backend Changes

### `app/routers/platform/control_tower.py`

New file. Module-level `_cache: dict[str, tuple[float, Any]]`. Helper `_cached(key, fn, ttl)` returns cached value if `time.time() - timestamp < ttl`, else calls `fn()` and stores result. Five route functions: `get_sales_now`, `get_active_sessions`, `get_deltas`, `get_top_tenants_today`, `get_system_health_summary`. Cache key for `get_deltas` includes `period` param: `f"deltas:{period}"`.

### `app/routers/platform/__init__.py`

Add `from . import control_tower` to the import block and `router.include_router(control_tower.router)` after the existing `api_keys` include.

---

## 6. Frontend Changes

### `frontend/src/api/platform.ts`

Extend the existing `platformApi` object and add TypeScript interfaces. New types: `ControlTowerSalesNow`, `ControlTowerActiveSessions`, `ControlTowerDeltas`, `ControlTowerDeltaItem`, `ControlTowerTopTenants`, `ControlTowerTopTenantItem`, `ControlTowerSystemHealth`. New functions: `getControlTowerSalesNow()`, `getControlTowerActiveSessions()`, `getControlTowerDeltas(period?)`, `getControlTowerTopTenantsToday()`, `getControlTowerSystemHealth()`, `ackAlert(id)`, `resolveIncident(id)`, `unpublishAnnouncement(id)`.

### `frontend/src/components/platform/v2/WidgetCard.tsx`

Props: `title`, `updatedAt`, `loading`, `error`, `children`, `className?`, `action?` (header-right slot). Renders `.pv2-card` div with header row (title + action), sub-header (relative time + pulsing dot when loading), skeleton when `loading && !updatedAt`, inline error when `error` set.

### Widget files

Each follows the same pattern: named export, `useEffect` with `setInterval`, local `loading`/`error`/`data` state, calls `registerFetch`/`resolveFetch` from `LiveIndicatorContext`, content in `<WidgetCard>`.

- `SalesNowWidget` — `TrendChart` with hourly revenue buckets.
- `ActiveSessionsWidget` — large count + compact session list.
- `DeltasWidget` — four `KPICardV2` tiles in 2×2 sub-grid; revenue tile takes `spark` prop.
- `SystemHealthWidget` — large status badge + sub-counts + links to `/platform/alerts`, `/platform/incidents`.
- `AlertsWidget` — list (unacked, limit 5); `[Ack]` button; optimistic removal.
- `IncidentsWidget` — list (active, limit 5); `[Resolve]` button with inline confirm; optimistic removal.
- `AnnouncementsWidget` — list (published, limit 5); `[Unpublish]` button; optimistic removal.
- `TopTenantsWidget` — compact table, 5 rows; rows link to `/platform/organizations/{id}`.

### `frontend/src/pages/platform/PlatformControlTower.tsx`

Named export. Defines `LiveIndicatorContext` locally. CSS Grid: rows 1+2 use `gridTemplateColumns: 'repeat(4, 1fr)'`, row 3 mixed. Page header: `<h1>Torre de Control</h1>` + `<LiveDot />` inline component.

### `frontend/src/App.tsx`

Lazy import + route inside `PlatformLayout` block:
```tsx
<Route path="control-tower" element={<SuperAdminRoute><Suspense fallback={<PageLoader />}><PlatformControlTower /></Suspense></SuperAdminRoute>} />
```

Use `SuperAdminRoute` because mutation endpoints are SUPERADMIN-only per `incidents.py:154,257`.

### `frontend/src/pages/platform/PlatformLayout.tsx`

Add to `NAV_PLATFORM` at position 0:
```ts
{ label: 'Torre de Control', icon: 'fa-tower-observation', to: '/platform/control-tower' }
```

---

## 7. Affected Files

| File | Change | Description |
|---|---|---|
| `app/routers/platform/control_tower.py` | CREATE | 5 GET endpoints + TTL cache |
| `app/routers/platform/__init__.py` | MODIFY | Register router |
| `frontend/src/pages/platform/PlatformControlTower.tsx` | CREATE | Page + grid + LiveIndicatorContext |
| `frontend/src/components/platform/v2/WidgetCard.tsx` | CREATE | Generic widget shell |
| `frontend/src/components/platform/v2/{SalesNow,ActiveSessions,Deltas,SystemHealth,Alerts,Incidents,Announcements,TopTenants}Widget.tsx` | CREATE × 8 | One per widget |
| `frontend/src/api/platform.ts` | MODIFY | 7 types + 8 API functions |
| `frontend/src/App.tsx` | MODIFY | Lazy import + 1 route |
| `frontend/src/pages/platform/PlatformLayout.tsx` | MODIFY | 1 nav entry |

---

## 8. Testing Strategy

**Backend — 3 tests in `tests/test_control_tower.py`:**

1. **Auth guard** — without token → 401; tenant ADMINISTRADOR JWT → 403; SUPERADMIN JWT → 200.
2. **Payload shape** — `GET /control-tower/deltas?period=daily` returns `items` list with `key/current/prior/delta_abs/delta_pct` (no undefined keys).
3. **Zero-fill** — `GET /control-tower/sales-now` with no recent sales returns 6 bucket entries (all zeros), not empty array.

**Frontend (manual smoke):** all 8 widgets render, `[● live]` indicator transitions correctly, `[Ack]` removes row instantly + fires correct POST, 30 s re-fetch silent.

---

## 9. Out of Scope

- Per-SUPERADMIN layout preferences. Grid is fixed.
- Geographic heatmap (deferred pending lat/lon on Branch).
- Drill-down panels embedded inside widgets — links only.
- WebSocket / SSE — polling sufficient.
- Custom alert thresholds from the tower.

---

## 10. Rollout

Feature branch off `release/qa`. No migrations. No feature flags. Route gated by `SuperAdminRoute`. PR targets `release/qa`. Verify no DB connection pool exhaustion under 8 concurrent 30 s polling widgets before promoting to beta.
