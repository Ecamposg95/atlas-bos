import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { platformApi, PlatformOrg, PlatformUser } from '../../api/platform'
import { industryIconV2 } from './v2/industryIcon'

type ItemKind = 'nav' | 'action' | 'org' | 'user'

interface PaletteItem {
  kind: ItemKind
  id: string
  label: string
  hint?: string
  icon: string
  run: () => void
  /** lowercase keywords for fuzzy match */
  search: string
}

const STATIC_NAV: Omit<PaletteItem, 'run' | 'search'>[] = [
  { kind: 'nav', id: 'nav-metrics',       label: 'Métricas globales',  hint: '/platform/metrics',       icon: 'fa-chart-pie' },
  { kind: 'nav', id: 'nav-orgs',          label: 'Organizaciones',     hint: '/platform/organizations', icon: 'fa-building' },
  { kind: 'nav', id: 'nav-users',         label: 'Usuarios globales',  hint: '/platform/users',         icon: 'fa-users' },
  { kind: 'nav', id: 'nav-branches',      label: 'Sucursales',         hint: '/platform/branches',      icon: 'fa-store' },
  { kind: 'nav', id: 'nav-presets',       label: 'Presets',            hint: '/platform/presets',       icon: 'fa-layer-group' },
  { kind: 'nav', id: 'nav-modules',       label: 'Módulos',            hint: '/platform/modules',       icon: 'fa-puzzle-piece' },
  { kind: 'nav', id: 'nav-admins',        label: 'Admins de plataforma', hint: '/platform/admins',      icon: 'fa-user-shield' },
  { kind: 'nav', id: 'nav-audit',         label: 'Audit log',          hint: '/platform/audit',         icon: 'fa-scroll' },
]

const STATIC_ACTIONS: Omit<PaletteItem, 'run' | 'search'>[] = [
  { kind: 'action', id: 'act-hq',         label: 'Ir al App (HQ)',   hint: '/hq/operations',          icon: 'fa-arrow-left' },
]

function fuzzyMatches(needle: string, haystack: string): boolean {
  if (!needle) return true
  const n = needle.toLowerCase().trim()
  if (!n) return true
  return haystack.toLowerCase().includes(n)
}

function score(needle: string, item: PaletteItem): number {
  const n = needle.toLowerCase().trim()
  if (!n) return 0
  const label = item.label.toLowerCase()
  if (label.startsWith(n)) return 100
  if (label.includes(n)) return 50
  if (item.search.includes(n)) return 20
  return 0
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [orgs, setOrgs] = useState<PlatformOrg[]>([])
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loadedAt, setLoadedAt] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Lazy load on first open; cache for 60s.
  useEffect(() => {
    if (!open) return
    const stale = Date.now() - loadedAt > 60_000
    if (!stale && (orgs.length || users.length)) return
    setLoading(true)
    Promise.all([
      platformApi.getOrgs({ include_archived: true }).catch(() => []),
      platformApi.getUsers({ include_inactive: true }).catch(() => []),
    ]).then(([o, u]) => {
      setOrgs(Array.isArray(o) ? o : [])
      setUsers(Array.isArray(u) ? u : [])
      setLoadedAt(Date.now())
    }).finally(() => setLoading(false))
  }, [open, loadedAt, orgs.length, users.length])

  // Focus + reset on open.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const close = useCallback(() => onClose(), [onClose])

  // Build items from static nav + data.
  const items: PaletteItem[] = useMemo(() => {
    const nav: PaletteItem[] = STATIC_NAV.map(i => ({
      ...i,
      run: () => { navigate(i.hint!); close() },
      search: (i.label + ' ' + (i.hint ?? '')).toLowerCase(),
    }))
    const actions: PaletteItem[] = [
      ...STATIC_ACTIONS.map(i => ({
        ...i,
        run: () => { if (i.hint) navigate(i.hint); close() },
        search: (i.label + ' ' + (i.hint ?? '')).toLowerCase(),
      })),
      {
        kind: 'action' as const,
        id: 'act-new-org',
        label: 'Nueva organización',
        hint: '/platform/organizations?new=1',
        icon: 'fa-circle-plus',
        run: () => { navigate('/platform/organizations?new=1'); close() },
        search: 'nueva org crear organizacion new create',
      },
      {
        kind: 'action' as const,
        id: 'act-new-user',
        label: 'Nuevo usuario global',
        hint: '/platform/users?new=1',
        icon: 'fa-user-plus',
        run: () => { navigate('/platform/users?new=1'); close() },
        search: 'nuevo usuario crear user new create',
      },
    ]
    const orgItems: PaletteItem[] = orgs.map(o => ({
      kind: 'org' as const,
      id: 'org-' + o.id,
      label: o.name,
      hint: o.industry_type
        ? `${o.industry_type}${o.is_active === false ? ' · inactiva' : ''}`
        : (o.is_active === false ? 'inactiva' : undefined),
      icon: industryIconV2(o.industry_type),
      run: () => { navigate(`/platform/organizations/${o.id}`); close() },
      search: [o.name, o.legal_name, o.tax_id, o.email, o.industry_type].filter(Boolean).join(' ').toLowerCase(),
    }))
    const userItems: PaletteItem[] = users.map(u => ({
      kind: 'user' as const,
      id: 'user-' + u.id,
      label: u.full_name || u.username,
      hint: [u.email || u.username, u.role, u.platform_role !== 'NONE' ? u.platform_role : null]
        .filter(Boolean).join(' · '),
      icon: u.platform_role === 'SUPERADMIN' ? 'fa-user-shield' : 'fa-user',
      run: () => { navigate('/platform/users'); close() },
      search: [u.username, u.full_name, u.email, u.role, u.platform_role].filter(Boolean).join(' ').toLowerCase(),
    }))
    return [...nav, ...actions, ...orgItems, ...userItems]
  }, [orgs, users, navigate, close])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Sin query: mostrar nav + acciones primero, no 500 usuarios.
      return items.filter(i => i.kind === 'nav' || i.kind === 'action').slice(0, 20)
    }
    return items
      .filter(i => fuzzyMatches(q, i.search) || fuzzyMatches(q, i.label))
      .sort((a, b) => score(q, b) - score(q, a))
      .slice(0, 40)
  }, [items, query])

  // Keyboard nav inside the palette.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive(a => Math.min(filtered.length - 1, a + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive(a => Math.max(0, a - 1))
      } else if (e.key === 'Enter') {
        const item = filtered[active]
        if (item) { e.preventDefault(); item.run() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, active, close])

  // Reset active when filter changes.
  useEffect(() => { setActive(0) }, [query])

  if (!open) return null

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 1200,
        display: 'grid',
        placeItems: 'start center',
        paddingTop: '15vh',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
        style={{
          width: 'min(640px, 92vw)',
          background: 'var(--p-surface)',
          border: '1px solid var(--p-border)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid var(--p-border)',
        }}>
          <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--p-muted)', fontSize: 14 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar orgs, usuarios, páginas… o escribe una acción"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--p-text)',
              fontSize: 15,
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 6,
          minHeight: 80,
        }}>
          {loading && filtered.length === 0 ? (
            <div style={emptyStyle}>Cargando datos…</div>
          ) : filtered.length === 0 ? (
            <div style={emptyStyle}>Sin resultados para "{query}"</div>
          ) : (
            <Groups items={filtered} active={active} onActivate={setActive} />
          )}
        </div>

        <div style={{
          display: 'flex', gap: 14, alignItems: 'center',
          padding: '10px 16px',
          borderTop: '1px solid var(--p-border)',
          fontSize: 11,
          color: 'var(--p-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> navegar</span>
          <span><kbd style={kbdStyle}>↵</kbd> abrir</span>
          <span><kbd style={kbdStyle}>Esc</kbd> cerrar</span>
          <span style={{ marginLeft: 'auto' }}>
            {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}

const GROUP_LABEL: Record<ItemKind, string> = {
  nav: 'Navegación',
  action: 'Acciones',
  org: 'Organizaciones',
  user: 'Usuarios',
}

function Groups({
  items, active, onActivate,
}: { items: PaletteItem[]; active: number; onActivate: (i: number) => void }) {
  // Group in order of first appearance while respecting score ranking.
  const groups = new Map<ItemKind, PaletteItem[]>()
  items.forEach(it => {
    const arr = groups.get(it.kind) ?? []
    arr.push(it)
    groups.set(it.kind, arr)
  })

  let globalIdx = 0
  return (
    <>
      {Array.from(groups.entries()).map(([kind, list]) => (
        <div key={kind} style={{ padding: '6px 4px 8px' }}>
          <div style={{
            fontSize: 10,
            color: 'var(--p-hint)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 600,
            padding: '6px 12px',
            fontFamily: 'var(--font-mono)',
          }}>
            {GROUP_LABEL[kind]}
          </div>
          {list.map(item => {
            const idx = globalIdx++
            const isActive = idx === active
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => onActivate(idx)}
                onClick={() => item.run()}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: isActive ? 'var(--p-surface-2)' : 'transparent',
                  color: 'var(--p-text)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                }}
              >
                <span style={{
                  width: 28, height: 28,
                  borderRadius: 7,
                  background: 'var(--p-surface-2)',
                  border: '1px solid var(--p-border)',
                  display: 'grid',
                  placeItems: 'center',
                  color: isActive ? 'var(--p-accent)' : 'var(--p-muted)',
                  fontSize: 12,
                  flexShrink: 0,
                }}>
                  <i className={'fa-solid ' + item.icon} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.label}
                  </div>
                  {item.hint && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--p-muted)',
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.hint}
                    </div>
                  )}
                </span>
                {isActive && (
                  <kbd style={kbdStyle}>↵</kbd>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  border: '1px solid var(--p-border)',
  borderRadius: 4,
  background: 'var(--p-surface-2)',
  color: 'var(--p-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 500,
  lineHeight: 1.4,
}

const emptyStyle: React.CSSProperties = {
  padding: '32px 18px',
  textAlign: 'center',
  color: 'var(--p-muted)',
  fontSize: 13,
}
