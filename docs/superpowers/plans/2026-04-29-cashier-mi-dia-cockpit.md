# Mi Día — Cockpit Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** PR 2 of 5 in Cashier Pack — implement spec `2026-04-28-cashier-pack-cockpit-redesign-design.md`: state-aware hero (verde/orange), avatar+greeting+role badge, top 5 products, 3 fixed payment cards, OpenShiftModal.

**Architecture:** Frontend rewrite of `CockpitGreeting.tsx` and parts of `CockpitDayKPIs.tsx`, plus 1 new component (`OpenShiftModal.tsx`). Minor backend additions: `role` field in `DashboardUser` schema + `top_products` limit raise from 3 to 5.

**Tech Stack:** React 18 + TypeScript + Tailwind on frontend; FastAPI + Pydantic on backend.

**Branch:** `feat/cashier-mi-dia-cockpit` off `release/qa` AFTER Mi Caja PR #184 merges (so heroEmerald/heroOrange tokens already exist; otherwise this PR creates them).

**Worktree:** `.claude/worktrees/cashier-mi-dia`

---

## Pre-flight check

This PR depends on tokens `ui.heroEmerald` and `ui.heroOrange`. Mi Caja PR #184 introduces them. Before starting:

```bash
git -C /home/atlas-tech/Devs/Atlas-API fetch origin --quiet
git -C /home/atlas-tech/Devs/Atlas-API log --oneline origin/release/qa | head -5
grep -n "heroEmerald" /home/atlas-tech/Devs/Atlas-API/frontend/src/components/branch/branchUI.ts
```

- If `heroEmerald` / `heroOrange` exist → skip Task 1 (tokens). Tasks 2+ proceed.
- If tokens don't exist (Mi Caja still pending merge) → execute Task 1 to create them; Mi Caja PR will then conflict on the same lines → resolve at merge time by accepting either copy (identical content).

---

## File structure (locked)

| File | Action |
|---|---|
| `frontend/src/components/branch/branchUI.ts` | **Modify (conditional)** — add hero tokens if not present |
| `frontend/src/copy/branchCopy.ts` | **Modify** — add cockpit greetings, pill labels, openShiftModal block, ROLE_LABELS const |
| `frontend/src/types/branchDashboard.ts` | **Modify** — add `role: string` to `DashboardUser` |
| `frontend/src/components/branch/OpenShiftModal.tsx` | **Create** — new modal for opening a shift |
| `frontend/src/components/branch/CockpitGreeting.tsx` | **Modify** — full rewrite: state-aware hero, avatar, time greeting, role badge, status pill, contextual CTA |
| `frontend/src/components/branch/CockpitDayKPIs.tsx` | **Modify** — TopProducts slice 3→5; PaymentMethods rewritten to 3 fixed cards |
| `app/schemas/branch_dashboard.py` | **Modify** — add `role: str` to `DashboardUser` |
| `app/services/branch_dashboard.py:249` | **Modify** — `.limit(3)` → `.limit(5)` and populate `role` from `current_user.role.value` |

---

## Task 0: Setup branch + worktree

- [ ] **Step 1: Sync + create worktree**

```bash
cd /home/atlas-tech/Devs/Atlas-API
git fetch origin --quiet
git worktree add /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/cashier-mi-dia -b feat/cashier-mi-dia-cockpit origin/release/qa
```

- [ ] **Step 2: Symlink node_modules + verify build baseline**

```bash
cd /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/cashier-mi-dia/frontend
ln -s ../../../../frontend/node_modules ./node_modules
npm run build 2>&1 | tail -3
```

Expected: `✓ built in N s`.

---

## Task 1 (CONDITIONAL): Add hero tokens

Only run this task if `grep -n "heroEmerald" frontend/src/components/branch/branchUI.ts` returns nothing.

- [ ] **Step 1: Add tokens**

In `frontend/src/components/branch/branchUI.ts`, after the existing `heroAlt` line:

```ts
  // Hero panel — state-aware variants for shift status (Mi Caja, Mi Día)
  // Solid colors to match the existing hero pattern (no gradients).
  heroEmerald: 'rounded-3xl bg-emerald-600 dark:bg-emerald-700 text-white shadow-2xl shadow-emerald-900/20',
  heroOrange: 'rounded-3xl bg-orange-600 dark:bg-orange-700 text-white shadow-2xl shadow-orange-900/20',
```

- [ ] **Step 2: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/components/branch/branchUI.ts
git commit -m "feat(branch): add heroEmerald and heroOrange tokens for shift-state hero"
```

If Mi Caja PR has not merged yet, this commit will conflict at merge time. Accept-either resolution (content identical).

---

## Task 2: Extend `branchCopy.ts`

**File:** `frontend/src/copy/branchCopy.ts`

- [ ] **Step 1: Extend `cockpit` block with greetings, pill labels, CTAs**

Find the existing `cockpit:` block. Find the line:

```ts
    greeting: (name: string) => `Hola, ${name}.`,
```

Right ABOVE that line (or after, anywhere in the cockpit block), add:

```ts
    greetingMorning: 'Buenos días',
    greetingAfternoon: 'Buenas tardes',
    greetingEvening: 'Buenas noches',
    shiftOpenPill: 'Turno abierto',
    shiftClosedPill: 'Sin turno',
    cobrarAhora: 'Cobrar ahora',
    abrirTurno: 'Abrir turno',
```

- [ ] **Step 2: Add `openShiftModal` top-level block**

After the closing `}` of the existing `pages:` object inside `BRANCH_COPY` (and before the closing `}` of `BRANCH_COPY`), add:

```ts
  openShiftModal: {
    title: 'Abrir turno',
    openingLabel: 'Monto inicial en caja',
    notesLabel: 'Notas (opcional)',
    submit: 'Abrir turno',
    success: 'Turno abierto',
    error: 'No se pudo abrir el turno',
  },
```

- [ ] **Step 3: Add `ROLE_LABELS` exported const**

At the top of the file (after the existing `PAY_METHOD_LABELS` export), add:

```ts
export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Admin',
  DUEÑO: 'Dueño',
  GERENTE: 'Gerente',
  CAJERO: 'Cajero',
  VENDEDOR: 'Vendedor',
  SOPORTE_OPERATIVO: 'Soporte',
  CLIENTE: 'Cliente',
}
```

- [ ] **Step 4: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/copy/branchCopy.ts
git commit -m "feat(branch): add cockpit greetings/openShiftModal copy + ROLE_LABELS"
```

---

## Task 3: Backend — `role` field + top_products limit

**Files:**
- Modify: `app/schemas/branch_dashboard.py`
- Modify: `app/services/branch_dashboard.py`

- [ ] **Step 1: Add `role` to `DashboardUser` schema**

Find `class DashboardUser` (line 7):

```python
class DashboardUser(BaseModel):
    name: str
    branch_name: str
```

Add `role`:

```python
class DashboardUser(BaseModel):
    name: str
    branch_name: str
    role: str = ""  # default empty for backward compat
```

- [ ] **Step 2: Populate `role` in service**

Open `app/services/branch_dashboard.py`. Find where `DashboardUser` is constructed in the `build()` method (search for `DashboardUser(`). Add `role=str(self.current_user.role.value if hasattr(self.current_user.role, 'value') else self.current_user.role)`:

```python
            user=DashboardUser(
                name=self.current_user.full_name or self.current_user.username or "",
                branch_name=branch_name or "",
                role=str(self.current_user.role.value if hasattr(self.current_user.role, 'value') else self.current_user.role),
            ),
```

(The exact existing fields may differ — adapt to match existing keyword args.)

- [ ] **Step 3: Raise top_products limit**

Find line 249 in `app/services/branch_dashboard.py`:

```python
            .limit(3)
```

Replace with:

```python
            .limit(5)
```

- [ ] **Step 4: Verify**

```bash
python -m py_compile app/schemas/branch_dashboard.py app/services/branch_dashboard.py && echo "compile OK"
```

- [ ] **Step 5: Commit**

```bash
git add app/schemas/branch_dashboard.py app/services/branch_dashboard.py
git commit -m "feat(branch-dashboard): add role to DashboardUser; top_products 3→5"
```

---

## Task 4: Frontend type — `DashboardUser.role`

**File:** `frontend/src/types/branchDashboard.ts`

- [ ] **Step 1: Add `role` field**

Replace:

```ts
export interface DashboardUser {
  name: string
  branch_name: string
}
```

With:

```ts
export interface DashboardUser {
  name: string
  branch_name: string
  role: string
}
```

- [ ] **Step 2: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/types/branchDashboard.ts
git commit -m "feat(branch): add role to DashboardUser type"
```

---

## Task 5: Create `OpenShiftModal.tsx`

**File:** `frontend/src/components/branch/OpenShiftModal.tsx` (new)

- [ ] **Step 1: Create with full content**

```tsx
import { useState } from 'react'
import { ui } from './branchUI'
import { BRANCH_COPY } from '../../copy/branchCopy'
import { cashApi } from '../../api/cash'
import { toast } from '../../store/toastStore'

interface Props {
  onOpened: () => void
  onCancel: () => void
}

export function OpenShiftModal({ onOpened, onCancel }: Props) {
  const COPY = BRANCH_COPY.openShiftModal
  const [opening, setOpening] = useState('0.00')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    const amt = parseFloat(opening)
    if (isNaN(amt) || amt < 0) {
      toast.error('Monto inválido')
      return
    }
    setLoading(true)
    try {
      await cashApi.open(amt, notes.trim() || undefined)
      toast.success(COPY.success)
      onOpened()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? COPY.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className={`${ui.card} w-full max-w-sm p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{COPY.title}</h3>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            aria-label="Cancelar"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className={`block ${ui.kpiLabel} mb-1`}>{COPY.openingLabel}</span>
            <input
              type="number"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              className={ui.input}
              step="0.01"
              min="0"
              autoFocus
            />
          </label>
          <label className="block">
            <span className={`block ${ui.kpiLabel} mb-1`}>{COPY.notesLabel}</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={ui.input}
              placeholder="Apertura matutina, etc."
            />
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} className={`${ui.btnSecondary} flex-1`} disabled={loading}>
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className={`${ui.btnPrimary} flex-1`}
          >
            {loading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-check" /> {COPY.submit}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/components/branch/OpenShiftModal.tsx
git commit -m "feat(branch): add OpenShiftModal for opening a cash shift"
```

---

## Task 6: Rewrite `CockpitGreeting.tsx`

**File:** `frontend/src/components/branch/CockpitGreeting.tsx`

Full rewrite. The current file (~70 lines) is replaced wholesale.

- [ ] **Step 1: Replace entire file content**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BRANCH_COPY, ROLE_LABELS } from '../../copy/branchCopy'
import { ui } from './branchUI'
import { OpenShiftModal } from './OpenShiftModal'
import type { DashboardShift, DashboardUser } from '../../types/branchDashboard'

interface Props {
  user: DashboardUser
  shift: DashboardShift
  onShiftOpened?: () => void  // parent refetches dashboard
}

function getInitials(fullName?: string | null, username?: string | null): string {
  const src = (fullName ?? '').trim() || (username ?? '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return BRANCH_COPY.cockpit.greetingMorning
  if (h < 19) return BRANCH_COPY.cockpit.greetingAfternoon
  return BRANCH_COPY.cockpit.greetingEvening
}

function formatElapsed(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function CockpitGreeting({ user, shift, onShiftOpened }: Props) {
  const [showOpenModal, setShowOpenModal] = useState(false)

  const heroClass = shift.is_open ? ui.heroEmerald : ui.heroOrange
  const ctaTextColor = shift.is_open ? 'text-emerald-700' : 'text-orange-700'
  const firstName = (user.name ?? '').split(/\s+/)[0] || user.name || ''
  const roleLabel = user.role ? (ROLE_LABELS[user.role] ?? user.role) : null

  return (
    <>
      <header className={`${heroClass} px-6 py-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4`}>
        {/* Left — avatar + greeting + subtitle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/20 text-white text-xl font-bold flex-shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
              {timeGreeting()}, {firstName}.
            </h1>
            <p className="text-base text-white/85 font-medium">
              {user.branch_name}
              {roleLabel && <span className="opacity-70"> · {roleLabel}</span>}
            </p>
          </div>
        </div>

        {/* Right — status pill + contextual CTA */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 text-white text-xs font-semibold px-2.5 py-1">
            <i className="fa-solid fa-circle text-[8px]" />
            {shift.is_open
              ? `${BRANCH_COPY.cockpit.shiftOpenPill} · ${formatElapsed(shift.duration_minutes ?? 0)}`
              : BRANCH_COPY.cockpit.shiftClosedPill}
          </span>

          {shift.is_open ? (
            <Link
              to="/pos"
              className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-white ${ctaTextColor} hover:bg-white/95 active:bg-white/90 font-bold text-base py-3 px-6 transition-colors shadow-lg shadow-black/20`}
              aria-label={BRANCH_COPY.cockpit.cobrarAhora}
            >
              <i className="fa-solid fa-cash-register" />
              {BRANCH_COPY.cockpit.cobrarAhora}
            </Link>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-white ${ctaTextColor} hover:bg-white/95 active:bg-white/90 font-bold text-base py-3 px-6 transition-colors shadow-lg shadow-black/20`}
            >
              <i className="fa-solid fa-play" />
              {BRANCH_COPY.cockpit.abrirTurno}
            </button>
          )}
        </div>
      </header>

      {showOpenModal && (
        <OpenShiftModal
          onOpened={() => { setShowOpenModal(false); onShiftOpened?.() }}
          onCancel={() => setShowOpenModal(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Pass `onShiftOpened` from `Cockpit.tsx`**

In `frontend/src/components/branch/Cockpit.tsx`, find:

```tsx
            <CockpitGreeting user={data.user} shift={data.shift} />
```

Replace with:

```tsx
            <CockpitGreeting
              user={data.user}
              shift={data.shift}
              onShiftOpened={() => {
                // Refetch dashboard
                getBranchDashboard().then((d) => setData(d)).catch(() => {})
              }}
            />
```

- [ ] **Step 3: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/components/branch/CockpitGreeting.tsx frontend/src/components/branch/Cockpit.tsx
git commit -m "feat(cockpit): state-aware hero + avatar + greeting + role badge + abrir-turno CTA"
```

---

## Task 7: `CockpitDayKPIs.tsx` — top 5 + 3 fixed payment cards

**File:** `frontend/src/components/branch/CockpitDayKPIs.tsx`

- [ ] **Step 1: TopProducts slice 3 → 5**

Find line 71:

```ts
const topProds = (today.top_products ?? []).slice(0, 3)
```

Replace with:

```ts
const topProds = (today.top_products ?? []).slice(0, 5)
```

- [ ] **Step 2: Replace `PaymentMethods` function**

Find `function PaymentMethods({ today }: TodayProps)` (line ~101). Replace the entire function with:

```tsx
const FIXED_METHODS = [
  { key: 'CASH',     icon: 'fa-money-bill-wave',  iconBg: 'rgba(16,185,129,0.1)',  iconColor: '#10b981' },
  { key: 'CARD',     icon: 'fa-credit-card',      iconBg: 'rgba(139,92,246,0.1)', iconColor: '#a78bfa' },
  { key: 'TRANSFER', icon: 'fa-building-columns', iconBg: 'rgba(59,130,246,0.1)', iconColor: '#60a5fa' },
] as const

function PaymentMethods({ today }: TodayProps) {
  const payMethods = today.payment_methods ?? {}

  return (
    <div className={`${ui.card} p-5`}>
      <p className={`${ui.kpiLabel} mb-4`}>{BRANCH_COPY.cockpit.paymentMethods}</p>
      <div className="grid grid-cols-3 gap-3">
        {FIXED_METHODS.map(({ key, icon, iconBg, iconColor }) => {
          const amount = Number(payMethods[key] ?? 0)
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ background: iconBg }}
              >
                <i className={`fa-solid ${icon} text-sm`} style={{ color: iconColor }} />
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>
                  {PAY_METHOD_LABELS[key] ?? key}
                </p>
                <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                  {fmtMoney(amount)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

The `FIXED_METHODS` const is hoisted to module scope (above `PaymentMethods`).

- [ ] **Step 3: Verify + commit**

```bash
cd frontend && npm run build 2>&1 | tail -3
git add frontend/src/components/branch/CockpitDayKPIs.tsx
git commit -m "feat(cockpit): TopProducts 3→5; PaymentMethods as 3 fixed cards"
```

---

## Task 8: Final build + push + PR

- [ ] **Step 1: Final clean build**

```bash
cd /home/atlas-tech/Devs/Atlas-API/.claude/worktrees/cashier-mi-dia
cd frontend && rm -rf dist && npm run build 2>&1 | tail -10
```

- [ ] **Step 2: Push**

```bash
git push -u origin feat/cashier-mi-dia-cockpit
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --base release/qa --head feat/cashier-mi-dia-cockpit \
  --title "feat(cockpit): Mi Día redesign — state-aware hero + avatar + abrir-turno + 3 payment cards" \
  --body "PR 2 of 5 in Cashier Pack. Spec: docs/superpowers/specs/2026-04-28-cashier-pack-cockpit-redesign-design.md. Plan: docs/superpowers/plans/2026-04-29-cashier-mi-dia-cockpit.md.

- State-aware hero: emerald solid when shift open, orange when closed (uses heroEmerald/heroOrange tokens).
- Avatar with initials, time-based greeting (Buenos días/tardes/noches), role badge.
- Status pill (Turno abierto · 2h 14m / Sin turno) + contextual CTA (Cobrar ahora / Abrir turno).
- Abrir turno opens new OpenShiftModal that calls cashApi.open() and refetches dashboard.
- TopProducts: bumped 3→5; backend service .limit(3) → .limit(5).
- PaymentMethods: rewritten from dynamic horizontal bars to 3 fixed cards (CASH / CARD / TRANSFER) with always-rendered \$0.00 fallback.
- DashboardUser.role added to schema + populated in service. Frontend type extended.

Depends on Mi Caja PR #184 having merged for shared heroEmerald/heroOrange tokens. If not, this PR's Task 1 commit creates them; resolve token conflict at merge time.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-review

**Spec coverage:**
- §1 Hero state-aware → Tasks 1, 6
- §2 OpenShiftModal → Task 5
- §3 Top products 3→5 → Tasks 3, 7
- §4 PaymentMethods 3 fixed cards → Task 7
- §5 Avatar with initials → Task 6
- §6 Role label mapping → Tasks 2, 6
- §7 Time-based greeting → Tasks 2, 6
- §8 Backend payload requirements → Task 3
- §9 Copy additions → Task 2
- §10 branchUI tokens → Task 1 (conditional)
- §11 File-by-file → matches Tasks 1-7

**Placeholder scan:** none — exact paths, exact code.

**Type consistency:** `DashboardUser.role` added in Tasks 3 (backend) and 4 (frontend). `OpenShiftModal` props `(onOpened, onCancel)` match between Task 5 (creation) and Task 6 (mount). `CockpitGreeting` new prop `onShiftOpened` matches between Task 6 step 1 (signature) and Task 6 step 2 (mount in Cockpit.tsx). `ROLE_LABELS` exported from branchCopy.ts in Task 2; consumed in Task 6.

**Risk note:** if Mi Caja merges between when Task 1 ran and when this PR's branch is rebased, the token-add commit becomes redundant. Resolution at merge time accepts either version (identical content). Worst case: a no-op rebase commit.
