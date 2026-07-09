import { useEffect, useState } from 'react'
import { reportsApi, WaiterSales } from '../../api/reports'
import { useAuthStore } from '../../store/authStore'
import { Kpi, Card, BarChart, N, ATLAS_MONO, ATLAS_FONT } from '../../components/atlas-one'

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0)

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const RANGES = [
  { key: 'today', label: 'Hoy', days: 0 },
  { key: '7d', label: '7 días', days: 6 },
  { key: '30d', label: '30 días', days: 29 },
] as const

const ACCENT = '#e2531b'

export function Meseros() {
  const { branch } = useAuthStore()
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('today')
  const [waiters, setWaiters] = useState<WaiterSales[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const r = RANGES.find((x) => x.key === range)!
    const start = isoDaysAgo(r.days)
    const end = isoDaysAgo(0)
    setLoading(true)
    setFailed(false)
    reportsApi
      .byWaiter({ start_date: start, end_date: end, branch_id: branch?.id })
      .then((d) => { if (alive) setWaiters(d.waiters) })
      .catch(() => { if (alive) setFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [range, branch?.id])

  const totalRevenue = waiters.reduce((s, w) => s + w.revenue, 0)
  const totalTips = waiters.reduce((s, w) => s + w.tips, 0)
  const totalTickets = waiters.reduce((s, w) => s + w.tickets, 0)
  const top = waiters[0]

  return (
    <div style={{ background: N.page, minHeight: '100%', fontFamily: ATLAS_FONT }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.75rem 3rem' }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Reportes · Gastro</p>
            <h1 style={{ margin: '6px 0 4px', fontSize: '1.7rem', fontWeight: 600, color: N.ink, letterSpacing: -0.6 }}>Ventas por mesero</h1>
            <p style={{ margin: 0, color: N.muted, fontSize: 14 }}>Desempeño y propinas por colaborador.</p>
          </div>
          <div style={{ display: 'inline-flex', gap: 4, background: N.chip, borderRadius: 999, padding: 3 }}>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 999,
                  fontSize: 12.5, fontWeight: 600, fontFamily: ATLAS_FONT,
                  background: range === r.key ? '#fff' : 'transparent',
                  color: range === r.key ? N.ink : N.muted,
                  boxShadow: range === r.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                {r.label}
              </button>
            ))}
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
          <Kpi label="Ventas totales" value={money(totalRevenue)} accent={ACCENT} />
          <Kpi label="Propinas" value={money(totalTips)} accent={ACCENT} />
          <Kpi label="Tickets" value={totalTickets} accent={ACCENT} />
          <Kpi label="Mejor mesero" value={top ? top.name.split(' ')[0] : '—'} sub={top ? money(top.revenue) : undefined} accent={ACCENT} />
        </div>

        {failed ? (
          <Card pad={16} style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}0d` }}>
            <span style={{ fontSize: 13, color: N.body }}>No pudimos cargar el reporte de meseros.</span>
          </Card>
        ) : loading ? (
          <Card pad={40} style={{ textAlign: 'center', color: N.faint, fontFamily: ATLAS_MONO, fontSize: 13 }}>Cargando…</Card>
        ) : waiters.length === 0 ? (
          <Card pad={40} style={{ textAlign: 'center', color: N.faint, fontFamily: ATLAS_MONO, fontSize: 13 }}>Sin ventas en el periodo</Card>
        ) : (
          <>
            <Card pad={18} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>
                Ventas por mesero
              </div>
              <div style={{ overflowX: 'auto' }}>
                <BarChart width={640} height={200} color={ACCENT}
                  data={waiters.slice(0, 8).map((w, i) => ({
                    label: w.name.split(' ')[0].slice(0, 8),
                    value: Math.round(w.revenue),
                    highlight: i === 0,
                  }))}
                />
              </div>
            </Card>

            <Card pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5 }}>
                  <thead>
                    <tr>
                      {['Mesero', 'Tickets', 'Ventas', 'Propinas', 'Ticket prom.'].map((h, i) => (
                        <th key={h} style={{
                          textAlign: i === 0 ? 'left' : 'right', padding: '12px 16px',
                          background: N.chip, color: N.ink, fontWeight: 600, fontSize: 12,
                          fontFamily: ATLAS_MONO, letterSpacing: 0.4, textTransform: 'uppercase',
                          borderBottom: `1px solid ${N.line}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {waiters.map((w) => (
                      <tr key={w.user_id}>
                        <td style={{ padding: '12px 16px', color: N.ink, fontWeight: 600, borderBottom: `1px solid ${N.line}` }}>{w.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: N.body, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${N.line}` }}>{w.tickets}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: N.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${N.line}` }}>{money(w.revenue)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: ACCENT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${N.line}` }}>{money(w.tips)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: N.body, fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${N.line}` }}>{money(w.avg_ticket)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
