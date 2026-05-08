# Compact Thermal Ticket — OXXO-style Redesign

**Date:** 2026-04-29
**Owner:** Emmanuel
**Target:** `app/pos_printer.py` — `build_ticket_bytes`, `build_reissued_ticket_bytes`, `build_test_ticket_bytes`, `_generate_image_bytes`
**Goal:** Reduce paper consumption ~50% with an OXXO-style compact layout, while keeping ESC/POS compatibility on 80mm thermal printers.

---

## Motivation

Current ticket consumes 22-28 lines per sale. The header alone takes 7-10 lines (logo, razón social, dirección, RFC, régimen, fecha, sucursal, "NOTA DE VENTA"). Products often wrap to 2 lines because the unit price is appended to the name. Footer takes 4-5 lines. Total: 25-30 cm of paper per sale on a busy POS.

Goal: ≤14 lines for a typical sale. Estimated savings: 45-55% paper per ticket.

---

## Layout (80mm, ESC/POS Font B, 56 cols)

```
[LOGO — centered, 1/3 of ticket width]
RMAZH | EL MUNDO DE LA TAZA
Centro CDMX | 5512312345
29/04/26 17:21 | A-771 | Maria
--------------------------------------------------------
30x TAZA MOD 125-5                    @35.00     1050.00
--------------------------------------------------------
SUBTOTAL:                                        1050.00
IVA:                                                0.00
TOTAL:                                           1050.00      <- bold
EFECTIVO  REC:1500.00  CAM:450.00
Gracias por su compra | rmazh.mx
```

The compactness comes from collapsing **vertical lines** (3-line header,
1-line products, 1-line payment), **not** from narrow columns. Using the
full printable width keeps product names readable.

**Width math:**

| Paper | cols | qty | name | unit | total | label / value |
|-------|------|-----|------|------|-------|---------------|
| 80mm  | 56   | 4   | 32   | 8    | 12    | 40 + 16       |
| 58mm  | 32   | 4   | 12   | 8    | 8     | 20 + 12       |

---

## Header rules

3 lines maximum (after the logo):

1. **Org name** — `{organization.name}` centered. If the org has a `legal_name` distinct from `name`, prepend it as `{legal_name_short} | {name}` only when both fit in 42 cols; otherwise keep just `name`.
2. **Branch + phone** — `{branch.city or branch.name} | {branch.phone or organization.phone}`. If no phone, just the city/branch segment. If no branch (HQ-direct sale), use `organization.address`'s city portion if available, else skip the line.
3. **Date + ticket + cashier** — `DD/MM/YY HH:mm | {series}-{folio} | {cashier_first_name}`. Cashier is the first token of `current_user.username` (split on space/dot).

Dropped from header by default:
- Razón social / legal name
- Address (full street)
- RFC, régimen fiscal
- "NOTA DE VENTA" line
- Per-line `Sucursal:` / `Tel:` / `Fecha:` labels

**Logo:** Always rendered at **1/3 of the printable width** (192 px @ 80mm out of 576-dot paper, 128 px @ 58mm out of 384-dot paper). Both dimensions are byte-aligned multiples of 8. If the logo is wider, scale down preserving aspect ratio; if narrower, scale **up** so all branches look uniform.

**Centering** the logo cannot rely on `ESC a 1` — many cheap thermals ignore that command for raster images and print from the left edge. The implementation pads the bitmap to the **full paper width** (576 / 384 dots) with empty pixels on the left so the actual logo data sits centered within the canvas. The pad offset is byte-aligned.

---

## Product line rules

- One line per product when name fits. Truncate names to the column width (32 chars on 80mm, 12 on 58mm) — no ellipsis, clean cut.
- 80mm format: `{qty:<4}{name:<32}{unit:>8}{total:>12}` = 56 cols.
- 58mm format: `{qty:<4}{name:<12}{unit:>8}{total:>8}` = 32 cols.
- `qty` always renders as `Nx ` (e.g. `30x `, `1x  `, `2x  `). Decimals: `1.5x` → 4 chars exact.
- `unit` is always shown including for `qty == 1` (consistent column alignment, OXXO style). Format `@PRICE`.
- Negative qty (returns) prefixes a minus: `-1x ` and a `-` on totals.

Returned items (when reprinting after a refund):
- 1 line per refunded item, prefixed `- DEVUELTO`:
  ```
  - DEVUELTO 1x PLATO ESPECIAL      -120.00
  ```
- The original positive product lines remain unchanged.
- The `SUBTOTAL` / `IVA` / `TOTAL` block reflects the **net** amount, computed at print time as `sale.total_amount - sum(returns.refund_amount)`. (`sale.total_amount` stores the original total; nets are computed in-place by the printer, same as today.)
- Drop the current `--- DEVOLUCIONES ---` / `Total Devuelto` / `TOTAL NETO` summary block.

---

## Totals block (4 lines)

```
SUBTOTAL:                         1050.00
IVA:                                 0.00
TOTAL:                            1050.00
{METHOD}  REC:{paid}  CAM:{change}
```

- `TOTAL` line in **bold** (`ESC E 1` / `ESC E 0`).
- IVA line is always shown, even when 0.00, for legal clarity.
- `SUBTOTAL` no longer shows the article count (`(15 art.)`) — moved to header line 3 implicitly via folio.

**Payment line:**
- Single payment: `EFECTIVO  REC:1500.00  CAM:450.00` on one line.
- Mixed payments (≥2): one line per method. Last method carries the change. Example:
  ```
  EFECTIVO  REC:500.00
  TARJETA   REC:550.00  CAM:0.00
  ```
- `REC:` (recibido) and `CAM:` (cambio) are abbreviated, no decimals dropped.
- Method names mapped: `CASH→EFECTIVO`, `CARD→TARJETA`, `TRANSFER→TRANSFER`, `STORE_CREDIT→CREDITO`, etc.
- Drop the legacy `Pagado:` / `Cambio:` rows from the totals block.
- Drop the `--- Pagos ---` separator and `Ref:` lines for now (deferred — out of scope).

---

## Footer (1 line)

`{org.ticket_footer or "Gracias por su compra"} | rmazh.mx`

If `is_reprint=True`, prepend the line `*** REIMPRESION ***` immediately above the footer. Drop:
- `Software: Atlas ERPPOS`
- Standalone `www.rmazh.mx` line
- `*** COPIA - REIMPRESION ***` legacy form
- Sale notes block (`sale.notes`) — out of scope; if needed, a future "modo detallado" surfaces it.

After the footer: `LF * 3` then `CUT`. If `open_drawer=True`, send drawer command before the cut (unchanged from current).

---

## ESC/POS commands (unchanged from current `CMD` dict)

- `RESET` (`ESC @`), `INIT`
- `FONT_B` (`ESC M 1`) — set as default at top of ticket
- `BOLD_ON` / `BOLD_OFF` — only around `TOTAL:` line
- `CENTER` / `LEFT` — center logo + header lines 1-3, left-align everything else
- `CUT`, `DRAWER`, `LF` — unchanged

No new commands. The redesign is pure layout reshuffling within existing primitives.

---

## Affected functions

| Function | Change |
|---|---|
| `build_ticket_bytes` | Full rewrite of header/products/totals/footer per layout above. |
| `build_reissued_ticket_bytes` | Same layout; "REIMPRESION" marker forced. |
| `build_test_ticket_bytes` | Use the same layout with sample data. |
| `_generate_image_bytes` | Scale logo to 1/3 of paper width (192 px @ 80mm, 128 px @ 58mm) — both up and down — preserving aspect ratio. Then pad the bitmap to the full paper width (576 / 384 dots) with empty pixels on the left, byte-aligned, so the printer renders it centered regardless of whether it honors `ESC a 1`. |
| `cols` attribute | Stays at **56** for ≥70mm, **32** for <70mm. (Same as before, but now actually used — the prior compact draft narrowed to 42 and wasted ~14 chars of paper.) |

---

## Out of scope (deferred)

- **Configurable modes** (`compacto` / `normal` / `detallado`) — the spec mentions these but explicit instruction was "posteriormente". This redesign IS the new "compacto" default; modes come later.
- **`organization.ticket_show_tax_id` flag** to optionally print RFC/régimen for tax-invoice flows. Will be added in a follow-up when invoice printing is needed.
- **Multi-payment `Ref:`** detail lines — preserved data, not printed.
- **Sale notes** in footer.
- **Cash-cut ticket** (`build_cash_cut_bytes`) — separate ticket, different layout, not part of this redesign.

---

## Testing strategy

1. **Visual regression** via byte-snapshot tests in `tests/test_ticket_format.py`:
   - Single-line sale, 1 cash payment.
   - Multi-line sale (5 items), 1 card payment.
   - Sale with one refunded item (reissued ticket).
   - Mixed payment (cash + card).
   - Long product name (>20 chars) → truncation behavior.
   - Reprint flag set → `*** REIMPRESION ***` shown.
2. **Manual smoke** on the 80mm USB Epson at HQ: print the 6 cases above and visually verify column alignment, bold on TOTAL, logo size ≈27mm wide.
3. **DataXPOS preset must remain functional** — existing tests in `tests/test_excel_logic.py` and `tests/stress_test.py` should still pass (those don't exercise the printer directly but validate the sale model the printer reads from).

---

## Rollout

- Single PR against `release/qa`.
- Ship without a feature flag — the new format replaces the old one immediately. Cashiers will see shorter tickets on next print.
- If a tenant complains about missing RFC/address on the ticket, fast-follow with the `ticket_show_tax_id` flag.
