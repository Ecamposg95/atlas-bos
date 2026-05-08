# Cash Reconciliation — Canonical Spec

**Last updated**: 2026-05-02
**Owner**: Atlas Tech
**Status**: Active (post F0-F4 of cash hardening plan)

This is the single source of truth for how cash sessions reconcile in Atlas. Read this before touching `app/services/cash_reconciliation.py`, `app/routers/cash.py`, `app/crud/returns.py`, or any UI that displays balance/expected/difference.

---

## The formula

```
expected = opening
         + (gross_cash − change_given)        # net_cash
         + manual_inflows
         − manual_outflows
         − refund_cash_outflows

difference = closing_balance − expected
```

Implemented in `app/services/cash_reconciliation.py:compute_expected_cash`. **Every place that shows "esperado en caja" must call this function** — no parallel implementations.

## Components

| Component | Source | Notes |
|---|---|---|
| **opening** | `cash_sessions.opening_balance` | Set at session open. Immutable. |
| **gross_cash** | `SUM(payments.amount WHERE method=CASH)` joined to sales with `status IN (PAID, REFUNDED_PARTIAL, REFUNDED_TOTAL)` and matching `session_sales_filter(session)` | Includes REFUNDED_* because the original cash entry physically happened. Refunds are subtracted separately via cash_movements. |
| **change_given** | `SUM(sales.change_given)` for sales with cash | Persisted at sale time (Track 1.3). Legacy fallback recomputes from payments. |
| **net_cash** | `gross_cash − change_given` | What actually stayed in the drawer from sales. |
| **manual_inflows** | `SUM(cash_movements WHERE type=IN AND session_id=X)` | Reposiciones, ajustes positivos. |
| **manual_outflows** | `SUM(cash_movements WHERE type=OUT AND reason NOT LIKE 'Devoluci%' AND session_id=X)` | Gastos, retiros. |
| **refund_cash_outflows** | `SUM(cash_movements WHERE type=OUT AND reason LIKE 'Devolución %' AND session_id=X)` | Salidas por refunds aprobados. |

## Status filter for cash queries

Use the canonical tuple:

```python
from app.services.cash_reconciliation import CASH_INCLUDED_STATUSES
# = (PAID, REFUNDED_PARTIAL, REFUNDED_TOTAL)
```

**Why include REFUNDED_*:** when a sale is refunded, `payments` rows are NOT mutated — the original cash entered the drawer. The refund is recorded as a `cash_movements` OUT row. Excluding REFUNDED_* would erase the original deposit while still subtracting the OUT, producing negative `expected_cash` on heavy-refund days. This was the bug fixed in commit `640fbe9`.

## Hard invariants (R-checks in `approve_return`)

These BLOCK before any side-effect:

| Code | Rule | Override |
|---|---|---|
| **R-1** | `total_refunded > 0` | None |
| **R-2** | `total_refunded ≤ original_sale_total + prior_approved_refunds` | None |
| **R-3** | If `refund_method = CASH` and `total_refunded > 10000`: requires `force=True` | `?force=true` query param. UI must confirm twice. |

## Closure warnings (W-codes in `compute_closure_warnings`)

These SIGNAL but do NOT block (cross-day refunds are legitimate):

| Code | Severity | Trigger |
|---|---|---|
| **REFUNDS_EXCEED_TODAY_CASH** | warning | `refund_cash_outflows > gross_cash` (cross-day refund OR inflated refund) |
| **CHANGE_EXCEEDS_GROSS_CASH** | critical | `change_given > gross_cash` (corrupted change_given on a sale — investigate) |
| **LARGE_DIFFERENCE_RATIO** | warning | `\|difference\| / \|expected\| > 50%` (recount before closing) |

Logged as `CASH_CLOSE_WARNING` in Railway logs and recorded in `cash_audit_log` with `event_type=SESSION_CLOSED` payload.

## Audit log (`cash_audit_log`)

Append-only. Every monetary event inserts one row via `app/services/cash_audit.py:audit_cash_event` (FAILSAFE — never raises).

Event vocabulary in `CashAuditEvent`:
- `SALE_CREATED`, `PAYMENT_RECORDED`
- `REFUND_APPROVED`, `REFUND_REJECTED`
- `MANUAL_INFLOW`, `MANUAL_OUTFLOW`
- `SESSION_OPENED`, `SESSION_CLOSED`
- `INVARIANT_FAILED`, `CLOSURE_WARNING`

Query the timeline of any session via `GET /api/cash/{session_id}/audit-log` (ADMIN only) or visualize at `/platform/cash-audit/{session_id}`.

## Edge cases & semantics

### Cross-day refund
Refund of a sale from a previous session → `cash_movements OUT` lands in the **current** open session. The original `payments` row stays in the original session. `expected` for today reflects only today's deposits minus today's refunds. **If today's refunds exceed today's deposits, `expected` is legitimately negative** — operationally means caja needs reposición. NOT a bug. UI surfaces the W1 warning to flag this for admin review.

### Multi-PC same cashier
N PCs of the same cashier share the same `cash_session.id`. All sales aggregate via `session_sales_filter(session)` → same session_id OR (legacy NULL + same seller + same branch + within window).

### Legacy NULL `cash_session_id`
Sales created before Track 1 have `cash_session_id = NULL`. The fallback in `session_sales_filter` matches via seller + branch + `created_at IN [opened_at, closed_at|now()]`. Tested in `tests/test_cash_math.py::TestEdgeCases::test_legacy_sale_null_session_id`.

### Card/Transfer-only refund
If `refund_method != CASH`, the refund does **not** create a `cash_movements OUT` row. `gross_cash` and `refund_cash_outflows` both stay 0. `expected` unchanged. Only `sale.status` flips and `sale.total_amount` is netted. Tested in `tests/test_cash_math.py::TestRefundReconciliation::test_refund_non_cash_method_no_cash_impact`.

### Change > gross_cash (impossible)
Should never happen organically — would mean the cashier handed back more than they received. If it appears, `change_given` is corrupted (e.g. POS bug at create_sale persisted wrong value). W2 warning fires; investigate the `payments` rows for the affected sale.

## Reconciliation reverse-engineering

When a cashier reports "no cuadra", run this in `/platform/cash-audit/{session_id}`:

1. Look at the **DESGLOSE MATEMÁTICO** card: which line is off?
2. Cross-check with the **TIMELINE**: where does the gap show up?
3. If `refund_cash_outflows` looks inflated → drill down on each `REFUND_APPROVED` event. The payload includes `sale_id`, `refund_method`, `force_used`. If `force_used=true` and amount is huge → fat-finger that supervisor authorized.
4. If `change_given` is the issue → query `SELECT id, total_amount, change_given FROM sales_documents WHERE cash_session_id=X AND change_given > total_amount` to find corrupted rows.
5. If still unexplained → check for `cash_movements` not classified correctly (reason without "Devolución" prefix that should be a refund).

## Tools

| Script | Purpose |
|---|---|
| `scripts/recompute_session_differences.py` | Recompute `session.difference` for closed sessions using current formula. Dry-run by default. |
| `scripts/audit_outage_2026_05_01.sql` | One-off psql audit script for the 2026-05-01 outage window. |

## Tests

| File | Coverage |
|---|---|
| `tests/test_cash_math.py` | 24 cases: payment-method matrix, refund reconciliation, manual movements, edge cases, closing balance |
| `tests/test_cash_invariants.py` | 10 cases: closure warnings + refund hard invariants (R-1 / R-2 / R-3 with and without force) |
| `tests/test_cash_audit.py` | 6 cases: audit helper failsafe, refund/inflow/outflow/close hooks emit rows |

Run all:
```bash
uv run --with pytest --with sqlalchemy --with fastapi --with bcrypt==3.2.0 \
  --with passlib==1.7.4 --with python-jose[cryptography] \
  --with email_validator --with pydantic[email] --with python-multipart \
  --with python-dotenv python -m pytest tests/test_cash_*.py
```

40 tests, ~10s runtime.

## Related code

- Service: `app/services/cash_reconciliation.py` (formula + warnings)
- Service: `app/services/cash_audit.py` (audit helper)
- Model: `app/models/cash.py` (CashSession + CashMovement)
- Model: `app/models/cash_audit.py` (CashAuditLog + CashAuditEvent vocabulary)
- Router: `app/routers/cash.py` (close, summary, audit-log endpoints)
- CRUD: `app/crud/returns.py` (approve_return + R-invariants)

## Related docs

- Plan: `docs/superpowers/specs/2026-05-01-cash-reconciliation-hardening-plan.md`
- Audit: `docs/superpowers/audits/2026-05-01-cash-mapper-outage-audit.md`
