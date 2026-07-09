import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reportsApi, DashboardData } from '../../api/reports'
import { useAuthStore } from '../../store/authStore'
import { Kpi, Card, BarChart, Sparkline, N, ATLAS_MONO, ATLAS_FONT } from '../../components/atlas-one'

/**
 * Home del día — modo OPERACIÓN (cálido). Usado por los presets gastro
 * (Restaurant / Café / Bar). Cablea datos reales de reportsApi.dashboard
 * del día de hoy y los muestra con los componentes atlas-one (Kpi, BarChart,
 * Sparkline). Los accesos rápidos siguen visibles aunque el reporte falle.
 */

export interface QuickAction {
  icon: string
  label: string
  to: string
  beta?: boolean
}

export interface GastroHomeConfig {
  greeting: string
  orgName: string
  title: string
  subtitle: string
  accent: string
  topLabel: string          // "Platillos top" / "Bebidas top" / "Productos top"
  actions: QuickAction[]
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0)

function todayISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function growthDelta(curr: number, prev?: number): string | undefined {
  if (prev == null || prev === 0) return undefined
  const pct = ((curr - prev) / prev) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`
}

export function GastroHomeDay({ greeting, orgName, title, subtitle, accent, topLabel, actions }: GastroHomeConfig) {
  const { branch } = useAuthStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const day = todayISO()
    setLoading(true)
    setFailed(false)
    reportsApi
      .dashboard({ start_date: day, end_date: day, branch_id: branch?.id })
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [branch?.id])

  const k = data?.kpis
  const hourly = data?.charts?.hourly?.data ?? []
  const topProducts = (data?.top_products ?? []).slice(0, 6)
  const peakHour = (() => {
    const h = data?.charts?.hourly
    if (!h?.data?.length) return null
    let bestI = 0
    h.data.forEach((v, i) => { if (v > h.data[bestI]) bestI = i })
    return h.labels?.[bestI] ?? null
  })()

  return (
    <div style={{ background: N.page, minHeight: '100%', fontFamily: ATLAS_FONT }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '2rem 1.75rem 3rem' }}>
        {/* Header */}
        <header style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {orgName} · {title}
              </p>
              <h1 style={{ margin: '6px 0 6px', fontSize: '1.7rem', fontWeight: 600, color: N.ink, letterSpacing: -0.6 }}>
                {greeting ? `Hola, ${greeting}` : 'Bienvenido'}
              </h1>
              <p style={{ margin: 0, color: N.muted, fontSize: 14 }}>{subtitle}</p>
            </div>
            <span style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: ATLAS_MONO,
              background: `${accent}18`, color: accent, whiteSpace: 'nowrap',
            }}>
              Hoy · {todayISO()}
            </span>
          </div>
        </header>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
          {loading ? (
            [0, 1, 2, 3].map((i) => (
              <Card key={i} pad={18} style={{ minHeight: 132, opacity: 0.55 }}>
                <div style={{ fontSize: 11.5, fontFamily: ATLAS_MONO, color: N.faint, textTransform: 'uppercase' }}>Cargando…</div>
              </Card>
            ))
          ) : (
            <>
              <Kpi label="Ventas del día" value={money(k?.sales ?? 0)}
                delta={growthDelta(k?.sales ?? 0, k?.prev_sales)} trend={hourly} accent={accent} />
              <Kpi label="Órdenes" value={k?.orders ?? 0}
                delta={growthDelta(k?.orders ?? 0, k?.prev_orders)} accent={accent} />
              <Kpi label="Ticket promedio" value={money(k?.avg_ticket ?? 0)}
                delta={growthDelta(k?.avg_ticket ?? 0, k?.prev_avg_ticket)} accent={accent} />
              <Kpi label="Cuentas abiertas" value={k?.pending ?? 0}
                sub={peakHour ? `Hora pico ${peakHour}` : undefined} accent={accent} />
            </>
          )}
        </div>

        {failed && (
          <Card pad={14} style={{ marginBottom: 18, borderColor: `${accent}40`, background: `${accent}0d` }}>
            <span style={{ fontSize: 13, color: N.body }}>
              No pudimos cargar los datos del día. Los accesos rápidos siguen disponibles abajo.
            </span>
          </Card>
        )}

        {/* Charts */}
        {!failed && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14, marginBottom: 18 }}>
            <Card pad={18}>
              <div style={{ fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>
                {topLabel} de hoy
              </div>
              {topProducts.length ? (
                <div style={{ overflowX: 'auto' }}>
                  <BarChart
                    width={560} height={190} color={accent}
                    data={topProducts.map((p, i) => ({
                      label: p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name,
                      value: p.qty,
                      highlight: i === 0,
                    }))}
                  />
                </div>
              ) : (
                <p style={{ fontSize: 13, color: N.faint, fontFamily: ATLAS_MONO, margin: '28px 0' }}>Aún sin ventas hoy</p>
              )}
            </Card>

            <Card pad={18} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>
                Ritmo del día
              </div>
              {hourly.some((v) => v > 0) ? (
                <>
                  <Sparkline values={hourly} color={accent} width={260} height={90} fill />
                  <div style={{ marginTop: 'auto', paddingTop: 14, fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted }}>
                    {peakHour != null ? <>Hora pico: <strong style={{ color: N.ink }}>{peakHour}</strong></> : 'Sin actividad'}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: N.faint, fontFamily: ATLAS_MONO, margin: '28px 0' }}>Sin actividad todavía</p>
              )}
            </Card>
          </div>
        )}

        {/* Quick actions */}
        <div style={{ fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.2, textTransform: 'uppercase', margin: '4px 2px 12px' }}>
          Accesos rápidos
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
          {actions.map((a) => (
            <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
              <Card pad={16} style={{ display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color .15s' }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 9, flex: 'none',
                  background: `${accent}18`, color: accent,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}>
                  <i className={`fa-solid ${a.icon}`} />
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: N.ink }}>{a.label}</span>
                {a.beta && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                    letterSpacing: 0.4, background: 'rgba(180,120,20,0.16)', color: '#8a5a12',
                  }}>BETA</span>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
