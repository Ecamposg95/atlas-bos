// enterprise.jsx — Atlas One Enterprise (Preset 10)
// Color: Púrpura + azul eléctrico, dark premium. Corporativa, escalable.

const enterpriseP = () => PRESETS.enterprise;

// Local dark theme tokens for enterprise
const E = {
  bg:      '#08060F',
  surface: '#0F0B1F',
  surface2:'#15102A',
  line:    '#22193D',
  line2:   '#332957',
  text:    '#F0EBFA',
  body:    '#C7BEE0',
  muted:   '#7B6EA8',
  faint:   '#5C5183',
};

const enterpriseSidebarItems = [
  { header: 'Dirección' },
  { icon: Icon.shield,   label: 'Panel ejecutivo' },
  { icon: Icon.branch,   label: 'Sucursales',         badge: '12' },
  { icon: Icon.layers,   label: 'Módulos' },
  { header: 'Operación' },
  { icon: Icon.bars,     label: 'KPIs comparados' },
  { icon: Icon.users,    label: 'Roles y permisos' },
  { icon: Icon.zap,      label: 'Integraciones',      badge: '8' },
  { header: 'Gobierno' },
  { icon: Icon.document, label: 'Auditoría' },
  { icon: Icon.sparkles, label: 'Atlas IA',           badge: 'BETA' },
  { icon: Icon.cog,      label: 'Configuración' },
];

// ─── 01 · Desktop · Panel ejecutivo multisucursal ─────────────
function EnterpriseDesktop() {
  const p = enterpriseP();

  const branches = [
    { id: 'MX-01', name: 'CDMX · Polanco',       state: 'CDMX', sales: 482360, tickets: 1860, ticket: 259, trend: [12,14,15,14,16,17,18,19,20,22,24,26], status: 'ok',  vsTarget: 1.12 },
    { id: 'MX-02', name: 'CDMX · Roma Norte',    state: 'CDMX', sales: 412840, tickets: 1620, ticket: 254, trend: [10,12,13,12,14,15,16,16,17,18,20,21], status: 'ok',  vsTarget: 1.04 },
    { id: 'MX-03', name: 'GDL · Providencia',    state: 'JAL',  sales: 386140, tickets: 1480, ticket: 261, trend: [9,10,11,12,13,14,14,16,17,18,19,20], status: 'ok',  vsTarget: 0.98 },
    { id: 'MX-04', name: 'MTY · San Pedro',      state: 'NL',   sales: 524620, tickets: 1920, ticket: 273, trend: [14,16,18,20,21,22,24,26,28,30,32,34], status: 'top', vsTarget: 1.24 },
    { id: 'MX-05', name: 'QRO · Centro Sur',     state: 'QRO',  sales: 218460, tickets:  920, ticket: 237, trend: [6,7,8,7,9,10,11,12,13,14,15,16], status: 'low', vsTarget: 0.82 },
    { id: 'MX-06', name: 'PUE · Angelópolis',    state: 'PUE',  sales: 286140, tickets: 1120, ticket: 255, trend: [8,9,10,11,12,13,14,15,16,17,18,19], status: 'ok',  vsTarget: 1.01 },
  ];

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: E.bg, color: E.text, fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Panel ejecutivo" items={enterpriseSidebarItems}
        footer={<SidebarUser preset={p} name="Director Comercial" role="Atlas Tech" branch="HQ Polanco" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 30px', background: E.surface, borderBottom: `1px solid ${E.line}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: -0.3, color: E.text }}>Resumen ejecutivo · noviembre</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: E.muted, marginTop: 4 }}>12 SUCURSALES · 4 PAÍSES · ÚLTIMA SINCRONIZACIÓN HACE 12 S</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: '7px 12px', background: E.surface2, border: `1px solid ${E.line2}`, borderRadius: 7, fontFamily: ATLAS_MONO, fontSize: 11, color: E.body }}>Mes en curso ▾</div>
            <div style={{ padding: '7px 12px', background: E.surface2, border: `1px solid ${E.line2}`, borderRadius: 7, fontFamily: ATLAS_MONO, fontSize: 11, color: E.body }}>vs. octubre ▾</div>
            <div style={{ padding: '8px 14px', background: p.accent2, color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 600 }}>Exportar PDF</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '22px 30px', overflow: 'hidden' }}>
          {/* Top KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
            {[
              ['Ventas consolidadas',  mxnInt(2310600), '+18.4%', [12,14,16,18,20,22,24,26,28,30,32,38]],
              ['Tickets',              '8 920',        '+11.2%',  [8,9,10,11,12,13,14,15,16,17,18,20]],
              ['Ticket promedio',      mxn(259.04),    '+6.5%',   [6,7,7,8,8,9,9,10,10,11,12,12]],
              ['Margen consolidado',   '62.4%',         '+1.8 pp',[10,10,11,11,12,12,12,13,13,13,14,14]],
            ].map(([l, v, d, t], i) => (
              <EnterpriseKpi key={i} label={l} value={v} delta={d} trend={t} accent={i === 0 ? p.accent2 : p.accent} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
            {/* Branches ranked */}
            <div style={{ background: E.surface, border: `1px solid ${E.line}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${E.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: E.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Sucursales · ranking del mes</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: E.text }}>Comparado vs. meta y vs. mes anterior</div>
                </div>
                <div style={{ display: 'flex', gap: 8, fontFamily: ATLAS_MONO, fontSize: 11, color: E.muted }}>
                  <span><span style={{ color: '#34D399' }}>▲</span> sobre meta</span>
                  <span><span style={{ color: '#FB7185' }}>▼</span> bajo meta</span>
                </div>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 130px 90px 90px 90px 80px',
                padding: '12px 20px', background: E.surface2, fontFamily: ATLAS_MONO, fontSize: 10, color: E.muted, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                <div>ID</div><div>Sucursal</div><div>Tendencia 12 sem</div><div style={{textAlign:'right'}}>Tickets</div><div style={{textAlign:'right'}}>T. prom.</div><div style={{textAlign:'right'}}>Ventas</div><div style={{textAlign:'right'}}>vs Meta</div>
              </div>
              {branches.map((b, i) => {
                const c = b.status === 'top' ? '#22D3EE' : b.status === 'low' ? '#FB7185' : p.accent;
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr 130px 90px 90px 90px 80px',
                    padding: '13px 20px', alignItems: 'center', borderTop: `1px solid ${E.line}`, fontSize: 13,
                  }}>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: c, fontWeight: 600 }}>{b.id}</div>
                    <div>
                      <div style={{ fontWeight: 500, color: E.text }}>{b.name}</div>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: E.muted, marginTop: 2 }}>{b.state}</div>
                    </div>
                    <Sparkline values={b.trend} color={c} width={120} height={28} fill />
                    <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, color: E.body }}>{b.tickets}</div>
                    <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, color: E.body }}>{mxn(b.ticket)}</div>
                    <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 14, fontWeight: 600, color: E.text }}>{mxnInt(b.sales)}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontFamily: ATLAS_MONO, fontSize: 11, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 4,
                        background: b.vsTarget >= 1 ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)',
                        color: b.vsTarget >= 1 ? '#34D399' : '#FB7185',
                      }}>{b.vsTarget >= 1 ? '+' : ''}{((b.vsTarget - 1) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: IA insights + integrations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: `linear-gradient(135deg, ${p.accent}30, ${p.accent2}15)`,
                border: `1px solid ${p.accent2}40`, borderRadius: 12, padding: 18,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: `${p.accent2}30`, filter: 'blur(40px)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                  <Icon.sparkles size={16} color={p.accent2} />
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2, letterSpacing: 0.8, textTransform: 'uppercase' }}>Atlas IA · insights</div>
                  <span style={{ padding: '2px 6px', background: p.accent2, color: E.bg, borderRadius: 4, fontSize: 9.5, fontFamily: ATLAS_MONO, fontWeight: 700 }}>BETA</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, position: 'relative' }}>
                  {[
                    ['QRO · Centro Sur', '↓ ticket prom 12%', 'Posible mix de productos. Compara con MX-04.'],
                    ['MX-04 · MTY', '↑ 24% vs meta', 'Ampliar staff hora pico viernes y sábado.'],
                    ['Inventario · 6 SKUs', '4 sucursales en crítico', 'Generar orden consolidada por proveedor.'],
                  ].map(([t, h, d], i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'rgba(8,6,15,0.5)', borderRadius: 8, borderLeft: `2px solid ${p.accent2}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: E.text }}>{t}</span>
                        <span style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: p.accent2 }}>{h}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: E.body, marginTop: 4, lineHeight: 1.4 }}>{d}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, background: E.surface, border: `1px solid ${E.line}`, borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: E.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Integraciones activas</div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#34D399' }}>8 / 8 OK</div>
                </div>
                {[
                  ['SAT · CFDI 4.0',    'Facturación',     'OK',  '#34D399'],
                  ['Stripe · pagos',    'Cobros tarjeta',  'OK',  '#34D399'],
                  ['Mercado Pago',      'QR / OXXO',       'OK',  '#34D399'],
                  ['Contpaqi',          'Contabilidad',    'OK',  '#34D399'],
                  ['SAP B1',            'ERP corporativo', 'OK',  '#34D399'],
                  ['Google Workspace',  'SSO',             'OK',  '#34D399'],
                ].map(([n, kind, status, c], i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '12px 1fr 80px', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${E.line}` : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: c, boxShadow: `0 0 6px ${c}` }} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: E.text }}>{n}</div>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: E.muted, marginTop: 1 }}>{kind}</div>
                    </div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: c, textAlign: 'right', fontWeight: 600 }}>{status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnterpriseKpi({ label, value, delta, trend, accent }) {
  const positive = delta && delta.startsWith('+');
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.line}`, borderRadius: 12, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 6, minHeight: 116,
    }}>
      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: E.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: ATLAS_FONT, fontSize: 28, fontWeight: 600, color: E.text, letterSpacing: -0.6 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <span style={{ fontFamily: ATLAS_MONO, fontSize: 11.5, color: positive ? '#34D399' : '#FB7185', fontWeight: 600 }}>{delta}</span>
        <Sparkline values={trend} color={accent} width={70} height={22} />
      </div>
    </div>
  );
}

// ─── 02 · Módulos activables (tablet/desktop) ─────────────────
function EnterpriseTouch() {
  const p = enterpriseP();
  const modules = [
    { name: 'Punto de venta',     active: true, locked: true,  desc: 'POS, tickets y caja', icon: Icon.cart, suite: 'Base' },
    { name: 'Inventario',         active: true, locked: true,  desc: 'SKU · stock · alertas', icon: Icon.pkg, suite: 'Base' },
    { name: 'Clientes',           active: true, locked: true,  desc: 'Catálogo y segmentación', icon: Icon.users, suite: 'Base' },
    { name: 'Reportes',           active: true, locked: true,  desc: 'Operación y ventas', icon: Icon.chart, suite: 'Base' },
    { name: 'Agenda',             active: true,                desc: 'Citas y servicios', icon: Icon.calendar, suite: 'Servicios' },
    { name: 'Comisiones',         active: true,                desc: 'Por colaborador y producto', icon: Icon.bars, suite: 'Servicios' },
    { name: 'Mesas y comandas',   active: false,               desc: 'Salón, KDS, recetas', icon: Icon.table, suite: 'Restaurante' },
    { name: 'Multi-sucursal',     active: true,                desc: 'Consolidado por sede', icon: Icon.branch, suite: 'Enterprise' },
    { name: 'RBAC · permisos',    active: true,                desc: 'Roles por área y módulo', icon: Icon.shield, suite: 'Enterprise' },
    { name: 'API · integraciones',active: true,                desc: 'SAT, Stripe, ERP', icon: Icon.zap, suite: 'Enterprise' },
    { name: 'Auditoría',          active: true,                desc: 'Bitácora y trazabilidad', icon: Icon.document, suite: 'Enterprise' },
    { name: 'Atlas IA',           active: false, beta: true,   desc: 'Insights, sugerencias, alertas', icon: Icon.sparkles, suite: 'Próximamente' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', background: E.bg, color: E.text, display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 28px', background: E.surface, borderBottom: `1px solid ${E.line}` }}>
        <Wordmark color={E.text} accent={p.accent2} size={14} sub="ENTERPRISE · CONFIG" />
        <div style={{ width: 1, height: 22, background: E.line2 }} />
        <span style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: E.body }}>CLIENTE · MUEBLES VEGA SA · 12 SUCURSALES</span>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '6px 12px', background: p.accent2, color: E.bg, borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Guardar configuración</div>
      </div>

      <div style={{ flex: 1, padding: 28, overflow: 'hidden', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2, letterSpacing: 0.8, textTransform: 'uppercase' }}>Constructor de plataforma</div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, fontWeight: 500, marginTop: 6, color: E.text, letterSpacing: -0.5 }}>Módulos activos · 9 de 12</div>
            <div style={{ fontSize: 13, color: E.body, marginTop: 6, maxWidth: 600 }}>Cada módulo se activa cuando el negocio lo necesita. Crece sin cambiar de sistema; cada cambio se replica a las 12 sucursales en segundos.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {modules.map((m, i) => {
              const IconCmp = m.icon;
              return (
                <div key={i} style={{
                  background: m.active ? E.surface : 'transparent',
                  border: `1px solid ${m.active ? p.accent2 + '50' : E.line}`,
                  borderRadius: 12, padding: 16, position: 'relative',
                  boxShadow: m.active ? `0 0 16px ${p.accent2}10` : 'none',
                  opacity: m.beta ? 0.85 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 9,
                      background: m.active ? p.accent2 : E.surface2,
                      color: m.active ? E.bg : E.muted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconCmp size={18} color={m.active ? E.bg : E.muted} />
                    </div>
                    <div style={{
                      width: 36, height: 20, borderRadius: 999, padding: 2,
                      background: m.active ? p.accent2 : E.surface2,
                      display: 'flex', alignItems: 'center', justifyContent: m.active ? 'flex-end' : 'flex-start',
                      transition: 'all .2s', opacity: m.locked ? 0.7 : 1,
                    }}>
                      <div style={{ width: 16, height: 16, borderRadius: 999, background: m.active ? E.bg : E.muted }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: m.active ? E.text : E.body }}>{m.name}</span>
                    {m.locked && <Icon.shield size={12} color={E.muted} />}
                    {m.beta && <span style={{ padding: '1px 5px', background: p.accent2, color: E.bg, borderRadius: 3, fontSize: 8.5, fontFamily: ATLAS_MONO, fontWeight: 700 }}>BETA</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: E.muted, marginTop: 4 }}>{m.desc}</div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: m.active ? p.accent2 : E.faint, marginTop: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>{m.suite}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary side */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: E.surface, border: `1px solid ${E.line}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: E.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Resumen de plan</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, color: E.text }}>Enterprise · 12 sucursales</div>
            <div style={{ marginTop: 12 }}>
              {[['Base · 4 módulos', 'incluido'], ['Servicios · 2 módulos', mxn(1200)], ['Enterprise · 4 módulos', mxn(3600)], ['Atlas IA', 'BETA · gratis']].map(([n, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: i ? `1px solid ${E.line}` : 'none', fontSize: 12.5 }}>
                  <span style={{ color: E.body }}>{n}</span>
                  <span style={{ fontFamily: ATLAS_MONO, color: E.text }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${E.line2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12.5, color: E.muted }}>Total/sucursal/mes</span>
              <span style={{ fontFamily: ATLAS_MONO, fontSize: 22, fontWeight: 600, color: p.accent2, letterSpacing: -0.4 }}>{mxn(4800)}</span>
            </div>
          </div>

          <div style={{ background: E.surface, border: `1px solid ${E.line}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: E.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Permisos por rol</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Director comercial', 'TODO', '#34D399'],
                ['Gerente sucursal',   'Suc. asignada', p.accent2],
                ['Cajero',             'POS + caja',  '#A78BFA'],
                ['Auditor',            'Solo lectura', '#FB7185'],
              ].map(([r, sc, c], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
                  <span style={{ fontSize: 12.5, color: E.text }}>{r}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: ATLAS_MONO, fontSize: 10, color: E.muted }}>{sc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Hero ────────────────────────────────────────────────
function EnterpriseHero() {
  const p = enterpriseP();
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(135deg, ${E.bg}, #15082A 60%, #07021A 100%)`,
      position: 'relative', overflow: 'hidden', fontFamily: ATLAS_FONT, color: E.text,
    }}>
      <div style={{ position: 'absolute', top: -250, left: -150, width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${p.accent}40, transparent 60%)`, filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: -150, right: -100, width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${p.accent2}30, transparent 60%)`, filter: 'blur(80px)' }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, position: 'relative' }}>
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent2, color: '#fff', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 600 }}>PRESET 10</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2, letterSpacing: 1.4, textTransform: 'uppercase' }}>Multisucursal · gobierno · IA</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 60, fontWeight: 500, lineHeight: 1, letterSpacing: -1.6, color: E.text }}>
            Atlas One
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 60, fontWeight: 500, lineHeight: 1, letterSpacing: -1.6, color: p.accent2, marginTop: 4 }}>
            <em style={{ fontStyle: 'italic' }}>Enterprise.</em>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.3, color: E.body }}>
            La misma plataforma. Operación corporativa real.
          </div>
          <div style={{ fontSize: 15, color: E.body, lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 480 }}>
            Multi-sucursal, roles y permisos, API e integraciones, auditoría y reportes ejecutivos. Diseñado para empresas que necesitan crecer sin cambiar de sistema — y para directores que necesitan ver todo el negocio en una sola vista.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {[['12+', 'sucursales en una sola plataforma'], ['8', 'integraciones nativas en producción'], ['100%', 'auditoría por usuario y módulo'], ['IA', 'insights ejecutivos beta']].map(([k, v], i) => (
              <div key={i} style={{ paddingLeft: 14, borderLeft: `2px solid ${p.accent2}` }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: p.accent2, letterSpacing: -0.4 }}>{k}</div>
                <div style={{ fontSize: 12, color: E.muted, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ padding: '10px 16px', background: p.accent2, color: '#fff', borderRadius: 7, fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: `0 0 24px ${p.accent2}30` }}>
              Agendar evaluación <Icon.arrowRight size={14} color="#fff" />
            </div>
            <div style={{ padding: '10px 16px', color: E.text, border: `1px solid ${E.line2}`, borderRadius: 7, fontWeight: 500, fontSize: 13 }}>
              Ver arquitectura
            </div>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 30, right: 0 }}>
            <LaptopFrame width={700}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.475)', transformOrigin: 'top left' }}>
                <EnterpriseDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{
            position: 'absolute', bottom: 30, left: 0, padding: 16, width: 220,
            background: E.surface, border: `1px solid ${p.accent2}60`, borderRadius: 12,
            boxShadow: `0 0 24px ${p.accent2}25`, transform: 'rotate(-3deg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon.sparkles size={14} color={p.accent2} />
              <span style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: p.accent2, letterSpacing: 0.5 }}>ATLAS IA</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: E.text, marginTop: 8 }}>QRO · Centro Sur</div>
            <div style={{ fontSize: 11, color: E.body, marginTop: 4, lineHeight: 1.5 }}>↓ ticket prom. 12% · posible mix de productos. Compara con MX-04 que va +24%.</div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 70px', display: 'flex', alignItems: 'center', gap: 16,
        borderTop: `1px solid ${p.accent2}20`, background: 'rgba(8,6,15,0.7)', backdropFilter: 'blur(8px)',
      }}>
        <Wordmark color={E.text} accent={p.accent2} size={13} />
        <div style={{ width: 1, height: 18, background: E.line2 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: E.muted, letterSpacing: 0.6 }}>MULTISUCURSAL · RBAC · API · AUDITORÍA · IA</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: E.muted }}>atlas.tech / enterprise</div>
      </div>
    </div>
  );
}

Object.assign(window, { EnterpriseDesktop, EnterpriseTouch, EnterpriseHero });
