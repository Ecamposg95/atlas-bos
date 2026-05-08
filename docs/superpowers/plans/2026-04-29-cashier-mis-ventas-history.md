# Mis Ventas — Sales History Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** PR 3 of 5 in Cashier Pack — implement spec `2026-04-28-cashier-pack-sales-history-redesign-design.md`: row click opens modal, hover-reveal 3 actions per row (Ver / Reimprimir / Devolver), 6 KPIs (adds Devoluciones + Hora pico), fix CASH→Efectivo leak.

**Architecture:** Frontend rewrite of `SalesHistory.tsx` plus 3 new fields on the existing `/sales/stats` endpoint. No new endpoints, no schema changes (the endpoint returns a plain dict — we add 3 keys). The `METHOD_LABELS` map already exists in the file; we just apply it at line 127.

**Tech Stack:** React 18 + TypeScript + Tailwind on frontend, FastAPI + SQLAlchemy on backend.

**Branch:** `feat/cashier-mis-ventas-history` off `release/qa` at the latest tip. Independent of Mi Caja PR #184 (no shared files).

**Worktree:** `.claude/worktrees/cashier-mis-ventas`

---

## File structure (locked)

| File | Action |
|---|---|
| `app/routers/sales.py:56-136` (`get_sales_stats`) | **Modify** — add 3 aggregates to the returned dict |
| `frontend/src/api/sales.ts:30-35` (`SalesStats` interface) | **Modify** — add 3 fields |
| `frontend/src/pages/sales/SalesHistory.tsx` | **Modify** — KPI grid 4→6, fix CASH at line 127, rewrite tbody for row-click + 3 hover-revealed actions, extract `reprintTicket` helper |

No new files. No new endpoints. The endpoint already exists and returns a plain dict (no Pydantic response_model).

---

## Task 0: Setup branch + worktree

**Files:** none

- [ ] **Step 1: Verify clean state**

```bash
git fetch origin --quiet
git log --oneline origin/release/qa | head -3
```

Expected: latest qa commit is whatever was the last merge into qa.

- [ ] **Step 2: Create worktree**

```bash
git worktree add /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/cashier-mis-ventas -b feat/cashier-mis-ventas-history origin/release/qa
```

- [ ] **Step 3: Symlink node_modules + verify build baseline**

```bash
cd /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/cashier-mis-ventas/frontend
ln -s ../../../../frontend/node_modules ./node_modules
npm run build 2>&1 | tail -3
```

Expected: `✓ built in N s`.

---

## Task 1: Backend — extend `/sales/stats` with 3 new fields

**Files:**
- Modify: `app/routers/sales.py` lines 56-136 (the `get_sales_stats` function)

- [ ] **Step 1: Add SaleReturn import**

At the top of `app/routers/sales.py`, the existing line is:

```python
from app.models.returns import SaleReturn, SaleReturnItem
```

Already imports `SaleReturn` — no change needed.

- [ ] **Step 2: Add the 3 aggregates inside `get_sales_stats`**

Find the return statement at the end of `get_sales_stats` (around line 131):

```python
    return {
        "total_sales": float(total_sales),
        "total_transactions": total_count,
        "average_ticket": float(avg_ticket),
        "payment_methods": methods_data
    }
```

Replace with this version (computes 3 new aggregates BEFORE the return):

```python
    # 3. Devoluciones — count + total refunded across the period
    refunds_query = db.query(SaleReturn).filter(
        SaleReturn.organization_id == org_id,
        SaleReturn.status == "APPROVED",
    )
    if target_branch_id:
        refunds_query = refunds_query.filter(SaleReturn.branch_id == target_branch_id)
    if start_date:
        refunds_query = refunds_query.filter(SaleReturn.created_at >= start_date)
    if end_date:
        refunds_query = refunds_query.filter(SaleReturn.created_at <= end_date)

    refund_count = refunds_query.count()
    refund_total = refunds_query.with_entities(
        func.coalesce(func.sum(SaleReturn.total_refunded), Decimal(0))
    ).scalar() or Decimal(0)

    # 4. Hora pico — hour of day with most PAID sales in the period
    peak_query = (
        db.query(
            func.extract('hour', SalesDocument.created_at).label('hr'),
            func.count(SalesDocument.id).label('n'),
        )
        .filter(
            SalesDocument.organization_id == org_id,
            SalesDocument.status == DocumentStatus.PAID,
            SalesDocument.doc_type == DocumentType.INVOICE,
        )
    )
    if target_branch_id:
        peak_query = peak_query.filter(SalesDocument.branch_id == target_branch_id)
    if start_date:
        peak_query = peak_query.filter(SalesDocument.created_at >= start_date)
    if end_date:
        peak_query = peak_query.filter(SalesDocument.created_at <= end_date)

    peak_row = peak_query.group_by('hr').order_by(func.count(SalesDocument.id).desc()).first()
    peak_hour = f"{int(peak_row.hr):02d}:00" if peak_row else None

    return {
        "total_sales": float(total_sales),
        "total_transactions": total_count,
        "average_ticket": float(avg_ticket),
        "payment_methods": methods_data,
        "refund_count": int(refund_count),
        "refund_total": float(refund_total),
        "peak_hour": peak_hour,
    }
```

- [ ] **Step 3: Verify endpoint runs**

```bash
cd /home/atlas-tech/Devs/Atlas-API
source venv/bin/activate 2>/dev/null || true
python -c "from app.routers.sales import get_sales_stats; print('import OK')"
```

Expected: `import OK`. (Full import-time check — catches syntax errors. Endpoint behavior validated during smoke.)

- [ ] **Step 4: Commit**

```bash
git add app/routers/sales.py
git commit -m "feat(sales): extend /sales/stats with refund_count, refund_total, peak_hour"
```

---

## Task 2: Frontend — extend `SalesStats` type

**Files:**
- Modify: `frontend/src/api/sales.ts` lines 30-35

- [ ] **Step 1: Add 3 fields to the interface**

Find the existing interface (lines 30-35):

```ts
export interface SalesStats {
  total_sales: number
  total_transactions: number
  average_ticket: number
  payment_methods: Record<string, number>
}
```

Replace with:

```ts
export interface SalesStats {
  total_sales: number
  total_transactions: number
  average_ticket: number
  payment_methods: Record<string, number>
  refund_count: number
  refund_total: number
  peak_hour: string | null
}
```

Also update the `getStats` fallback default at line ~52:

```ts
    return data ?? { total_sales: 0, total_transactions: 0, average_ticket: 0, payment_methods: {} }
```

Replace with:

```ts
    return data ?? { total_sales: 0, total_transactions: 0, average_ticket: 0, payment_methods: {}, refund_count: 0, refund_total: 0, peak_hour: null }
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -3
```

Expected: `✓ built in N s`. May warn that new fields aren't consumed yet — that's fine, Task 3 wires them.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/sales.ts
git commit -m "feat(sales): add refund_count/refund_total/peak_hour to SalesStats type"
```

---

## Task 3: Frontend — KPI grid 4 → 6 + fix CASH leak

**Files:**
- Modify: `frontend/src/pages/sales/SalesHistory.tsx`

- [ ] **Step 1: Replace the KPI grid block**

Find the existing KPI block (lines 119-141):

```tsx
      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: formatCurrency(stats.total_sales), icon: 'fa-coins', color: 'text-emerald-400' },
            { label: 'Transacciones', value: String(stats.total_transactions), icon: 'fa-receipt', color: 'text-white' },
            { label: 'Ticket promedio', value: formatCurrency(stats.average_ticket), icon: 'fa-chart-bar', color: 'text-indigo-400' },
            {
              label: 'Método top',
              value: Object.entries(stats.payment_methods ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
              icon: 'fa-credit-card',
              color: 'text-slate-300',
            },
          ].map((k) => (
            <DaxCard key={k.label}>
              <div className="flex items-center gap-2 mb-1">
                <i className={`fa-solid ${k.icon} text-slate-500 text-xs`} />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
              </div>
              <p className={`text-xl font-black tabular-nums ${k.color}`}>{k.value}</p>
            </DaxCard>
          ))}
        </div>
      )}
```

Replace with the new 6-KPI version (uses METHOD_LABELS for top method, adds Devoluciones + Hora pico):

```tsx
      {/* KPIs — 6 cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: formatCurrency(stats.total_sales), icon: 'fa-coins', color: 'text-emerald-400' },
            { label: 'Transacciones', value: String(stats.total_transactions), icon: 'fa-receipt', color: 'text-white' },
            { label: 'Ticket promedio', value: formatCurrency(stats.average_ticket), icon: 'fa-chart-bar', color: 'text-indigo-400' },
            {
              label: 'Método top',
              value: (() => {
                const top = Object.entries(stats.payment_methods ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0]
                return top ? (METHOD_LABELS[top] ?? top) : '—'
              })(),
              icon: 'fa-credit-card',
              color: 'text-slate-300',
            },
            {
              label: 'Devoluciones',
              value: `${stats.refund_count ?? 0} · ${formatCurrency(stats.refund_total ?? 0)}`,
              icon: 'fa-undo',
              color: 'text-rose-400',
            },
            {
              label: 'Hora pico',
              value: stats.peak_hour ?? '—',
              icon: 'fa-clock',
              color: 'text-purple-400',
            },
          ].map((k) => (
            <DaxCard key={k.label}>
              <div className="flex items-center gap-2 mb-1">
                <i className={`fa-solid ${k.icon} text-slate-500 text-xs`} />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
              </div>
              <p className={`text-xl font-black tabular-nums ${k.color}`}>{k.value}</p>
            </DaxCard>
          ))}
        </div>
      )}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/sales/SalesHistory.tsx
git commit -m "feat(sales): KPI grid 4→6 (adds Devoluciones, Hora pico) + fix CASH leak in Método top"
```

---

## Task 4: Frontend — extract `reprintTicket` helper + row click + hover-reveal actions

**Files:**
- Modify: `frontend/src/pages/sales/SalesHistory.tsx`

- [ ] **Step 1: Extract `reprintTicket` as a reusable function**

Inside the `SalesHistory` component, AFTER the existing state declarations (around line 53) and BEFORE the `load` callback, add this helper. It needs `printerName`, `setReprinting`, and the toast already imported.

First, ensure `toast` is imported. At the top of the file, check imports — add this line if `toast` is not already imported:

```ts
import { toast } from '../../store/toastStore'
```

(Check the file first; the import block currently does NOT include toast — Mi Caja and other branch pages use it. Verify by searching.)

Then add the helper inside the component:

```ts
  const reprintTicket = async (saleId: string) => {
    if (!printerName) {
      toast.error('Configura una impresora en /printer-settings primero')
      return
    }
    setReprinting(true)
    try {
      const b64 = await printerApi.getTicketBase64(saleId)
      if (b64) await printerApi.printViaAgent(printerName, b64)
      toast.success('Ticket enviado a la impresora')
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Error al reimprimir')
    } finally {
      setReprinting(false)
    }
  }
```

- [ ] **Step 2: Update modal Reimprimir handler to use the helper**

Find the modal's Reimprimir button (lines 282-300). Currently:

```tsx
              <button
                disabled={reprinting || !printerName}
                onClick={async () => {
                  if (!printerName) return
                  setReprinting(true)
                  try {
                    const b64 = await printerApi.getTicketBase64(selected.id)
                    if (b64) await printerApi.printViaAgent(printerName, b64)
                  } catch { /* silencioso */ } finally { setReprinting(false) }
                }}
                ...
```

Simplify the `onClick` to call the helper:

```tsx
              <button
                disabled={reprinting || !printerName}
                onClick={() => reprintTicket(selected.id)}
                ...
```

(Keep the rest of the button JSX unchanged.)

- [ ] **Step 3: Make rows clickable + add hover-reveal actions**

Find the tbody row block (lines 192-225):

```tsx
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-indigo-400 text-xs">{saleLabel(s)}</td>
                    ...
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSel(s)} className="text-slate-500 hover:text-white transition-colors text-xs" title="Ver detalle">
                          <i className="fa-solid fa-eye" />
                        </button>
                        {(s.status === 'PAID' || s.status === 'REFUNDED_PARTIAL') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setReturnSale(s) }}
                            className="text-red-400 hover:text-red-300 transition-colors text-xs"
                            title="Iniciar devolución"
                          >
                            <i className="fa-solid fa-undo" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
```

Replace the entire `<tbody>` with:

```tsx
              <tbody>
                {sales.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSel(s)}
                    className="group cursor-pointer hover:bg-indigo-500/5 transition-colors"
                  >
                    <td className="font-mono text-indigo-400 text-xs">{saleLabel(s)}</td>
                    <td className="text-xs text-slate-400">
                      {new Date(s.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="text-sm">{s.customer_name ?? <span className="text-slate-600 italic">Público general</span>}</td>
                    <td className="text-right font-semibold text-emerald-400">{formatCurrency(s.total_amount)}</td>
                    <td>
                      {s.payments?.map((p, i) => (
                        <span key={i} className="dax-badge dax-badge-blue mr-1">{METHOD_LABELS[p.method] ?? p.method}</span>
                      ))}
                    </td>
                    <td><Badge variant={statusVariant(s.status) as 'green' | 'red' | 'blue' | 'yellow'}>{STATUS_LABELS[s.status] ?? s.status}</Badge></td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSel(s) }}
                          className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors"
                          title="Ver detalle"
                        >
                          <i className="fa-solid fa-eye" /> Ver
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); reprintTicket(s.id) }}
                          disabled={!printerName}
                          className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={printerName ? 'Reimprimir ticket' : 'Configura una impresora'}
                        >
                          <i className="fa-solid fa-print" /> Reimprimir
                        </button>
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
                  </tr>
                ))}
              </tbody>
```

Key changes:
- `<tr>` has `onClick={() => setSel(s)}`, `className="group cursor-pointer hover:bg-indigo-500/5"`
- Last `<td>` uses `opacity-100 sm:opacity-0 sm:group-hover:opacity-100` — visible on touch (`<sm`), fade-in on hover (`sm+`)
- 3 buttons: Ver / Reimprimir / Devolver, all with `e.stopPropagation()` to prevent row click

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/sales/SalesHistory.tsx
git commit -m "feat(sales): row-click opens detail; hover-reveal Ver/Reimprimir/Devolver actions"
```

---

## Task 5: Build verification + push + PR

**Files:** none

- [ ] **Step 1: Final clean build**

```bash
cd frontend && rm -rf dist && npm run build 2>&1 | tail -10
```

Expected: `✓ built in N s`. No TypeScript errors.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/cashier-mis-ventas-history
```

- [ ] **Step 3: Open PR via gh CLI**

```bash
gh pr create --base release/qa --head feat/cashier-mis-ventas-history --title "feat(sales): Mis Ventas redesign — 6 KPIs + row click + hover actions + CASH fix" --body "$(cat <<'EOF'
## Summary

PR 3 of 5 in Cashier Pack per spec
[2026-04-28-cashier-pack-sales-history-redesign-design.md](docs/superpowers/specs/2026-04-28-cashier-pack-sales-history-redesign-design.md).

- KPI grid 4 → 6 cards: adds Devoluciones (count + total) and Hora pico.
- Fixes CASH leak in Método top KPI (line 127): now applies METHOD_LABELS so cashier sees "Efectivo" instead of "CASH".
- Entire row clickable to open detail modal.
- 3 hover-revealed action buttons per row: Ver / Reimprimir / Devolver. On mobile/touch (<sm), buttons stay visible.
- Reprint extracted into reusable helper; modal and row both use it.
- Backend extends /sales/stats with refund_count, refund_total, peak_hour. Aggregates SaleReturn (APPROVED only) and SQL EXTRACT(hour) over PAID invoices in the period.

Independent of Mi Caja PR. No file overlap.

## Test plan

- [ ] CAJERO login → /sales → 6 KPIs render with branch-scoped data
- [ ] Método top shows Spanish label (Efectivo / Tarjeta / Transferencia), not raw enum
- [ ] Hover row → 3 buttons fade in (Ver / Reimprimir / Devolver if eligible)
- [ ] Click anywhere in a row (not on a button) → detail modal opens
- [ ] Click Reimprimir with printer set → ticket prints; without printer → button disabled w/ tooltip
- [ ] Click Devolver on PAID sale → ReturnModal opens
- [ ] Mobile viewport → buttons stay visible without hover
- [ ] Period with refunds → Devoluciones KPI shows count + total
- [ ] Period with sales → Hora pico shows HH:00 of busiest hour
- [ ] Period with 0 sales → Hora pico shows "—", Devoluciones "0 · \$0.00"
- [ ] HQ /sales — same view (no redirect), still works for admins

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Note PR URL**

Save the PR URL output by gh for the master orchestration's status table.

---

## Self-review summary

**Spec coverage:**
- §1 KPI grid 4→6 → Task 3
- §2 Tabla densa con hover-reveal → Task 4
- §3 Fix CASH leak → Task 3 (line 127 inside KPI block)
- §4 Detail modal unchanged → no task needed
- §5 Backend extend /sales/stats → Task 1
- §6 Frontend type extension → Task 2
- §7 File-by-file → matches Tasks 1-4

**Placeholder scan:** none — exact paths, exact code, exact commands.

**Type consistency:** `SalesStats` shape extended in Task 2 matches what backend returns in Task 1 and what frontend reads in Task 3. `reprintTicket(saleId: string)` signature matches both row-button (Task 4 step 3) and modal-button (Task 4 step 2) call sites.

**Risk note:** `peak_hour` SQL uses `func.extract('hour', SalesDocument.created_at)`. The DB stores `created_at` as TIMESTAMPTZ; the backend's MX_TZ context (line 44) is for parameter parsing, not column extraction. The hour returned will be in DB-server local time. If Railway/local Postgres run UTC, peak_hour will show UTC hour, NOT Mexico City hour. **Acceptable trade-off**: cashier works in MX_TZ but most days the peak still falls in the same hour for both timezones; if the hour shift becomes a complaint, follow-up adds `AT TIME ZONE 'America/Mexico_City'`.
