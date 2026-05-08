# Release — Cajero Pack Stable (2026-04-30)

**Feature tag**: `v2026.04.30-cajero-stable` (anchored at `45d37a12` initially, post-docs at `a79d9393`)
**Milestone tag**: `milestone-2026.04.30` → `a79d9393` — multi-branch alignment hito
**Commit**: `a79d9393`
**Branches**: `release/qa`, `release/beta`, `release/production`, `main` — **all aligned**
**Status**: shipped to all four branches. Production live as of ~00:30 CST 2026-04-30 (FF after user override of the soak gate). Soak watcher remains active as a divergence detector.

---

## What changed

This release closes the 2026-04-29 cajero/sucursal audit. Three waves of fixes plus the OXXO ticket redesign and the print-agent restructure landed on top of the cashier pack v1+v2.

### Backend

**RBAC / branch isolation** (hotfix, commit `c539ac1`):
- `/api/sales/{id}` no longer returns sales from another branch (CRIT C-2 — was a TODO with `pass`).
- `/api/sales/by-folio/{series}/{folio}` (CRIT C-3) — same fix.
- `/api/sales/{id}/print-view` (CRIT C-4) — same fix.
- `/api/sales/export/csv` (CRIT C-1) — branch users now get only their branch.
- `/api/printer/{print-ticket, reprint-ticket, reprint-refunded}` (C-4) — non-HQ users can only target sales of their own branch.
- New helpers in `app/routers/sales.py`: `_is_hq_role`, `_assert_sale_branch_access`. Branch user attempting cross-branch read gets 404 (not 403) to avoid leaking existence.

**Money trust** (wave 1, commit `c7cd419`):
- `/api/sales` (POST) recomputes `expected_total` from server-side line items and validates `sum(payments.amount)`:
  - Insufficient pay (< expected − $0.01) → **422** "Pagos insuficientes …".
  - Sobrepago > 10× total → **422** "Sobrepago anómalo, revisa el monto".
  - Discrepancy >$0.01 within band → accepted but logged as `PAYMENT_DISCREPANCY` warning with user, branch, sale id.
- New optional field `global_discount_pct: Decimal (0-50)` in `SaleCreate`. Persisted on `SalesDocument.global_discount_pct` for audit (NOT enforced — frontend still applies the factor client-side).
- Branch users (CAJERO, GERENTE, VENDEDOR) **must** have an open `CashSession` to create any sale; the prior `if payments` gate let credit-only sales through (H-5).

**State machine integrity** (wave 1):
- Parked tickets (`ParkedTicket`) gain a `status` enum (`ACTIVE` / `CONVERTED`) and a `converted_to_sale_id` FK. On sale create from a parked source, the parent is marked `CONVERTED` atomically. Resuming a `CONVERTED` ticket returns **410 Gone** (M-3).
- `/api/cash/close` rejects with **409** when the closing session has un-converted parked tickets owned by the same user opened during the session window (H-7).

**Returns integrity** (wave 1):
- `crud.approve_return()` now requires `organization_id`, applies it to the SELECT, and uses `SELECT ... FOR UPDATE` so concurrent approvals serialize. Idempotent: re-approving an already-`APPROVED` return returns the existing record without re-writing inventory/cash (H-3, H-4).
- After approve, the parent `SalesDocument`'s `subtotal`, `tax_amount`, `total_amount` are **recomputed and persisted** so finance reports match printed tickets. Pro-rata tax across sequential approvals is consistent (M-2).
- All inventory-movement quantities are pure Decimal end-to-end (M-4).

**OXXO ticket redesign** (separate, earlier in the day on 2026-04-29):
- `app/pos_printer.py` rewritten to a 56-col compact layout: 3-line header, 1 product per line, bold `TOTAL`, single payment line `EFECTIVO REC:X CAM:Y`. Logo always at 1/3 paper width, manually centered (576-dot canvas pad). 11 lines for a 1-product cash sale (was ~25).
- Reissued + test tickets share the same compact helpers.

### Frontend

**Sale payload** (wave 2, commit `45d37a1`):
- `POS.tsx` now sends `global_discount_pct` and `parked_ticket_id` so the wave-1 backend fields are exercised (H-2 frontend half).
- `forcedPriceTier` added to `CartItem`; `posStore.setForcedTier()` action persists it; `CartPanel` rebuilds the `forcedPrices` Map from the cart on every change so a parked ticket's manual price override survives park/resume (H-6).

**Cart UX**:
- `editingPrice` / `editingDiscount` / `editingQty` collapsed into a single `{ key, mode }` state — opening one closes the others (M-7).
- `PricePickerPopover` now listens for scroll on every scrollable ancestor of the trigger, so popover stays anchored when the cart panel itself scrolls (L-4).
- Print-agent failures show a toast distinguishing "ticket guardado pero no se pudo imprimir" from backend errors (L-3).

**Cockpit**:
- `MovementModal` accepts an `onMovementSuccess` callback and `Cockpit` exposes its dashboard loader via `useCallback` so movements trigger a refresh. Note: today's tree renders `MovementModal` under `CashBranchView`, not under `Cockpit`, so cross-page refresh still needs a separate signal — out of scope for this release (M-5 partial).
- `OpenShiftModal` synchronous `submittingRef` guard prevents double-open under high latency (M-6).

### Print agent

- `tools/print_agent/` restructured: only `impresora_win.bat`, `impresora_linux.sh`, `impresora_mac.sh` visible at root. All Python + service files moved to `core/`.
- Windows `.bat` rewritten in pure ASCII — fixes the "ora", "shell", "NV_DIR" parser errors caused by multi-byte UTF-8 in the previous file.

---

## Database migrations (applied on first deploy)

All idempotent. None scan rows; they are `ALTER TABLE ADD COLUMN` with defaults.

| Table | Column | Type | Default |
|---|---|---|---|
| `sales_documents` | `global_discount_pct` | `NUMERIC(5,2)` | 0 |
| `parked_tickets` | `status` | `VARCHAR(16)` NOT NULL | `'ACTIVE'` |
| `parked_tickets` | `converted_to_sale_id` | `VARCHAR(36)` REFERENCES `sales_documents(id)` | NULL |

Plus the migrations from the cashier pack (cash sessions, branches, etc.) which already ran when the pack first reached qa/beta.

---

## API contract changes (callers should know)

| Endpoint | Old | New |
|---|---|---|
| `POST /api/sales` (insufficient pay) | sometimes silently accepted | **422** with detail message |
| `POST /api/sales` (overpay > 10× total) | accepted | **422** "Sobrepago anómalo" |
| `POST /api/sales` (no open session, branch user) | accepted if `payments=[]` | **409** "Debes abrir caja antes de registrar ventas" |
| `POST /api/sales/parked/{id}/resume` (already CONVERTED) | accepted | **410 Gone** |
| `POST /api/cash/close` (with active parked tickets) | accepted | **409** with count |
| `GET /api/sales/{id}` (cross-branch by CAJERO) | returned | **404** |
| `GET /api/sales/by-folio/...` (cross-branch) | returned | **404** |
| `GET /api/sales/{id}/print-view` (cross-branch) | returned HTML | **404** |
| `GET /api/sales/export/csv` (CAJERO) | full org CSV | **branch only** |
| `POST /api/printer/{print,reprint}-ticket/{id}` (cross-branch) | printed | **404** |
| `POST /api/printer/reprint-refunded/{id}` (cross-branch) | printed | **404** |

**New optional payload fields** on `POST /api/sales`:
- `global_discount_pct: Decimal (0-50)` — for audit. >50 → **422**.
- `parked_ticket_id: string` — when set, marks the parked ticket CONVERTED atomically.

`crud.approve_return()` signature now requires `organization_id`. Anything calling it directly (CRUD imports outside `app/routers/returns.py`) must pass it.

---

## Known limitations / pending follow-ups

These are intentionally deferred. Tracked in `docs/superpowers/audits/2026-04-29-cajero-branch-audit.md`.

- **L-1** sale rejects only > 10× overpayment; finer fat-finger check (e.g. > $10k) is not in.
- **L-2** reprint counter race — improvable with `UPDATE … SET count = count + 1` server-side; today uses ORM increment.
- **N-1** popover width fixed at 300 px; cuts off below 320-px viewports (cashiers use 10" tablets so non-issue).
- **M-5 cross-page** — Cockpit refetch only fires when MovementModal lives under it; the production tree has it under CashBranchView. A Zustand counter would close the loop; deferred.

---

## Smoke checklist after Railway autodeploy

1. **Health**: `curl -fsS https://<beta-host>/api/health` → 200.
2. **POS sale (cash, single item)**: total 1-product cash sale prints with the new compact layout (see `docs/superpowers/specs/2026-04-29-compact-thermal-ticket-design.md`).
3. **Mixed payment**: 2-method sale prints stacked payment lines; `cash + card = total ± $0.01` validated server-side.
4. **Park + resume**: create a sale, park, resume, sell. Verify the parked record is CONVERTED in DB.
5. **Cross-branch attempt**: log in as CAJERO at branch A, try `GET /api/sales/{id_from_branch_B}` → 404.
6. **Return**: approve a partial return; verify `SalesDocument.subtotal` / `tax_amount` / `total_amount` decreased by net refund.
7. **Cash close with parked**: park a ticket, attempt to close the session → 409.
8. **Discount/caja buttons**: amber for descuento, indigo for caja — distinct in dark mode.
9. **Popover**: tap `{price}/u` on a cart line, scroll cart while open, popover follows the trigger (does not float in space).

---

## Rollback

Single command:

```bash
git checkout release/beta
git reset --hard fc6df18                # pre-promotion tip from 2026-04-29 (before the cashier-pack push)
git push --force-with-lease origin release/beta
```

Or, less destructively, roll back to the **2026-04-29 cashier-pack tag**:

```bash
git push --force-with-lease origin v2026.04.29-cashier-pack^{commit}:refs/heads/release/beta
```

DB columns added by the migrator stay (they're harmless with the old code — defaults are pre-feature behavior).

See the runbook at `docs/superpowers/runbooks/2026-04-30-cajero-pack-runbook.md` for symptom-driven mitigations.
