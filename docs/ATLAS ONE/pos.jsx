// pos.jsx — Atlas POS preset (Preset 01)
// Color: Azul tecnológico. Entrada universal.

const posP = () => PRESETS.pos;

const posSidebarItems = [
  { header: 'Operación' },
  { icon: Icon.cart,    label: 'Punto de venta' },
  { icon: Icon.receipt, label: 'Caja', badge: '3' },
  { icon: Icon.pkg,     label: 'Productos' },
  { icon: Icon.users,   label: 'Clientes' },
  { header: 'Analítica' },
  { icon: Icon.chart,   label: 'Reportes' },
  { icon: Icon.bars,    label: 'Tickets' },
  { icon: Icon.branch,  label: 'Sucursales' },
  { header: 'Sistema' },
  { icon: Icon.user,    label: 'Usuarios' },
  { icon: Icon.cog,     label: 'Ajustes' },
];

// ─── 01 · Desktop dashboard ───────────────────────────────────
function PosDesktop() {
  const p = posP();
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: N.canvas, fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Punto de venta" items={posSidebarItems}
        footer={<SidebarUser preset={p} name="Ana Lozano" role="Cajera principal" branch="MX-01 Roma" />} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Panel de operación"
          sub="VIERNES · 25 NOV 2026 · TURNO MAÑANA"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SearchInput preset={p} width={300} />
              <Icon.bell size={18} color={N.muted} />
              <Button label="Nueva venta" kind="primary" preset={p} icon={Icon.plus} />
            </div>
          }
        />

        <div style={{ flex: 1, padding: '22px 28px', background: N.page, overflow: 'hidden' }}>
          {/* Status strip */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
            <Badge color="#0E8A4E" soft="#E3F4EA" dot>Caja abierta · 09:12</Badge>
            <Badge color={p.accentInk} soft={p.accentSoft} dot>Sucursal MX-01 Roma</Badge>
            <Badge color="#6B6B66" soft={N.chip}>Apertura · {mxn(1500.00)}</Badge>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>Últ. sincronización · hace 4 s</div>
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
            <Kpi label="Ventas del turno"   value={mxnInt(28430)} delta="+18.2%" trend={[3,5,4,6,7,6,8,9,8,11,12,14]} accent={p.accent} />
            <Kpi label="Tickets cobrados"   value="143"           delta="+9.1%"  trend={[5,6,7,6,8,9,8,10,11,12,11,13]} accent={p.accent} />
            <Kpi label="Ticket promedio"    value={mxn(198.81)}   delta="+3.4%"  trend={[6,7,7,8,7,9,8,8,9,10,9,10]} accent={p.accent} />
            <Kpi label="Productos vendidos" value="412"           sub="48 SKUs activos · 2 sin stock" />
          </div>

          {/* Main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 14 }}>
            {/* Sales over the day */}
            <Card pad={20}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Ventas por hora</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, letterSpacing: -0.2 }}>Hoy vs. promedio · {mxn(28430)}</div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: N.muted, fontFamily: ATLAS_MONO }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: p.accent }} />Hoy</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: N.line2 }} />Prom. 30d</span>
                </div>
              </div>
              <LineChart
                series={[
                  { values: [2, 4, 5, 8, 12, 18, 22, 19, 17, 21, 28, 32, 28, 24] },
                  { values: [3, 4, 6, 9, 11, 14, 16, 17, 16, 18, 21, 24, 22, 20] },
                ]}
                width={700} height={220}
                color={p.accent} color2={N.line2}
                labels={['09','10','11','12','13','14','15','16','17','18','19','20','21','22']}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${N.line}` }}>
                <Stat label="Hora pico" value="14:00 – 15:00" sub="32 tickets / hora" />
                <Stat label="Método principal" value="Tarjeta · 62%" sub={`${mxn(17626.60)} cobrado`} />
                <Stat label="Devoluciones" value="2 · $384.00" sub="0.9% del total" />
              </div>
            </Card>

            {/* Top products */}
            <Card pad={20}>
              <SectionTitle action="Ver todos">Productos más vendidos</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Café americano 12 oz',  42, 1596, 0.92],
                  ['Croissant mantequilla', 31, 1395, 0.74],
                  ['Latte vainilla 16 oz',  28, 1568, 0.66],
                  ['Cookie chocolate',      24,  720, 0.56],
                  ['Sandwich pavo',         19, 1330, 0.46],
                ].map(([name, qty, total, pct], i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 60px 90px', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>{String(i+1).padStart(2,'0')}</div>
                    <div>
                      <div style={{ fontSize: 13, color: N.ink }}>{name}</div>
                      <div style={{ height: 3, background: N.line, borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${pct*100}%`, height: '100%', background: p.accent }} />
                      </div>
                    </div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: N.muted, textAlign: 'right' }}>{qty} pz</div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: N.ink, textAlign: 'right', fontWeight: 500 }}>{mxn(total)}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Bottom row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 14, marginTop: 14 }}>
            {/* Payment mix */}
            <Card pad={20}>
              <SectionTitle>Métodos de cobro</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <Donut value={0.62} label="Tarjeta" color={p.accent} track={N.line} size={104} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, flex: 1 }}>
                  {[['Tarjeta', 62, p.accent], ['Efectivo', 26, p.accent2], ['Transferencia', 9, N.body], ['QR / app', 3, N.faint]].map(([n, pct, c]) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                      <span style={{ flex: 1 }}>{n}</span>
                      <span style={{ fontFamily: ATLAS_MONO, color: N.muted }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Recent tickets */}
            <Card pad={20}>
              <SectionTitle action="Abrir caja →">Últimos tickets</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  ['#A-01421', '14:32', 'María R.', 348.00, 'Tarjeta'],
                  ['#A-01420', '14:28', 'Cliente mostrador', 86.00, 'Efectivo'],
                  ['#A-01419', '14:24', 'Cliente mostrador', 412.50, 'Tarjeta'],
                  ['#A-01418', '14:18', 'Pedro G.', 156.00, 'Transferencia'],
                  ['#A-01417', '14:11', 'Cliente mostrador', 245.00, 'Tarjeta'],
                ].map(([id, t, name, amt, m], i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '78px 1fr 88px 90px',
                    padding: '8px 0', borderTop: i ? `1px solid ${N.line}` : 'none',
                    alignItems: 'center', fontSize: 12.5,
                  }}>
                    <div style={{ fontFamily: ATLAS_MONO, color: N.muted }}>{id}</div>
                    <div>
                      <div>{name}</div>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.faint, marginTop: 2 }}>{t} · {m}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontWeight: 500 }}>{mxn(amt)}</div>
                    <div style={{ textAlign: 'right' }}><Icon.arrowRight size={14} color={N.muted} /></div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Cash drawer */}
            <Card pad={20}>
              <SectionTitle>Estado de caja</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Apertura', 1500.00],
                  ['Ventas efectivo', 7392.00],
                  ['Otros ingresos', 0.00],
                  ['Retiros', -2000.00],
                ].map(([l, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: N.body }}>{l}</span>
                    <span style={{ fontFamily: ATLAS_MONO, color: v < 0 ? '#B43E2E' : N.ink, fontWeight: 500 }}>{v < 0 ? '−' : ''}{mxn(Math.abs(v))}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: N.line, margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
                  <span>Esperado en caja</span>
                  <span style={{ fontFamily: ATLAS_MONO, color: p.accent }}>{mxn(6892.00)}</span>
                </div>
                <Button label="Cerrar caja del turno" kind="accent" preset={p} icon={Icon.receipt} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 500, marginTop: 4, fontFamily: ATLAS_FONT, color: N.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: N.faint, fontFamily: ATLAS_MONO, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── 02 · POS táctil tablet ───────────────────────────────────
function PosTouch() {
  const p = posP();
  const categories = [
    { name: 'Todos', n: 86, active: true },
    { name: 'Cafés', n: 18 },
    { name: 'Panadería', n: 24 },
    { name: 'Sandwiches', n: 12 },
    { name: 'Bebidas frías', n: 16 },
    { name: 'Postres', n: 9 },
    { name: 'Por gramo', n: 7 },
  ];
  const products = [
    { name: 'Americano',         price: 38,  cat: 'Café' },
    { name: 'Latte vainilla',    price: 52,  cat: 'Café' },
    { name: 'Capuchino',         price: 48,  cat: 'Café' },
    { name: 'Espresso doble',    price: 36,  cat: 'Café' },
    { name: 'Cold brew',         price: 58,  cat: 'Frío' },
    { name: 'Croissant',         price: 45,  cat: 'Pan' },
    { name: 'Concha vainilla',   price: 22,  cat: 'Pan' },
    { name: 'Sandwich pavo',     price: 70,  cat: 'Sand.' },
    { name: 'Sandwich vegetal',  price: 68,  cat: 'Sand.' },
    { name: 'Cookie chocolate',  price: 30,  cat: 'Postre' },
    { name: 'Cheesecake',        price: 75,  cat: 'Postre' },
    { name: 'Bagel queso',       price: 55,  cat: 'Pan' },
  ];
  const cart = [
    { name: 'Latte vainilla',    qty: 2, price: 52 },
    { name: 'Croissant',         qty: 1, price: 45 },
    { name: 'Sandwich pavo',     qty: 1, price: 70 },
    { name: 'Cookie chocolate',  qty: 2, price: 30 },
  ];
  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  return (
    <div style={{ width: '100%', height: '100%', background: N.canvas, display: 'flex', fontFamily: ATLAS_FONT }}>
      {/* Left: products */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: N.card, borderBottom: `1px solid ${N.line}` }}>
          <Wordmark color={N.ink} accent={p.accent} size={14} sub="POS · MX-01" />
          <div style={{ width: 1, height: 24, background: N.line }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: 1,
            padding: '10px 14px', background: N.page, border: `1px solid ${N.line}`, borderRadius: 8,
            fontSize: 14, color: N.muted,
          }}>
            <Icon.search size={16} color={N.muted} /> Buscar producto o escanear código…
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: ATLAS_MONO, fontSize: 11.5, color: N.muted }}>
            <Badge color="#0E8A4E" soft="#E3F4EA" dot>Caja · Ana L.</Badge>
            <span>14:32</span>
          </div>
        </div>

        {/* Category strip */}
        <div style={{ display: 'flex', gap: 6, padding: '14px 20px', background: N.card, borderBottom: `1px solid ${N.line}`, overflow: 'hidden' }}>
          {categories.map((c, i) => (
            <div key={i} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 13,
              background: c.active ? p.accent : N.page,
              color: c.active ? '#fff' : N.body,
              border: c.active ? 'none' : `1px solid ${N.line}`,
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: c.active ? 500 : 400,
            }}>
              {c.name}
              <span style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, opacity: 0.7 }}>{c.n}</span>
            </div>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, padding: '16px 20px', overflow: 'hidden', background: N.page }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {products.map((pr, i) => (
              <div key={i} style={{
                background: N.card, border: `1px solid ${N.line}`, borderRadius: 12,
                padding: 14, height: 140, display: 'flex', flexDirection: 'column',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  flex: 1, borderRadius: 8, background: `${p.accentSoft}`,
                  backgroundImage: `repeating-linear-gradient(45deg, ${p.accent}10 0 1px, transparent 1px 8px)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: p.accent, fontFamily: ATLAS_MONO, fontSize: 10, letterSpacing: 0.8,
                  marginBottom: 10,
                }}>{pr.cat.toUpperCase()}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{pr.name}</div>
                <div style={{ fontSize: 14, fontFamily: ATLAS_MONO, fontWeight: 600, color: p.accent, marginTop: 2 }}>{mxn(pr.price)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: cart */}
      <div style={{ width: 360, background: N.card, borderLeft: `1px solid ${N.line}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${N.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Ticket · A-01422</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>Mostrador</div>
            </div>
            <div style={{
              padding: '6px 10px', background: p.accentSoft, color: p.accentInk,
              borderRadius: 6, fontFamily: ATLAS_MONO, fontSize: 11, fontWeight: 500,
            }}>+ Cliente</div>
          </div>
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, padding: '10px 20px', overflow: 'hidden' }}>
          {cart.map((item, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 32px 80px',
              alignItems: 'center', gap: 8, padding: '12px 0',
              borderBottom: i < cart.length - 1 ? `1px solid ${N.line}` : 'none',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: p.accentSoft,
                color: p.accent, fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{item.qty}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, marginTop: 2 }}>{mxn(item.price)} c/u</div>
              </div>
              <Icon.more size={16} color={N.muted} />
              <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 14, fontWeight: 600 }}>{mxn(item.qty * item.price)}</div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ padding: '16px 20px', background: N.page, borderTop: `1px solid ${N.line}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: N.muted }}>
              <span>Subtotal</span><span style={{ fontFamily: ATLAS_MONO }}>{mxn(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: N.muted }}>
              <span>IVA · 16%</span><span style={{ fontFamily: ATLAS_MONO }}>{mxn(tax)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: N.muted }}>
              <span>Descuento</span><span style={{ fontFamily: ATLAS_MONO }}>—</span>
            </div>
          </div>
          <div style={{ height: 1, background: N.line, margin: '14px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: N.muted }}>Total a cobrar</span>
            <span style={{ fontFamily: ATLAS_MONO, fontSize: 30, fontWeight: 600, color: N.ink, letterSpacing: -0.8 }}>{mxn(total)}</span>
          </div>

          {/* Payment methods */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {[
              { icon: Icon.card, label: 'Tarjeta', primary: true },
              { icon: Icon.cash, label: 'Efectivo' },
              { icon: Icon.qr, label: 'QR / app' },
              { icon: Icon.bank, label: 'Transfer.' },
            ].map((m, i) => {
              const IconCmp = m.icon;
              return (
                <div key={i} style={{
                  padding: '14px 12px', borderRadius: 8,
                  background: m.primary ? p.accent : N.card,
                  color: m.primary ? '#fff' : N.ink,
                  border: m.primary ? 'none' : `1px solid ${N.line}`,
                  display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500,
                }}>
                  <IconCmp size={18} color={m.primary ? '#fff' : N.body} />
                  <span style={{ fontSize: 13.5 }}>{m.label}</span>
                </div>
              );
            })}
          </div>
          <Button label={`Cobrar ${mxn(total)}`} kind="primary" preset={p} icon={Icon.arrowRight} />
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Mobile ──────────────────────────────────────────────
function PosMobile() {
  const p = posP();
  return (
    <div style={{ width: '100%', height: '100%', background: N.page, display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 14px', background: N.card, borderBottom: `1px solid ${N.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.8 }}>HOLA, ANA</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Sucursal Roma</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: p.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.accent }}>
            <Icon.bell size={17} />
          </div>
        </div>
        <div style={{
          background: p.accent, color: '#fff', borderRadius: 12, padding: 14,
          backgroundImage: `linear-gradient(135deg, ${p.accent}, ${p.accentInk})`,
        }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, opacity: 0.85, letterSpacing: 0.6 }}>VENTAS DEL TURNO</div>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: ATLAS_FONT, marginTop: 4, letterSpacing: -0.6 }}>{mxn(28430.00)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11.5, fontFamily: ATLAS_MONO, opacity: 0.85 }}>
            <span>143 tickets</span>
            <span>Prom. {mxn(198.81)}</span>
            <span>+18.2%</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { icon: Icon.cart, l: 'Vender' },
          { icon: Icon.receipt, l: 'Caja' },
          { icon: Icon.pkg, l: 'Productos' },
          { icon: Icon.chart, l: 'Reporte' },
        ].map((a, i) => {
          const IconCmp = a.icon;
          return (
            <div key={i} style={{ background: N.card, border: `1px solid ${N.line}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <IconCmp size={20} color={p.accent} />
              <div style={{ fontSize: 11, color: N.body }}>{a.l}</div>
            </div>
          );
        })}
      </div>

      {/* Hourly chart */}
      <div style={{ padding: '4px 18px 14px' }}>
        <Card pad={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Ventas por hora · hoy</div>
            <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: '#0E8A4E' }}>+18.2%</div>
          </div>
          <BarChart
            data={[
              { label: '9', value: 4 },{ label: '10', value: 7 },{ label: '11', value: 9 },
              { label: '12', value: 12 },{ label: '13', value: 18 },{ label: '14', value: 24, highlight: true },
              { label: '15', value: 17 },
            ]}
            width={310} height={84} color={p.accent} soft={N.line}
          />
        </Card>
      </div>

      {/* Recent tickets */}
      <div style={{ padding: '0 18px', flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Últimos tickets</div>
        <Card pad={0}>
          {[
            ['#A-01421', 'Tarjeta', 348.00, '14:32', '#0E8A4E'],
            ['#A-01420', 'Efectivo', 86.00, '14:28', '#9A6610'],
            ['#A-01419', 'Tarjeta', 412.50, '14:24', '#0E8A4E'],
            ['#A-01418', 'Transferencia', 156.00, '14:18', '#1F4FC8'],
          ].map(([id, m, amt, t, c], i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '8px 1fr 80px', gap: 10,
              padding: '12px 14px', alignItems: 'center',
              borderTop: i ? `1px solid ${N.line}` : 'none',
            }}>
              <div style={{ width: 4, height: 28, background: c, borderRadius: 2 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{id}</div>
                <div style={{ fontSize: 10.5, fontFamily: ATLAS_MONO, color: N.muted, marginTop: 2 }}>{t} · {m}</div>
              </div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{mxn(amt)}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Bottom nav */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        background: N.card, borderTop: `1px solid ${N.line}`,
        padding: '8px 8px 24px',
      }}>
        {[
          { icon: Icon.home, l: 'Inicio', active: true },
          { icon: Icon.cart, l: 'Vender' },
          { icon: Icon.plus, l: '', primary: true },
          { icon: Icon.chart, l: 'Reportes' },
          { icon: Icon.user, l: 'Cuenta' },
        ].map((n, i) => {
          const IconCmp = n.icon;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {n.primary ? (
                <div style={{ width: 42, height: 42, borderRadius: 12, background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 14px ${p.accent}40` }}>
                  <IconCmp size={20} color="#fff" strokeWidth={2} />
                </div>
              ) : (
                <>
                  <IconCmp size={20} color={n.active ? p.accent : N.muted} />
                  <div style={{ fontSize: 10, color: n.active ? p.accent : N.muted, fontFamily: ATLAS_MONO }}>{n.l}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 04 · Hero comercial ──────────────────────────────────────
function PosHero() {
  const p = posP();
  return (
    <HeroBg preset={p}>
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 40, fontFamily: ATLAS_FONT, position: 'relative' }}>
        {/* Left copy */}
        <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent, color: '#fff', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 500 }}>PRESET 01</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accentInk, letterSpacing: 1.4, textTransform: 'uppercase' }}>Entrada universal</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 56, fontWeight: 500, lineHeight: 1.02, letterSpacing: -1.4, color: N.ink, marginBottom: 18 }}>
            Atlas <span style={{ color: p.accent }}>POS</span>
            <div style={{ fontSize: 30, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.5, color: N.body, fontFamily: ATLAS_SERIF }}>
              Vender, cobrar y controlar caja desde el día uno.
            </div>
          </div>
          <div style={{ fontSize: 15, color: N.body, lineHeight: 1.6, marginBottom: 28, maxWidth: 480 }}>
            La forma más simple de empezar con Atlas One. Productos, caja, tickets y reportes — listos para operar en cualquier mostrador, sin curva de aprendizaje.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {[
              ['$12 MXN', 'al día desde'],
              ['1 mes', 'gratis para probar'],
              ['Multi-caja', 'incluido'],
              ['Tickets', 'profesionales'],
            ].map(([k, v], i) => (
              <div key={i} style={{ paddingLeft: 14, borderLeft: `2px solid ${p.accent}` }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: N.ink, letterSpacing: -0.4, fontFamily: ATLAS_FONT }}>{k}</div>
                <div style={{ fontSize: 12, color: N.muted, fontFamily: ATLAS_MONO, marginTop: 2, letterSpacing: 0.3 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button label="Probar 1 mes gratis" kind="primary" preset={p} icon={Icon.arrowRight} />
            <Button label="Ver demo" kind="secondary" />
          </div>
        </div>

        {/* Right: device composition */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Laptop */}
          <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-58%)' }}>
            <LaptopFrame width={680}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.46)', transformOrigin: 'top left' }}>
                <PosDesktop />
              </div>
            </LaptopFrame>
          </div>
          {/* Phone */}
          <div style={{ position: 'absolute', bottom: 30, right: 10, transform: 'rotate(4deg)' }}>
            <PhoneFrame width={210}>
              <div style={{ width: 390, height: 844, transform: 'scale(0.539)', transformOrigin: 'top left' }}>
                <PosMobile />
              </div>
            </PhoneFrame>
          </div>
        </div>
      </div>

      {/* Footer band */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 70px', display: 'flex', alignItems: 'center', gap: 16,
        borderTop: `1px solid ${p.accent}20`,
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(8px)',
      }}>
        <Wordmark color={N.ink} accent={p.accent} size={13} />
        <div style={{ width: 1, height: 18, background: N.line2 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6 }}>UN SOLO SOFTWARE · CONFIGURADO PARA TU NEGOCIO</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>atlas.tech / pos</div>
      </div>
    </HeroBg>
  );
}

Object.assign(window, { PosDesktop, PosTouch, PosMobile, PosHero });
