# POS Price Picker — Inline → Popover

**Date:** 2026-04-29
**Owner:** Emmanuel
**Target:** `frontend/src/components/pos/CartPanel.tsx` (cart line 432-507)
**Goal:** Replace the cramped inline price selector with a touch-friendly floating popover so cashiers on tablets can pick a tier or set a free price without expanding the cart row.

---

## Motivation

The current "Elegir precio" panel:
- Lives inside the cart row → opening it pushes the rest of the cart down.
- Uses 9-10 px fonts and 24 px button heights → impossible to hit reliably on a touchscreen.
- Mixes Menudeo button + tier list + free-price input + reset-to-auto in a 75-line block (`CartPanel.tsx:432-507`) — the row gets visually crowded the moment it opens.

A popover separates the picker from the cart row, lets us size buttons for fingers, and keeps the cart layout stable.

---

## UX

Trigger stays the same: the `{price}/u` button on the cart row (`CartPanel.tsx:615-623`). On click, a popover anchored to the trigger replaces the inline panel.

```
┌─ Elegir precio              ✕ ┐
├──────────────────────────────┤
│ Menudeo               $35.00 │
│ Mayoreo  (≥6pz)       $30.00 │
│ Caja     (≥30pz)      $25.00 │  ← active tier: indigo ring
├── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ Precio libre $ [____] Aplicar │
├──────────────────────────────┤
│ ↺ Volver a precio automático │  ← only when isForcedPrice
└──────────────────────────────┘
```

**Sizes**:
- Width: 300 px (fixed). Mobile/narrow viewports: clamp to `min(300, viewport_width - 32)`.
- Tier/Menudeo buttons: **48 px** tall, 14 px font for label + 16 px font for price.
- Libre input + Aplicar: 48 px row.
- Reset row: 36 px.
- Overall height auto; cap at `viewport_height - 80` with internal scroll (rare: typical product has ≤5 tiers).

**Visual style**: matches the existing dax tokens (`--dax-elevated`, `--dax-card`, `--dax-text`, etc.). Indigo accent for active tier ring (matches the badge already shown on the cart line). Amber accent for the reset row (matches the forced-price badge convention).

---

## Positioning

Anchored to the trigger button via `getBoundingClientRect()`:
- Primary: opens **below** the trigger, left edge aligned with the trigger's left edge.
- Fallback: if the popover would extend past `viewport_height - 16`, opens **above** with bottom edge aligned to the trigger's top.
- Horizontal clamp: shift left if right edge would exceed `viewport_width - 16`.

Re-evaluate position on `resize` and `scroll` (capture phase, passive). Recompute after the popover renders if its measured height differs from the estimate.

No third-party positioning library. We need exactly one popover; @floating-ui/dom is overkill.

---

## Interactions

| Action                         | Result                                                |
|--------------------------------|-------------------------------------------------------|
| Click a tier / Menudeo button  | Apply price + close popover                           |
| Type in libre + press Enter    | Apply free price + close popover                      |
| Type in libre + click "Aplicar"| Apply free price + close popover                      |
| Click outside the popover      | **Close without applying**                            |
| Press Esc                      | **Close without applying**                            |
| Click ✕ in header              | Close without applying                                |
| Click "Volver a auto" (reset)  | Reset to auto-tier + close                            |
| Click the trigger again        | Close (toggle behavior)                               |

The libre input keeps the value the user typed even after closing, so re-opening preserves the in-progress entry. (Existing `priceInput` state already does this.)

---

## Component contract

New file: `frontend/src/components/pos/PricePickerPopover.tsx`.

```tsx
type Props = {
  open: boolean
  triggerRef: React.RefObject<HTMLElement>
  basePrice: number                    // for "Menudeo"
  currentPrice: number                 // active price on the cart line
  tiers: Array<{                       // unitItem.prices, already loaded
    id: string
    price_name: string
    unit_price: number
    min_quantity: number
  }>
  isForced: boolean
  onSelectTier: (unit_price: number, tier_name: string) => void
  onSelectFree: (unit_price: number) => void
  onResetToAuto: () => void
  onClose: () => void                  // click-outside / Esc / ✕
}
```

The popover **does not** own the `priceInput` state — it lifts up to CartPanel (existing) so the value persists across open/close cycles.

Render via `createPortal(<div>…, document.body)` to escape the cart's overflow/transform stacking context. The portal mounts once when `open=true`; click-outside detection uses a `mousedown` listener on `document` filtered by ref.

---

## CartPanel changes

1. One shared `activeTriggerRef = useRef<HTMLButtonElement | null>(null)`. Only one popover is ever open at a time, so we don't need a ref-per-row collection. The trigger button calls `(el) => { if (editingPrice === priceKey) activeTriggerRef.current = el }` as its `ref` callback so the ref points at the currently-open row.
2. No visual change to the trigger (still the existing `{price}/u` button at line 615-623).
3. Replace the inline block (`CartPanel.tsx:432-507`) with:
   ```tsx
   <PricePickerPopover
     open={editingPrice === priceKey}
     triggerRef={triggerRef}
     basePrice={unitItem?.base_price ?? unitItem!.price}
     currentPrice={unitItem!.price}
     tiers={unitItem!.prices ?? []}
     isForced={isForcedPrice}
     onSelectTier={(price, name) => applyPrice(priceKey!, price, name)}
     onSelectFree={(price) => applyPrice(priceKey!, price, 'Libre')}
     onResetToAuto={() => resetToAuto(priceKey!)}
     onClose={() => setEditingPrice(null)}
   />
   ```
4. The libre input stays controlled by `priceInput` lifted to CartPanel (already exists).

Net diff in CartPanel: ~ −75 LOC (inline block) +20 LOC (popover invocation + ref). New file ~ 180 LOC.

---

## State / behavior preserved

- `editingPrice` semantics unchanged — null vs cart_key, mutually exclusive with `editingDiscount`.
- `forcedPrices` map unchanged — still set/cleared by `applyPrice` and `resetToAuto`.
- Auto-tier logic (`forcedPrices.has(cartKey) ? skip : recompute`) unchanged.
- Caja-button auto-restructure unchanged.

---

## Out of scope

- Animation polish beyond a 120 ms opacity fade.
- Mobile virtual keyboard layout adjustments — rely on OS default.
- Adding new tier shortcuts (e.g. quick "Caja" toggle) — those already exist on the cart row.
- Keyboard navigation between buttons (Tab works because they are `<button>`s; arrow-key navigation is YAGNI for a 5-button list).

---

## Testing strategy

1. **Manual smoke** on the dev server:
   - Single-tier product (only Menudeo) → opens, no tier list, libre + reset visible.
   - Multi-tier product (Menudeo + Mayoreo + Caja) → opens, all three buttons render, active one has ring.
   - Forced price → reset row visible; clicking it returns to auto.
   - Libre input → typing + Enter applies; typing + click outside discards.
   - Cart with 8+ rows → opening the picker on the last row positions the popover **above** the trigger.
   - Esc closes without applying.
2. **No regression** on the existing flows: Caja button still toggles; descuento editor still opens; remove-line button still works.

No new automated tests — the cart-level behavior is already exercised by the existing POS smoke runs.

---

## Rollout

Single commit on `release/qa`. No flag — the popover replaces the inline picker immediately. Cashiers see a slightly larger price selector on next page load.
