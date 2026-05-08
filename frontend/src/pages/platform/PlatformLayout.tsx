import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Toaster } from '../../components/ui/Toast'
import { ImpersonationBanner } from '../../components/layout/ImpersonationBanner'
import { CommandPalette } from '../../components/platform/CommandPalette'
import '../../styles/platform-v2.css'

const NAV_PLATFORM = [
  { label: 'Dashboard',      icon: 'fa-gauge-high',           to: '/platform/metrics' },
  { label: 'Health',         icon: 'fa-heart-pulse',          to: '/platform/health' },
  { label: 'Alerts',         icon: 'fa-triangle-exclamation', to: '/platform/alerts' },
  { label: 'Organizaciones', icon: 'fa-building',             to: '/platform/organizations' },
  { label: 'Usuarios',       icon: 'fa-users',                to: '/platform/users' },
  { label: 'Sucursales',     icon: 'fa-store',                to: '/platform/branches' },
  { label: 'Reportes',       icon: 'fa-chart-line',           to: '/platform/reportes' },
  { label: 'Cash Audit',     icon: 'fa-magnifying-glass-dollar', to: '/platform/cash-audit' },
]

const NAV_ADMIN = [
  { label: 'Presets',       icon: 'fa-layer-group',    to: '/platform/presets' },
  { label: 'Módulos',       icon: 'fa-puzzle-piece',   to: '/platform/modules' },
  { label: 'Admins',        icon: 'fa-user-shield',    to: '/platform/admins' },
  { label: 'Announcements', icon: 'fa-bullhorn',       to: '/platform/announcements' },
  { label: 'Flags',         icon: 'fa-toggle-on',      to: '/platform/flags' },
  { label: 'Incidents',     icon: 'fa-fire',           to: '/platform/incidents' },
  { label: 'API keys',      icon: 'fa-key',            to: '/platform/api-keys' },
  { label: 'Audit Log',     icon: 'fa-scroll',         to: '/platform/audit' },
]

function initials(input?: string | null): string {
  if (!input) return 'SA'
  const parts = input.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return input.slice(0, 2).toUpperCase()
}

export function PlatformLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // ⌘K / Ctrl+K global hotkey.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const displayName = user?.full_name || user?.username || 'atlas@ops'

  return (
    <div className="pv2">
      <div className="pv2-layout">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className="pv2-sidebar" aria-label="Platform navigation">
          <div className="brand">
            <div className="mark">A</div>
            <div className="name">Atlas</div>
            <div className="env">V2</div>
          </div>

          <button
            type="button"
            className="nav-item pv2-kbar-trigger"
            onClick={() => setPaletteOpen(true)}
            aria-label="Abrir búsqueda"
            title="Buscar (⌘K)"
          >
            <i className="fa-solid fa-magnifying-glass" />
            <span>Buscar</span>
            <kbd
              style={{
                marginLeft: 'auto',
                padding: '1px 6px',
                border: '1px solid var(--p-border)',
                borderRadius: 4,
                background: 'var(--p-surface-2)',
                color: 'var(--p-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >⌘K</kbd>
          </button>

          <div>
            <div className="group-label">Platform</div>
            {NAV_PLATFORM.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <i className={'fa-solid ' + item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div>
            <div className="group-label">Admin</div>
            {NAV_ADMIN.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <i className={'fa-solid ' + item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <NavLink to="/hq/operations" className="nav-item">
              <i className="fa-solid fa-arrow-left" />
              <span>Salir al App</span>
            </NavLink>
          </div>

          <div className="footer">
            <div className="avatar">{initials(displayName)}</div>
            <div className="meta">
              <span className="nm">{displayName}</span>
              <span className="role">Superadmin</span>
            </div>
            <button
              type="button"
              className="logout-btn"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </aside>

        {/* ── Main surface ────────────────────────────────────────── */}
        <div className="pv2-surface">
          <ImpersonationBanner />
          <div className="pv2-content">
            <Outlet />
          </div>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  )
}
