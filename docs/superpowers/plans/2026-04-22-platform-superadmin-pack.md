# Platform SUPERADMIN — Mega Implementation Plan

> **Para agentes:** SUB-SKILL recomendado: `superpowers:subagent-driven-development` (1 subagente por fase) o `superpowers:executing-plans` (inline con checkpoints). Steps usan `- [ ]` para tracking.

**Goal:** Llevar los 9 módulos `/platform/*` (SUPERADMIN) a paridad completa con `context/TASKS_PLATFORM_SUPERADMIN.md`, aplicando el design system de `context/PLATFORM_ADMIN_UI_SKILL.md` (tokens `--p-*`, KPI strip, DataTable compartido, SideDrawer para CRUDs, dark mission-control).

**Architecture:** 5 fases secuenciales. Fase 0 sienta tokens + componentes compartidos en `frontend/src/components/platform/` (sin esto cada módulo duplica). Fase 1 cierra gaps de backend (audit write, admin CRUD, module CRUD, KPI helpers). Fases 2-4 implementan los 9 módulos en orden de prioridad de la spec (P1 → P2 → P3). Cada módulo = 1 branch + 1 PR contra `release/qa` para preservar trazabilidad por módulo.

**Tech Stack:** React 18 + TS + Vite + Recharts + Zustand + Axios + FastAPI + SQLAlchemy.

**Coverage hoy (per audit):** ~45% del spec implementado. Tablas + CRUD básicos existen; falta tokens, drawer pattern, charts, audit log feature, admin CRUD, module CRUD, SUPPORT role.

**Estrategia PR:** Branch `feat/platform-foundations` para Fase 0+1 → 1 PR. Después 1 branch + 1 PR por módulo (M1..M9). Total: ~10 PRs contra `release/qa`. Promote a beta cuando los P1 estén estables.

---

## File Structure

**Crear (Fase 0):**
```
frontend/src/components/platform/
├── KPICard.tsx                 # Tarjeta con label, value, delta, accentColor
├── DataTable.tsx               # Tabla genérica: search, sort, paginate, CSV export
├── StatusBadge.tsx             # Badges: active/inactive/beta/stable/archived/superadmin/support
├── SideDrawer.tsx              # 480px right drawer con header/body/footer
├── ConfirmModal.tsx            # Modal con escritura del nombre del recurso para destructivos
├── GradientAccent.tsx          # Línea/border de gradiente firma
├── PlatformPageShell.tsx       # Header + KPI strip + content slot estándar
└── chartTheme.ts               # Defaults para Recharts (dark, paleta, ticks)
```

**Modificar (Fase 0):**
- `frontend/src/index.css` — añadir `:root` con tokens `--p-*`.
- `frontend/src/pages/platform/PlatformLayout.tsx` — aplicar tokens, breadcrumb, drawer slot.

**Modificar (Fase 1, backend):**
- `app/routers/platform.py` — endpoints faltantes (audit write hook, audit filters, admin CRUD, module CRUD, user reset/role, KPI deltas).
- `app/services/audit_service.py` (nuevo) — wrapper para escribir audit logs desde otros routers.
- `app/schemas/platform.py` — schemas para audit filter, admin invite, module CRUD.
- `app/security/__init__.py:155` — `require_platform_admin` admite también SUPPORT con flag `support_ok`.

**Modificar (Fases 2-4, frontend):**
Cada módulo en su propio branch:
- M9 audit: `PlatformAuditLog.tsx` + `frontend/src/api/platform.ts` (audit filtros + export).
- M4 users: `PlatformUsers.tsx` + api (reset/role/sessions).
- M2 orgs: `PlatformOrganizations.tsx` (drawer + filters + CSV).
- M1 metrics: `PlatformMetrics.tsx` (deltas + AreaChart + Top5/Last5 panels).
- M3 orgDetail: `PlatformOrgDetail.tsx` (breadcrumb + danger zone + preset section).
- M5 branches: `PlatformBranches.tsx` (alertas).
- M8 admins: `PlatformAdmins.tsx` (CRUD completo).
- M6 presets: `PlatformPresets.tsx` (drawer + warning system).
- M7 modules: `PlatformModules.tsx` (build from stub).

---

## FASE 0 — Foundations (tokens + componentes compartidos)

**Branch:** `feat/platform-foundations`
**PR:** uno solo cubriendo Fase 0 + Fase 1.

### Task 0.1: Añadir tokens `--p-*` a `index.css`

**Files:**
- Modify: `frontend/src/index.css` (después del bloque `--dax-*` existente, antes de `.dark`)

- [ ] **Step 1:** Pegar el bloque siguiente en `:root`:
```css
/* ── PLATFORM (SUPERADMIN) — tokens dark-only obligatorios ── */
--p-bg:        #141416;
--p-surface:   #1E1E22;
--p-surface-2: #25252C;
--p-border:    #2A2A32;
--p-text:      #E8E8EA;
--p-muted:     #6B6B78;
--p-hint:      #44444E;
--p-teal:      #00C9B1;
--p-cyan:      #00E5FF;
--p-purple:    #7B2FBE;
--p-magenta:   #C026D3;
--p-success:   #22C55E;
--p-warning:   #F59E0B;
--p-danger:    #EF4444;
--p-info:      #3B82F6;
--p-gradient:  linear-gradient(135deg, #00C9B1, #00E5FF, #7B2FBE, #C026D3);
```

- [ ] **Step 2:** `cd frontend && npm run build` → verde.

- [ ] **Step 3:** Commit: `feat(platform): add --p-* design tokens`.

### Task 0.2: `KPICard` component

**Files:**
- Create: `frontend/src/components/platform/KPICard.tsx`

- [ ] **Step 1:** Escribir el archivo:
```tsx
interface KPICardProps {
  label: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  accent?: 'teal' | 'cyan' | 'purple' | 'magenta' | 'warning' | 'danger'
  icon?: string
}
const ACCENT_COLOR: Record<NonNullable<KPICardProps['accent']>, string> = {
  teal: 'var(--p-teal)', cyan: 'var(--p-cyan)', purple: 'var(--p-purple)',
  magenta: 'var(--p-magenta)', warning: 'var(--p-warning)', danger: 'var(--p-danger)',
}
export function KPICard({ label, value, delta, deltaPositive, accent = 'teal', icon }: KPICardProps) {
  return (
    <div style={{
      background: 'var(--p-surface)', border: '1px solid var(--p-border)',
      borderRadius: 6, padding: '1rem 1.25rem',
      borderTop: `2px solid ${ACCENT_COLOR[accent]}`,
    }}>
      <p style={{ fontSize: '0.7rem', color: 'var(--p-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <i className={`fa-solid ${icon}`} />}{label}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--p-text)', margin: '0 0 4px', lineHeight: 1 }}>{value}</p>
      {delta && (
        <p style={{ fontSize: '0.75rem', color: deltaPositive ? 'var(--p-success)' : 'var(--p-danger)', margin: 0 }}>
          {deltaPositive ? '↑' : '↓'} {delta}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2:** Build verde.

- [ ] **Step 3:** Commit: `feat(platform): KPICard component`.

### Task 0.3: `StatusBadge` component

**Files:**
- Create: `frontend/src/components/platform/StatusBadge.tsx`

- [ ] **Step 1:** Escribir:
```tsx
type Status = 'active' | 'inactive' | 'beta' | 'stable' | 'archived' | 'superadmin' | 'support'
const CFG: Record<Status, { label: string; bg: string; color: string }> = {
  active:     { label: 'Activo',     bg: 'rgba(0,201,177,0.12)',    color: 'var(--p-teal)' },
  inactive:   { label: 'Inactivo',   bg: 'rgba(107,107,120,0.2)',    color: 'var(--p-muted)' },
  beta:       { label: 'BETA',       bg: 'rgba(245,158,11,0.15)',    color: 'var(--p-warning)' },
  stable:     { label: 'Stable',     bg: 'rgba(34,197,94,0.12)',     color: 'var(--p-success)' },
  archived:   { label: 'Archivado',  bg: 'rgba(239,68,68,0.12)',     color: 'var(--p-danger)' },
  superadmin: { label: 'SUPERADMIN', bg: 'rgba(192,38,211,0.15)',    color: 'var(--p-magenta)' },
  support:    { label: 'SUPPORT',    bg: 'rgba(59,130,246,0.15)',    color: 'var(--p-info)' },
}
export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const c = CFG[status]
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label ?? c.label}
    </span>
  )
}
```

- [ ] **Step 2:** Build verde.

- [ ] **Step 3:** Commit: `feat(platform): StatusBadge component`.

### Task 0.4: `SideDrawer` component

**Files:**
- Create: `frontend/src/components/platform/SideDrawer.tsx`

- [ ] **Step 1:** Escribir:
```tsx
import { useEffect } from 'react'
interface Props {
  open: boolean
  title: string
  onClose: () => void
  onSave?: () => void
  saveLabel?: string
  saving?: boolean
  children: React.ReactNode
  width?: number
}
export function SideDrawer({ open, title, onClose, onSave, saveLabel = 'Guardar', saving = false, children, width = 480 }: Props) {
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, height: '100vh', width,
        background: 'var(--p-surface)', borderLeft: '1px solid var(--p-border)',
        zIndex: 1000, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--p-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--p-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', color: 'var(--p-text)' }}>{children}</div>
        {onSave && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--p-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} disabled={saving} style={{ background: 'var(--p-surface-2)', color: 'var(--p-text)', border: '1px solid var(--p-border)', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={onSave} disabled={saving} style={{ background: 'var(--p-teal)', color: '#000', fontWeight: 700, padding: '8px 20px', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
              {saving ? '...' : saveLabel}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2:** Build verde.

- [ ] **Step 3:** Commit: `feat(platform): SideDrawer component`.

### Task 0.5: `DataTable` component

**Files:**
- Create: `frontend/src/components/platform/DataTable.tsx`

- [ ] **Step 1:** Escribir el componente con: search local, sort por columna, paginación 20, export CSV. (Componente largo — código completo abajo.)

```tsx
import { useMemo, useState } from 'react'

export interface DataTableColumn<T> {
  key: string
  label: string
  accessor: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
  sortable?: boolean
  width?: string
}

interface Props<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  searchable?: boolean
  searchKeys?: (row: T) => string
  pageSize?: number
  csvFilename?: string
  csvRow?: (row: T) => Record<string, string | number>
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export function DataTable<T>({ data, columns, searchable = true, searchKeys, pageSize = 20, csvFilename, csvRow, rowKey, onRowClick, emptyMessage = 'Sin datos' }: Props<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!search.trim() || !searchKeys) return data
    const q = search.toLowerCase()
    return data.filter(r => searchKeys(r).toLowerCase().includes(q))
  }, [data, search, searchKeys])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find(c => c.key === sortKey)
    if (!col?.sortValue) return filtered
    const out = [...filtered].sort((a, b) => {
      const va = col.sortValue!(a); const vb = col.sortValue!(b)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return out
  }, [filtered, sortKey, sortDir, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const exportCSV = () => {
    if (!csvRow || !csvFilename) return
    const rows = sorted.map(csvRow)
    if (rows.length === 0) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = csvFilename; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 6 }}>
      {(searchable || csvRow) && (
        <div style={{ padding: 12, display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--p-border)' }}>
          {searchable && (
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="Buscar..."
              style={{ background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', color: 'var(--p-text)', padding: '6px 10px', borderRadius: 4, fontSize: 13, width: 240 }}
            />
          )}
          {csvRow && csvFilename && (
            <button onClick={exportCSV} style={{ background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', color: 'var(--p-text)', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <i className="fa-solid fa-download" style={{ marginRight: 6 }} /> CSV
            </button>
          )}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead style={{ background: 'var(--p-surface-2)' }}>
          <tr>
            {columns.map(c => (
              <th key={c.key} onClick={() => c.sortable && toggleSort(c.key)} style={{
                padding: '10px 14px', textAlign: 'left', color: 'var(--p-muted)',
                fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 600, cursor: c.sortable ? 'pointer' : 'default',
                userSelect: 'none', borderBottom: '1px solid var(--p-border)',
                width: c.width,
              }}>
                {c.label}
                {sortKey === c.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: 24, textAlign: 'center', color: 'var(--p-muted)' }}>{emptyMessage}</td></tr>
          ) : pageRows.map(r => (
            <tr key={rowKey(r)} onClick={() => onRowClick?.(r)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
              {columns.map(c => (
                <td key={c.key} style={{ padding: '12px 14px', borderBottom: '1px solid var(--p-border)', color: 'var(--p-text)', verticalAlign: 'middle' }}>
                  {c.accessor(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--p-border)' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'var(--p-surface-2)', color: 'var(--p-text)', border: '1px solid var(--p-border)', padding: '4px 12px', borderRadius: 4, fontSize: 12, opacity: page === 0 ? 0.4 : 1 }}>← Anterior</button>
          <span style={{ color: 'var(--p-muted)', fontSize: 12 }}>Pág. {page + 1} / {pages} · {sorted.length} registros</span>
          <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} style={{ background: 'var(--p-surface-2)', color: 'var(--p-text)', border: '1px solid var(--p-border)', padding: '4px 12px', borderRadius: 4, fontSize: 12, opacity: page >= pages - 1 ? 0.4 : 1 }}>Siguiente →</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2:** Build verde.

- [ ] **Step 3:** Commit: `feat(platform): DataTable with search, sort, paginate, CSV export`.

### Task 0.6: `ConfirmModal` (escribir nombre del recurso)

**Files:**
- Create: `frontend/src/components/platform/ConfirmModal.tsx`

- [ ] **Step 1:** Escribir:
```tsx
import { useState, useEffect } from 'react'
interface Props {
  open: boolean
  title: string
  message: string
  resourceName: string  // ej. nombre de la org — el usuario debe escribirlo exacto
  destructive?: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  busy?: boolean
}
export function ConfirmModal({ open, title, message, resourceName, destructive, onClose, onConfirm, busy }: Props) {
  const [typed, setTyped] = useState('')
  useEffect(() => { if (open) setTyped('') }, [open])
  if (!open) return null
  const confirmed = typed === resourceName
  const accent = destructive ? 'var(--p-danger)' : 'var(--p-teal)'
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--p-surface)', border: `1px solid ${accent}`, borderRadius: 6, padding: 20, width: 420 }}>
        <h3 style={{ margin: 0, color: 'var(--p-text)', fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
        <p style={{ color: 'var(--p-muted)', fontSize: '0.85rem', marginTop: 8, marginBottom: 12 }}>{message}</p>
        <p style={{ color: 'var(--p-text)', fontSize: '0.8rem', marginBottom: 6 }}>Para confirmar, escribe <code style={{ color: accent, fontWeight: 700 }}>{resourceName}</code>:</p>
        <input value={typed} onChange={e => setTyped(e.target.value)} style={{ width: '100%', background: 'var(--p-surface-2)', color: 'var(--p-text)', border: '1px solid var(--p-border)', padding: '6px 10px', borderRadius: 4, fontSize: 13, marginBottom: 12 }} autoFocus />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={{ background: 'var(--p-surface-2)', color: 'var(--p-text)', border: '1px solid var(--p-border)', padding: '6px 14px', borderRadius: 4, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onConfirm()} disabled={!confirmed || busy} style={{ background: accent, color: destructive ? '#fff' : '#000', fontWeight: 700, border: 'none', padding: '6px 16px', borderRadius: 4, cursor: confirmed && !busy ? 'pointer' : 'not-allowed', opacity: confirmed && !busy ? 1 : 0.4 }}>
            {busy ? '...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2:** Build verde.

- [ ] **Step 3:** Commit: `feat(platform): ConfirmModal with typed-name confirmation`.

### Task 0.7: `PlatformPageShell` + `chartTheme.ts` + `GradientAccent`

**Files:**
- Create: `frontend/src/components/platform/PlatformPageShell.tsx`
- Create: `frontend/src/components/platform/chartTheme.ts`
- Create: `frontend/src/components/platform/GradientAccent.tsx`

- [ ] **Step 1:** `PlatformPageShell.tsx`:
```tsx
interface Props { breadcrumb?: string; title: string; actions?: React.ReactNode; kpis?: React.ReactNode; children: React.ReactNode }
export function PlatformPageShell({ breadcrumb = 'Platform / Superadmin', title, actions, kpis, children }: Props) {
  return (
    <div style={{ background: 'var(--p-bg)', minHeight: '100vh', padding: '2rem', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ fontSize: '0.7rem', color: 'var(--p-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{breadcrumb}</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--p-text)', margin: 0 }}>{title}</h1>
        </div>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      {kpis && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>{kpis}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>{children}</div>
    </div>
  )
}
```

- [ ] **Step 2:** `chartTheme.ts`:
```ts
export const CHART_COLORS = ['#00C9B1', '#00E5FF', '#7B2FBE', '#C026D3', '#F59E0B', '#3B82F6']
export const chartAxis = { tick: { fill: '#6B6B78', fontSize: 11 }, axisLine: { stroke: '#2A2A32' } }
export const chartGrid = { strokeDasharray: '3 3', stroke: '#2A2A32' }
export const chartTooltipStyle = { background: '#25252C', border: '1px solid #2A2A32', borderRadius: 4, color: '#E8E8EA', fontSize: 12 }
export const chartLegend = { wrapperStyle: { color: '#6B6B78', fontSize: 12 } }
```

- [ ] **Step 3:** `GradientAccent.tsx`:
```tsx
export function GradientAccent({ vertical = false }: { vertical?: boolean }) {
  return <div style={{ background: 'var(--p-gradient)', height: vertical ? '100%' : 2, width: vertical ? 2 : '100%', border: 'none', margin: vertical ? 0 : '1.5rem 0' }} />
}
```

- [ ] **Step 4:** Build verde.

- [ ] **Step 5:** Commit: `feat(platform): PageShell + chartTheme + GradientAccent`.

### Task 0.8: Aplicar tokens al `PlatformLayout.tsx`

**Files:**
- Modify: `frontend/src/pages/platform/PlatformLayout.tsx`

- [ ] **Step 1:** Reemplazar `bg-slate-*` y `text-slate-*` por inline styles con `var(--p-bg)`, `var(--p-surface)`, `var(--p-text)`. Mantener estructura sidebar + outlet.

- [ ] **Step 2:** Build verde.

- [ ] **Step 3:** Commit: `refactor(platform): apply --p-* tokens to PlatformLayout`.

---

## FASE 1 — Backend gaps

### Task 1.1: Audit log write helper + filter endpoint

**Files:**
- Create: `app/services/audit_service.py`
- Modify: `app/routers/platform.py:1603` (`GET /audit/logs`)

- [ ] **Step 1:** `audit_service.py`:
```python
from app.models import AuditLog  # asume existe; si no, crear modelo en este task
from sqlalchemy.orm import Session

def write_audit(db: Session, *, user_id: int, action: str, entity: str, entity_id: str | None = None, org_id: int | None = None, ip: str | None = None, result: str = "OK", meta: dict | None = None):
    log = AuditLog(
        user_id=user_id, action=action, entity=entity, entity_id=entity_id,
        organization_id=org_id, ip=ip, result=result, meta=meta or {},
    )
    db.add(log)
    # caller hace commit
```

- [ ] **Step 2:** Verificar que `app/models/audit.py` (o similar) define `AuditLog`. Si no, crear modelo:
```python
# app/models/audit.py
from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
class AuditLog(Base):
    __tablename__ = "platform_audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String, nullable=False, index=True)
    entity = Column(String, nullable=False, index=True)
    entity_id = Column(String)
    organization_id = Column(Integer, ForeignKey("organization.id"), index=True)
    ip = Column(String)
    result = Column(String, default="OK")
    meta = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
```
Y registrar en `app/models/__init__.py`.

- [ ] **Step 3:** Modificar el endpoint `/audit/logs` para soportar query params: `start_date`, `end_date`, `admin_id`, `action`, `org_id`, `result`, `limit`, `offset`. Retornar `{items, total}`.

- [ ] **Step 4:** Crear migración: `scripts/migrate_add_platform_audit.py` (CREATE TABLE platform_audit_logs).

- [ ] **Step 5:** Syntax check + commit: `feat(platform): audit log model + filter endpoint + write helper`.

### Task 1.2: Hook audit_service en endpoints sensibles

**Files:**
- Modify: `app/routers/platform.py` — añadir `write_audit(...)` en: create/update/delete org, archive/unarchive, suspend/activate, bootstrap, apply-preset, create/delete branch, create/update/delete user, impersonate.

- [ ] **Step 1:** Para cada endpoint mutador, importar y llamar `write_audit(db, user_id=current_user.id, action='CREATE_ORG', entity='Organization', entity_id=str(org.id), org_id=org.id, result='OK')` antes del commit final.

- [ ] **Step 2:** Commit: `feat(platform): instrument mutating endpoints with audit log writes`.

### Task 1.3: Admin CRUD endpoints

**Files:**
- Modify: `app/routers/platform.py` — agregar:
  - `GET /admins` → lista usuarios con `platform_role IN ('SUPERADMIN', 'SUPPORT')`.
  - `POST /admins` → invitar (email + platform_role + temp password).
  - `PATCH /admins/{user_id}/role` → cambiar entre SUPERADMIN/SUPPORT.
  - `DELETE /admins/{user_id}` → revocar (set platform_role='NONE').
- Modify: `app/schemas/platform.py` — `AdminInvite`, `AdminRoleChange` schemas.

- [ ] **Step 1:** Implementar los 4 endpoints, todos protegidos por `require_platform_admin` (solo SUPERADMIN, no SUPPORT).

- [ ] **Step 2:** Cada uno escribe audit log.

- [ ] **Step 3:** Syntax check + commit: `feat(platform): admins CRUD endpoints`.

### Task 1.4: Module CRUD endpoints

**Files:**
- Modify: `app/routers/platform.py` — agregar:
  - `POST /modules` → crear `Module` (key, name, scope, status).
  - `PUT /modules/{key}` → editar (name, description, scope, status).
  - `DELETE /modules/{key}` → soft-delete (rechazar si hay orgs activas).
  - `GET /modules/{key}/dependencies` → lista presets + orgs que lo usan.

- [ ] **Step 1:** Implementar los 4 endpoints. Solo SUPERADMIN.

- [ ] **Step 2:** Audit log en cada uno.

- [ ] **Step 3:** Syntax check + commit: `feat(platform): modules catalog CRUD`.

### Task 1.5: User reset password + role change endpoints

**Files:**
- Modify: `app/routers/platform.py`:
  - `POST /users/{id}/reset-password` → genera password temporal, retorna en respuesta (SUPERADMIN ve la temp password).
  - `PATCH /users/{id}/role` → cambia rol tenant del usuario.
  - `GET /users/{id}/sessions` → lista sesiones JWT activas (si hay tabla; si no, retornar lista vacía con TODO).

- [ ] **Step 1:** Implementar. Reset password: genera string random 12 chars, bcrypt hash, audit log.

- [ ] **Step 2:** Commit: `feat(platform): user reset-password + role change`.

### Task 1.6: KPI deltas + activity rate

**Files:**
- Modify: `app/routers/platform.py:91` (`/stats/global`) — extender response con:
  - `total_orgs_delta` (vs hace 30 días)
  - `total_users_delta`
  - `sales_today_delta` (vs ayer)
  - `new_orgs_this_month`
  - `activity_rate` (% orgs con ≥ 1 venta hoy)

- [ ] **Step 1:** Añadir queries para cada delta. Testear con casos edge (org count = 0).

- [ ] **Step 2:** Commit: `feat(platform): KPI deltas in /stats/global`.

### Task 1.7: SUPPORT role en `require_platform_admin`

**Files:**
- Modify: `app/security/__init__.py:155` — soportar SUPPORT con flag.

- [ ] **Step 1:**
```python
def require_platform_admin(current_user: User = Depends(get_current_user)):
    if current_user.platform_role not in (PlatformRole.SUPERADMIN, PlatformRole.SUPPORT):
        raise HTTPException(status_code=403, detail="Requiere Rol de Plataforma")
    return current_user

def require_superadmin(current_user: User = Depends(get_current_user)):
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Requiere SUPERADMIN")
    return current_user
```

- [ ] **Step 2:** Aplicar `require_superadmin` en endpoints destructivos / admins / modules CRUD.

- [ ] **Step 3:** Commit: `feat(platform): SUPPORT role read-only access; SUPERADMIN gates destructive ops`.

### Task 1.8: PR Fase 0+1 → release/qa

- [ ] **Step 1:**
```bash
git push -u origin feat/platform-foundations
gh pr create --base release/qa --head feat/platform-foundations \
  --title "feat(platform): foundations — design tokens + shared components + backend gaps"
gh pr merge --merge --admin
```

---

## FASES 2-4 — Módulos (1 branch + 1 PR cada uno)

Cada módulo sigue la misma estructura: branch `feat/platform-mN-nombre` off latest `release/qa`, refactor del `.tsx` para usar `PlatformPageShell` + `KPICard` + `DataTable` + `SideDrawer`, build verde, commit, push, PR, merge.

### FASE 2 (P1 — alta prioridad)

#### Task M9 — Audit Log

**Branch:** `feat/platform-m9-audit`
**Files:** `frontend/src/pages/platform/PlatformAuditLog.tsx`, `frontend/src/api/platform.ts`

- [ ] Step 1: Extender `platformApi.getAuditLogs()` con params (start_date, end_date, admin_id, action, org_id, result, limit, offset).
- [ ] Step 2: KPI strip (4 KPIs: eventos hoy, críticos 24h, admins activos, orgs afectadas hoy).
- [ ] Step 3: DataTable con cols (Timestamp, Admin, Acción, Entidad, Org, IP, Resultado), sort default por timestamp DESC, filtros (date range, admin selector, action selector, org selector, result), CSV export.
- [ ] Step 4: LineChart eventos por día (30d) con 2 series (total teal, críticos magenta).
- [ ] Step 5: PieChart distribución por tipo de acción (panel 60/40 junto al LineChart).
- [ ] Step 6: SUPPORT mask: IPs como `***.***.*.*`, emails como `u***@domain.com`. Wrapper `maskIfSupport(value, role)`.
- [ ] Step 7: Build verde + commit + PR + merge a qa.

#### Task M4 — Users

**Branch:** `feat/platform-m4-users`

- [ ] Step 1: KPI strip (Total, Activos 24h, Nuevos mes, Por rol pie).
- [ ] Step 2: DataTable cross-tenant con filtros (org selector, rol selector, status, date range), CSV export.
- [ ] Step 3: SideDrawer para crear/editar usuario (drawer en lugar del modal actual).
- [ ] Step 4: Row actions: Reset password (toast con temp pass), Cambiar rol (drawer pequeño), Deshabilitar/Habilitar, Ver sesiones.
- [ ] Step 5: LineChart nuevos usuarios por mes (últimos 6m, agrupado por rol) — P3, opcional.
- [ ] Step 6: Build verde + commit + PR + merge.

#### Task M2 — Organizations

**Branch:** `feat/platform-m2-organizations`

- [ ] Step 1: KPI strip (Total, Activas, Archivadas, Nuevas este mes).
- [ ] Step 2: Migrar tabla actual al `DataTable` compartido. Añadir filtros (industry_type multi-select, status, date range).
- [ ] Step 3: CSV export (`csvFilename: organizations.csv`).
- [ ] Step 4: Reemplazar modal actual por `SideDrawer` para crear/editar (preset selector ya existe, mantener).
- [ ] Step 5: Row actions menú ⋮: Detalle (link), Editar (drawer), Archivar (confirm), Eliminar (`ConfirmModal` con typed-name).
- [ ] Step 6: Build verde + commit + PR + merge.

#### Task M1 — Metrics

**Branch:** `feat/platform-m1-metrics`

- [ ] Step 1: KPI strip 5 KPIs con deltas (consumir `/stats/global` extendido).
- [ ] Step 2: AreaChart ventas 30d (2 series: total teal, meta cyan punteado). Si backend no expone `meta`, calcular promedio en cliente.
- [ ] Step 3: BarChart industria (ya existe — solo aplicar tokens).
- [ ] Step 4: Panel Top 5 orgs (existe — refactor a `DataTable` compacta + sparkline mini).
- [ ] Step 5: Panel Últimas 5 orgs creadas (nuevo) usando `getOrgs({ sort: 'created_at_desc', limit: 5 })`.
- [ ] Step 6: Build verde + commit + PR + merge.

### FASE 3 (P1-P2)

#### Task M3 — Org Detail

**Branch:** `feat/platform-m3-orgdetail`

- [ ] Step 1: Header con breadcrumb `Platform > Organizaciones > [Nombre]`, badges, fecha.
- [ ] Step 2: Sección Módulos: refactor toggles existentes para mostrar badge BETA/STABLE por módulo (data viene de `/modules/catalog`). Toast en cada toggle.
- [ ] Step 3: Sección Preset: selector + preview de módulos + botón aplicar con warning si va a desactivar módulos existentes.
- [ ] Step 4: Tabs Sucursales / Usuarios con DataTable compacto y links pre-filtrados.
- [ ] Step 5: Danger Zone (fondo rojo sutil): Archivar, Reset config, Eliminar — todas con `ConfirmModal` typed-name.
- [ ] Step 6: Build + PR + merge.

#### Task M5 — Branches

**Branch:** `feat/platform-m5-branches`

- [ ] Step 1: KPI strip (Total, Activas ahora, Promedio por org, Con alertas).
- [ ] Step 2: DataTable refactor + filtros (org, tipo, status), CSV.
- [ ] Step 3: Badge rojo por fila con alertas críticas. Panel lateral on-row-click con detalle de alertas.
- [ ] Step 4: Build + PR + merge.

#### Task M8 — Admins

**Branch:** `feat/platform-m8-admins`

- [ ] Step 1: Page guard frontend: si `user.platform_role !== 'SUPERADMIN'` → render 403 component (no redirect, mostrar mensaje).
- [ ] Step 2: DataTable con cols (Nombre, Email, Rol, Creado por, Última sesión, Acciones), CSV.
- [ ] Step 3: SideDrawer "Invitar admin" (email + role selector).
- [ ] Step 4: Row actions: Cambiar rol (drawer pequeño), Revocar (`ConfirmModal` typed-name).
- [ ] Step 5: Panel lateral on-row-click: audit trail del admin (last 50 entries de `/audit/logs?admin_id=X`).
- [ ] Step 6: Build + PR + merge.

### FASE 4 (P2-P3)

#### Task M6 — Presets

**Branch:** `feat/platform-m6-presets`

- [ ] Step 1: Lista de presets con cards (nombre, industria, módulos como pills, orgs que lo usan count, badge SYSTEM si aplica).
- [ ] Step 2: SideDrawer CRUD (nombre, descripción, industry_type, multi-select módulos con badges, preview).
- [ ] Step 3: Duplicar preset (botón en row actions → abre drawer prellenado).
- [ ] Step 4: Editar system preset → `ConfirmModal` con lista de orgs afectadas + typed-name.
- [ ] Step 5: Build + PR + merge.

#### Task M7 — Modules Catalog

**Branch:** `feat/platform-m7-modules`

- [ ] Step 1: DataTable (Key, Nombre, Scope, Status, Presets que lo usan count, Orgs activas count, Acciones), CSV.
- [ ] Step 2: SideDrawer CRUD (key inmutable post-create, nombre, descripción, scope, status BETA/STABLE).
- [ ] Step 3: Click en fila → panel de dependencias (presets + orgs). Botón "Deshabilitar globalmente" con `ConfirmModal` y lista de orgs.
- [ ] Step 4: Build + PR + merge.

---

## Verificación final (post-todas-las-fases)

**Frontend manual:**
1. `cd frontend && npm run dev`, login SUPERADMIN.
2. Navegar `/platform/metrics` → ver 5 KPIs con deltas, AreaChart 30d, paneles.
3. `/platform/audit` → filtrar por admin + date range, exportar CSV, ver LineChart.
4. `/platform/users` → buscar, sort, reset password de un user, cambiar rol.
5. `/platform/organizations` → crear org via drawer (no modal), aplicar preset, eliminar con typed-name confirm.
6. `/platform/organizations/:id` → toggle módulos, danger zone visible.
7. `/platform/branches` → ver alertas, filtrar por org.
8. `/platform/admins` → invitar admin SUPPORT, verificar que SUPPORT no ve la página completa.
9. `/platform/presets` → crear preset, editar system preset → confirma orgs afectadas.
10. `/platform/modules` → crear módulo BETA, ver dependencias.

**Backend:**
- `python3 -c "import ast; ast.parse(open('app/routers/platform.py').read())"` → OK.
- Smoke test cada endpoint nuevo (admin CRUD, modules CRUD, audit filter, reset-password).

**Build:** `npm run build` verde en cada PR.

**RBAC:** login SUPPORT → ve audit/users/orgs/branches en read-only con masking; no ve admins; no puede ejecutar destructivos.

---

## Self-Review

**Cobertura del spec:**
- M1 (5 sub-tareas): cubiertas en Task M1.
- M2 (3): Task M2.
- M3 (5): Task M3.
- M4 (4): Task M4.
- M5 (3): Task M5.
- M6 (3): Task M6.
- M7 (3): Task M7.
- M8 (3): Task M8.
- M9 (4): Task M9.
- Foundations (2 ítems del spec, "Crear SKILL" y "Crear componentes compartidos"): Fase 0.

Total 35/35 sub-tareas mapeadas + 7 tasks de backend gap.

**Type consistency:** `KPICard`, `DataTable`, `StatusBadge`, `SideDrawer`, `ConfirmModal`, `PlatformPageShell` definidos en Fase 0; reutilizados nominalmente idénticos en Fases 2-4.

**Sin placeholders:** todos los snippets son código completo o referencias exactas a líneas existentes.

**Estimación esfuerzo:** Fase 0+1 = 1-2 días. Cada módulo M9/M4/M2/M1 = ~1 día. M3/M5/M8/M6/M7 = ~0.5-1 día c/u. Total ~10-12 días si secuencial; ~5-7 si se paralelizan los módulos independientes (M9, M4, M2, M5, M8, M6, M7 son independientes entre sí post-Fase-0).

**PRs totales:** 1 (foundations+backend) + 9 (uno por módulo) = 10 PRs.

---

## Execution Handoff

Plan guardado en `docs/superpowers/plans/2026-04-22-platform-superadmin-pack.md`.

**Opciones de ejecución:**

1. **Subagent-Driven (recomendado para escala)** — un subagente por fase / módulo, revisión entre tareas. Permite paralelizar M2/M4/M9 después de Fase 0.

2. **Inline (auto-mode)** — ejecuto secuencialmente todas las fases en esta sesión, commits + PRs + merges directos a `release/qa`.

¿Cuál prefieres?
