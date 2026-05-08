import { useState, useEffect, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BranchSwitcher } from './BranchSwitcher'
import { ImpersonationBanner } from './ImpersonationBanner'
import { Toaster } from '../ui/Toast'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import type { Role } from '../../types/auth'

const ROUTE_TITLES: Record<string, string> = {
  '/hq/operations':     'Operaciones HQ',
  '/hq/reports-hub':   'Reportes HQ',
  '/hq/control':       'Control HQ',
  '/hq/sales':         'Ventas HQ',
  '/hq/returns':       'Devoluciones HQ',
  '/hq/inventory':     'Inventario Global',
  '/hq/branches':      'Sucursales',
  '/admin/catalog':    'Catálogo',
  '/departments':      'Departamentos',
  '/brands':           'Marcas',
  '/quotes/new':       'Nueva Cotización',
  '/quotes':           'Cotizaciones',
  '/seguimiento':      'Pedidos',
  '/purchases':        'Compras',
  '/expenses':         'Gastos',
  '/inventory':        'Inventario',
  '/logistics':        'Logística',
  '/boxes':            'Cajas y Contenedores',
  '/customers':        'Clientes',
  '/organization':     'Empresa',
  '/users':            'Usuarios',
  '/hr/me':            'Mi Expediente',
  '/hr':               'Recursos Humanos',
  '/dataxpos':         'Inicio',
  '/pos':              'Punto de Venta',
  '/sales':            'Historial de Ventas',
  '/cash-history':     'Cortes de Caja',
  '/returns':          'Devoluciones',
  '/products':         'Consulta de Productos',
  '/reports':          'Reportes',
  '/printer-settings': 'Config. Impresora',
  '/mobile/dashboard': 'Dashboard Móvil',
  '/mobile/query':     'Consulta Móvil',
  '/mobile/sales':     'Venta Móvil',
  '/mobile/profile':   'Perfil Móvil',
}

const ADMIN_ROLES: Role[] = ['ADMINISTRADOR', 'DUEÑO']

const ROLE_LABEL: Record<Role, string> = {
  ADMINISTRADOR:     'Administrador',
  DUEÑO:             'Dueño',
  GERENTE:           'Gerente',
  CAJERO:            'Cajero',
  VENDEDOR:          'Vendedor',
  SOPORTE_OPERATIVO: 'Soporte',
  CLIENTE:           'Cliente',
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, org } = useAuthStore()
  const location = useLocation()
  const { theme } = useTheme()
  const role = (user?.role ?? 'CAJERO') as Role

  const pageTitle = useMemo(() => {
    const exact = ROUTE_TITLES[location.pathname]
    if (exact) return exact
    const prefix = Object.keys(ROUTE_TITLES).find(
      k => k.length > 1 && location.pathname.startsWith(k + '/')
    )
    return prefix ? ROUTE_TITLES[prefix] : 'Atlas ERP'
  }, [location.pathname])

  const userInitial = ((user?.full_name || user?.username) ?? 'U').charAt(0).toUpperCase()
  const userName = user?.full_name || user?.username || ''
  const isAdmin = ADMIN_ROLES.includes(role)

  // Routes that need full viewport height with no padding/max-width container
  const isFullBleed = location.pathname === '/pos'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--dax-bg)' }}>
      <Sidebar collapsed={collapsed} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <ImpersonationBanner />
        {/* ── Topbar ── */}
        <header
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{
            height: '60px',
            background: theme === 'dark' ? 'rgba(5,5,8,0.85)' : 'rgba(245,243,255,0.88)',
            borderBottom: '1px solid var(--dax-border-dim)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* LEFT — hamburger + page context */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="transition-colors p-1.5 rounded-lg flex-shrink-0"
              style={{ color: 'rgba(148,163,184,0.6)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'white')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.6)')}
              title="Toggle sidebar"
            >
              <i className={`fa-solid ${collapsed ? 'fa-indent' : 'fa-outdent'} text-sm`} />
            </button>

            <div className="hidden sm:flex flex-col min-w-0">
              <span
                style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--dax-text-faint)', lineHeight: 1 }}
              >
                {org?.name ?? 'Atlas ERP'}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  style={{ fontSize: '0.875rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', color: 'var(--dax-text)', lineHeight: 1 }}
                  className="truncate"
                >
                  {pageTitle}
                </span>
                <span
                  style={{
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    background: 'rgba(99,102,241,0.2)',
                    color: '#a5b4fc',
                    flexShrink: 0,
                  }}
                >
                  ACTIVO
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT — branch switcher + session dot + user chip + clock */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {isAdmin && <BranchSwitcher />}

            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: '#34d399', boxShadow: '0 0 6px #34d399' }}
              />
              <span
                className="hidden md:block text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(52,211,153,0.7)' }}
              >
                Activo
              </span>
            </div>

            {user && (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col items-end">
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--dax-text)', lineHeight: 1.2 }}>
                    {userName}
                  </span>
                  <span style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(139,92,246,0.7)', lineHeight: 1.2 }}>
                    {ROLE_LABEL[role]}
                  </span>
                </div>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  {userInitial}
                </div>
              </div>
            )}

            <Clock />
          </div>
        </header>

        {/* ── Content ── */}
        <main className={`flex-1 ${isFullBleed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {isFullBleed ? (
            <Outlet />
          ) : (
            <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">
              <Outlet />
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer
          className="flex items-center justify-center gap-6 flex-shrink-0 px-6"
          style={{
            height: '40px',
            background: theme === 'dark' ? 'rgba(5,5,8,0.5)' : 'rgba(237,233,254,0.6)',
            borderTop: '1px solid var(--dax-border-dim)',
          }}
        >
          <span style={{ fontSize: '0.68rem', color: 'rgba(100,116,139,0.55)', fontWeight: 500 }}>
            Desarrollado con ❤️ por{' '}
            <span style={{ color: '#818cf8', fontWeight: 800 }}>Atlas Tech</span>
          </span>
          <FooterClock />
        </footer>
      </div>

      <Toaster />
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 10_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span
      className="font-mono text-sm tabular-nums font-semibold flex-shrink-0"
      style={{ color: 'rgba(148,163,184,0.7)' }}
    >
      {time}
    </span>
  )
}

function FooterClock() {
  const [dt, setDt] = useState('')
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true,
      })
    setDt(fmt())
    const id = setInterval(() => setDt(fmt()), 1_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span
      className="font-mono tabular-nums"
      style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(100,116,139,0.45)' }}
    >
      {dt}
    </span>
  )
}
