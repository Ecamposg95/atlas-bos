# CAJERO / Branch-Level Audit — 2026-04-29

**Status**: closed 2026-04-30. Released as `v2026.04.30-cajero-stable` (commit `45d37a12`). See `docs/superpowers/releases/2026-04-30-cajero-pack-release.md` for the release notes and `docs/superpowers/runbooks/2026-04-30-cajero-pack-runbook.md` for the mitigation runbook.

**Scope**: Bug & RBAC audit for the `CAJERO` role at branch context. Backend (`app/routers/{sales,cash,returns,products,printer}.py`, services, CRUD) + frontend (`pages/pos/POS.tsx`, `components/pos/*`, `components/branch/*`, `store/posStore.ts`).

**Methodology**: 3 Explore agents in parallel — backend isolation/RBAC, money math/state machines, frontend trust/UI. Critical findings spot-verified by reading the source.

---

## Summary

| Severity | Count | Closed | Open |
|---|---|---|---|
| **CRIT** | 4 | 4 ✅ | 0 |
| **HIGH** | 7 | 7 ✅ | 0 |
| **MED** | 7 | 6 ✅ | 1 (M-1 was false positive — Role inherits str-Enum so the existing comparison works) |
| **LOW** | 5 | 2 ✅ | 3 (L-1, L-2 deferred; L-5 closed transitively by C-3) |
| **NIT** | 2 | 0 | 2 |

**Closed in commits**: `c539ac1` (hotfix CRIT block), `c7cd419` (wave 1 backend), `45d37a1` (wave 2 frontend).

---

## CRITICAL

### ✅ C-1 — `/sales/export/csv` leaks every sale of the org to any CAJERO  *(fixed `c539ac1`)*
**File**: `app/routers/sales.py:972-1011`
**Status**: **verified by reading**
**Issue**: The handler filters by `organization_id` only. There is no branch-scoping check. A CAJERO at branch 1 calling `GET /api/sales/export/csv` receives a full CSV of every sale at every branch in the same org.
**Fix**: Apply the same role-aware branch filter that `read_sales()` uses (around line 204-217) before the `.all()` at 1011 — admins/HQ pass through, anyone else gets `query.filter(SalesDocument.branch_id == current_user.branch_id)`.
**Effort**: S

### ✅ C-2 — `/sales/{sale_id}` has a TODO comment with `pass` that became permanent  *(fixed `c539ac1`)*
**File**: `app/routers/sales.py:777-797`
**Status**: **verified by reading**
**Issue**: Literal source: `# Permitir si es admin/gerente, restringir si es cajero de otra sucursal? / # Por ahora lo dejamos pasar o lanzamos 403. / pass`. The endpoint returns sales from any branch of the same org. CAJERO at branch A can view sales of branch B by guessing/iterating IDs.
**Fix**: Replace the `pass` with `if current_user.branch_id and sale.branch_id != current_user.branch_id and current_user.role not in (Role.ADMINISTRADOR, Role.DUEÑO): raise HTTPException(403, ...)`. Same pattern fixes C-3 and C-4.
**Effort**: S

### ✅ C-3 — `/sales/by-folio/{series}/{folio}` no branch isolation  *(fixed `c539ac1`)*
**File**: `app/routers/sales.py:599-610`
**Issue**: Same shape as C-2; folios are predictable (series + ascending integer) so this is the easier-to-exploit variant.
**Fix**: Add the same branch check used in the proposed C-2 fix.
**Effort**: S

### ✅ C-4 — `/sales/{sale_id}/print-view` no branch check + reprint via printer router  *(fixed `c539ac1`)*
**File**: `app/routers/sales.py:799-812` and `app/routers/printer.py:225` (`/reprint-ticket/{id}`)
**Issue**: Print-view renders the full HTML ticket for any sale in the org. `/reprint-ticket/{id}` likewise resends ESC/POS bytes for any sale; a CAJERO can reprint another branch's ticket on their printer. Customer data + the implicit confirmation that the sale exists both leak.
**Fix**: Apply the C-2 branch check on both endpoints. The reprint counter increment should run only after the branch check passes.
**Effort**: S

---

## HIGH

### ✅ H-1 — Backend trusts client-supplied `payment.amount` without recompute  *(fixed `c7cd419`)*
**File**: `frontend/src/pages/pos/POS.tsx:158-167` (client) and the corresponding server endpoint in `app/routers/sales.py` (sale create)
**Issue**: Cashier-entered amounts in `CashPaymentModal` and `MixedPaymentModal` are sent directly as `{method, amount}` payloads. Server must recompute the expected total from `items` (with per-line discount + global discount applied) and reject if `sum(payments.amount) - change < total - tolerance`. Without that gate, a malicious or confused cashier can record any "received" amount.
**Fix**: Server-side validation in the sale create handler: recompute total, sum payments, compare with ±0.01 tolerance, reject 422 if mismatch. Log discrepancy with `device_id` for audit. Frontend already has the right shape; no UI change needed.
**Effort**: M

### ✅ H-2 — Global discount applied client-side and not echoed to the server  *(backend `c7cd419`, frontend `45d37a1`)*
**File**: `frontend/src/pages/pos/POS.tsx:105-139`, `frontend/src/components/pos/CartPanel.tsx:676-730`
**Issue**: `gdFactor = 1 - globalDiscount/100` is multiplied into each `unit_price` before send. The discount value itself never reaches the API, so the server can't audit "was a discount applied", reproduce the calc, or enforce a max-discount policy. Combined with H-1, an inflated cart can hide as a discount.
**Fix**: Add `global_discount_pct: number` to the create-sale payload. Server applies the same factor, validates the resulting unit prices against the catalog. Persist the percentage on the sale record (new column or reuse an existing meta field) so reports can split discounted vs full price.
**Effort**: M (frontend + backend + small migration)

### ✅ H-3 — `crud.approve_return()` does not filter by `organization_id`  *(verified + fixed `c7cd419`)*
**File**: `app/crud/returns.py:110` (per Agent A)
**Issue**: Function takes only `return_id, supervisor_id`. If a return ID leaks across orgs (Agent A flagged this as architecturally weak), approving it would credit cash to the wrong org's session.
**Status**: **needs verification** — Agent A claimed this; I have not opened the CRUD file in this audit.
**Fix**: Require `organization_id` in the function signature; filter the SELECT and the cash-movement creation. Or do the validation upstream in the router and pass an org-scoped query.
**Effort**: S

### ✅ H-4 — Multiple-approve race on `SaleReturn`  *(fixed `c7cd419`)*
**File**: `app/crud/returns.py:110-124`
**Issue**: `approve_return()` checks status outside a row-level lock, then runs inventory + cash-movement writes. Two concurrent approvals can both pass the status check (when the first hasn't committed) and double-credit inventory + cash.
**Fix**: `SELECT ... FOR UPDATE` on the return row at the top of `approve_return`; or add a unique constraint that prevents two `APPROVED` rows for the same return. The latter is cheaper and idempotent on retry.
**Effort**: S

### ✅ H-5 — Sales without `cash_session_id` accepted when `payments` is empty  *(fixed `c7cd419`)*
**File**: `app/routers/sales.py:276-291`
**Issue**: The "must have an open session" guard only fires when `sale_in.payments` is truthy. A CAJERO creating a fully-credit sale (zero payments) bypasses it; the resulting `SalesDocument.cash_session_id = NULL`. Later returns or reconciliation can't link the sale to a session.
**Fix**: Tighten the guard to "any sale during business hours by a branch user must have an open session", regardless of payments. If the credit-sale flow is intentional, add `status=DRAFT` for unfinalized sales and only require session for `PENDING/COMPLETED`.
**Effort**: S

### ✅ H-6 — Forced price flag lost on parked-ticket resume  *(fixed `45d37a1`)*
**File**: `frontend/src/components/pos/CartPanel.tsx:57` (`forcedPrices` Map state) + parked ticket payload
**Issue**: `forcedPrices` is local React state in CartPanel. When a ticket is parked, only `cart` items are serialized; the "this price was manually overridden" flag is dropped. After resume, auto-tier recalculation can overwrite the manual price as the cashier adjusts qty.
**Fix**: Add `forcedPriceTier?: string | null` to `CartItem`. Serialize it as part of the parked cart_json. On hydrate, rebuild the `forcedPrices` Map from items where `forcedPriceTier` is set. Auto-tier loop already respects "skip if cart_key in forcedPrices" — this fix lets the skip work after a resume.
**Effort**: M

### ✅ H-7 — Cash session can be closed with parked tickets pending  *(fixed `c7cd419`)*
**File**: `app/routers/cash.py:105-141`
**Issue**: `_apply_close_to_session()` doesn't query for un-converted parked tickets owned by the closing user / session. A cashier can close their shift with N parked carts still alive, then on next shift those tickets reference stale session/cash context.
**Fix**: Before close, count parked tickets with `cash_session_id == session.id AND status='ACTIVE'`. If > 0, raise 409 with the count. Optionally: auto-convert tickets >8h old to ARCHIVED so they don't block close.
**Effort**: M

---

## MEDIUM

### ⚠️  M-1 — `/cash/branch-summary` role check compares Role enum to string  *(false positive — `Role` inherits `str, Enum` so `in (...)` works correctly)*
**File**: `app/routers/cash.py:552`
**Issue**: `if current_user.role not in ("ADMINISTRADOR", "DUEÑO", "GERENTE")` — Role is an enum, the values are strings, but Python's `in` checks identity for enums. This check **always** evaluates as "not in" (because `Role.ADMINISTRADOR != "ADMINISTRADOR"` for enum values that aren't pure str), so the gate is effectively bypassed — every authenticated user passes.
**Fix**: Compare Role enum members directly: `if current_user.role not in (Role.ADMINISTRADOR, Role.DUEÑO, Role.GERENTE)`. Audit other routers for the same pattern.
**Effort**: S

### ✅ M-2 — IVA recomputed on the printed ticket, not on the DB row  *(fixed `c7cd419`)*
**File**: `app/pos_printer.py:185-187` (compact ticket recompute) vs `SalesDocument.tax_amount` in DB
**Issue**: After approval of returns, the ticket prints `net_subtotal / net_tax / net_total` correctly via pro-rata math at print time, but `SalesDocument.tax_amount` and `subtotal` in the DB remain at original (pre-return) values. Tax reports that sum these columns inflate.
**Fix**: Two options. (a) On return approval, update the parent `SalesDocument.subtotal` and `tax_amount` to net. (b) Document the column semantics and have all reports subtract `SUM(return_items)` per period. (a) is cleaner; (b) is less invasive.
**Effort**: M

### ✅ M-3 — Parked tickets not deleted/marked after resume → conversion  *(fixed `c7cd419` — status enum + 410 on resume)*
**File**: `app/routers/sales.py:737-754` (or wherever parked-resume + sale-create lives)
**Issue**: The parked-ticket record persists after the resumed cart is sold. A cashier hitting back-button or double-clicking can resume the same parked ticket twice and create two sales. Reconciliation: "two folios, one parked" doesn't match.
**Fix**: When a sale is created from a parked source, mark the parked record `CONVERTED` (or delete) in the same transaction as the sale insert. Reject resume if status != ACTIVE.
**Effort**: S

### ✅ M-4 — Float in the inventory-movement write on returns  *(fixed `c7cd419`)*
**File**: `app/crud/returns.py:157` (per Agent B)
**Issue**: `qty_after = float(qty_before) + float(item.quantity)`. Decimal stock with fractional values drifts via repeated float coercions.
**Fix**: Keep Decimal end-to-end: `qty_after = qty_before + item.quantity`.
**Effort**: S

### ◑ M-5 — Cockpit KPIs stale after MovementModal action  *(callback prop wired in `45d37a1`; cross-page CashBranchView refresh deferred)*
**File**: `frontend/src/components/branch/Cockpit.tsx:11-51`, `MovementModal.tsx`
**Issue**: After a successful inflow/outflow, the cockpit doesn't refetch its dashboard. KPIs lag until manual reload.
**Fix**: After modal success, call the cockpit's loader (lift state up via callback or use a Zustand store with a `branchDashboardVersion` counter that the cockpit watches). Optimistic UI optional.
**Effort**: M

### ✅ M-6 — `OpenShiftModal` susceptible to double-submit race  *(fixed `45d37a1`)*
**File**: `frontend/src/components/branch/OpenShiftModal.tsx:18-35`
**Issue**: Loading guard is set after the API call resolves, not before; double-click in the gap creates two open-session requests. Backend doesn't currently prevent two simultaneously open sessions for the same user.
**Fix**: Set `loading=true` synchronously before the API call (already done in some places — verify this one) AND have the backend `/cash/open` reject with 409 if a session is already OPEN for `(user_id, branch_id)`. Frontend retries by re-querying the existing session.
**Effort**: S

### ✅ M-7 — Cart row editor states (price/discount/qty) can open simultaneously  *(fixed `45d37a1`)*
**File**: `frontend/src/components/pos/CartPanel.tsx:45-57`
**Issue**: Three independent state variables with no mutual exclusion. Opening discount on row A then price on row B leaves both editors visible — confusing UI.
**Fix**: Collapse into one `editing: { row: string; mode: 'price'|'discount'|'qty' } | null`. Each opener clears the others.
**Effort**: S

---

## LOW

### ◑ L-1 — `change_given` not bounded
`app/routers/sales.py:466-475`. Cashier overpayment of 100x the sale total is silently accepted. **Partially closed by H-1**: now rejects > 10× total. Finer cap (e.g. > $10k without supervisor override) **deferred**.

### ☐ L-2 — Reprint counter is not row-locked  *(deferred)*
Concurrent reprints can lose increments. `UPDATE sales_documents SET reprint_count = reprint_count + 1 WHERE id = :id` with `synchronize_session=False`. Effort S.

### ✅ L-3 — Printer agent failure is silent in the POS UI  *(fixed `45d37a1`)*

### ✅ L-4 — `PricePickerPopover` measures viewport, not the cart's scroll container  *(fixed `45d37a1`)*

### ✅ L-5 — Returns search by folio is not branch-scoped on the frontend either  *(transitively closed by C-3)*

---

## NIT

- **N-1**: PricePickerPopover hardcodes `W = 300` — clipped on phone-class viewports (<400px). Cashiers use 10" tablets so this is a non-issue today.
- **N-2**: Amber/indigo button contrast in the very low brightness end of dark mode. Move to `text-amber-200` if QA reports it.

---

## Verification status per agent

- **Agent A (backend RBAC + isolation)** — C-1, C-2, C-3, C-4 spot-verified by reading source; M-1 verified by reading. H-3 still **needs verification** (open `crud/returns.py`).
- **Agent B (money + state machines)** — H-4, H-5, M-2, M-3 are based on code references the agent cited; recommend a pass before fixing to confirm exact line numbers.
- **Agent C (frontend trust + UI)** — H-1, H-2, H-6 are real and high-value. M-7 is real and easy.

---

## Recommended sprint shape

**Sprint 1 — Branch isolation hotfix (S, 1 day)**: C-1, C-2, C-3, C-4, M-1. Same fix pattern across 5 endpoints + 1 enum compare. Single PR.

**Sprint 2 — Money trust + parked-ticket integrity (M, 2-3 days)**: H-1, H-2, H-5, H-7, M-3. Backend recompute + payload change + parked-ticket lifecycle.

**Sprint 3 — Returns integrity (M, 2 days)**: H-3, H-4, M-2, M-4. Lock-on-approval + DB tax recompute.

**Sprint 4 — Frontend polish (M, 1-2 days)**: H-6, M-5, M-6, M-7, L-3, L-4. Best done after the backend stabilizes.

---

## What was NOT audited (out of scope)

HQ-only routers, platform admin, mobile dashboards, abasto subscriber, transfers/purchases, the full admin catalog. Those need their own audit if/when the cashier surface stabilizes.
