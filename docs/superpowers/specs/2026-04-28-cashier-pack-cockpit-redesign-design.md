# Cashier Pack — Mi Día (Cockpit) redesign

**Date:** 2026-04-28
**Module:** 1 of 5 in Cashier Pack
**Target route:** `/dataxpos` (CAJERO/GERENTE only — HQ DataXPOS stays untouched)
**Target component:** `frontend/src/components/branch/Cockpit.tsx` and its sub-components
**PR target:** `release/qa`

---

## Context

The cashier-facing landing page at `/dataxpos` renders `<Cockpit />` (HQ users see `DataXPOS.tsx` instead — out of scope). The current cockpit has these gaps:

1. **Shift status barely visible** — small amber link inside `ShiftBadge`. Cashiers miss whether their shift is open.
2. **No way to open a shift** without leaving the page (the existing `ShiftBadge` link sends to `/cash-history`, which itself does not have an open-shift control either).
3. **Top products limited to 3** — cashiers asked for more visibility into what is selling.
4. **Payment methods rendered as dynamic horizontal bars** — varies in shape day to day. Cashiers asked for the same fixed 3-card pattern used in Mi Caja (CASH / CARD / TRANSFER) for predictability and didactic value.
5. **Greeting and identity feel sparse** — generic "Hola, {name}.", no time-of-day, no role indication, no visual identity.

This redesign keeps backend contracts mostly intact (one tiny payload field addition is flagged), reuses the state-aware hero pattern approved for Mi Caja, and surfaces actions that already work but aren't reachable.

---

## Goals

- Make shift state (open vs closed) **visceral**: the entire hero band changes color, mirroring Mi Caja for consistency across the cashier's two main pages.
- Surface a working "Abrir turno" action without requiring navigation.
- Replace dynamic payment-method bars with fixed CASH/CARD/TRANSFER cards (didactic, predictable, copies Mi Caja).
- Bump top products from 3 to 5.
- Enrich identity in the hero: time-based greeting, avatar with initials, role label.

## Non-goals

- HQ `DataXPOS.tsx` is **not changed**. Only branch-facing `Cockpit` and its sub-components.
- No changes to the closing-shift flow (already in POS header / Mi Caja).
- No avatar photo upload — initials only. Photos can be added later by extending the avatar component with an optional `photoUrl` prop.
- No changes to `CockpitAlerts` or `CockpitQuickAccess`.

---

## Design

### 1. Hero band — state-aware (`CockpitGreeting.tsx` rewrite)

The hero band's gradient changes with `shift.is_open`:

| State | Gradient |
|---|---|
| Shift open (`shift.is_open === true`) | `from-emerald-600 to-emerald-500` |
| Shift closed / not open | `from-orange-600 to-orange-500` |

The neutral purple `ui.hero` is **not used on this page** — the hero always conveys state. (Mi Caja keeps the neutral as a "no data" fallback; Mi Día always has data because the dashboard payload always loads.)

#### Hero layout (left/center/right)

```
┌──────────────────────────────────────────────────────────┐
│ [Avatar]   Buenos días, Carmen.       [● Turno abierto] │
│  CG        Sucursal Centro · Cajero    ┌──────────────┐ │
│                                        │ 💰 Cobrar... │ │
│                                        └──────────────┘ │
└──────────────────────────────────────────────────────────┘
```

- **Avatar** (left): 56px circle (`w-14 h-14`), `bg-white/20`, white bold text, initials. See §6.
- **Greeting line** (center, top): `Buenos días/tardes/noches, {firstName}.` All white. `text-3xl lg:text-4xl font-extrabold`.
- **Subtitle** (center, bottom): `{branch_name} · {role_label}`. White at 80% opacity, `text-sm font-medium`.
- **Status pill** (right, top): white-translucent pill (`bg-white/20`).
  - Shift open: `● Turno abierto · 2h 14m`
  - Shift closed: `● Sin turno`
- **CTA** (right, bottom): white-background button, color matches hero gradient (`text-emerald-700` when open, `text-orange-700` when closed).
  - Open shift: `💰 Cobrar ahora` → `<Link to="/pos">`
  - Closed shift: `▶ Abrir turno` → opens `OpenShiftModal` (see §2)

The status pill and CTA are explicit and large — replacing today's tiny text link.

### 2. OpenShiftModal — new component

New file `frontend/src/components/branch/OpenShiftModal.tsx` (~90 LOC).

Props:
```ts
interface Props {
  onOpened: () => void   // parent re-fetches dashboard on success
  onCancel: () => void
}
```

Fields:
- `Monto inicial en caja` — number input, default `'0.00'`, autoFocus, step 0.01, min 0
- `Notas (opcional)` — text input

Submit:
1. `await cashApi.open(parseFloat(opening_balance), notes || undefined)`
2. On success: `toast.success(BRANCH_COPY.openShiftModal.success)`, call `onOpened()`, close modal
3. On error: `toast.error(detail ?? BRANCH_COPY.openShiftModal.error)`, leave modal open

Style: same `ui.card`, `ui.input`, `ui.btnSecondary` (cancel) + `ui.btnPrimary` (submit) tokens as `MovementModal`. Backdrop `bg-black/60 backdrop-blur-sm`.

`cashApi.open` is idempotent server-side (returns the existing OPEN session if one already exists). The modal does not need extra defensive checks.

### 3. Top products — bump to 5

In `frontend/src/components/branch/CockpitDayKPIs.tsx`, function `TopProducts`, line 71:

```ts
// before:
const topProds = (today.top_products ?? []).slice(0, 3)

// after:
const topProds = (today.top_products ?? []).slice(0, 5)
```

Layout of the card itself (`<ol>`, divider, item structure) does not change. Vertical height of the column grows by ~70px in the worst case; the parent `Cockpit` row uses `gap-4` and the sibling columns (`HeroSales`, `SecondaryKPIs`) wrap fine because they use `flex flex-col` and `h-full` — verified in current code.

The backend payload (`today.top_products`) must return at least 5 items. See §8 for verification.

### 4. Payment methods — 3 fixed cards

`CockpitDayKPIs.PaymentMethods` is rewritten. The current dynamic-bar implementation (lines 100–140) is replaced with a fixed 3-card grid mirroring Mi Caja:

```tsx
const FIXED_METHODS = [
  { key: 'CASH',     icon: 'fa-money-bill-wave',  iconBg: 'rgba(16,185,129,0.1)',  iconColor: '#10b981' },
  { key: 'CARD',     icon: 'fa-credit-card',      iconBg: 'rgba(139,92,246,0.1)', iconColor: '#a78bfa' },
  { key: 'TRANSFER', icon: 'fa-building-columns', iconBg: 'rgba(59,130,246,0.1)', iconColor: '#60a5fa' },
] as const
```

Card layout (per method, in a `grid grid-cols-3 gap-3`):

```
┌────────────────────────┐
│  [icon]  EFECTIVO      │
│         $1,250.00      │
└────────────────────────┘
```

Render rules:
- Always render exactly 3 cards, in the order CASH → CARD → TRANSFER.
- Read amount from `today.payment_methods[key] ?? 0`. If missing or zero, render `$0.00`.
- Methods other than these three (e.g. `STORE_CREDIT`, `OTHER`) in the payload are **ignored** for this card grid.
- The card stays at `lg:col-span-7` in `Cockpit.tsx` row 3; alerts stay at `lg:col-span-5`. No layout reshuffle.

Section title stays `BRANCH_COPY.cockpit.paymentMethods` ("Cobrado por método" or current value).

### 5. Avatar helper

Inline component or utility in `CockpitGreeting.tsx`:

```ts
function getInitials(fullName?: string | null, username?: string | null): string {
  const src = (fullName ?? '').trim() || (username ?? '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
```

Render:
```tsx
<div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/20 text-white text-xl font-bold flex-shrink-0">
  {getInitials(user.name, user.username)}
</div>
```

Future-proof: if a `photoUrl` is later added to `DashboardUser`, render `<img>` and fall back to the initials block.

### 6. Role label mapping

Add to `frontend/src/copy/branchCopy.ts`:

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

Used in the hero subtitle: `{user.branch_name} · {ROLE_LABELS[user.role] ?? user.role}`.

If `user.role` is not in the payload (see §8), the badge omits the role part: subtitle becomes just `{branch_name}`.

### 7. Time-based greeting

Helper in `CockpitGreeting.tsx`:

```ts
function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return BRANCH_COPY.cockpit.greetingMorning
  if (h < 19) return BRANCH_COPY.cockpit.greetingAfternoon
  return BRANCH_COPY.cockpit.greetingEvening
}
```

Used in the heading: `<h1>{timeGreeting()}, {firstName}.</h1>`.

`firstName` derived from `user.name.split(' ')[0]` with username fallback.

### 8. Backend payload requirements

Two checks must happen during plan execution:

1. **`today.top_products` must return ≥5 items.** Find the service that builds `BranchDashboard` (likely `app/services/branch_dashboard.py` or similar). If a hardcoded `.limit(3)` exists, raise it to `.limit(5)`. If already ≥5 or unbounded, no change.
2. **`DashboardUser.role` should be present.** Check `app/schemas/branch_dashboard.py` (or equivalent). If `role` is not on the schema, add it as a `str` field and populate from `current_user.role.value`.

Both are minor backend touches that fit in the same PR. If the schema work is non-trivial, the role badge degrades gracefully (omits the role) and the change can be deferred.

### 9. Copy (i18n) additions

In `frontend/src/copy/branchCopy.ts`, add to the existing `cockpit` block:

```ts
cockpit: {
  // existing keys preserved; ADD:
  greetingMorning: 'Buenos días',
  greetingAfternoon: 'Buenas tardes',
  greetingEvening: 'Buenas noches',
  shiftOpenPill: 'Turno abierto',
  shiftClosedPill: 'Sin turno',
  cobrarAhora: 'Cobrar ahora',
  abrirTurno: 'Abrir turno',
}
```

New top-level block:

```ts
openShiftModal: {
  title: 'Abrir turno',
  openingLabel: 'Monto inicial en caja',
  notesLabel: 'Notas (opcional)',
  submit: 'Abrir turno',
  success: 'Turno abierto',
  error: 'No se pudo abrir el turno',
}
```

`ROLE_LABELS` exported as a separate const (not nested under `BRANCH_COPY`) so it can be imported directly.

### 10. branchUI tokens

Reuses `ui.heroEmerald` and `ui.heroOrange` declared in the Mi Caja spec (file `frontend/src/components/branch/branchUI.ts`). If Mi Caja merges first, the tokens already exist. If Mi Día merges first, this PR creates them. The implementation plan must check before adding.

### 11. File-by-file summary

| File | Change |
|---|---|
| `frontend/src/components/branch/CockpitGreeting.tsx` | Rewrite: state-aware hero, avatar, time-based greeting, role badge, status pill, contextual CTA |
| `frontend/src/components/branch/CockpitDayKPIs.tsx` | `TopProducts`: slice(0,5). `PaymentMethods`: rewrite to 3 fixed cards |
| `frontend/src/components/branch/OpenShiftModal.tsx` | **NEW** — modal for opening a shift |
| `frontend/src/components/branch/branchUI.ts` | Add `heroEmerald`, `heroOrange` if not yet present (also declared in Mi Caja spec) |
| `frontend/src/copy/branchCopy.ts` | New keys: greetings, pill labels, CTAs, `openShiftModal` block, `ROLE_LABELS` const |
| `frontend/src/types/branchDashboard.ts` | Add `role: string` to `DashboardUser` (pending payload check) |
| `app/schemas/branch_dashboard.py` (or equivalent) | Include `role` in `DashboardUserOut` (pending check) |
| `app/services/branch_dashboard.py` (or equivalent) | Bump top_products limit from 3→5 if hardcoded |

The exact backend file paths are TBD until plan-time discovery; the spec calls for verification before edits.

---

## Data flow

```
On Cockpit mount
  └── GET /branch/dashboard → { user, shift, today, alerts }
       (today contains payment_methods, top_products, sales_total, etc.)

On "Abrir turno" click
  ├── OpenShiftModal renders
  ├── On submit: POST /cash/open { opening_balance, notes }
  └── On success: refetch GET /branch/dashboard → re-render Cockpit

On "Cobrar ahora" click
  └── <Link to="/pos">  (no API call)
```

No new endpoints. One existing endpoint (`POST /cash/open`) is now reachable from this page for the first time.

---

## Edge cases & states

| State | Hero gradient | Avatar | Greeting | Status pill | CTA |
|---|---|---|---|---|---|
| Shift open | emerald | initials | time-based, white | "Turno abierto · 2h 14m" | "Cobrar ahora" → /pos |
| No shift today | orange | initials | time-based, white | "Sin turno" | "Abrir turno" → modal |
| `user.role` missing | orange or emerald | initials | time-based | as above | as above (subtitle drops " · role") |
| `top_products` empty | n/a | n/a | n/a | n/a | TopProducts card shows existing empty state ("Sin datos" or equivalent) |
| `payment_methods` empty / all zero | n/a | n/a | n/a | n/a | 3 cards still render with `$0.00` each |

---

## Testing plan

Manual smoke (CAJERO role on `/dataxpos`):

1. Login as cashier with no shift open → `/dataxpos` → hero is **orange**, status pill says "Sin turno", CTA says "Abrir turno".
2. Click "Abrir turno" → modal opens, prefilled $0.00 → enter $200 + "Apertura matutina" → submit → toast success → modal closes → cockpit reloads → hero turns **emerald**, pill says "Turno abierto · 0m", CTA changes to "Cobrar ahora".
3. Verify avatar circle shows correct initials for current user.
4. Verify greeting matches local time (morning/afternoon/evening).
5. Verify subtitle shows `{branch_name} · Cajero`.
6. Verify TopProducts card shows up to 5 items.
7. Verify Payment Methods shows exactly 3 cards: CASH, CARD, TRANSFER. If today's sales include only CASH, the CARD and TRANSFER cards still render with $0.00.
8. Manually log a sale via /pos → return to /dataxpos → verify the corresponding payment-method card increments.

---

## Risks

- **`heroEmerald` / `heroOrange` token coordination**: If Mi Caja and Mi Día merge in different orders, both PRs claim to add the tokens. Implementation plan must check `branchUI.ts` before adding to avoid duplicate declarations.
- **`role` field absence**: If backend payload doesn't include `role` and the schema change is skipped, the role badge silently disappears. Acceptable degradation.
- **Top products limit**: If the backend caps at 3, only 3 will render even after the frontend slice change. Plan-time check is mandatory.
- **Avatar visual contrast**: White-on-translucent-white might be low-contrast against an emerald hero. If the avatar circle becomes hard to read, tweak to `bg-white/30` or add a 1px white border. Not pre-emptively done — visual review during execution.
- **OpenShiftModal does not block sales**: A cashier can still navigate to /pos without an open shift; POS itself blocks the sale flow downstream. This page surfaces the action but is not the gatekeeper.

---

## Out of scope (followups)

- Avatar photo support (no field on User model today).
- Open-shift entry from /cash-history (Mi Caja keeps current behavior; future PR can add a button there if needed).
- Per-method historical chart on Cockpit (TopProducts gets bumped to 5 here; broader charting is its own concern).
- Time-zone-aware greeting (`new Date().getHours()` uses browser local time — fine for Mexico-based deployments, may need TZ awareness if multi-region later).
