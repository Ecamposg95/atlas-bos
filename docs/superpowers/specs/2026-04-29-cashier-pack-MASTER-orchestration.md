# Cashier Pack — Master Orchestration

**Date:** 2026-04-29
**Scope:** 5 cashier-facing modules redesigned in coordination
**Final target:** `release/qa` first (5 PRs), then audit, then `release/qa → release/beta` outside merge-freeze (9–19h)

This document coordinates the 5 module specs, defines build order, declares shared assets, and sets the audit gates before promoting `qa → beta`.

---

## The 5 specs

| # | Module | Spec | Risk | Backend | Order |
|---|---|---|---|---|---|
| 4 | Mi Caja | `2026-04-28-cashier-pack-cash-branch-design.md` | Medium | None | 1st |
| 1 | Mi Día | `2026-04-28-cashier-pack-cockpit-redesign-design.md` | Medium | Minor (1 schema field, 1 limit) | 2nd |
| 3 | Mis Ventas | `2026-04-28-cashier-pack-sales-history-redesign-design.md` | Low | Yes (3 stats fields) | 3rd |
| 5 | Inventario | `2026-04-29-cashier-pack-products-branch-redesign-design.md` | Medium | Yes (dry_run flag + UploadPreviewResponse) | 4th |
| 2 | POS | `2026-04-29-cashier-pack-pos-bulk-caja-design.md` | **High** (touches money) | None | **5th (last)** |

Order rationale (locked during brainstorm):
- Mi Caja first — surfaces inflows/outflows that already exist server-side; reusable hero tokens for Mi Día.
- Mi Día second — depends on Mi Caja's `heroEmerald`/`heroOrange` tokens (sequenced merge avoids token-collision PR work).
- Mis Ventas third — independent; small backend stats addition is contained.
- Inventario fourth — adds upload-preview backend; independent of the others.
- POS last — touches the money path. Lands after the rest of the pack is stable in qa to make rollback cleaner if pricing logic regresses.

---

## Shared assets

Cross-spec dependencies that need explicit coordination at PR-author time:

### `branchUI.heroEmerald` and `branchUI.heroOrange`

Declared in **both** Mi Caja spec (§8) and Mi Día spec (§10). Whichever PR lands first creates the tokens in `frontend/src/components/branch/branchUI.ts`; the second PR's plan must check the file before adding (don't re-declare, don't shadow).

### `OpenShiftModal` and `MovementModal`

Both live in `frontend/src/components/branch/`, both follow the same modal shell pattern (`ui.card`, `ui.input`, `ui.btnPrimary` / `ui.btnSecondary`, `bg-black/60 backdrop-blur-sm` overlay). Owned by Mi Caja and Mi Día specs respectively; **no shared file** — duplicating the modal shell is intentional, prevents cross-coupling.

### `branchCopy.ts`

Both Mi Caja and Mi Día add new keys. Different blocks (`cashKpis`, `cashMovements`, `weekSalesChart` vs. `cockpit`, `openShiftModal`, `ROLE_LABELS`). No collisions. Whichever lands first sets the structure; second PR adds new keys cleanly.

### `branchDashboard` payload

Mi Día spec calls for adding `role` to `DashboardUser` and ensuring `top_products` returns ≥5. These are minor backend changes; if they slip, Mi Día degrades gracefully (role omitted from subtitle, top products capped at backend's limit). Not a blocker.

---

## PR sequence

### PR 1 — Mi Caja (`feat/cashier-mi-caja-branch`)
- **Branches off**: `release/qa` at the spec-commit SHA `30c88cf`
- **Adds**: `heroEmerald` / `heroOrange` to `branchUI.ts`, `MovementModal.tsx`, `WeekSalesChart.tsx`
- **Modifies**: `CashBranchView.tsx`, `branchCopy.ts`
- **Backend**: none
- **Reviewer focus**: `expectedCash` formula change (now includes inflows/outflows), STORE_CREDIT removal, hero gradient logic on three states (open/closed-today/no-shift)

### PR 2 — Mi Día (`feat/cashier-mi-dia-cockpit`)
- **Branches off**: `release/qa` AFTER PR 1 merges (or rebases on top)
- **Plan-time check**: `branchUI.heroEmerald` / `heroOrange` already present? If yes, reuse. If no, add (Mi Caja PR not yet merged)
- **Adds**: `OpenShiftModal.tsx`, `getInitials` helper, `ROLE_LABELS` const, `timeGreeting` helper
- **Modifies**: `CockpitGreeting.tsx`, `CockpitDayKPIs.tsx` (TopProducts limit, PaymentMethods rewrite), `branchCopy.ts`, possibly `branchDashboard.ts` types, possibly `app/schemas/branch_dashboard.py`
- **Backend**: optional — `role` field in DashboardUser, `top_products` limit raise to 5
- **Reviewer focus**: avatar contrast on emerald/orange hero, `cashApi.open()` idempotency assumption, dashboard refetch after open-shift

### PR 3 — Mis Ventas (`feat/cashier-mis-ventas-history`)
- **Branches off**: `release/qa` (independent of PR 1 / PR 2, can run in parallel after PR 1 merges)
- **Adds**: `reprintTicket()` helper inside `SalesHistory.tsx`
- **Modifies**: `SalesHistory.tsx`, `frontend/src/api/sales.ts` (or `types/sales.ts`), `app/routers/sales.py`, `app/schemas/sales.py`
- **Backend**: `refund_count`, `refund_total`, `peak_hour` added to stats endpoint
- **Reviewer focus**: hover-reveal pattern on touch devices, `peak_hour` timezone awareness, `refund_total` source-of-truth (column vs. join), CASH translation fix

### PR 4 — Inventario (`feat/cashier-inventario-products`)
- **Branches off**: `release/qa` (independent, parallel-safe with PR 3)
- **Adds**: `SectionHeader` component, `TIER_PALETTE` const, wizard state machine in `ImportExcelModal`, `getCatalogKpis()` API call
- **Modifies**: `ProductsBranchView.tsx`, `frontend/src/api/products.ts`, `frontend/src/types/products.ts`, `app/routers/products/import_export.py`, `app/schemas/products.py`
- **Backend**: `dry_run: bool` query param + `UploadPreviewResponse` schema
- **Reviewer focus**: dry-run/commit drift, file re-upload correctness, tier palette overflow at 6+ tiers

### PR 5 — POS bulk caja (`feat/pos-bulk-caja`)
- **Branches off**: `release/qa` after PRs 1-4 are merged. **Do not parallelize** — POS lives in a different file but the cashier flow visits all 5 surfaces; landing POS last gives cleanest rollback boundary.
- **Adds**: `applyCajaToAll()`, `restoreAutoTier()` actions in `posStore.ts`, control button in `CartPanel.tsx`, `cajaForcedByBulk` flag on `CartItem`
- **Modifies**: `CartPanel.tsx` (extract `applyAutoTier` from useEffect), `posStore.ts`, `types/sales.ts`
- **Backend**: none
- **Reviewer focus**: remainder-pieces handling (qty mod min_quantity), backend margin floor unaffected, `findProductSource` semantics, `restoreAutoTier` idempotence, manually-forced lines override

---

## Audit gates

Each PR follows its own review and merge cycle. Once **all 5** are merged into `release/qa`, run the integration audit before promoting to `release/beta`.

### Per-PR gate (before merging to qa)

For each PR:
1. CI green (build + typecheck + tests pass).
2. Manual smoke run the spec's own `## Testing plan` section.
3. `code-reviewer` agent (subagent_type) reviews the diff against the spec for divergences.
4. PR description links the spec file and lists any deviations.
5. Merge to `release/qa` (squash or merge commit per repo convention).

### Integration audit (before promoting qa → beta)

After all 5 are in qa:

1. **Code-reviewer agent — full pack review**: feed all 5 spec files + the diff `release/qa @ post-merge` vs `release/qa @ pre-pack-start (30c88cf)`. Surface any cross-spec inconsistencies, dead code, or merge artifacts.

2. **Smoke test — full cashier flow** (manual, from a fresh CAJERO login):
   - `/atlas-pos` → Mi Día renders hero verde (after open-shift modal), avatar + greeting + role badge correct.
   - `/cash-history` → Mi Caja shows emerald hero, IN/OUT pills, registers a movement, sees it in the movements table.
   - `/products` → Inventario shows 4 KPIs, no Inactivos tab; create a product with 3 colored tiers; import a small Excel with dry-run + commit.
   - `/sales` → Mis Ventas shows 6 KPIs (Método top in Spanish), click a row opens detail, hover reveals 3 actions, reprint works.
   - `/pos` → cart shows bulk-caja button below global discount, scan 2 products, click apply, see counter; restaurar; create sale; receipt prints.

3. **Regression checklist** (existing flows that must still work):
   - HQ Atlas POS unchanged (no branch redirect on HQ user).
   - HQ CashHistory unchanged.
   - HQ products page unchanged.
   - POS pause/resume → parked_tickets (recent change, not regressed).
   - POS sale creation rejects below-margin pricing (margin floor).
   - Cash session close + reprint cut.

4. **Backend smoke**:
   - `GET /sales/stats?start=...&end=...` returns 3 new fields.
   - `POST /products/upload?dry_run=true` returns preview without writing.
   - `POST /cash/open` from new modal succeeds (idempotent).

If any audit step fails, the offending PR is reverted on `release/qa` (or a follow-up patch lands) before promotion.

### Promotion to beta

Outside merge-freeze hours (9-19h, per repo policy):
- `git fetch origin`
- Verify `origin/release/qa` is at the audited SHA
- FF push: `git push origin <qa-sha>:refs/heads/release/beta`
- Tag the milestone: `vYYYY.MM.DD-cashier-pack` annotated tag
- Push tag: `git push origin <tag>`
- Watch Railway autodeploy of beta env; verify cashier login + POS sale.

`release/beta` carries real users — do **not** promote without a clean audit run.

---

## Risk register

| Risk | Spec | Mitigation |
|---|---|---|
| Hero token collision (Mi Caja / Mi Día both add `heroEmerald`) | Cross | Plan-time check; second PR detects-and-reuses |
| `peak_hour` timezone wrong | Mis Ventas | Plan-time DB column type check; convert if needed |
| Remainder pieces dropped on bulk-caja | POS | Toast warns; cashier handles manually; followup PR can add residual line |
| Catalog import preview/commit drift | Inventario | Documented in copy; cashier scale tolerable |
| Avatar low contrast on emerald/orange hero | Mi Día | Visual review during PR 2 implementation |
| Backend `role` field absent (Mi Día) | Mi Día | Graceful degrade — subtitle drops role label |
| Cashier muscle memory broken (Inactivos tab gone) | Inventario | Tab is rarely used per discovery; if cashier complains, restore via filter dropdown |

---

## Rollback strategy

If post-promotion to beta a regression is detected:

- **Per-PR rollback in qa**: revert the offending PR commit; promote new qa SHA to beta.
- **Full pack rollback**: `release/beta` reset to the pre-pack tag (`v2026.04.28-stable`); takes 1 git command. All 5 modules disappear at once. Use only if multiple modules co-fail.
- **Hot-patch**: small frontend-only fix → branch off beta, fix, merge back to beta only (NOT qa). Cherry-pick to qa later. Avoid this path; prefer reverts.

---

## Status tracking

This section is updated as PRs land:

| PR | Branch | Spec SHA | Status | Merged at |
|---|---|---|---|---|
| 1 | `feat/cashier-mi-caja-branch` | TBD | pending | — |
| 2 | `feat/cashier-mi-dia-cockpit` | TBD | pending | — |
| 3 | `feat/cashier-mis-ventas-history` | TBD | pending | — |
| 4 | `feat/cashier-inventario-products` | TBD | pending | — |
| 5 | `feat/pos-bulk-caja` | TBD | pending | — |
| Audit | — | — | pending | — |
| Promote qa→beta | — | — | pending | — |
