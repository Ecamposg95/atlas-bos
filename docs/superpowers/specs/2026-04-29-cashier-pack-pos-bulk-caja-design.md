# Cashier Pack — POS bulk-apply caja pricing

**Date:** 2026-04-29
**Module:** 2 of 5 in Cashier Pack
**Target route:** `/pos`
**Target file:** `frontend/src/components/pos/CartPanel.tsx` + `frontend/src/store/posStore.ts`
**PR target:** `release/qa`

---

## Context

The POS cart already supports per-line price modes (Menudeo / Mayoreo / Caja / Promo) with a badge per cart line, computed automatically from `min_quantity` thresholds and an optional `linked_package_id` that ties a tier to a `PackagingUnit` (caja). Cashiers can also force a specific tier per line manually via the badge.

The user request: **a single control next to the global discount % input that applies "P2 / caja" pricing to the entire cart in one click**, with an undo path.

Important context from discovery:
- **There is no P1/P2/P3 enum.** Prices are tiered by `min_quantity`. The "caja" tier is identified by having `linked_package_id` set, pointing to a `PackagingUnit` with `package_price` and `units_per_package`.
- **Backend recomputes prices on sale creation** (`app/routers/sales.py:326-346`) and validates against a margin floor (no client can vend below 50% of the lowest tier). Frontend can change cart state freely; backend is the security boundary.
- **The auto-tier and caja-restructure useEffects** in `CartPanel.tsx` already do the heavy lifting per line. The new bulk action reuses their semantics.

This redesign adds a **one-shot bulk action with explicit undo**, no sticky mode, no new backend.

---

## Goals

- Single click to apply caja-tier pricing across all current cart lines that qualify.
- Lines without a caja tier (no `linked_package_id` configured) gracefully degrade to their best auto-tier — no error, no block.
- Lines with caja tier but `qty < min_quantity` also degrade (we do not auto-bump qty).
- Live counter "X de Y productos" shows what the bulk applied to.
- Explicit "Restaurar" link reverts every line to auto-tier (qty-driven highest qualifying tier).
- Newly-added cart lines after the bulk-click do NOT auto-apply caja — cashier re-clicks if she wants the new line included. Counter `Y` grows but `X` stays until re-clicked.

## Non-goals

- No sticky "modo caja" toggle (rejected during brainstorm — risks forgot-toggle bugs in real cashier flow).
- No backend changes. No schema changes. No new endpoints.
- No new "P1/P2/P3" enum or rename of the pricing model. Caja stays defined by `linked_package_id`.
- No changes to the per-line manual force flow (existing badge-click pattern stays as-is).
- No automatic qty-bump (e.g., qty=5 → qty=12 to qualify for caja). Cashier handles qty manually.

---

## Design

### 1. Visual control — placement and states

The control lives **directly below the global-discount-% input** (current `CartPanel.tsx` lines ~718-761), inside the same controls block as global discount.

#### State A — Not applied (default)

Dashed amber border button, full-width within the controls block:

```tsx
<button
  onClick={applyCajaToAll}
  disabled={items.length === 0}
  className="
    w-full rounded-lg px-3 py-2.5
    bg-amber-500/5 border border-dashed border-amber-500/25
    text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/40
    disabled:opacity-40 disabled:cursor-not-allowed
    transition-colors text-xs font-bold
    flex items-center justify-center gap-2
  "
  title="Aplica precio caja a todos los productos del carrito que tengan tier caja configurado y cantidad suficiente. Sobreescribe precios manuales."
>
  <i className="fa-solid fa-box" aria-hidden="true" />
  Aplicar caja a todo
</button>
```

Disabled when `items.length === 0`.

#### State B — Applied (at least one line has `cajaForcedByBulk` true)

Solid emerald container with live counter and undo link:

```tsx
<div className="
  w-full rounded-lg px-3 py-2.5
  bg-emerald-500/10 border border-emerald-500/30
  flex items-center justify-between gap-3
">
  <div className="flex items-center gap-2 min-w-0">
    <i className="fa-solid fa-box text-emerald-400" aria-hidden="true" />
    <div className="flex flex-col min-w-0">
      <span className="text-xs font-bold text-emerald-300">Caja aplicada</span>
      <span className="text-[10px] text-slate-400 truncate">
        {appliedCount} de {totalCount} {totalCount === 1 ? 'producto' : 'productos'}
      </span>
    </div>
  </div>
  <button
    onClick={restoreAutoTier}
    className="text-[10px] text-slate-400 hover:text-white underline transition-colors flex-shrink-0"
  >
    Restaurar
  </button>
</div>
```

#### Counter computation (live, not snapshot)

```ts
const totalCount = items.length
const appliedCount = items.filter((item) => item.cajaForcedByBulk === true).length
const cajaModeApplied = appliedCount > 0
```

Counter recalculates on every render. When the cashier scans a new product post-click, `totalCount` grows but `appliedCount` stays — the visual mismatch makes the "not yet applied to new" state explicit.

### 2. Per-line application logic — `applyCajaToLine()`

```ts
function applyCajaToLine(item: CartItem, source: Product): CartItem {
  // Find the caja tier (the one with linked_package_id set)
  const cajaTier = source.prices?.find((p) => p.linked_package_id != null)

  if (!cajaTier) {
    // No caja tier configured for this product → degrade to auto-tier
    return applyAutoTier(item, source)
  }

  const cajaMinQty = Number(cajaTier.min_quantity)
  if (!Number.isFinite(cajaMinQty) || cajaMinQty <= 0) {
    return applyAutoTier(item, source)
  }

  // Pieces-equivalent of current cart line (so the comparison is fair regardless
  // of current unit_kind). If line is already in 'package' mode, multiply by
  // its current units_per_package.
  const piecesQty = item.unit_kind === 'package'
    ? Number(item.quantity) * Number(item.units_per_package ?? 1)
    : Number(item.quantity)

  if (piecesQty < cajaMinQty) {
    // Not enough qty to qualify as caja → degrade to auto-tier
    return applyAutoTier(item, source)
  }

  // Qualifies. Restructure as caja line, mirroring the existing buildCajaItem
  // path (CartPanel.tsx lines ~198-223).
  const linkedPkg = source.packaging_units?.find(
    (pk) => pk.id === cajaTier.linked_package_id
  )
  const pricePerBox = linkedPkg?.package_price != null
    ? Number(linkedPkg.package_price)
    : Number(cajaTier.unit_price) * cajaMinQty

  const numBoxes = Math.floor(piecesQty / cajaMinQty)
  // Remainder of pieces (if any) — out of scope for v1: we drop them.
  // The cashier sees the box count and can scan loose pieces separately if needed.

  return {
    ...item,
    unit_kind: 'package',
    units_per_package: cajaMinQty,
    price: pricePerBox,
    quantity: numBoxes,
    activeTier: cajaTier,
    isForcedPrice: true,        // immune to subsequent auto-tier recalc
    cajaForcedByBulk: true,     // marker for restore + counter
  }
}
```

Notes:
- The remainder `piecesQty % cajaMinQty` is **dropped** in v1. If the cashier had qty=14 and caja=12, the bulk action restructures to 1 box (12 pieces). The remaining 2 pieces are lost. **Flagged in copy** (toast says `1 caja aplicada (2 piezas no completaron caja, agrégalas manualmente si las necesitas).`). Out-of-scope refinement: keep a residual line for the remainder.
- `applyAutoTier(item, source)` is the existing per-line tier evaluator inside `CartPanel.tsx` (lines 80-104). Extracted into a named function and called from both the existing useEffect and the new bulk path.

### 3. Bulk action — `applyCajaToAll()`

In `posStore.ts`:

```ts
applyCajaToAll: () => {
  const state = get()
  const updated = state.items.map((item) => {
    const source = findProductSource(item.product_id)  // existing pattern
    if (!source) return item
    return applyCajaToLine(item, source)
  })
  set({ items: updated })

  // Toast feedback
  const total = updated.length
  const applied = updated.filter((i) => i.cajaForcedByBulk).length
  if (applied === total) {
    toast.success(`Caja aplicada a los ${total} productos`)
  } else if (applied === 0) {
    toast.warning('Ningún producto tiene precio caja disponible')
  } else {
    toast.success(
      `Caja aplicada a ${applied} de ${total} productos. ${total - applied} quedan en su precio normal.`
    )
  }
}
```

`findProductSource` mirrors how the existing useEffects look up the source `Product` per cart line (likely via `useCartProducts()` or a Zustand-store lookup keyed by `product_id`). Plan-time discovery confirms exact API.

### 4. Reverse action — `restoreAutoTier()`

```ts
restoreAutoTier: () => {
  const state = get()
  const restored = state.items.map((item) => {
    if (!item.cajaForcedByBulk && !item.isForcedPrice) return item
    return {
      ...item,
      cajaForcedByBulk: false,
      isForcedPrice: false,
      // Reset to piece mode so the auto-tier useEffect can re-evaluate freely.
      unit_kind: 'piece' as const,
      units_per_package: undefined,
      // Restore qty to pieces-equivalent if it was a box
      quantity: item.unit_kind === 'package'
        ? Number(item.quantity) * Number(item.units_per_package ?? 1)
        : item.quantity,
    }
  })
  set({ items: restored })
  // The auto-tier useEffect in CartPanel will fire on the next render and
  // re-apply qty-based tiers. If a line legitimately qualifies for caja by
  // its own qty (without bulk), it will re-acquire caja status — but
  // cajaForcedByBulk stays false (it's qty-driven, not bulk-forced).
}
```

This is **idempotent**: pressing "Restaurar" twice does nothing on the second press (all lines already auto-tier).

### 5. Override of manually-forced lines

If a line was manually forced (cashier clicked the badge to set a tier) before bulk-apply:
- The bulk action **overrides** that force. `applyCajaToLine` returns a new line with `isForcedPrice: true` and `cajaForcedByBulk: true`, replacing whatever was there.
- Tooltip on the bulk button warns: `Aplica precio caja... Sobreescribe precios manuales`.
- After "Restaurar", manually-forced lines lose their force too (mass reset). Cashier re-applies manually if needed. Acceptable: bulk-action implies "treat the cart uniformly".

### 6. Newly-added cart lines (post-click)

The bulk action is one-shot. After click, the cashier scans more products:
- New line enters with `cajaForcedByBulk: false` and goes through the existing auto-tier flow.
- Counter updates: `appliedCount` stays, `totalCount` grows.
- Visual: `4 de 7` becomes `4 de 8`. The mismatch is intentional and informative.

The cashier's options:
- Re-click "Aplicar caja a todo" → re-evaluates the whole cart (existing forces survive logic of §5).
- Force the new line manually via its badge.
- Leave it.

### 7. CartItem type extension

`frontend/src/types/sales.ts`:

```ts
export interface CartItem {
  // existing fields preserved
  ...
  // NEW:
  cajaForcedByBulk?: boolean
}
```

Optional flag, defaults to `false`/`undefined`. No migration needed for in-memory cart state.

### 8. File-by-file summary

| File | Change |
|---|---|
| `frontend/src/components/pos/CartPanel.tsx` | Add bulk-caja control (state A and state B) below global discount; extract `applyAutoTier` from existing useEffect into a reusable function |
| `frontend/src/store/posStore.ts` | Add `applyCajaToAll()` and `restoreAutoTier()` actions; expose them in store interface |
| `frontend/src/types/sales.ts` | Add `cajaForcedByBulk?: boolean` to `CartItem` |
| Backend | **None** |

---

## Data flow

```
On "Aplicar caja a todo" click
  ├── posStore.applyCajaToAll()
  │   ├── For each cart line: applyCajaToLine(item, source)
  │   │   └── If caja tier exists AND qty qualifies → restructure as box
  │   │       Else → applyAutoTier (existing logic)
  │   └── Toast: success/partial/warning
  └── CartPanel re-renders → state B shows count + Restaurar

On scanning a new product (post-bulk)
  └── New line goes through normal auto-tier flow
       counter shows N+1 total but applied stays the same

On "Restaurar" click
  ├── posStore.restoreAutoTier()
  │   ├── For each line: clear cajaForcedByBulk + isForcedPrice + unit_kind=piece
  │   └── Auto-tier useEffect (existing) re-evaluates per-line tiers
  └── CartPanel re-renders → state A (default)

On sale creation (POST /sales)
  ├── Cart payload includes unit_kind, unit_price, quantity per line
  ├── Backend recomputes from variant.prices (security)
  └── If client price < 50% of lowest tier: 422 (margin floor violation)
```

---

## Edge cases

| Case | Handling |
|---|---|
| Empty cart | Bulk button disabled |
| All products lack caja tier | Toast warning "Ningún producto tiene precio caja disponible"; counter stays "0 de Y"; control returns to dashed amber |
| Mix qualifying / not | Toast partial "X de Y aplicados"; counter shows split |
| qty=14, caja=12 | 1 caja applied; remainder 2 pieces dropped; toast notes the loss |
| Line manually forced before click | Override; bulk wins |
| Line in caja (auto, by qty) before click | Re-applied as bulk caja (`cajaForcedByBulk=true`); counter includes it |
| Line in caja (auto) when "Restaurar" pressed | Resets to piece, then auto-tier re-applies caja (since qty qualifies); `cajaForcedByBulk` stays false |
| Cashier presses Apply twice in a row | Second press is a no-op for already-applied lines; non-applied lines re-evaluate (no harm) |
| Backend rejects sale on margin floor | Existing 422 error path; cashier sees toast; can adjust manually |

---

## Testing plan

Manual smoke (CAJERO role on `/pos`):

1. Open POS, empty cart → button disabled (dashed amber).
2. Scan product A (has caja tier 12u @ $480/box, currently qty=12) → button enabled.
3. Scan product B (has caja tier 24u @ $720/box, currently qty=5) → button still enabled.
4. Scan product C (no caja tier, qty=3) → button still enabled.
5. Click "Aplicar caja a todo" → toast `Caja aplicada a 1 de 3 productos. 2 quedan en su precio normal.`
   - A becomes 1 caja @ $480 (`unit_kind=package`).
   - B stays at qty=5, mayoreo or base price (didn't qualify).
   - C stays at qty=3, base price (no caja).
6. Control turns emerald: `Caja aplicada · 1 de 3 productos · Restaurar`.
7. Increase B's qty to 24 manually → it should auto-restructure to 1 caja by the existing useEffect (auto-tier picks the caja tier because qty qualifies). Counter `appliedCount` does NOT change (it counts `cajaForcedByBulk` only, not auto-caja).
8. Click "Aplicar caja a todo" again → now B becomes bulk-caja too. Counter goes to `2 de 3`.
9. Click "Restaurar" → all lines reset to piece mode and re-evaluate. A (qty=12) and B (qty=24) re-acquire caja by auto-tier. Counter goes to `0 de 3`. Control returns to dashed amber.
10. Create sale → backend accepts; receipt shows correct caja prices.
11. Edge: scan product with qty=14 (caja=12) → click bulk → 1 caja, 2 pieces dropped (toast warns).

---

## Risks

- **Remainder loss (qty mod min_quantity)**: dropping the remainder pieces is the simplest v1. If cashiers complain, follow-up adds a residual `piece` line for the remainder. Flagged in toast and in §2.
- **`applyAutoTier` extraction**: requires factoring out logic from `CartPanel.tsx`'s existing useEffect (lines 80-104). Risk of regression in the auto-tier flow if the extraction misses an edge case. Mitigated by manual smoke after change.
- **`findProductSource` API**: spec assumes a way to look up the source `Product` from a cart `product_id`. Existing useEffects already do this; plan-time confirms the exact mechanism (Zustand subscription, prop drill, or hook).
- **Backend margin floor**: bulk-caja could in theory cross the 50% floor on a misconfigured product (caja price < 50% of base tier). Backend rejects with 422; cashier sees clear error. Same protection as today.
- **Tooltip browser support**: `title=` is the simplest disclosure for "sobreescribe precios manuales". On touch devices, no hover. Acceptable: the action is recoverable via Restaurar.

---

## Out of scope (followups)

- Residual line for `qty mod min_quantity` (preserves dropped pieces).
- Sticky "modo caja" toggle (auto-applies to new lines).
- Bulk-apply for tiers other than caja (e.g., "todo en mayoreo").
- Per-line "lock from bulk" — exclude a specific line from future bulk actions.
- Animation/transition between states A and B (kept static for simplicity).
- Backend dry-run pricing endpoint (would let frontend preview without mutating cart state).
