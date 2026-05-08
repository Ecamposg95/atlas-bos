# Mi Caja — Branch View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement PR 1 of 5 in the Cashier Pack — redesign `CashBranchView.tsx` per spec `2026-04-28-cashier-pack-cash-branch-design.md`: state-aware hero (emerald/orange), inflow/outflow pills + movements table, Efectivo-del-turno KPI grid, sales-per-day chart, drop Crédito tienda + Diferencia + Turnos·7d KPIs.

**Architecture:** Frontend-only PR. Zero backend, zero schema, zero new endpoints. All data already returned by `GET /cash/summary` and `GET /cash/history`. Reuses existing `cashApi.inflow`, `cashApi.outflow`, `cashApi.getSummary`. Two new components extracted from the current monolith: `MovementModal.tsx` (branch-scoped) and `WeekSalesChart.tsx`. Two new design tokens: `ui.heroEmerald`, `ui.heroOrange`.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + Zustand. No unit-test framework on the frontend (per CLAUDE.md, manual smoke is the standard for UI changes); typecheck via `npm run build`.

**Branch:** `feat/cashier-mi-caja-branch` off `release/qa` at SHA `f4a5560` (the master orchestration commit).

**Testing strategy:** TDD doesn't fit (no test framework). Each task ends with `npm run build` (typecheck) and, where the change is visually impactful, a manual smoke step. Final smoke walk-through is Task 12.

---

## File structure (locked)

| File | Action |
|---|---|
| `frontend/src/components/branch/branchUI.ts` | **Modify** — add `heroEmerald`, `heroOrange` |
| `frontend/src/copy/branchCopy.ts` | **Modify** — extend `cashKpis`, add `cashMovements` and `weekSalesChart` blocks |
| `frontend/src/components/branch/MovementModal.tsx` | **Create** — branch-scoped IN/OUT modal |
| `frontend/src/components/branch/WeekSalesChart.tsx` | **Create** — sales-per-day chart |
| `frontend/src/components/branch/CashBranchView.tsx` | **Modify** — hero state-aware, KPI grid rewrite, drop STORE_CREDIT, drop legacy WeekVarianceChart, add Movimientos section, wire MovementModal |

Spec deviation: `ui.heroEmerald` / `ui.heroOrange` declared as **solid colors** (`bg-emerald-600 dark:bg-emerald-700` / `bg-orange-600 dark:bg-orange-700`) to match the existing `ui.hero` token style, not Tailwind gradients. Same visual punch, consistent system. Documented inline in `branchUI.ts`.

---

## Task 0: Setup branch

**Files:** none

- [ ] **Step 1: Verify clean state and remote sync**

```bash
git status
git fetch origin
git log --oneline origin/release/qa | head -3
```

Expected output: working tree clean (or only the existing `app/static/branch_logos/` untracked dir, which is unrelated). The most-recent qa commit should be `f4a5560 docs(cashier-pack): POS bulk-caja spec + master orchestration`.

- [ ] **Step 2: Create the implementation branch off qa**

```bash
git checkout -b feat/cashier-mi-caja-branch origin/release/qa
git log --oneline -3
```

Expected: HEAD now at `f4a5560`.

- [ ] **Step 3: Sanity-check the dev environment**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: build succeeds (`✓ built in N s`). If it fails, fix the underlying issue before proceeding — never commit on a broken-baseline branch.

- [ ] **Step 4: Commit a marker (no changes; for traceability)**

Skip this step — no marker commits.

---

## Task 1: Add hero tokens to `branchUI.ts`

**Files:**
- Modify: `frontend/src/components/branch/branchUI.ts`

- [ ] **Step 1: Add `heroEmerald` and `heroOrange` tokens**

Open `frontend/src/components/branch/branchUI.ts`. Find the existing `hero` and `heroAlt` declarations (lines 22-23):

```ts
  // Hero panel — solid purple, no gradient
  hero: 'rounded-3xl bg-purple-600 dark:bg-purple-700 text-white shadow-2xl shadow-purple-900/20',
  heroAlt: 'rounded-3xl bg-purple-700 dark:bg-purple-800 text-white shadow-2xl shadow-purple-900/30',
```

Insert two new lines AFTER `heroAlt`:

```ts
  // Hero panel — state-aware variants for shift status (Mi Caja, Mi Día)
  // Solid colors to match the existing hero pattern (no gradients).
  heroEmerald: 'rounded-3xl bg-emerald-600 dark:bg-emerald-700 text-white shadow-2xl shadow-emerald-900/20',
  heroOrange: 'rounded-3xl bg-orange-600 dark:bg-orange-700 text-white shadow-2xl shadow-orange-900/20',
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/branch/branchUI.ts
git commit -m "feat(branch): add heroEmerald and heroOrange tokens for shift-state hero"
```

---

## Task 2: Extend `branchCopy.ts` with new copy keys

**Files:**
- Modify: `frontend/src/copy/branchCopy.ts`

- [ ] **Step 1: Extend `cashKpis` block with new keys**

Find the `cashKpis` block (lines 58-63):

```ts
    cashKpis: {
      salesToday: 'Ventas del turno',
      expected: 'Efectivo esperado',
      difference: 'Diferencia turno',
      weekShifts: 'Turnos 7 días',
    },
```

Replace with (preserves existing keys for backwards compatibility, adds new ones):

```ts
    cashKpis: {
      // existing — kept for any out-of-scope consumers
      salesToday: 'Ventas del turno',
      expected: 'Efectivo esperado',
      difference: 'Diferencia turno',
      weekShifts: 'Turnos 7 días',
      // new — used by the redesigned KPI grid
      cashShift: 'Efectivo del turno',
      inflows: 'Entradas',
      outflows: 'Salidas',
    },
```

- [ ] **Step 2: Add `cashMovements` block**

Inside the `pages` object, AFTER the `cashWeekChart` block (around line 75), insert:

```ts
    cashMovements: {
      title: 'Movimientos del turno',
      empty: 'Sin movimientos en este turno',
      registerIn: '+ Entrada',
      registerOut: '− Salida',
      modalTitleIn: 'Entrada de efectivo',
      modalTitleOut: 'Salida / Gasto',
      amount: 'Monto',
      concept: 'Concepto',
      submitIn: 'Registrar entrada',
      submitOut: 'Registrar salida',
    },
```

- [ ] **Step 3: Add `weekSalesChart` block**

Inside the `pages` object, AFTER `cashMovements`, insert:

```ts
    weekSalesChart: {
      title: 'Efectivo cobrado · 7 días',
      legend: 'Suma de cash sales por día (turnos cerrados + turno actual)',
      noSession: 'Sin turno',
    },
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/copy/branchCopy.ts
git commit -m "feat(branch): add cashKpis/cashMovements/weekSalesChart copy keys"
```

---

## Task 3: Create `MovementModal.tsx`

**Files:**
- Create: `frontend/src/components/branch/MovementModal.tsx`

- [ ] **Step 1: Create the file with full component**

```tsx
import { useState } from 'react'
import { ui } from './branchUI'
import { BRANCH_COPY } from '../../copy/branchCopy'

interface Props {
  type: 'IN' | 'OUT'
  onClose: () => void
  onConfirm: (amount: number, concept: string) => Promise<void>
}

export function MovementModal({ type, onClose, onConfirm }: Props) {
  const COPY = BRANCH_COPY.pages.cashMovements
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || !concept.trim()) return
    setLoading(true)
    try {
      await onConfirm(amt, concept.trim())
    } finally {
      setLoading(false)
    }
  }

  const title = type === 'IN' ? COPY.modalTitleIn : COPY.modalTitleOut
  const submitLabel = type === 'IN' ? COPY.submitIn : COPY.submitOut

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`${ui.card} w-full max-w-sm p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            aria-label="Cerrar"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className={`block ${ui.kpiLabel} mb-1`}>{COPY.amount}</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={ui.input}
              placeholder="0.00"
              min="0"
              step="0.01"
              autoFocus
            />
          </label>
          <label className="block">
            <span className={`block ${ui.kpiLabel} mb-1`}>{COPY.concept}</span>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className={ui.input}
              placeholder={type === 'IN' ? 'Ej. Fondo de cambio' : 'Ej. Refresco, papelería'}
            />
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className={`${ui.btnSecondary} flex-1`} disabled={loading}>
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !amount || !concept.trim()}
            className={`${ui.btnPrimary} flex-1 disabled:opacity-50`}
          >
            {loading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-check" /> {submitLabel}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds (the component is exported but not yet imported anywhere — that's fine).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/branch/MovementModal.tsx
git commit -m "feat(branch): add MovementModal for IN/OUT registration"
```

---

## Task 4: Create `WeekSalesChart.tsx`

**Files:**
- Create: `frontend/src/components/branch/WeekSalesChart.tsx`

- [ ] **Step 1: Create the file with full component**

```tsx
import { useMemo } from 'react'
import { ui, fmtMoney } from './branchUI'
import { BRANCH_COPY } from '../../copy/branchCopy'

interface SessionLike {
  closed_at: string | null
  total_cash_sales: string
}

interface Props {
  sessions: SessionLike[]   // closed sessions (last 7 days, ordered by recency or any)
  todayCashSales?: number   // total_cash_sales of the currently open shift, if any
}

function parseNum(v: string | null | undefined): number {
  if (v == null || v === '') return 0
  return Number(v)
}

const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

export function WeekSalesChart({ sessions, todayCashSales = 0 }: Props) {
  const COPY = BRANCH_COPY.pages.weekSalesChart

  const slots = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      // Sum cash sales of all closed sessions whose closed_at falls on this day
      const dayStart = d.getTime()
      const dayTotal = sessions.reduce((acc, s) => {
        if (!s.closed_at) return acc
        const sd = new Date(s.closed_at)
        sd.setHours(0, 0, 0, 0)
        return sd.getTime() === dayStart ? acc + parseNum(s.total_cash_sales) : acc
      }, 0)
      // If this is today (i === 0), also add the current open-shift total
      const total = i === 0 ? dayTotal + todayCashSales : dayTotal
      return { date: d, total }
    }).reverse()  // oldest first → today last
  }, [sessions, todayCashSales])

  const maxTotal = useMemo(() => {
    const vals = slots.map((s) => s.total)
    return Math.max(...vals, 1)  // avoid div-by-zero
  }, [slots])

  return (
    <div className={`${ui.card} p-5 h-full`}>
      <p className={`${ui.sectionTitle} mb-3`}>{COPY.title}</p>
      <div className="flex items-end gap-1.5 h-28">
        {slots.map((slot, i) => {
          const isToday = i === slots.length - 1
          const hasData = slot.total > 0
          const pct = hasData ? Math.max(slot.total / maxTotal, 0.06) : 0
          const barColor = !hasData
            ? 'bg-stone-200 dark:bg-slate-700'
            : isToday
              ? 'bg-purple-500 dark:bg-purple-400'           // saturated for today
              : 'bg-purple-500/70 dark:bg-purple-400/70'     // muted for past days
          const dayName = DAY_LABELS[slot.date.getDay()]
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex-1 w-full flex items-end">
                <div
                  className={`w-full rounded-t-sm transition-all ${barColor}`}
                  style={{ height: hasData ? `${pct * 100}%` : '8%' }}
                  title={hasData ? fmtMoney(slot.total) : COPY.noSession}
                />
              </div>
              <span
                className={`text-[10px] font-semibold ${
                  isToday
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {dayName}
              </span>
            </div>
          )
        })}
      </div>
      <p className={`text-xs ${ui.muted} mt-2`}>{COPY.legend}</p>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/branch/WeekSalesChart.tsx
git commit -m "feat(branch): add WeekSalesChart (cash sales per day, 7-day window)"
```

---

## Task 5: `CashBranchView.tsx` — state-aware hero band

**Files:**
- Modify: `frontend/src/components/branch/CashBranchView.tsx`

- [ ] **Step 1: Import the new components and tokens**

At the top of the file, find the imports block (lines 1-9). The existing imports are:

```ts
import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import { cashApi, type CashSummary } from '../../api/cash'
import { printerApi } from '../../api/printer'
import { usePOSStore } from '../../store/posStore'
import { toast } from '../../store/toastStore'
import { BRANCH_COPY, PAY_METHOD_LABELS } from '../../copy/branchCopy'
import { ui, brand, fmtMoney, fmtDateTime } from './branchUI'
```

Add these two lines after the `./branchUI` import:

```ts
import { MovementModal } from './MovementModal'
import { WeekSalesChart } from './WeekSalesChart'
```

- [ ] **Step 2: Add state for the new modal trigger**

Inside `CashBranchView()`, find the existing state block (lines 356-362):

```ts
  const [current, setCurrent] = useState<CashSession | null>(null)
  const [past, setPast] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [reprintingId, setReprintingId] = useState<number | null>(null)
  const [showCloseWizard, setShowCloseWizard] = useState(false)
  const [methodTotals, setMethodTotals] = useState<MethodTotals | null>(null)
  const [summaryError, setSummaryError] = useState(false)
```

Add a new state right after `setShowCloseWizard`:

```ts
  const [movementModal, setMovementModal] = useState<'IN' | 'OUT' | null>(null)
  const [summary, setSummary] = useState<CashSummary | null>(null)
```

(`summary` is needed because we now read `total_inflows` / `total_outflows` / `movements` from the full summary response, beyond just `methodTotals`.)

- [ ] **Step 3: Capture full summary on load**

Find the existing summary fetch inside `useEffect` (line ~388):

```ts
      if (todaySessionId != null) {
        try {
          const summary = await cashApi.getSummary(cur ? undefined : todaySessionId)
          setMethodTotals({
            CASH: Number(summary.total_cash) || 0,
            CARD: Number(summary.total_card) || 0,
            TRANSFER: Number(summary.total_transfer) || 0,
          })
        } catch {
          setSummaryError(true)
        }
      } else {
        setSummaryError(true)
      }
```

Replace with:

```ts
      if (todaySessionId != null) {
        try {
          const sum = await cashApi.getSummary(cur ? undefined : todaySessionId)
          setSummary(sum)
          setMethodTotals({
            CASH: Number(sum.total_cash) || 0,
            CARD: Number(sum.total_card) || 0,
            TRANSFER: Number(sum.total_transfer) || 0,
          })
        } catch {
          setSummaryError(true)
        }
      } else {
        setSummaryError(true)
      }
```

- [ ] **Step 4: Update `handleShiftClosed` and add a helper to refresh after movement**

Find `handleShiftClosed` (line ~405). Right after it, add:

```ts
  async function handleMovement(amount: number, concept: string) {
    if (!movementModal) return
    try {
      if (movementModal === 'IN') await cashApi.inflow(amount, concept)
      else await cashApi.outflow(amount, concept)
      toast.success(movementModal === 'IN' ? 'Entrada registrada' : 'Salida registrada')
      setMovementModal(null)
      // Refetch summary to update KPIs and movements list
      try {
        const sum = await cashApi.getSummary()
        setSummary(sum)
        setMethodTotals({
          CASH: Number(sum.total_cash) || 0,
          CARD: Number(sum.total_card) || 0,
          TRANSFER: Number(sum.total_transfer) || 0,
        })
      } catch { /* swallow — toast already showed success */ }
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'No se pudo registrar el movimiento')
    }
  }
```

- [ ] **Step 5: Replace the hero band JSX**

Find the hero band block (lines 519-574). It begins with:

```tsx
        {/* ── Hero band ──────────────────────────────────────────────── */}
        <div className={`${ui.hero} px-6 py-6 flex flex-wrap items-center justify-between gap-4`}>
```

Replace the ENTIRE hero band block (everything from the `{/* ── Hero band ─── */}` comment down to its closing `</div>` at line 574) with:

```tsx
        {/* ── Hero band — state-aware ──────────────────────────────── */}
        {(() => {
          const heroClass =
            current ? ui.heroEmerald :
            todayClosedSession ? ui.heroOrange :
            ui.hero
          return (
            <div className={`${heroClass} px-6 py-6 flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-0.5">
                  {COPY.cash}
                </p>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Mi caja</h1>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <i className="fa-solid fa-vault text-white/50 text-2xl" />

                {current ? (
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 text-white text-xs font-semibold px-2.5 py-1">
                      <i className="fa-solid fa-circle text-[8px]" />
                      Turno abierto
                    </span>
                    <p className="text-white/80 text-sm">
                      <i className="fa-solid fa-clock mr-1 text-white/50" />
                      {formatElapsed(current.opened_at)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMovementModal('IN')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                      >
                        <i className="fa-solid fa-arrow-down text-[10px]" />
                        {BRANCH_COPY.pages.cashMovements.registerIn}
                      </button>
                      <button
                        onClick={() => setMovementModal('OUT')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                      >
                        <i className="fa-solid fa-arrow-up text-[10px]" />
                        {BRANCH_COPY.pages.cashMovements.registerOut}
                      </button>
                      <button
                        onClick={() => setShowCloseWizard(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                      >
                        <i className="fa-solid fa-moon text-[10px]" />
                        {BRANCH_COPY.cockpit.closeShift}
                      </button>
                    </div>
                  </div>
                ) : todayClosedSession ? (
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 text-white text-xs font-semibold px-2.5 py-1">
                      <i className="fa-solid fa-circle-check text-[10px]" />
                      Turno cerrado hoy
                    </span>
                    <p className="text-white/70 text-xs">
                      <i className="fa-solid fa-clock mr-1 text-white/50" />
                      {fmtDateTime(todayClosedSession.closed_at!)}
                    </p>
                  </div>
                ) : (
                  <span className={ui.pillSlate}>
                    <i className="fa-solid fa-circle text-[8px] text-slate-400" />
                    Sin caja abierta
                  </span>
                )}
              </div>
            </div>
          )
        })()}
```

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/branch/CashBranchView.tsx
git commit -m "feat(cash): state-aware hero with IN/OUT pills + close-shift CTA"
```

---

## Task 6: `CashBranchView.tsx` — KPI grid rewrite (4 cards)

**Files:**
- Modify: `frontend/src/components/branch/CashBranchView.tsx`

- [ ] **Step 1: Update `expectedCash` to include inflows/outflows**

Find the existing `expectedCash` useMemo (line ~457):

```ts
  const expectedCash = useMemo(() => {
    if (current) return parseNum(current.opening_balance) + parseNum(current.total_cash_sales)
    if (todayClosedSession) return parseNum(todayClosedSession.closing_balance)
    return null
  }, [current, todayClosedSession])
```

Replace with:

```ts
  const expectedCash = useMemo(() => {
    if (current) {
      const base = parseNum(current.opening_balance) + parseNum(current.total_cash_sales)
      const flows = (Number(summary?.total_inflows) || 0) - (Number(summary?.total_outflows) || 0)
      return base + flows
    }
    if (todayClosedSession) return parseNum(todayClosedSession.closing_balance)
    return null
  }, [current, todayClosedSession, summary])
```

- [ ] **Step 2: Replace the KPI grid block**

Find the KPI cards row (lines 577-633). It begins with:

```tsx
        {/* ── KPI cards row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon="fa-coins"
            label={COPY.cashKpis.salesToday}
            ...
```

Replace the ENTIRE row block (from the `{/* ── KPI cards row ─── */}` comment down to its closing `</div>` 4 cards later) with:

```tsx
        {/* ── KPI cards row — Efectivo / Esperado / Entradas / Salidas ─ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon="fa-coins"
            label={COPY.cashKpis.cashShift}
            value={fmtMoney(String(todaySales))}
            iconBg="rgba(16,185,129,0.12)"
            iconColor="#10b981"
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            icon="fa-scale-balanced"
            label={current ? COPY.cashKpis.expected : 'Cierre reportado'}
            value={expectedCash != null ? fmtMoney(String(expectedCash)) : '—'}
            sub={
              current
                ? `Inicial: ${fmtMoney(current.opening_balance)}`
                : todayClosedSession
                  ? `Inicial: ${fmtMoney(todayClosedSession.opening_balance)}`
                  : undefined
            }
            iconBg="rgba(139,92,246,0.12)"
            iconColor="#a78bfa"
          />
          <KpiCard
            icon="fa-arrow-down"
            label={COPY.cashKpis.inflows}
            value={summary ? `+${fmtMoney(String(summary.total_inflows))}` : '—'}
            iconBg="rgba(16,185,129,0.12)"
            iconColor="#10b981"
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            icon="fa-arrow-up"
            label={COPY.cashKpis.outflows}
            value={summary ? `-${fmtMoney(String(summary.total_outflows))}` : '—'}
            iconBg="rgba(244,63,94,0.12)"
            iconColor="#f43f5e"
            valueClass="text-rose-600 dark:text-rose-400"
          />
        </div>
```

- [ ] **Step 3: Remove now-unused state — `currentDiff`, `weekDiffSum`, `closedSessions`**

`closedSessions` is still used by `WeekSalesChart` (next task) and the bottom session list, so KEEP it. `currentDiff` and `weekDiffSum` are unused after removing the Diferencia and Turnos·7d KPIs. Find these useMemos (lines ~464 and ~469):

```ts
  const currentDiff = useMemo(() => {
    if (todaySession) return parseNum(todaySession.difference)
    return null
  }, [todaySession])

  const weekDiffSum = useMemo(
    () => closedSessions.reduce((acc, s) => acc + parseNum(s.difference), 0),
    [closedSessions],
  )
```

Delete both useMemos and any remaining references to `currentDiff` / `weekDiffSum` / `diffCardClass` higher up. Also delete `diffCardClass` definition (lines ~506-513):

```ts
  // STATUS colors for variance — semantic, not brand
  const diffCardClass =
    currentDiff == null
      ? ui.muted
      : currentDiff < 0
      ? 'text-rose-600 dark:text-rose-400'
      : currentDiff > 0
      ? brand.greenText
      : ui.muted
```

Delete that whole block.

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: build succeeds. If TS warns about unused imports (e.g. `brand` if no other usage remains), leave them — `brand` is still used by `SessionRow`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/branch/CashBranchView.tsx
git commit -m "feat(cash): KPI grid — Efectivo/Esperado/Entradas/Salidas; drop Diferencia + Turnos7d"
```

---

## Task 7: `CashBranchView.tsx` — drop STORE_CREDIT method

**Files:**
- Modify: `frontend/src/components/branch/CashBranchView.tsx`

- [ ] **Step 1: Remove STORE_CREDIT from the methods array**

Find the methods grid block (lines ~635-688). Inside, find the array literal (lines ~654-660):

```ts
              {(
                [
                  { key: 'CASH',         icon: 'fa-money-bill-wave', iconBg: 'rgba(16,185,129,0.1)',  iconColor: '#10b981' },
                  { key: 'CARD',         icon: 'fa-credit-card',     iconBg: 'rgba(139,92,246,0.1)', iconColor: '#a78bfa' },
                  { key: 'TRANSFER',     icon: 'fa-building-columns',iconBg: 'rgba(59,130,246,0.1)', iconColor: '#60a5fa' },
                  { key: 'STORE_CREDIT', icon: 'fa-store',            iconBg: 'rgba(245,158,11,0.1)', iconColor: '#f59e0b' },
                ] as const
              ).map(({ key, icon, iconBg, iconColor }) => {
```

Replace with (drops STORE_CREDIT entry):

```ts
              {(
                [
                  { key: 'CASH',     icon: 'fa-money-bill-wave',  iconBg: 'rgba(16,185,129,0.1)',  iconColor: '#10b981' },
                  { key: 'CARD',     icon: 'fa-credit-card',      iconBg: 'rgba(139,92,246,0.1)', iconColor: '#a78bfa' },
                  { key: 'TRANSFER', icon: 'fa-building-columns', iconBg: 'rgba(59,130,246,0.1)', iconColor: '#60a5fa' },
                ] as const
              ).map(({ key, icon, iconBg, iconColor }) => {
```

- [ ] **Step 2: Update the grid columns from sm:grid-cols-4 to sm:grid-cols-3**

In the same block, find the wrapping `<div>` (a few lines above the array, line ~653):

```tsx
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
```

Replace with:

```tsx
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/branch/CashBranchView.tsx
git commit -m "feat(cash): drop Crédito tienda from payment methods grid"
```

---

## Task 8: `CashBranchView.tsx` — replace chart, delete legacy

**Files:**
- Modify: `frontend/src/components/branch/CashBranchView.tsx`

- [ ] **Step 1: Delete the `WeekVarianceChart` function**

Find the entire `WeekVarianceChart` component (lines 73-146). It begins with:

```tsx
// ─── Week Variance Chart ──────────────────────────────────────────────────────

interface WeekChartProps {
  sessions: CashSession[]
}

function WeekVarianceChart({ sessions }: WeekChartProps) {
```

Delete the entire block (the `interface WeekChartProps`, the `function WeekVarianceChart`, and any lines up to and including its closing `}`). The next section after it should be `// ─── Session Row ───`.

- [ ] **Step 2: Replace the chart usage in the bottom row**

Find the chart-rendering block (line ~694):

```tsx
          {/* chart — 5 cols */}
          <div className="lg:col-span-5">
            <WeekVarianceChart sessions={past} />
          </div>
```

Replace with:

```tsx
          {/* chart — 5 cols */}
          <div className="lg:col-span-5">
            <WeekSalesChart
              sessions={past}
              todayCashSales={current ? Number(current.total_cash_sales) || 0 : 0}
            />
          </div>
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/branch/CashBranchView.tsx
git commit -m "feat(cash): swap variance chart for sales-per-day chart"
```

---

## Task 9: `CashBranchView.tsx` — add Movimientos del turno section

**Files:**
- Modify: `frontend/src/components/branch/CashBranchView.tsx`

- [ ] **Step 1: Insert the new section between methods grid and bottom row**

Find the closing `</div>` of the methods card (the card whose section title is "Esperado por método de pago" / "Cobrado hoy por método"). It ends just BEFORE the comment:

```tsx
        {/* ── Bottom row: chart + list ────────────────────────────────── */}
```

Insert this new block AFTER the methods card's closing `</div>` and BEFORE the bottom-row comment:

```tsx
        {/* ── Movimientos del turno — full width ─────────────────────── */}
        {summary && summary.movements.length > 0 && (
          <div className={`${ui.card} p-5`}>
            <p className={`${ui.sectionTitle} mb-3`}>{BRANCH_COPY.pages.cashMovements.title}</p>
            <ul className={ui.divider}>
              {summary.movements.map((m) => (
                <li key={m.id} className="py-3 flex items-center gap-3 text-sm">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                      m.type === 'IN'
                        ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    <i className={`fa-solid ${m.type === 'IN' ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 dark:text-slate-200 truncate">{m.concept || '—'}</p>
                    <p className={`text-xs ${ui.muted}`}>
                      {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span
                    className={`font-bold tabular-nums flex-shrink-0 ${
                      m.type === 'IN'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {m.type === 'IN' ? '+' : '-'}{fmtMoney(String(m.amount))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary && summary.movements.length === 0 && current && (
          <div className={`${ui.card} p-5`}>
            <p className={`${ui.sectionTitle} mb-3`}>{BRANCH_COPY.pages.cashMovements.title}</p>
            <p className={`text-sm italic ${ui.muted}`}>
              {BRANCH_COPY.pages.cashMovements.empty}
            </p>
          </div>
        )}
```

The empty-state card only renders when there's an active shift (`current`) but no movements yet — keeps the section visible for the cashier to see "this is where they'll appear".

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/branch/CashBranchView.tsx
git commit -m "feat(cash): add Movimientos del turno full-width section"
```

---

## Task 10: `CashBranchView.tsx` — mount the MovementModal

**Files:**
- Modify: `frontend/src/components/branch/CashBranchView.tsx`

- [ ] **Step 1: Mount the modal at the end of the component tree**

Find the existing modal mount near the bottom of the JSX (line ~723):

```tsx
      {/* ── Close-shift modal overlay ──────────────────────────────────── */}
      {showCloseWizard && current && (
        <CloseShiftModal
          onClosed={handleShiftClosed}
          onCancel={() => setShowCloseWizard(false)}
        />
      )}
```

Add right after it (before the final `</div>` of the component):

```tsx
      {/* ── Movement modal (IN/OUT) ────────────────────────────────────── */}
      {movementModal && (
        <MovementModal
          type={movementModal}
          onClose={() => setMovementModal(null)}
          onConfirm={handleMovement}
        />
      )}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/branch/CashBranchView.tsx
git commit -m "feat(cash): mount MovementModal triggered from hero IN/OUT pills"
```

---

## Task 11: Final build + manual smoke test

**Files:** none

- [ ] **Step 1: Clean build**

```bash
cd frontend && rm -rf dist && npm run build 2>&1 | tail -15
```

Expected: ends with `✓ built in N s`. No TypeScript errors. Bundle size warning about chunks > 500KB is the existing baseline — ignore.

- [ ] **Step 2: Run dev server and exercise the page**

In a terminal, start the backend:

```bash
# from repo root
source venv/bin/activate
uvicorn app.main:app --reload
```

In another terminal, start the frontend:

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` in a browser.

- [ ] **Step 3: Smoke walkthrough — login as a CAJERO**

Use a CAJERO account (via QA seed: `superadmin/admin123` then create a CAJERO, or use existing branch user). Navigate to `/cash-history`.

Run the spec's testing-plan items in order. For each, confirm the listed expectation. Note any deviation in a scratch file.

  1. **No shift open**: Hero is purple/slate (default `ui.hero`). KPIs all show `—`. Methods card hidden. Movimientos section hidden. Chart still renders (past 7 days from `past[]`).

  2. **Open a shift** (via POS or existing button): return to `/cash-history`. Hero turns **emerald**. Pill `Turno abierto`. Three pills visible: `+ Entrada`, `− Salida`, `Cerrar mi turno`. KPIs populate with values.

  3. **Click `+ Entrada`**: modal opens with title "Entrada de efectivo". Enter amount `500` and concept `Fondo de cambio`, click `Registrar entrada`. Modal closes. Toast: "Entrada registrada". KPI `Entradas` shows `+$500.00`. KPI `Esperado en caja` increases by $500. New row appears in `Movimientos del turno` table with green arrow + concept + time.

  4. **Click `− Salida`**: modal title "Salida / Gasto". Enter `25` and `Refresco`. Submit. KPI `Salidas` shows `-$25.00`. `Esperado` decreases by $25.

  5. **Close the shift**: Click the Cerrar pill, complete the wizard. Hero turns **orange**. Pill `Turno cerrado hoy`. Action pills disappear. KPIs show snapshot of the closed shift. Movimientos still rendered (movements of that shift).

  6. **Verify chart**: bars match expected per-day cash totals. Today's bar is fully saturated (`bg-purple-500`). Past days slightly muted (`bg-purple-500/70`). Empty days neutral grey at 8% height.

  7. **Verify methods grid is 3 cards** (CASH / CARD / TRANSFER) — no Crédito tienda.

- [ ] **Step 4: Visual review against spec**

Re-read `docs/superpowers/specs/2026-04-28-cashier-pack-cash-branch-design.md` § "Edge cases & states" table. Confirm each state matches behavior.

- [ ] **Step 5: If any deviation found**

Document and either fix in a follow-up task within this PR, or note it in the PR description as a known divergence with rationale.

---

## Task 12: Push branch and open PR

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/cashier-mi-caja-branch 2>&1
```

Expected: push succeeds, branch tracked.

- [ ] **Step 2: Open the PR via gh CLI**

```bash
gh pr create --base release/qa --title "feat(cash): Mi Caja branch view redesign — state-aware hero + IN/OUT + sales chart" --body "$(cat <<'EOF'
## Summary

Implements PR 1 of 5 in the Cashier Pack per spec
[`2026-04-28-cashier-pack-cash-branch-design.md`](docs/superpowers/specs/2026-04-28-cashier-pack-cash-branch-design.md)
and master orchestration
[`2026-04-29-cashier-pack-MASTER-orchestration.md`](docs/superpowers/specs/2026-04-29-cashier-pack-MASTER-orchestration.md).

- **State-aware hero** — emerald gradient when shift open, orange when closed today, neutral otherwise.
- **Hero pills** — `+ Entrada`, `− Salida`, and `Cerrar mi turno` visible when shift open.
- **KPI grid rewritten** — Efectivo del turno / Esperado en caja / Entradas / Salidas (drops Diferencia and Turnos · 7 días).
- **Esperado en caja formula** now includes `+ inflows − outflows` for accuracy mid-shift.
- **Drop Crédito tienda** — methods grid is 3 cards (CASH / CARD / TRANSFER).
- **New Movimientos del turno section** — full-width table fed by `summary.movements`.
- **Chart swap** — `WeekVarianceChart` (difference) → `WeekSalesChart` (cash sales per day, brand purple).
- **New `MovementModal.tsx`** — branch-scoped IN/OUT modal using `ui.*` tokens.
- **New `WeekSalesChart.tsx`** — extracted, sums `total_cash_sales` per day across closed sessions plus today's open shift.
- **New `branchUI` tokens** — `heroEmerald`, `heroOrange` (solid colors, matching existing `ui.hero` style; spec called for gradients but solid is consistent with the system).

Zero backend changes. All endpoints already returned the needed shape.

## Test plan

- [ ] CAJERO login, navigate to `/cash-history`
- [ ] No shift open → hero purple, KPIs `—`, methods hidden, movimientos hidden, chart renders past
- [ ] Open shift → hero emerald, 3 action pills visible, KPIs populate
- [ ] `+ Entrada` modal → submit `$500 Fondo` → toast, KPIs update, movimientos row appears
- [ ] `− Salida` modal → submit `$25 Refresco` → toast, KPIs update
- [ ] Close shift → hero orange, action pills hidden, KPIs snapshot
- [ ] Methods grid: 3 cards (no Crédito tienda)
- [ ] Chart bars: today saturated, past muted, empty days grey
- [ ] HQ `/cash-history` (admin route) unchanged

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Note the PR URL**

The output of `gh pr create` includes the PR URL. Save it for the master orchestration's status table update.

- [ ] **Step 4: Wait for CI + reviewer**

Per the master orchestration audit gate: CI green + spec-aligned manual smoke + `code-reviewer` agent pass before merging to qa.

---

## Self-review summary

**Spec coverage:**
- §1 Hero state-aware → Tasks 1, 5
- §2 KPI grid 4 cards → Task 6
- §3 Drop Crédito tienda → Task 7
- §4 Movimientos del turno → Task 9
- §5 Chart sales-per-day → Tasks 4, 8
- §6 MovementModal → Task 3
- §7 Backend (none) → no tasks needed
- §8 Copy → Task 2
- §9 branchUI tokens → Task 1
- §10 Component file layout → matches Tasks 3, 4
- §Edge cases → exercised in Task 11 smoke

**Placeholder scan:** none — every step has exact paths, exact code, exact commands, expected outputs.

**Type consistency:** `MovementModal` props `(type, onClose, onConfirm)` matches both Task 3 (creation) and Task 10 (mount). `WeekSalesChart` props `(sessions, todayCashSales)` matches both Task 4 (creation) and Task 8 (usage). `summary` state is added in Task 5 and consumed in Tasks 6 (expectedCash), 9 (movements), and through `setSummary` in Task 5's modified summary fetch.

**Spec deviation flagged:** §1's "from-emerald-600 to-emerald-500" gradient → solid `bg-emerald-600 dark:bg-emerald-700`. Reason: matches existing `ui.hero` token (solid), not gradient. Same visual punch.
