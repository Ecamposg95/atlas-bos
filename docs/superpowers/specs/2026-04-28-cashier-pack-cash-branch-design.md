# Cashier Pack — Mi Caja (branch view) redesign

**Date:** 2026-04-28
**Module:** 4 of 5 in Cashier Pack
**Target route:** `/cash-history` (CAJERO/GERENTE only — HQ stays untouched)
**Target file:** `frontend/src/components/branch/CashBranchView.tsx`
**PR target:** `release/qa`

---

## Context

The cashier-facing "Mi Caja" view currently has three usability gaps:

1. The shift-status indicator (open/closed) is subtle — same purple hero band for every state, only a small pill changes.
2. There is **no way to register cash inflows/outflows from this view**. The backend supports it (`POST /cash/inflow`, `POST /cash/outflow`) and the HQ view exposes it, but cashiers cannot reach it without leaving their workspace.
3. Several KPIs and a chart are computed against a `difference` field that managers care about but cashiers do not act on day-to-day.

This redesign keeps all backend contracts, removes noise from the cashier's surface, and surfaces actions that already work but aren't reachable.

---

## Goals

- Make shift state (open vs closed) **visible at a glance**, no reading required.
- Let cashiers register cash inflows and outflows directly, with a movements log on the same page.
- Replace `difference` framing with positive cash framing (sales per day, expected cash, inflows, outflows).
- Zero backend changes — all data already returned by `GET /cash/summary` and `GET /cash/history`.

## Non-goals

- HQ `CashHistory.tsx` is **not changed**. This spec only touches the branch component tree.
- No changes to `CloseShiftModal` (works as-is).
- No new endpoints. No DB migrations. No model changes.
- No i18n framework — copy stays in `frontend/src/copy/branchCopy.ts` (existing pattern).

---

## Design

### 1. Hero band — state-aware gradient

The hero band background gradient changes with shift state, alongside the existing pill:

| State | Gradient | Pill |
|---|---|---|
| Active shift (`current` truthy) | `from-emerald-600 to-emerald-500` | white-translucent "Abierto" |
| Closed today (`todayClosedSession` truthy, `current` null) | `from-orange-600 to-orange-500` | white-translucent "Cerrado hoy" |
| No shift today | existing neutral hero (purple/slate) | "Sin caja abierta" |

Hero actions (visible **only when shift is open**, right side):

- `[+ Entrada]` pill, emerald background → opens `MovementModal type="IN"`
- `[− Salida]` pill, rose background → opens `MovementModal type="OUT"`
- `[🌙 Cerrar turno]` pill, white-translucent → opens existing `CloseShiftModal`

When closed today: only the close-shift CTA is hidden. The `Entrada`/`Salida` pills are also hidden (no active shift to attach movements to).

### 2. KPI grid — 4 cards (replaces current 4)

Removes: "Diferencia" and "Turnos · 7 días + Σ dif".
Adds: "Entradas" and "Salidas".

| # | Label | Source | Color | Behavior when no `summary` |
|---|---|---|---|---|
| 1 | Efectivo del turno | `todaySales` (already computed; `total_cash_sales` of current shift, or today's closed shift) | emerald | `—` |
| 2 | Esperado en caja | `opening_balance + total_cash + total_inflows − total_outflows` | violet | `—` |
| 3 | Entradas | `summary.total_inflows` | emerald | `—` |
| 4 | Salidas | `summary.total_outflows` | rose | `—` |

The current `expectedCash` `useMemo` (line 457) computes `opening + total_cash_sales` only — it must be extended to include `+ summary.total_inflows − summary.total_outflows` once `summary` is loaded. When `summary` is not yet available, fall back to current formula (same null-safety as today).

### 3. Métodos de pago — drop Crédito tienda

In the methods grid (`CashBranchView.tsx` lines 654–660), remove the `STORE_CREDIT` entry from the array. The grid changes from `sm:grid-cols-4` to `sm:grid-cols-3`.

The `MethodTotals` interface keeps `STORE_CREDIT?: number` (optional, doesn't affect render); only the rendered array shrinks.

### 4. Movimientos del turno — new full-width section

Inserted **between** the methods-of-payment card and the chart+history row. Hidden when no `summary` (no shift today).

Card structure (uses `ui.card` token, `padding={false}` pattern):

```
┌─ DaxCard padding={false} ────────────────────────┐
│ MOVIMIENTOS DEL TURNO                            │
├──────────────────────────────────────────────────┤
│ Tipo │ Concepto      │      Monto │ Hora         │
│ ─────┼───────────────┼────────────┼──────────────│
│ IN   │ Fondo cambio  │   +$500.00 │ 10:14        │
│ OUT  │ Refresco      │    −$25.00 │ 11:48        │
└──────────────────────────────────────────────────┘
```

Empty state: replace table with a single line `Sin movimientos en este turno` in muted text.

Data: `summary.movements` (already returned by `/cash/summary`). Uses same row format as HQ `CashHistory.tsx` lines 222–241, adapted to `ui.*` tokens (no `dax-table` class — use the branch view's existing list/divider patterns).

### 5. Chart — ventas por día (replaces variance chart)

Rename component `WeekVarianceChart` → `WeekSalesChart`. Same 7-bar layout, different dataset and colors.

- **Dataset**: for each of the last 7 days (today inclusive), bar height = sum of `total_cash_sales` of:
  - any closed session whose `closed_at` falls on that day, plus
  - if that day is today and there is an open shift, also `current.total_cash_sales`.
- **Bar color**: single brand purple (`bg-purple-500/70` light, `bg-purple-400/70` dark). Today's bar drops the `/70` opacity modifier (full saturation, e.g. `bg-purple-500` / `bg-purple-400`) to mark it as the current day.
- **Empty days**: muted neutral bar at ~8% height (same low-state-bar pattern as today's variance chart).
- **Title**: `Efectivo cobrado · 7 días`
- **Legend**: `Suma de cash sales por día (turnos cerrados + turno actual)`
- **Tooltip**: `title={fmtMoney(...)}` on each bar (existing pattern).
- **No negative values, no sign branching, no rose/emerald split.** Always positive.

### 6. MovementModal (new branch-scoped component)

New file `frontend/src/components/branch/MovementModal.tsx`. Adapted from HQ `CashHistory.tsx` lines 12–49 with:

- `ui.card`, `ui.input`, `ui.btnSecondary`, `ui.btnPrimary` tokens (instead of `dax-*` classes)
- Props: `{ type: 'IN' | 'OUT', onClose, onConfirm }` — same shape
- Fields: `Monto` (number, autoFocus, step 0.01, min 0) + `Concepto` (text)
- Submit gates on `amount > 0 && concept.trim() !== ''`
- Submit calls `cashApi.inflow(amount, concept)` for IN, `cashApi.outflow(amount, concept)` for OUT
- On success, parent re-loads (refetch `cashApi.getSummary` to refresh KPIs and movements list)

The HQ modal stays untouched. We accept the duplication because branch and HQ token systems diverge.

### 7. Copy

Add to `frontend/src/copy/branchCopy.ts`:

```ts
cashKpis: {
  // existing keys preserved; ADD:
  cashShift: 'Efectivo del turno',
  inflows: 'Entradas',
  outflows: 'Salidas',
  // 'expected' already exists ('Esperado en caja')
  // 'salesToday' is no longer used in this view (kept for compatibility if used elsewhere)
}
cashMovements: {
  title: 'Movimientos del turno',
  empty: 'Sin movimientos en este turno',
  registerIn: '+ Entrada',
  registerOut: '− Salida',
  modalTitleIn: 'Entrada de efectivo',
  modalTitleOut: 'Salida / Gasto',
  amount: 'Monto',
  concept: 'Concepto',
  submitIn: 'Registrar entrada',
  submitOut: 'Registrar salida',
}
weekSalesChart: {
  title: 'Efectivo cobrado · 7 días',
  legend: 'Suma de cash sales por día (turnos cerrados + turno actual)',
  noSession: 'Sin turno',
}
```

The existing `cashWeekChart` block stays in place (referenced elsewhere) but `WeekSalesChart` reads from the new `weekSalesChart` block.

### 8. branchUI tokens

Add to `frontend/src/components/branch/branchUI.ts`:

- `ui.heroEmerald` — emerald gradient string
- `ui.heroOrange` — orange gradient string

Existing `ui.hero` (purple) is kept as the default/fallback. The hero JSX picks at render time:

```ts
const heroClass =
  current ? ui.heroEmerald :
  todayClosedSession ? ui.heroOrange :
  ui.hero
```

### 9. Component file layout

| File | Change |
|---|---|
| `frontend/src/components/branch/CashBranchView.tsx` | Modify hero JSX, replace KPI grid, drop STORE_CREDIT entry, insert MovementModal mount + Movimientos section, swap chart import |
| `frontend/src/components/branch/MovementModal.tsx` | **NEW** — branch-scoped duplicate of HQ MovementModal |
| `frontend/src/components/branch/WeekSalesChart.tsx` | **NEW** — extract+rewrite of `WeekVarianceChart` |
| `frontend/src/components/branch/branchUI.ts` | Add `heroEmerald`, `heroOrange` |
| `frontend/src/copy/branchCopy.ts` | Add new copy keys (see §7) |

The old `WeekVarianceChart` definition inside `CashBranchView.tsx` is **deleted** (it has no other consumer per discovery). If it later turns out to be used elsewhere, the spec calls for grep before delete during implementation.

---

## Data flow

```
On page mount
  ├── GET /cash/status        → current
  ├── GET /cash/history?limit=7 → past[]
  └── GET /cash/summary       → summary { total_cash, total_card, total_transfer,
                                          total_inflows, total_outflows,
                                          opening_amount, expected_cash, movements[] }

After IN/OUT modal confirm
  ├── POST /cash/inflow {amount, reason}
  │   or POST /cash/outflow {amount, reason}
  └── re-call GET /cash/summary

On close-shift confirm (existing flow, unchanged)
  └── POST /cash/close {closing_amount}
```

No new endpoints. No new schemas.

---

## Edge cases & states

| State | Hero | KPIs | Métodos | Movimientos | Chart |
|---|---|---|---|---|---|
| Open shift | emerald + 3 action pills | live | live | rendered | rendered |
| Closed today | orange + reprint button only | last shift's snapshot | last shift's snapshot | rendered (movements of closed shift) | rendered |
| No shift today | neutral + "Sin caja abierta" | all `—` | hidden | hidden | rendered (still shows past 7d) |

`summaryError` from API: show muted "Sin turno hoy" placeholder in métodos card, hide movimientos section, KPIs show `—`. Same fail-soft as today.

---

## Testing plan

Manual smoke (cashier role on `/cash-history`):

1. Login as CAJERO, no shift open → page shows neutral hero, "Sin caja abierta" pill, KPIs all `—`, métodos hidden, chart still renders.
2. Open shift from POS → return to `/cash-history` → hero turns emerald, "Abierto" pill + 3 action pills visible, KPIs populated.
3. Click `[+ Entrada]` → modal opens → enter $500 + "Fondo de cambio" → submit → modal closes → KPI "Entradas" shows +$500, movement appears in tabla, "Esperado en caja" reflects.
4. Click `[− Salida]` → enter $25 + "Refresco" → submit → "Salidas" shows -$25, "Esperado" decreases by $25, movement shows in tabla.
5. Close shift → hero turns orange, action pills disappear, "Cerrado hoy" pill shows.
6. Verify chart bars match expected sums for the last 7 days.

No automated tests requested for UI changes (existing project pattern).

---

## Risks

- **`expectedCash` formula change**: today's number is `opening + cash`. Adding `+ inflows − outflows` is more correct but **changes the displayed value** for any cashier with active inflows/outflows. This is the desired behavior per spec; flag in PR description so reviewer expects it.
- **Hero gradient change** alters page accent color. Other branch pages (Cockpit, etc.) keep purple — this is intentional but creates a visual inconsistency on this one page. Decision: keep the state-aware hero only on Mi Caja; other pages stay purple.
- **Movements list size**: `summary.movements` is unbounded per backend. If a shift logs 100+ movements, the section grows tall. Discovery showed HQ doesn't paginate it either; out of scope for this spec.

---

## Out of scope (followups)

- HQ `CashHistory.tsx` does not get the new state-aware hero — different visual system.
- "Corte parcial" remains disabled (already disabled in HQ; not changed here).
- Movements pagination / search.
- Per-method breakdown chart (separate from the daily totals chart).
