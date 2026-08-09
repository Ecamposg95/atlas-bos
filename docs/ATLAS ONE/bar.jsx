// bar.jsx — Atlas One Bar (Preset 08)
// Color: Violeta + neón cyan, DARK MODE. Nocturna, lounge.

const barP = () => PRESETS.bar;

const barSidebarItems = [
  { header: 'Salón' },
  { icon: Icon.cocktail, label: 'Barra' },
  { icon: Icon.table,    label: 'Mesas',           badge: '11' },
  { icon: Icon.receipt,  label: 'Comandas' },
  { header: 'Inventario' },
  { icon: Icon.wine,     label: 'Botellas' },
  { icon: Icon.beaker,   label: 'Insumos líquidos' },
  { icon: Icon.zap,      label: 'Promociones',     badge: '3' },
  { header: 'Operación' },
  { icon: Icon.bars,     label: 'Cortes por turno' },
  { icon: Icon.chart,    label: 'Reportes nocturnos' },
  { icon: Icon.cog,      label: 'Ajustes' },
];

// Dark mode tokens
const D = {
  bg: '#0A0418',
  surface: '#15082A',
  surface2: '#1F1037',
  line: '#2A1B45',
  line2: '#3D2A5C',
  text: '#F0E8FB',
  body: '#C7B8E4',
  muted: '#7A6BA0',
  faint: '#5A4D80',
};

// ─── 01 · Desktop · Dashboard nocturno ────────────────────────
function BarDesktop() {
  const p = barP();
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: D.bg, fontFamily: ATLAS_FONT, color: D.text }}>
      <Sidebar preset={p} active="Barra" items={barSidebarItems}
        footer={<SidebarUser preset={p} name="Iván Solís" role="Bar manager" branch="Roma · Lounge" />} />

      {/* Custom topbar for dark mode */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 28px', background: D.surface, borderBottom: `1px solid ${D.line}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: D.text, letterSpacing: -0.2 }}>Turno noche · viernes</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.muted, marginTop: 4 }}>BARRA ABIERTA 20:00 · 11 MESAS · 28 BOTELLAS DESCORCHADAS · CIERRE 03:00</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: '6px 12px', background: D.surface2, border: `1px solid ${D.line}`, borderRadius: 7, fontFamily: ATLAS_MONO, fontSize: 11, color: D.body, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: p.accent2, boxShadow: `0 0 8px ${p.accent2}` }} />
              EN VIVO · 23:42
            </div>
            <div style={{ padding: '8px 14px', background: p.accent2, color: D.bg, borderRadius: 7, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon.plus size={14} color={D.bg} strokeWidth={2.2} />Nueva comanda
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '22px 28px', overflow: 'hidden' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
            {[
              ['Ventas del turno', mxnInt(42180), '+22%', [4,6,5,8,7,10,9,12,14,16,18,22]],
              ['Cuentas activas',  '11',          null,    null, 'mesa · 8 · barra · 3'],
              ['Ticket promedio',  mxn(720.00),  '+8%',  [6,7,6,8,7,9,8,9,10,10,11,12]],
              ['Botellas servidas','42',         '+12',  null, '28 abiertas · ↑4 vs ayer'],
            ].map(([l, v, d, t, sub], i) => (
              <DarkKpi key={i} label={l} value={v} delta={d} trend={t} sub={sub} accent={p.accent2} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
            {/* Bottle inventory */}
            <div style={{ background: D.surface, border: `1px solid ${D.line}`, borderRadius: 12, padding: 20, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Inventario líquido · top 8</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: D.text }}>Control de copeo y botella</div>
                </div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2 }}>● 28 abiertas / 142 totales</div>
              </div>

              {[
                { name: 'Don Julio Reposado',     vol: 0.42, pours: 28, value: 3360, color: p.accent },
                { name: 'Mezcal Amores Joven',    vol: 0.65, pours: 22, value: 2640, color: p.accent2 },
                { name: 'Hendrick\'s Gin',        vol: 0.18, pours: 16, value: 2240, color: '#FB7185', warning: true },
                { name: 'Macallan 12',            vol: 0.82, pours:  6, value: 2160, color: '#F59E0B' },
                { name: 'Aperol',                 vol: 0.55, pours: 14, value:  980, color: p.accent },
                { name: 'Tanqueray',              vol: 0.38, pours: 12, value: 1320, color: p.accent2 },
                { name: 'Campari',                vol: 0.28, pours:  9, value:  720, color: '#FB7185', warning: true },
              ].map((b, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 200px 70px 90px',
                  alignItems: 'center', gap: 14, padding: '10px 0',
                  borderTop: i ? `1px solid ${D.line}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {b.warning && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#FB7185', boxShadow: '0 0 6px #FB7185' }} />}
                    <span style={{ fontSize: 13, fontWeight: 500, color: D.text }}>{b.name}</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ height: 6, background: D.surface2, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${b.vol * 100}%`, height: '100%',
                        background: b.color, boxShadow: `0 0 6px ${b.color}80`,
                      }} />
                    </div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: D.muted, marginTop: 3 }}>{Math.round(b.vol * 100)}% restante</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 12, color: D.body }}>{b.pours} copas</div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 600, color: D.text }}>{mxnInt(b.value)}</div>
                </div>
              ))}
            </div>

            {/* Right: promotions + top cocktails */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: `linear-gradient(135deg, ${p.accent}, ${p.accent2}30)`,
                borderRadius: 12, padding: 18, border: `1px solid ${p.accent2}40`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `${p.accent2}30`, filter: 'blur(40px)' }} />
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2, letterSpacing: 0.8, textTransform: 'uppercase' }}>Promociones activas · noche</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, position: 'relative' }}>
                  {[
                    ['Happy hour mezcales', '20–22h', '2×1', '36 servidos'],
                    ['Whisky + tabla',      '22–01h', '15% OFF', '14 vendidos'],
                    ['Vino casa por copa',  'Toda la noche', '$120', '28 servidos'],
                  ].map(([n, hr, off, sold], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(10,4,24,0.4)', borderRadius: 7 }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: D.text }}>{n}</div>
                        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: D.body, marginTop: 2 }}>{hr} · {sold}</div>
                      </div>
                      <div style={{ padding: '4px 10px', background: p.accent2, color: D.bg, borderRadius: 5, fontFamily: ATLAS_MONO, fontSize: 11, fontWeight: 700 }}>{off}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, background: D.surface, border: `1px solid ${D.line}`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Cocteles top · noche</div>
                {[
                  ['Mezcal old fashioned', 18, 4860],
                  ['Negroni clásico',      14, 3360],
                  ['Espresso martini',     12, 2880],
                  ['Aperol spritz',         9, 1620],
                  ['Manhattan',             8, 2160],
                ].map(([n, qty, total], i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 50px 80px', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: i ? `1px solid ${D.line}` : 'none' }}>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.muted }}>{String(i+1).padStart(2, '0')}</div>
                    <div style={{ fontSize: 13, color: D.text }}>{n}</div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.body, textAlign: 'right' }}>{qty}×</div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: p.accent2, fontWeight: 600, textAlign: 'right' }}>{mxnInt(total)}</div>
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

function DarkKpi({ label, value, delta, trend, sub, accent }) {
  const positive = delta && delta.startsWith('+');
  return (
    <div style={{
      background: D.surface, border: `1px solid ${D.line}`, borderRadius: 12, padding: 16,
      minHeight: 116, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: D.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: ATLAS_FONT, fontSize: 26, fontWeight: 600, color: D.text, letterSpacing: -0.6 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        {sub ? <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: D.muted }}>{sub}</div>
            : delta && <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: positive ? '#22D3B8' : '#FB7185' }}>{delta}</div>}
        {trend && <Sparkline values={trend} color={accent} width={60} height={22} />}
      </div>
    </div>
  );
}

// ─── 02 · Barra táctil con copeo ──────────────────────────────
function BarTouch() {
  const p = barP();
  return (
    <div style={{ width: '100%', height: '100%', background: D.bg, color: D.text, display: 'flex', fontFamily: ATLAS_FONT }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', background: D.surface, borderBottom: `1px solid ${D.line}` }}>
          <Wordmark color={D.text} accent={p.accent2} size={14} sub="BAR · LOUNGE ROMA" />
          <div style={{ width: 1, height: 22, background: D.line }} />
          <span style={{ padding: '4px 10px', background: 'rgba(34,211,238,0.15)', color: p.accent2, borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: p.accent2, boxShadow: `0 0 6px ${p.accent2}` }} />
            BARRA · IVÁN S.
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.muted }}>MESA 04 · 4 PERS · ABIERTA 22:18</div>
        </div>

        {/* Cocktail grid */}
        <div style={{ flex: 1, padding: '18px 22px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {['Coctelería', 'Mezcales', 'Whiskies', 'Gin & tonic', 'Vinos', 'Cervezas'].map((c, i) => (
              <div key={i} style={{
                padding: '10px 16px', borderRadius: 8, fontSize: 13,
                background: i === 0 ? p.accent : D.surface,
                color: i === 0 ? '#fff' : D.body,
                border: i === 0 ? 'none' : `1px solid ${D.line}`,
                fontWeight: i === 0 ? 500 : 400,
              }}>{c}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { name: 'Mezcal old fashioned', price: 270, spirit: 'Mezcal', glow: true },
              { name: 'Negroni clásico',      price: 240, spirit: 'Gin' },
              { name: 'Espresso martini',     price: 240, spirit: 'Vodka', glow: true },
              { name: 'Manhattan',            price: 280, spirit: 'Whisky' },
              { name: 'Aperol spritz',        price: 180, spirit: 'Aperol' },
              { name: 'Margarita de la casa', price: 220, spirit: 'Tequila' },
              { name: 'Tom collins',          price: 190, spirit: 'Gin' },
              { name: 'Paloma jamaica',       price: 200, spirit: 'Tequila' },
            ].map((c, i) => (
              <div key={i} style={{
                background: D.surface, border: `1px solid ${c.glow ? p.accent2 + '60' : D.line}`,
                borderRadius: 14, padding: 16, height: 140, display: 'flex', flexDirection: 'column',
                position: 'relative', overflow: 'hidden',
                boxShadow: c.glow ? `0 0 20px ${p.accent2}20` : 'none',
              }}>
                {c.glow && <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: p.accent2, filter: 'blur(40px)', opacity: 0.25 }} />}
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(124,58,237,0.18)', color: p.accent2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                }}>
                  <Icon.cocktail size={20} color={p.accent2} />
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10, color: D.text }}>{c.name}</div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: D.muted, marginTop: 2 }}>{c.spirit.toUpperCase()}</div>
                </div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 16, fontWeight: 600, color: p.accent2, position: 'relative' }}>{mxn(c.price)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: order */}
      <div style={{ width: 360, background: D.surface, borderLeft: `1px solid ${D.line}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px', background: D.surface2, borderBottom: `1px solid ${D.line}` }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Comanda · B-1182</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4, letterSpacing: -0.3 }}>Mesa 04 · 4 pax</div>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.body, marginTop: 4 }}>ABIERTA 22:18 · MESERO LUIS</div>
        </div>

        {/* Items */}
        <div style={{ flex: 1, padding: '6px 20px', overflow: 'hidden' }}>
          {[
            { qty: 2, name: 'Mezcal old fashioned',  price: 270, status: 'served' },
            { qty: 1, name: 'Negroni clásico',       price: 240, status: 'served' },
            { qty: 1, name: 'Espresso martini',      price: 240, status: 'making' },
            { qty: 2, name: 'Mezcal Amores joven · copa', price: 180, status: 'served' },
            { qty: 1, name: 'Tabla de quesos',       price: 380, status: 'sent', kitchen: true },
          ].map((it, i) => {
            const sc = it.status === 'served' ? '#22D3B8' : it.status === 'making' ? p.accent2 : '#F59E0B';
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 60px 12px',
                gap: 10, padding: '12px 0', alignItems: 'center',
                borderBottom: i < 4 ? `1px solid ${D.line}` : 'none',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(124,58,237,0.18)', color: p.accent2, fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.qty}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: D.text }}>{it.name}</div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: D.muted, marginTop: 2 }}>{mxn(it.price)} {it.kitchen && '· COCINA'}</div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 600, color: D.text }}>{mxn(it.price * it.qty)}</div>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: sc, boxShadow: `0 0 6px ${sc}` }} />
              </div>
            );
          })}
        </div>

        <div style={{ padding: '14px 20px', background: D.surface2, borderTop: `1px solid ${D.line}` }}>
          <div style={{ fontSize: 12, color: D.muted, display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span style={{ fontFamily: ATLAS_MONO }}>{mxn(1860.00)}</span></div>
          <div style={{ fontSize: 12, color: D.muted, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>Propina 15%</span><span style={{ fontFamily: ATLAS_MONO }}>{mxn(279.00)}</span></div>
          <div style={{ height: 1, background: D.line, margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: D.muted }}>Total</span>
            <span style={{ fontFamily: ATLAS_MONO, fontSize: 26, fontWeight: 600, color: D.text, letterSpacing: -0.6 }}>{mxn(2139.00)}</span>
          </div>
          <div style={{
            padding: '12px 16px', background: p.accent2, color: D.bg, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontWeight: 700, fontSize: 14, boxShadow: `0 0 16px ${p.accent2}40`,
          }}>
            Cerrar cuenta <Icon.arrowRight size={16} color={D.bg} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Cuentas abiertas ────────────────────────────────────
function BarTabs() {
  const p = barP();
  const accounts = [
    { id: 'B-1182', zone: 'Mesa 04', pax: 4, mins: 84, total: 2139, items: 6, tender: 'Luis', status: 'hot', active: true },
    { id: 'B-1186', zone: 'Barra 02', pax: 2, mins: 38, total: 940, items: 4, tender: 'Iván' },
    { id: 'B-1179', zone: 'Mesa 08', pax: 6, mins: 126, total: 4820, items: 14, tender: 'Carla', status: 'long' },
    { id: 'B-1190', zone: 'Lounge 01', pax: 3, mins: 22, total: 1280, items: 5, tender: 'Iván' },
    { id: 'B-1175', zone: 'Mesa 02', pax: 2, mins: 64, total: 1660, items: 7, tender: 'Luis' },
    { id: 'B-1192', zone: 'Barra 04', pax: 1, mins: 12, total: 540, items: 2, tender: 'Carla' },
    { id: 'B-1170', zone: 'Privado', pax: 8, mins: 152, total: 8940, items: 22, tender: 'Iván', status: 'long' },
    { id: 'B-1188', zone: 'Lounge 03', pax: 4, mins: 30, total: 1980, items: 6, tender: 'Luis' },
  ];
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: D.bg, color: D.text, fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Comandas" items={barSidebarItems}
        footer={<SidebarUser preset={p} name="Iván Solís" role="Bar manager" branch="Roma · Lounge" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 28px', background: D.surface, borderBottom: `1px solid ${D.line}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: D.text, letterSpacing: -0.2 }}>Cuentas abiertas</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: D.muted, marginTop: 4 }}>8 ABIERTAS · CONSUMO ACUMULADO {mxnInt(22299)} · TICKET PROM. $720</div>
          </div>
          <div style={{ padding: '8px 14px', background: p.accent2, color: D.bg, borderRadius: 7, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon.plus size={14} color={D.bg} strokeWidth={2.2} />Abrir cuenta
          </div>
        </div>
        <div style={{ flex: 1, padding: '22px 28px', overflow: 'hidden', display: 'flex', gap: 16 }}>
          {/* Accounts grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {accounts.map((a) => {
                const sc = a.status === 'long' ? '#FB7185' : a.status === 'hot' ? p.accent2 : D.muted;
                return (
                  <div key={a.id} style={{
                    background: a.active ? D.surface2 : D.surface, borderRadius: 12, padding: 16,
                    border: a.active ? `1.5px solid ${p.accent2}` : `1px solid ${D.line}`,
                    boxShadow: a.active ? `0 0 20px ${p.accent2}24` : 'none', position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: D.text }}>{a.zone}</div>
                        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: D.muted, marginTop: 2 }}>{a.id} · {a.pax} pax</div>
                      </div>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: sc, boxShadow: `0 0 6px ${sc}` }} />
                    </div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 24, fontWeight: 600, color: D.text, marginTop: 14, letterSpacing: -0.6 }}>{mxnInt(a.total)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: ATLAS_MONO, fontSize: 10.5, color: D.body }}>
                      <span>{a.items} ítems</span>
                      <span style={{ color: a.mins >= 120 ? '#FB7185' : D.muted }}>{a.mins}m</span>
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${D.line}`, fontFamily: ATLAS_MONO, fontSize: 10, color: D.muted }}>{a.tender}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div style={{ width: 340, flexShrink: 0, background: D.surface, border: `1px solid ${D.line}`, borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', background: D.surface2, borderBottom: `1px solid ${D.line}` }}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: D.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Cuenta · B-1182</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>Mesa 04 · 4 pax</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: D.body, marginTop: 4 }}>ABIERTA 22:18 · BARTENDER LUIS · 84 MIN</div>
            </div>
            <div style={{ flex: 1, padding: '6px 20px', overflow: 'hidden' }}>
              {[
                { qty: 2, name: 'Mezcal old fashioned', price: 270 },
                { qty: 1, name: 'Negroni clásico', price: 240 },
                { qty: 1, name: 'Espresso martini', price: 240 },
                { qty: 2, name: 'Mezcal Amores · copa', price: 180 },
                { qty: 1, name: 'Tabla de quesos', price: 380, kitchen: true },
              ].map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 60px', gap: 10, padding: '11px 0', alignItems: 'center', borderBottom: i < 4 ? `1px solid ${D.line}` : 'none' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(124,58,237,0.18)', color: p.accent2, fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.qty}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: D.text }}>{it.name}</div>
                    {it.kitchen && <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: D.muted, marginTop: 2 }}>COCINA</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 12.5, fontWeight: 600, color: D.text }}>{mxn(it.price * it.qty)}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 20px', background: D.surface2, borderTop: `1px solid ${D.line}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: D.muted }}>Total</span>
                <span style={{ fontFamily: ATLAS_MONO, fontSize: 24, fontWeight: 600, color: D.text, letterSpacing: -0.6 }}>{mxn(2139.00)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {['Separar', 'Mover ítems'].map((s,i)=>(
                  <div key={i} style={{ textAlign: 'center', padding: '10px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 500, color: D.body, border: `1px solid ${D.line2}` }}>{s}</div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', background: p.accent2, color: D.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, fontSize: 14, boxShadow: `0 0 16px ${p.accent2}40` }}>
                Cerrar cuenta <Icon.arrowRight size={16} color={D.bg} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 04 · Hero ────────────────────────────────────────────────
function BarHero() {
  const p = barP();
  return (
    <div style={{
      width: '100%', height: '100%', background: `linear-gradient(135deg, ${D.bg} 0%, #1A0B2E 50%, #07021A 100%)`,
      position: 'relative', overflow: 'hidden', fontFamily: ATLAS_FONT, color: D.text,
    }}>
      {/* Glow */}
      <div style={{ position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${p.accent}40, transparent 60%)`, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', bottom: -200, left: -150, width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${p.accent2}30, transparent 60%)`, filter: 'blur(60px)' }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, position: 'relative' }}>
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent2, color: D.bg, borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 600 }}>PRESET 08</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2, letterSpacing: 1.4, textTransform: 'uppercase' }}>Barra · noche · control</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 64, fontWeight: 500, lineHeight: 1, letterSpacing: -1.8, color: D.text }}>
            Atlas One <em style={{ color: p.accent2, fontStyle: 'italic', textShadow: `0 0 30px ${p.accent2}80` }}>Bar</em>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.3, color: D.body }}>
            La noche tiene mucho que medir. Atlas One la cuadra.
          </div>
          <div style={{ fontSize: 15, color: D.body, lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 460 }}>
            Inventario líquido, copeo y botella, promociones por horario, cortes por turno y reportes nocturnos. Para bares, lounges, cantinas y coctelerías que toman en serio su operación.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: Icon.wine,   t: 'Control de botella, copeo y merma líquida' },
              { icon: Icon.zap,    t: 'Promociones automáticas por horario y producto' },
              { icon: Icon.bars,   t: 'Cortes por turno y reportes de cierre nocturno' },
            ].map((f, i) => {
              const IconCmp = f.icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,211,238,0.12)', color: p.accent2, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${p.accent2}40` }}>
                    <IconCmp size={17} color={p.accent2} />
                  </div>
                  <div style={{ fontSize: 14, color: D.text }}>{f.t}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
            <div style={{ padding: '10px 16px', background: p.accent2, color: D.bg, borderRadius: 7, fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: `0 0 20px ${p.accent2}40` }}>
              Probar 1 mes gratis <Icon.arrowRight size={14} color={D.bg} />
            </div>
            <div style={{ padding: '10px 16px', background: 'transparent', color: D.text, border: `1px solid ${D.line2}`, borderRadius: 7, fontWeight: 500, fontSize: 13 }}>
              Ver demo
            </div>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 40, right: 0 }}>
            <LaptopFrame width={700}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.475)', transformOrigin: 'top left' }}>
                <BarDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{
            position: 'absolute', top: 0, right: 80,
            background: D.surface, border: `1px solid ${p.accent2}60`, borderRadius: 12, padding: 14, width: 200,
            boxShadow: `0 0 30px ${p.accent2}30`, transform: 'rotate(3deg)',
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: D.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Inventario líquido</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 28, fontWeight: 600, color: p.accent2, marginTop: 4, letterSpacing: -0.6 }}>28<span style={{ fontSize: 14, color: D.muted, fontFamily: ATLAS_MONO }}> /142</span></div>
            <div style={{ fontSize: 10.5, color: D.body, fontFamily: ATLAS_MONO, marginTop: 2 }}>botellas descorchadas</div>
            <div style={{ marginTop: 10, height: 4, background: D.surface2, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: '20%', height: '100%', background: p.accent2, boxShadow: `0 0 8px ${p.accent2}` }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 70px', display: 'flex', alignItems: 'center', gap: 16,
        borderTop: `1px solid ${p.accent2}20`, background: 'rgba(10,4,24,0.7)', backdropFilter: 'blur(8px)',
      }}>
        <Wordmark color={D.text} accent={p.accent2} size={13} />
        <div style={{ width: 1, height: 18, background: D.line2 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: D.muted, letterSpacing: 0.6 }}>BARRA · MESAS · BOTELLAS · COPEO · PROMOCIONES · CORTES</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: D.muted }}>atlas.tech / bar</div>
      </div>
    </div>
  );
}

Object.assign(window, { BarDesktop, BarTouch, BarTabs, BarHero });
