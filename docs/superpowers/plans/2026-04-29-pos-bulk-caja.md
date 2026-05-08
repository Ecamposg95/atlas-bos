# POS Bulk Caja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** PR 5 of 5 in Cashier Pack (LAST) — implement spec `2026-04-29-cashier-pack-pos-bulk-caja-design.md`: one-shot button "Aplicar caja a todo" below the global discount input, with explicit "Restaurar" undo. Iterates the cart applying caja-tier prices to qualifying lines; degrades non-qualifying ones to auto-tier.

**Architecture:** Frontend-only. Two new posStore actions (`applyCajaToAll`, `restoreAutoTier`) plus a control block in `CartPanel.tsx` and one new optional flag on `CartItem`. Zero backend changes — backend recomputes prices and validates margin on sale creation as today.

**Tech Stack:** React 18 + TypeScript + Zustand + Tailwind.

**Branch:** `feat/pos-bulk-caja` off `release/qa` AFTER all 4 prior PRs are merged. Touches the money path (cart pricing) — extra reviewer rigor.

**Worktree:** `.claude/worktrees/pos-bulk-caja`

---

## File structure (locked)

| File | Action |
|---|---|
| `frontend/src/types/sales.ts` (`CartItem` interface) | **Modify** — add `cajaForcedByBulk?: boolean` |
| `frontend/src/store/posStore.ts` | **Modify** — add `applyCajaToAll()` and `restoreAutoTier()` actions |
| `frontend/src/components/pos/CartPanel.tsx` | **Modify** — add bulk-caja control block below the global-discount input |

No new files. No backend changes.

---

## Task 0: Setup

- [ ] **Step 1: Verify all 4 prior PRs merged**

```bash
cd /home/atlas-tech/Devs/Atlas-API
git fetch origin --quiet
gh pr list --state merged --base release/qa --limit 10
```

Confirm Mi Caja, Mi Día, Mis Ventas, Inventario all merged. If any are still open, **STOP** — POS depends on a stable cart pricing baseline that doesn't shift mid-PR.

- [ ] **Step 2: Create worktree**

```bash
git worktree add /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/pos-bulk-caja -b feat/pos-bulk-caja origin/release/qa
cd /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/pos-bulk-caja/frontend
ln -s ../../../../frontend/node_modules ./node_modules
npm run build 2>&1 | tail -3
```

Expected: `✓ built in N s`.

---

## Task 1: Extend `CartItem` type

**File:** `frontend/src/types/sales.ts`

- [ ] **Step 1: Add the flag**

Find the `CartItem` interface (lines 66-80). Find the `unit_kind?` field (line 70). Add a new field anywhere in the interface (suggest after `unit_kind`):

```ts
  cajaForcedByBulk?: boolean  // true if line was set to caja mode by "Aplicar caja a todo"
```

- [ ] **Step 2: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/types/sales.ts
git commit -m "feat(pos): add cajaForcedByBulk flag to CartItem"
```

---

## Task 2: posStore actions

**File:** `frontend/src/store/posStore.ts`

The implementer **must read** the existing file first (Zustand store with `cart`, `globalDiscount`, etc.). The two new actions need access to the same product source data the cart already uses — likely passed in from CartPanel useEffects, since the store may not directly hold the source `Product`. **Read the existing tier-evaluation logic in `CartPanel.tsx`** before implementing, then decide where the actions live:

- Option A: Add as posStore actions if the store has access to enough product context.
- Option B: Add as helpers exported from `posStore.ts` that take `(items, productLookup)` and return the new items.

If unclear after reading: status NEEDS_CONTEXT.

- [ ] **Step 1: Read the relevant code**

Read these files end-to-end:
- `frontend/src/store/posStore.ts` — full file
- `frontend/src/components/pos/CartPanel.tsx` lines 80-225 — the auto-tier and caja-restructure useEffects, `buildCajaItem` helper

Understand:
- How is the source `Product` looked up when needed for tier resolution? (Likely a Zustand store of recent products, or a prop passed into CartPanel.)
- How does `buildCajaItem` (or equivalent) restructure a line into a box?

- [ ] **Step 2: Add `applyCajaToAll(productLookup)` action**

Add to the posStore interface:

```ts
applyCajaToAll: (sources: Map<string, ProductWithPricesAndPacks>) => { applied: number; total: number }
restoreAutoTier: () => void
```

(`ProductWithPricesAndPacks` is a structural type matching what's needed: `{ prices?: ProductPrice[], packaging_units?: PackagingUnit[] }`. If a precise type already exists in `types/products.ts`, use it.)

Implement `applyCajaToAll`:

```ts
applyCajaToAll: (sources) => {
  const state = get()
  let appliedCount = 0
  const updated = state.cart.map((item) => {
    const source = sources.get(item.product_id)
    if (!source) return item
    const cajaTier = source.prices?.find((p) => p.linked_package_id != null)
    if (!cajaTier) return applyAutoTierLocal(item, source)

    const cajaMinQty = Number(cajaTier.min_quantity)
    if (!Number.isFinite(cajaMinQty) || cajaMinQty <= 0) return applyAutoTierLocal(item, source)

    // pieces-equivalent of current line
    const piecesQty = item.unit_kind === 'package'
      ? Number(item.quantity) * Number(item.units_per_package ?? 1)
      : Number(item.quantity)

    if (piecesQty < cajaMinQty) return applyAutoTierLocal(item, source)

    // qualifies — restructure as caja
    const linkedPkg = source.packaging_units?.find((pk) => pk.id === cajaTier.linked_package_id)
    const pricePerBox = linkedPkg?.package_price != null
      ? Number(linkedPkg.package_price)
      : Number(cajaTier.unit_price) * cajaMinQty
    const numBoxes = Math.floor(piecesQty / cajaMinQty)

    appliedCount += 1
    return {
      ...item,
      unit_kind: 'package' as const,
      units_per_package: cajaMinQty,
      price: pricePerBox,
      quantity: numBoxes,
      cajaForcedByBulk: true,
    }
  })
  set({ cart: updated })
  return { applied: appliedCount, total: state.cart.length }
}
```

`applyAutoTierLocal` is a helper that mirrors the per-line tier evaluation from `CartPanel.tsx` (selecting the highest-qualifying tier by min_quantity ≤ qty, falling back to base price). Read the existing useEffect and inline that logic into a `function applyAutoTierLocal(item, source) { ... }` near the top of `posStore.ts`. Mark it as not exported.

Implement `restoreAutoTier`:

```ts
restoreAutoTier: () => {
  const state = get()
  const restored = state.cart.map((item) => {
    if (!item.cajaForcedByBulk) return item
    // Reset to piece mode; auto-tier useEffect in CartPanel will re-evaluate next render
    return {
      ...item,
      cajaForcedByBulk: false,
      unit_kind: 'piece' as const,
      units_per_package: undefined,
      // restore qty in pieces
      quantity: item.unit_kind === 'package'
        ? Number(item.quantity) * Number(item.units_per_package ?? 1)
        : item.quantity,
      // reset price to base — auto-tier useEffect will pick correct tier
      price: item.base_price ?? item.price,
    }
  })
  set({ cart: restored })
}
```

If reading the existing code reveals that `unit_kind`, `unit_price`, or `base_price` are managed differently than this plan assumes, adapt to match — the goal is "after restoreAutoTier, the cart is in the same state it would be if the user had never clicked Aplicar caja, and the existing auto-tier useEffect re-evaluates from scratch."

- [ ] **Step 3: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/store/posStore.ts
git commit -m "feat(pos): add applyCajaToAll + restoreAutoTier actions to posStore"
```

---

## Task 3: CartPanel control block

**File:** `frontend/src/components/pos/CartPanel.tsx`

Add a control block below the existing global-discount input. The control has two visual states (A: not applied, B: applied) and shows a live counter.

- [ ] **Step 1: Compute counter inside the component**

Near the top of the component body (alongside other useState/useMemo), add:

```ts
const totalCount = items.length  // adapt: use whatever the cart-items array variable is named
const appliedCount = items.filter((i: any) => i.cajaForcedByBulk === true).length
const cajaModeApplied = appliedCount > 0
```

(Replace `items` with the actual variable name — e.g. `groups`, `cartItems`, etc. Read the file to find it.)

- [ ] **Step 2: Build the product-source lookup**

`applyCajaToAll` needs a `Map<product_id, ProductWithPricesAndPacks>`. Build it from the existing product context CartPanel already has (from the existing tier-evaluation useEffects, which already look up products). If that lookup is itself a Map, reuse it directly. If it's a function, wrap into a Map at click time:

```ts
const productSources = useMemo(() => {
  const m = new Map<string, ProductWithPricesAndPacks>()
  // populate from whatever the existing tier useEffect uses
  return m
}, [/* deps */])
```

Adapt to the actual data flow — the implementer reads first.

- [ ] **Step 3: Insert the control block**

Find the global-discount input block (lines ~718-761). Insert the new control IMMEDIATELY AFTER its closing element (after the global-discount block):

```tsx
{!cajaModeApplied ? (
  <button
    onClick={() => {
      const { applied, total } = applyCajaToAll(productSources)  // get from store via hook
      if (applied === total) {
        toast.success(`Caja aplicada a los ${total} productos`)
      } else if (applied === 0) {
        toast.warning('Ningún producto tiene precio caja disponible')
      } else {
        toast.success(`Caja aplicada a ${applied} de ${total} productos. ${total - applied} quedan en su precio normal.`)
      }
    }}
    disabled={items.length === 0}
    className="w-full rounded-lg px-3 py-2.5 bg-amber-500/5 border border-dashed border-amber-500/25 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-bold flex items-center justify-center gap-2"
    title="Aplica precio caja a todos los productos del carrito que tengan tier caja configurado y cantidad suficiente. Sobreescribe precios manuales."
  >
    <i className="fa-solid fa-box" aria-hidden="true" />
    Aplicar caja a todo
  </button>
) : (
  <div className="w-full rounded-lg px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
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
      onClick={() => restoreAutoTier()}
      className="text-[10px] text-slate-400 hover:text-white underline transition-colors flex-shrink-0"
    >
      Restaurar
    </button>
  </div>
)}
```

`applyCajaToAll` and `restoreAutoTier` are accessed via the existing `usePOSStore` hook. Pull them in alongside other actions:

```ts
const { applyCajaToAll, restoreAutoTier } = usePOSStore()
```

`toast` should already be imported in `CartPanel.tsx` (used for other notifications). If not, add `import { toast } from '../../store/toastStore'`.

- [ ] **Step 4: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/components/pos/CartPanel.tsx
git commit -m "feat(pos): bulk-caja control below global discount with Restaurar undo"
```

---

## Task 4: Manual smoke (no automated test framework)

**Files:** none

This module touches money. Smoke MUST be done before opening PR.

- [ ] **Step 1: Run dev**

```bash
# from repo root, two terminals
source venv/bin/activate
uvicorn app.main:app --reload
# other terminal
cd /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/pos-bulk-caja/frontend
npm run dev
```

- [ ] **Step 2: Smoke walkthrough**

Login as CAJERO. Open `/pos`.

1. Empty cart → button disabled (dashed amber).
2. Scan product A (must have a tier with `linked_package_id`, e.g. caja 12u @ \$480/box). Add qty=12. Button enabled.
3. Scan product B (same caja config 24u @ \$720/box) but with qty=5. Button still enabled.
4. Scan product C (no caja tier). qty=3.
5. Click "Aplicar caja a todo" → expect toast "Caja aplicada a 1 de 3 productos. 2 quedan en su precio normal."
   - Line A: now 1 caja @ \$480 (unit_kind=package).
   - Line B: still qty=5, mayoreo or base.
   - Line C: still qty=3, base.
6. Control turns emerald: "Caja aplicada · 1 de 3 productos · Restaurar".
7. Increase B's qty to 24 manually → existing auto-tier reevaluates and may upgrade B to caja by qty alone (fine; counter unchanged because cajaForcedByBulk false).
8. Click "Aplicar caja a todo" again → counter goes to "2 de 3".
9. Click "Restaurar" → all reset; counter "0 de 3"; control returns to dashed amber.
10. Create sale → backend accepts; printed receipt shows correct caja prices.
11. Edge case: scan product with qty=14 (caja=12) → click bulk → 1 caja, remainder 2 dropped (toast notes; flagged in spec).

If any smoke step fails, **STOP** and fix before opening PR.

---

## Task 5: Push + PR

- [ ] **Step 1: Final build**

```bash
cd /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/pos-bulk-caja
cd frontend && rm -rf dist && npm run build 2>&1 | tail -10
```

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin feat/pos-bulk-caja
gh pr create --base release/qa --head feat/pos-bulk-caja \
  --title "feat(pos): bulk-apply caja prices to cart with explicit Restaurar undo" \
  --body "PR 5 of 5 (LAST) in Cashier Pack. Spec: docs/superpowers/specs/2026-04-29-cashier-pack-pos-bulk-caja-design.md. Plan: docs/superpowers/plans/2026-04-29-pos-bulk-caja.md.

- One-shot button \"Aplicar caja a todo\" below the global discount input.
- Iterates cart, restructuring qualifying lines (caja tier configured + qty ≥ tier.min_quantity) to box mode. Non-qualifying lines fall back to auto-tier.
- Live counter \"X de Y aplicados\" — updates as cart changes.
- Explicit \"Restaurar\" link reverts all bulk-applied lines to auto-tier.
- New CartItem flag cajaForcedByBulk distinguishes bulk-forced caja from qty-driven auto-caja.
- Two new posStore actions: applyCajaToAll(sources) returns {applied, total}; restoreAutoTier() resets and lets the existing auto-tier useEffect re-evaluate.
- Zero backend changes. Backend recomputes prices and validates margin floor on sale creation as today.

Touches money path — extra reviewer rigor. Smoke walkthrough completed (see plan Task 4).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-review

**Spec coverage:**
- §1 Visual control state A/B → Task 3
- §2 Per-line application logic → Task 2 (applyCajaToAll body)
- §3 Bulk action toast feedback → Task 3 (onClick handler)
- §4 restoreAutoTier semantics → Task 2
- §5 Override of manually-forced lines → covered in Task 2 (the new line replaces forced state)
- §6 New cart lines post-click → counter recomputes from current cart, no extra logic needed
- §7 CartItem type extension → Task 1
- §8 File-by-file → matches Tasks 1, 2, 3
- §9 Edge cases → smoke covers in Task 4
- §10 Risks → flagged in this plan; remainder dropping documented in Task 4 step 11

**Placeholder scan:** intentional NEEDS_CONTEXT escalation in Task 2 step 1 ("If unclear after reading"). The implementer reads the file before implementing — the exact data flow for product-source lookup must be verified, can't be hardcoded in the plan without seeing the existing code.

**Type consistency:** `applyCajaToAll(sources)` signature returns `{applied, total}` — matches the click handler in Task 3 step 3. `cajaForcedByBulk` flag added in Task 1 (type), set in Task 2 (`applyCajaToAll`), read in Task 2 (`restoreAutoTier`) and Task 3 (counter).

**Risk note:** The plan calls for the implementer to read `CartPanel.tsx` lines 80-225 first because the auto-tier and caja-restructure useEffects already do similar work — `applyAutoTierLocal` should mirror, not duplicate-with-drift, that logic. If the implementer finds the existing code doesn't factor out cleanly, raise NEEDS_CONTEXT and the controller decides between in-place inline or a refactor (latter widens scope; ideally avoid).
