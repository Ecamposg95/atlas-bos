# Cashier Pack — Mis Ventas (sales history) redesign

**Date:** 2026-04-28
**Module:** 3 of 5 in Cashier Pack
**Target route:** `/sales` (all roles share this view — no branch redirect, unlike Mi Caja and Mi Día)
**Target file:** `frontend/src/pages/sales/SalesHistory.tsx`
**PR target:** `release/qa`

---

## Context

The "Mis Ventas" / sales-history page has four cashier-reported gaps:

1. **Row click does nothing.** Only the small eye icon opens the detail modal. Cashiers expect tap-anywhere-on-row to open detail (consistent with most CRMs).
2. **Per-row actions are limited and small.** Two icon-only buttons (eye, undo). "Reimprimir ticket" is buried inside the detail modal — a high-frequency action gated behind two clicks.
3. **"CASH" leaks to UI.** The "Método top" KPI shows the raw enum key (`CASH` / `CARD` / `TRANSFER`) instead of the Spanish label (`Efectivo` / `Tarjeta` / `Transferencia`). The `METHOD_LABELS` map exists in the same file but is not applied at line 127.
4. **KPIs are basic.** 4 cards (Total / Transacciones / Ticket promedio / Método top) — the user wants more cashier-relevant aggregates: refunds and peak sales hour.

This redesign keeps the same page layout, swaps the row pattern, fixes the i18n leak, and extends the stats payload with two new aggregates.

---

## Goals

- Make the entire row clickable (opens detail modal).
- Promote "Reimprimir" from inside-modal to per-row, alongside eye-detail and undo-return. 3 actions per row, hover-revealed on desktop, always visible on touch/mobile.
- Bigger, label-less-but-padded buttons (replace `text-xs` icon-only).
- Fix the "CASH" leak in the Método top KPI.
- Add 2 KPIs: Devoluciones (count + monto) and Hora pico.

## Non-goals

- No restructure of the detail modal (works as-is).
- No new ReturnModal logic (existing flow is unchanged).
- No "Email recibo", "Duplicar venta", or "Cancelar venta" actions — those would require new backend endpoints. Out of scope.
- Color maps in `HQOperations.tsx`, `HQReportsHub.tsx`, `Reports.tsx` that key off raw `CASH`/`CARD`/`TRANSFER` are **internal**, not user-facing strings. Not changed.

---

## Design

### 1. KPI grid — 4 → 6 cards

Layout: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`.

| # | Label | Value | Color | Source |
|---|---|---|---|---|
| 1 | Total | `formatCurrency(stats.total_sales)` | emerald | existing |
| 2 | Transacciones | `String(stats.total_transactions)` | white | existing |
| 3 | Ticket promedio | `formatCurrency(stats.average_ticket)` | indigo | existing |
| 4 | Método top | `METHOD_LABELS[topMethod] ?? topMethod` | slate | **fix** — see §3 |
| 5 | Devoluciones | `${stats.refund_count} · ${formatCurrency(stats.refund_total)}` | rose | **NEW** — backend |
| 6 | Hora pico | `stats.peak_hour ?? '—'` | purple | **NEW** — backend |

The card render block (current lines 119–141) is rewritten as a 6-item array with the same `DaxCard` wrapper + icon + label + value pattern.

Empty/null handling:
- `refund_count === 0` → render `0 · $0.00` (don't hide).
- `peak_hour === null` (no sales in period) → `—`.
- `topMethod` undefined → `—` (existing fallback).

### 2. Tabla densa con hover-reveal

#### 2a. Row-level click

- Add `onClick={() => setSel(s)}` to each `<tr>`.
- Add `cursor-pointer` and `hover:bg-indigo-500/5` classes for affordance.
- Action buttons inside the row use `onClick={(e) => { e.stopPropagation(); ... }}` to prevent the row click from firing when a button is pressed.

#### 2b. Action column

Replace the existing two-icon column (lines 207–222) with a 3-button group:

```tsx
<td className="text-right">
  <div className="
    flex items-center justify-end gap-2
    opacity-100 sm:opacity-0 sm:group-hover:opacity-100
    transition-opacity
  ">
    {/* Ver detalle */}
    <button
      onClick={(e) => { e.stopPropagation(); setSel(s) }}
      className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors"
      title="Ver detalle"
    >
      <i className="fa-solid fa-eye" /> Ver
    </button>

    {/* Reimprimir */}
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (!printerName) return
        reprintTicket(s.id)
      }}
      disabled={!printerName}
      className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title={printerName ? 'Reimprimir ticket' : 'Configura una impresora'}
    >
      <i className="fa-solid fa-print" /> Reimprimir
    </button>

    {/* Devolver — solo si elegible */}
    {(s.status === 'PAID' || s.status === 'REFUNDED_PARTIAL') && (
      <button
        onClick={(e) => { e.stopPropagation(); setReturnSale(s) }}
        className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition-colors"
        title="Iniciar devolución"
      >
        <i className="fa-solid fa-undo" /> Devolver
      </button>
    )}
  </div>
</td>
```

The `<tr>` gets `className="group ..."` so `group-hover` works.

For mobile/touch (`< sm` breakpoint), buttons stay visible (`opacity-100`). On desktop, they fade in on row hover. The `group-hover` mechanic is a known Tailwind pattern.

#### 2c. Reprint handler

New function inside `SalesHistory`:

```ts
const reprintTicket = async (saleId: number) => {
  if (!printerName) return
  setReprinting(true)  // existing state
  try {
    const b64 = await printerApi.getTicketBase64(saleId)
    if (b64) await printerApi.printViaAgent(printerName, b64)
    toast.success('Ticket enviado a la impresora')
  } catch (e) {
    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    toast.error(detail ?? 'Error al reimprimir')
  } finally {
    setReprinting(false)
  }
}
```

Same logic as the existing in-modal reprint button (lines 282–300), refactored into a reusable function. The modal calls the same function so behavior is consistent.

The current `reprinting` state is shared (single in-flight reprint at a time). Acceptable: cashiers reprint one at a time.

### 3. Fix `CASH` leak

In the KPI block, line 127 currently is:

```ts
value: Object.entries(stats.payment_methods ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
```

This returns the raw enum key. Replace with:

```ts
value: (() => {
  const top = Object.entries(stats.payment_methods ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0]
  return top ? (METHOD_LABELS[top] ?? top) : '—'
})()
```

The `METHOD_LABELS` map already exists at lines 30–37 of the same file.

#### Audit (no changes expected)

The discovery brief identified three sites that key off `CASH` / `CARD` / `TRANSFER` strings:

- `frontend/src/pages/hq/HQOperations.tsx:43-45` — color map keyed by enum (CSS class lookup).
- `frontend/src/pages/hq/HQReportsHub.tsx:58-60` — color map.
- `frontend/src/pages/finance/Reports.tsx:83` — inline ternary for color.

These are **internal lookups** (color/icon resolution), not strings rendered to the user. Not changed in this spec. The implementation plan must `grep -rn "[\"']CASH[\"']\|>CASH<\|>CARD<\|>TRANSFER<" frontend/src` to confirm no other user-facing leaks. Any leak found in the cashier-facing files (`pages/sales/`, `pages/pos/`, `components/branch/`, `components/pos/`) is fixed in this PR. Leaks in HQ pages stay for a future cleanup.

### 4. Detail modal — unchanged

The detail modal (lines 240–314) already:
- Translates payment methods via `METHOD_LABELS` (line 203 in row, similar in modal block).
- Has its own Reimprimir and Devolver buttons.

No changes. The redundancy between row buttons and modal buttons is intentional — both surfaces work.

### 5. Backend — extend `/sales/stats`

Endpoint: locate the stats handler in `app/routers/sales.py` (function name TBD at plan-time, likely `get_stats` or similar).

Schema change in `app/schemas/sales.py` (or wherever `SalesStatsRead` lives):

```python
class SalesStatsRead(BaseModel):
    # existing fields preserved:
    total_sales: Decimal
    total_transactions: int
    average_ticket: Decimal
    payment_methods: dict[str, Decimal]
    # NEW:
    refund_count: int
    refund_total: Decimal
    peak_hour: str | None  # "HH:00" or None if no sales
```

Aggregation logic (within the existing date-filtered query):

```python
# Refunds
refund_count = (
    db.query(func.count(SalesDocument.id))
    .filter(
        SalesDocument.organization_id == org_id,
        SalesDocument.created_at.between(start, end),
        SalesDocument.status.in_([DocumentStatus.REFUNDED_PARTIAL, DocumentStatus.REFUNDED_TOTAL]),
    )
    .scalar() or 0
)

# refund_total: sum of returned amounts. Plan-time discovery resolves whether this
# comes from a `refund_amount` column on SalesDocument or from sum(ReturnLine.amount).
# Spec calls for the cleaner option: if SalesDocument has refund_amount, use it;
# otherwise join SalesReturn and sum.

# Peak hour: hour of day with highest count of PAID sales
peak_row = (
    db.query(
        func.extract('hour', SalesDocument.created_at).label('hr'),
        func.count(SalesDocument.id).label('n'),
    )
    .filter(
        SalesDocument.organization_id == org_id,
        SalesDocument.created_at.between(start, end),
        SalesDocument.status == DocumentStatus.PAID,
    )
    .group_by('hr')
    .order_by(func.count(SalesDocument.id).desc())
    .limit(1)
    .first()
)
peak_hour = f"{int(peak_row.hr):02d}:00" if peak_row else None
```

The exact filter set (org scope, branch scope for cashiers, etc.) mirrors the existing query — no new permission logic.

### 6. Frontend type extension

In `frontend/src/api/sales.ts` or `frontend/src/types/sales.ts`:

```ts
export interface SalesStats {
  total_sales: number
  total_transactions: number
  average_ticket: number
  payment_methods: Record<string, number>
  // NEW:
  refund_count: number
  refund_total: number
  peak_hour: string | null
}
```

(Field names and current shape verified at plan-time; this spec assumes alignment.)

### 7. File-by-file summary

| File | Change |
|---|---|
| `frontend/src/pages/sales/SalesHistory.tsx` | KPI grid 4→6, fix CASH at line 127, rewrite tbody for row-click + 3 hover-revealed action buttons, extract `reprintTicket` |
| `frontend/src/api/sales.ts` (or `types/sales.ts`) | Extend `SalesStats` interface with 3 new fields |
| `app/routers/sales.py` | Extend stats endpoint with refund_count, refund_total, peak_hour aggregates |
| `app/schemas/sales.py` | Add 3 fields to `SalesStatsRead` |

---

## Data flow

```
On page load / filter change
  ├── GET /sales       → list of SalesDocument (paginated)
  └── GET /sales/stats → SalesStats { ..., refund_count, refund_total, peak_hour }

On row click
  └── setSel(s) → modal renders (no API call)

On row "Reimprimir" click
  ├── stopPropagation
  ├── GET /printer/ticket-base64/{id}
  └── POST to local agent URL with the b64 + printerName

On row "Devolver" click
  ├── stopPropagation
  └── setReturnSale(s) → ReturnModal renders

On row eye-button click
  └── stopPropagation; setSel(s) (same as row click)
```

No new endpoints (only an additive change to existing `/sales/stats`). No breaking changes.

---

## Edge cases

| State | KPI 5 (Devoluciones) | KPI 6 (Hora pico) | Tabla |
|---|---|---|---|
| Period has 0 sales | `0 · $0.00` | `—` | "Sin ventas en este período" (existing empty state) |
| Period has sales but no refunds | `0 · $0.00` | computed | rendered |
| Period spans midnight | n/a | uses hour-of-day, not day-of-week | rendered |
| Backend not yet deployed (frontend ahead) | `0 · $0.00` (default) | `—` (default) | rendered |

The frontend uses safe fallbacks (`?? 0`, `?? '—'`) so a stale backend doesn't blow up.

---

## Testing plan

Manual smoke (CAJERO role on `/sales`):

1. Open `/sales`. Verify 6 KPI cards render. Método top shows "Efectivo" (or other Spanish label), not "CASH".
2. Hover a row in the table → 3 action buttons fade in (Ver, Reimprimir, Devolver if eligible).
3. Click anywhere in a row (not on a button) → detail modal opens.
4. In the row, click "Reimprimir" with a printer configured → ticket prints. Without printer → button disabled with tooltip.
5. In the row, click "Devolver" on a PAID sale → ReturnModal opens.
6. On mobile (or simulated touch via DevTools) → buttons stay visible without hover.
7. Apply different date presets → KPIs refresh, peak_hour and refund counts update.
8. Force a period with 0 sales → KPIs gracefully show `0 · $0.00` and `—`.

---

## Risks

- **`group-hover` opacity transition**: relies on Tailwind `group` modifier. The `<tr>` must carry `className="group"` for the action column's `group-hover:opacity-100` to work. Easy to forget; flag in PR review.
- **Touch device detection**: forced `opacity-100` on `<sm` is approximate (assumes screen size correlates with touch). Acceptable for cashier devices (which are usually tablets or POS terminals with touch). If it ever runs on a small-screen-but-mouse setup, hover-reveal still works because mouse events fire.
- **`peak_hour` time zone**: `func.extract('hour', ...)` uses the DB's timezone. Atlas DB stores times in UTC (or the column may be timezone-aware). Plan-time check whether to convert to local (Mexico City) hour. If the column is `TIMESTAMPTZ` with proper timezone, the extract is correct in local time. If not, may need `AT TIME ZONE 'America/Mexico_City'`.
- **`refund_total` semantics**: the cleaner choice is "amount actually refunded to customer" (= `ReturnLine.subtotal` or equivalent). If the model only has `refund_amount` on the original `SalesDocument` (which may double-count partial returns), use that with a note for future improvement.
- **Stale list after Reimprimir**: reprint doesn't change sale state, so no list refresh needed. Confirmed.

---

## Out of scope (followups)

- "Email recibo" / "SMS recibo" — needs SMTP/SMS backend, customer email/phone field on Customer model.
- "Duplicar como nueva venta" — needs a new endpoint that clones a sale into the cart store; non-trivial state coordination.
- "Cancelar venta" — admin-only flow with shift-state checks; out of scope for cashier pack.
- HQ-side leaks of raw `CASH`/`CARD`/`TRANSFER` strings (in HQOperations, HQReportsHub, Reports). Internal color maps stay; user-facing leaks deferred to their own PR if any are found.
- Sparkline mini-charts on KPI cards (option D from brainstorm) — visual richness without functional gain for this iteration.
