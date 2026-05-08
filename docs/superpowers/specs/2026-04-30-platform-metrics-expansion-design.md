# Feature 3 — Platform Metrics Expansion

**Date:** 2026-04-30
**Owner:** SUPERADMIN / Platform team
**Target files:**
- `app/routers/platform/stats.py`
- `frontend/src/api/platform.ts`
- `frontend/src/pages/platform/PlatformMetrics.tsx`
- `frontend/src/components/platform/v2/CohortTable.tsx` (new)
- `frontend/src/components/platform/v2/ActivityHeatmap.tsx` (new)
- `frontend/src/components/platform/v2/Leaderboard.tsx` (new)

**Goal:** Transform the current 4-KPI / 1-chart overview into a comprehensive SUPERADMIN command center covering revenue trends, breakdowns by industry and tenant size, cross-tenant leaderboards, cohort retention, and activity heatmaps.

---

## 1. Motivation

The current `PlatformMetrics` page exposes two rows of data: a hero revenue KPI with a single Recharts area chart, and a side-by-side of industry distribution and a top-5 org table. This is insufficient for platform decisions. A SUPERADMIN needs to answer: Which industry segment is growing? Which cohort of tenants churned at 90 days? At what hour of day does Atlas peak across all orgs? None of those are answerable today. The expansion closes that gap without introducing new chart libraries (bundle is already at 373 kB pre-gzip from Recharts) and without building a full export/filter system (deferred to F4).

---

## 2. UX Layout — Page Post-Expansion

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Platform / Métricas globales                          [7d][30d][90d][YTD]  │
│                                                                [Refrescar]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  SECTION A — KPIs PRINCIPALES                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ Revenue  │ │  Sales   │ │   AOV    │ │ Active   │                        │
│  │  total   │ │  count   │ │ (avg ord)│ │ tenants  │  ← row 1 (4 cards)    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ Active   │ │  MRR     │ │Activation│ │Suspension│                        │
│  │ branches │ │ (proxy)  │ │   rate   │ │   rate   │  ← row 2 (4 cards)    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  SECTION B — TRENDS                                                         │
│  ┌───────────────────────────────────────────────┐ ┌───────────────────┐   │
│  │ Multi-series trend (revenue / sales / signups)│ │ New signups / mes │   │
│  │ [Revenue ✓] [Sales ✓] [Signups ✓]  toggle    │ │  (bar chart)      │   │
│  └───────────────────────────────────────────────┘ └───────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  SECTION C — BREAKDOWNS  (3 charts)                                         │
│  Industry dist. (donut) | Tenant size S/M/L (bar) | Branch count dist (bar)│
├─────────────────────────────────────────────────────────────────────────────┤
│  SECTION D — LEADERBOARDS  (3 tables)                                       │
│  Top tenants by revenue | Top branches cross-tenant | Top products         │
├─────────────────────────────────────────────────────────────────────────────┤
│  SECTION E — ADVANCED  [▼ Expandir análisis avanzado]  (collapsed)          │
│    COHORT RETENTION TABLE (rows = signup month, cols = 30/60/90/180d %)    │
│    ACTIVITY HEATMAP (hour-of-day × day-of-week, native SVG)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. API Contract — New Endpoints in `app/routers/platform/stats.py`

All endpoints require SUPERADMIN auth (same pattern as existing stats routes). All return JSON. Cache TTL via module-level dict `{key: (expires_at, payload)}`.

### 3.1 `GET /stats/kpis-extended`

Query: `range` ∈ `7d|30d|90d|ytd` (default `30d`). One bundle to populate all 8 KPI cards with their sparklines.

Response shape:
```json
{
  "range": "30d",
  "revenue":         { "total": float, "delta_pct": float|null, "spark": [float, ...] },
  "sales_count":     { "total": int,   "delta_pct": float|null, "spark": [float, ...] },
  "aov":             { "value": float, "delta_pct": float|null, "spark": [float, ...] },
  "active_tenants":  { "value": int,   "delta_pct": float|null, "spark": [float, ...] },
  "active_branches": { "value": int,   "delta_pct": float|null, "spark": [float, ...] },
  "mrr_proxy":       { "value": float, "delta_pct": float|null, "spark": [float, ...] },
  "activation_rate": { "value": float, "delta_pct": float|null, "spark": [float, ...] },
  "suspension_rate": { "value": float, "delta_pct": float|null, "spark": [float, ...] }
}
```

`spark` arrays = one float per day in range, oldest-to-newest. `mrr_proxy` = trailing-30d revenue regardless of `range`. `activation_rate` = `orgs_with_sale_in_range / active_orgs * 100`. Cache TTL: 10 min.

### 3.2 `GET /stats/trends-multi`

Query: `range`, `series` (CSV subset of `revenue,sales,signups`, default all). Returns daily array filling gaps with 0.

```json
{
  "range": "30d",
  "points": [
    { "date": "2026-03-31", "label": "31/03", "revenue": 4200.0, "sales": 38, "signups": 1 }
  ]
}
```

`signups` = `Organization.created_at` count per day. Cache TTL: 10 min.

### 3.3 `GET /stats/tenant-size-distribution`

Buckets active orgs by all-time total revenue: S (`<$10k`), M (`$10k–$100k`), L (`>=$100k`).

```json
[
  { "bucket": "S", "label": "< $10k",    "count": int, "revenue_total": float },
  { "bucket": "M", "label": "$10k–$100k","count": int, "revenue_total": float },
  { "bucket": "L", "label": ">= $100k",  "count": int, "revenue_total": float }
]
```

Cache TTL: 10 min.

### 3.4 `GET /stats/branch-distribution`

Counts orgs by active branch count: 1, 2-5, 6-20, 21+.

Cache TTL: 10 min.

### 3.5 `GET /stats/top-branches?limit=10`

Top branches cross-tenant by revenue last 30 days. Cache TTL: 5 min.

### 3.6 `GET /stats/top-products?limit=10&range=30d`

Top SKUs cross-tenant by quantity. Joins `SalesLineItem → ProductVariant → Product`. Includes `org_count` (distinct orgs that sold this SKU). Cache TTL: 5 min.

### 3.7 `GET /stats/cohort-retention?cohort_period=month`

For each calendar month of org signup (last 12 months), `% retained` at 30/60/90/180 days. `null` when insufficient elapsed time.

```json
[
  { "cohort": "2025-09", "cohort_label": "Sep 2025", "size": int,
    "ret_30d": float|null, "ret_60d": float|null, "ret_90d": float|null, "ret_180d": float|null }
]
```

Cache TTL: 10 min.

### 3.8 `GET /stats/activity-heatmap?range=30d`

Groups `SalesDocument` by `(EXTRACT(DOW), EXTRACT(HOUR))`. Returns 7×24 = 168 cells max with `count`. Includes `max_count` so frontend can normalize. Cache TTL: 5 min.

---

## 4. Frontend Changes

### 4.1 `frontend/src/api/platform.ts`

8 new functions on `platformApi` + 8 TypeScript interfaces. Functions: `kpisExtended(range)`, `trendsMulti(range, series?)`, `tenantSizeDistribution()`, `branchDistribution()`, `topBranches(limit?)`, `topProducts(limit?, range?)`, `cohortRetention()`, `activityHeatmap(range)`.

### 4.2 `frontend/src/pages/platform/PlatformMetrics.tsx`

**Phase 1 (initial load):** parallel `Promise.all` of `kpisExtended`, `trendsMulti`, `tenantSizeDistribution`, `branchDistribution`, `industryDistribution`, `topTenants`, `topBranches`, `topProducts`. Skeleton covers Phase 1.

**Phase 2 (lazy on `<details>` toggle):** `cohortRetention` + `activityHeatmap`.

**Range selector** changes from `24h|7d|30d|90d` → `7d|30d|90d|YTD`.

**Section A:** 8 `KPICardV2` cards in 4×2 grid. Map keys directly. `spark` prop = `response.X.spark.map(v => ({v}))`.

**Section B:** Multi-series `TrendChart` (extended with optional `salesSeries`/`signupsSeries` props + 3 toggle buttons). Right panel: monthly `BarChart` from `trendsMulti.signups`.

**Section C:** 3 cards side by side: existing `IndustryList` (left), new `BarChart` over tenant-size-distribution (center), new `BarChart` over branch-distribution (right).

**Section D:** 3 `Leaderboard` instances side by side.

**Section E:** Wrapped in `<details>`, lazy-loads on `onToggle`. Renders `CohortTable` + `ActivityHeatmap`.

### 4.3 New: `Leaderboard.tsx`

Props: `title`, `rows`, `columns: { key, label, align?, format? }[]`, `loading?`. Renders `<table>` with `.pv2` scope. Implicit rank column (1-N). Numeric cols use `formatCurrency`.

### 4.4 New: `CohortTable.tsx`

Props: `rows: CohortRow[]`. Native `<table>`. Row header = `cohort_label`. Cells with intensity-based `background-color` from value (0% = `var(--p-bg)`, 100% = `var(--p-accent)` 60% opacity). Null = `—`. No SVG, no chart lib.

### 4.5 New: `ActivityHeatmap.tsx`

Props: `cells`, `maxCount`. Pure SVG: 7 rows × 24 cols. Each cell = `<rect>` with `fill-opacity` = `count/maxCount`. Row labels Dom-Sáb. Col labels every 3 hours. `<title>` tooltip.

---

## 5. Affected Files

| File | Action |
|---|---|
| `app/routers/platform/stats.py` | Modify — 8 new endpoints + module cache |
| `frontend/src/api/platform.ts` | Modify — 8 functions + 8 interfaces |
| `frontend/src/pages/platform/PlatformMetrics.tsx` | Modify — refactor to 5 sections |
| `frontend/src/components/platform/v2/TrendChart.tsx` | Modify — optional `salesSeries`/`signupsSeries` props |
| `frontend/src/components/platform/v2/Leaderboard.tsx` | Create |
| `frontend/src/components/platform/v2/CohortTable.tsx` | Create |
| `frontend/src/components/platform/v2/ActivityHeatmap.tsx` | Create |

---

## 6. Performance Budget

- No new npm packages. Recharts `BarChart` already in bundle.
- `CohortTable` + `ActivityHeatmap` = pure HTML/SVG. Zero additional JS weight.
- Section E inside `<details>` with conditional render (not just CSS hide) → Phase 2 deferred until expansion.
- Target post-expansion bundle: < 390 kB pre-gzip.

Backend: all 8 new endpoints aggregate over `sales_documents` + `organizations`. Cache 5-10 min. No new indexes required (existing `created_at`/`organization_id` cover).

---

## 7. Testing Strategy

5 backend integration tests in `tests/test_platform_stats_extended.py`:

1. `test_kpis_extended_shape` — all 8 keys, `spark` is list, `delta_pct` is float|null.
2. `test_trends_multi_fills_gaps` — `points` has exactly `range_days` entries.
3. `test_tenant_size_buckets_exhaustive` — sum of buckets == total org count.
4. `test_cohort_retention_null_future` — cohort < 30d old has `ret_30d = null`.
5. `test_activity_heatmap_max_count` — equals `max(cell.count)`.

Frontend: manual smoke. Load page, verify 8 cards, expand Section E, no console errors.

---

## 8. Out of Scope

- CSV/Excel export (F4).
- Per-org/per-branch filter (F4).
- Custom dashboard layout / pinned widgets.
- Alert thresholds on KPIs (existing alerts system).
- Real MRR (billing model not present; `mrr_proxy` is 30d trailing).

---

## 9. Rollout

Single feature branch off `release/qa`. No migrations. No feature flag.
