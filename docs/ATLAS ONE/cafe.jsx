// cafe.jsx — Atlas One Café (Preset 07)
// Color: Café espresso + ámbar. Artesanal, cálido, rápido.

const cafeP = () => PRESETS.cafe;

const cafeSidebarItems = [
  { header: 'Barra' },
  { icon: Icon.coffee,   label: 'POS rápido' },
  { icon: Icon.utensils, label: 'Menú visual' },
  { icon: Icon.flame,    label: 'Pedidos',       badge: '6' },
  { header: 'Cocina' },
  { icon: Icon.beaker,   label: 'Recetas' },
  { icon: Icon.pkg,      label: 'Insumos',       badge: '!' },
  { icon: Icon.warning,  label: 'Merma' },
  { header: 'Negocio' },
  { icon: Icon.users,    label: 'Frecuentes' },
  { icon: Icon.chart,    label: 'Reportes' },
  { icon: Icon.cog,      label: 'Ajustes' },
];

// ─── 01 · Desktop · Ventas + recetas + insumos ────────────────
function CafeDesktop() {
  const p = cafeP();
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F7EFE3', fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="POS rápido" items={cafeSidebarItems}
        footer={<SidebarUser preset={p} name="Bruno Cano" role="Barista líder" branch="Roma Norte" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Operación · sábado 26 de noviembre"
          sub="TURNO MAÑANA · BARRA ABIERTA 07:00 · 248 ÓRDENES · MERMA <2%"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SearchInput preset={p} placeholder="Buscar bebida, combo o insumo…" width={300} />
              <Button label="Nueva orden" kind="primary" preset={p} icon={Icon.plus} />
            </div>
          }
        />

        <div style={{ flex: 1, padding: '20px 26px', background: '#FBF6EE', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <Kpi label="Ventas del turno" value={mxnInt(18420)} delta="+14%" trend={[3,5,4,7,6,9,8,11,12,10,14,18]} accent={p.accent} />
            <Kpi label="Órdenes" value="248" sub="ticket prom. $74.30" />
            <Kpi label="Hora pico" value="08:30" sub="42 órdenes / hora" />
            <Kpi label="Margen promedio" value="68%" delta="+2.4 pp" trend={[6,6,7,7,8,7,8,8,9,8,9,9]} accent={p.accent2} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 14 }}>
            <Card pad={20}>
              <SectionTitle action="Ver detalle →">Ventas por hora · hoy</SectionTitle>
              <BarChart
                data={[
                  { label: '07', value: 12 }, { label: '08', value: 42, highlight: true },
                  { label: '09', value: 38, highlight: true }, { label: '10', value: 22 },
                  { label: '11', value: 18 }, { label: '12', value: 26 }, { label: '13', value: 32 },
                  { label: '14', value: 24 }, { label: '15', value: 14 }, { label: '16', value: 10 },
                ]}
                width={460} height={170} color={p.accent} soft={N.line}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${N.line}` }}>
                <Stat label="Bebida estrella" value="Latte vainilla" sub="62 vendidos · 25%" />
                <Stat label="Combo más popular" value="Café + concha" sub="48 vendidos · margen 71%" />
                <Stat label="Pedidos para llevar" value="58%" sub="↑ vs barra · 42%" />
              </div>
            </Card>

            <Card pad={20}>
              <SectionTitle>Recetas · costo y margen</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { name: 'Latte vainilla 12 oz', cost: 14.20, price: 52, margin: 73 },
                  { name: 'Espresso doble',       cost:  6.80, price: 36, margin: 81 },
                  { name: 'Cold brew',            cost: 16.50, price: 58, margin: 72 },
                  { name: 'Croissant mantequilla',cost: 12.40, price: 45, margin: 72 },
                  { name: 'Concha vainilla',      cost:  5.20, price: 22, margin: 76 },
                  { name: 'Sandwich pavo',        cost: 28.00, price: 70, margin: 60 },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i ? `1px solid ${N.line}` : 'none' }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.name}</div>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 2 }}>Costo {mxn(r.cost)} · Precio {mxn(r.price)}</div>
                    </div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 600, color: r.margin >= 70 ? '#0E8A4E' : '#9A6610', textAlign: 'right' }}>{r.margin}%</div>
                    <div>
                      <div style={{ height: 4, background: N.line, borderRadius: 2 }}>
                        <div style={{ width: `${r.margin}%`, height: '100%', background: r.margin >= 70 ? '#0E8A4E' : '#9A6610', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card pad={20}>
              <SectionTitle action="Generar orden →">Insumos · estado</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { name: 'Café especialidad',  cur: 2.2,  unit: 'kg', target: 8,  status: 'crit',  rate: '6.4 kg/sem' },
                  { name: 'Leche entera',       cur: 24,   unit: 'L',  target: 80, status: 'low',   rate: '120 L/sem' },
                  { name: 'Vainilla en jarabe', cur: 1.8,  unit: 'L',  target: 4,  status: 'low',   rate: '2.5 L/sem' },
                  { name: 'Harina de trigo',    cur: 18,   unit: 'kg', target: 24, status: 'ok',    rate: '14 kg/sem' },
                  { name: 'Mantequilla',        cur: 6.4,  unit: 'kg', target: 8,  status: 'ok',    rate: '5 kg/sem' },
                ].map((it, i) => {
                  const pct = (it.cur / it.target) * 100;
                  const c = it.status === 'crit' ? '#B43E2E' : it.status === 'low' ? '#9A6610' : '#0E8A4E';
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>{it.name}</span>
                        <span style={{ fontFamily: ATLAS_MONO, color: c, fontWeight: 600 }}>{it.cur} / {it.target} {it.unit}</span>
                      </div>
                      <div style={{ height: 4, background: N.line, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: c }} />
                      </div>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 3 }}>Consumo · {it.rate}</div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 4, padding: 10, background: p.accentSoft, borderRadius: 7, fontSize: 11.5, color: p.accentInk, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Icon.sparkles size={14} color={p.accent} />
                  <span><strong>Pedido sugerido</strong> · 8 kg café + 80 L leche · {mxn(4280)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 02 · POS barra rápida con modificadores ──────────────────
function CafeTouch() {
  const p = cafeP();
  const drinks = [
    { name: 'Americano',         price: 38, kind: 'café' },
    { name: 'Espresso',          price: 28, kind: 'café' },
    { name: 'Latte',             price: 48, kind: 'café' },
    { name: 'Capuchino',         price: 44, kind: 'café' },
    { name: 'Mocha',             price: 56, kind: 'café' },
    { name: 'Cold brew',         price: 58, kind: 'frío' },
    { name: 'Frappé chocolate',  price: 62, kind: 'frío' },
    { name: 'Matcha latte',      price: 64, kind: 'specialty' },
    { name: 'Té chai',           price: 52, kind: 'specialty' },
  ];
  const modifiers = [
    { name: 'Leche entera',     active: true,  extra: 0 },
    { name: 'Leche deslactosada', extra: 6 },
    { name: 'Leche de avena',   extra: 12 },
    { name: 'Leche de almendra', extra: 12 },
    { name: 'Extra shot',       extra: 14 },
    { name: 'Crema batida',     extra: 8 },
    { name: 'Vainilla',         extra: 6 },
    { name: 'Caramelo',         extra: 6 },
  ];

  return (
    <div style={{ width: '100%', height: '100%', background: '#F7EFE3', display: 'flex', fontFamily: ATLAS_FONT }}>
      {/* Left: menu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', background: '#FFF', borderBottom: `1px solid ${N.line}` }}>
          <Wordmark color={N.ink} accent={p.accent} size={14} sub="CAFÉ · ROMA NORTE" />
          <div style={{ width: 1, height: 22, background: N.line }} />
          <Badge color={p.accent} soft={p.accentSoft} dot>Barra · Bruno C.</Badge>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>SÁBADO 08:24 · TURNO MAÑANA</div>
        </div>

        <div style={{ flex: 1, padding: 22, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Category strip */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { name: 'Café caliente', n: 12, active: true },
              { name: 'Bebidas frías', n: 8 },
              { name: 'Especialidad',  n: 6 },
              { name: 'Panadería',     n: 14 },
              { name: 'Sandwiches',    n: 7 },
              { name: 'Combos',        n: 5 },
            ].map((c, i) => (
              <div key={i} style={{
                padding: '10px 16px', borderRadius: 8, fontSize: 13,
                background: c.active ? p.accent : '#FFF',
                color: c.active ? '#fff' : N.body,
                border: c.active ? 'none' : `1px solid ${N.line}`,
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: c.active ? 500 : 400,
              }}>
                {c.name}
                <span style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, opacity: 0.7 }}>{c.n}</span>
              </div>
            ))}
          </div>

          {/* Drinks grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flex: 1 }}>
            {drinks.map((d, i) => (
              <div key={i} style={{
                background: i === 2 ? p.accent : '#FFF', color: i === 2 ? '#fff' : N.ink,
                border: i === 2 ? 'none' : `1px solid ${N.line}`,
                borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', position: 'relative',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: i === 2 ? 'rgba(255,255,255,0.15)' : p.accentSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon.coffee size={22} color={i === 2 ? '#fff' : p.accent} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 14 }}>{d.name}</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: i === 2 ? 'rgba(255,255,255,0.75)' : N.muted, marginTop: 2, textTransform: 'capitalize' }}>{d.kind}</div>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 18, fontWeight: 600 }}>{mxn(d.price)}</div>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: i === 2 ? '#fff' : p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon.plus size={16} color={i === 2 ? p.accent : '#fff'} strokeWidth={2.2} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: order with modifier panel for Latte */}
      <div style={{ width: 380, background: '#FFF', borderLeft: `1px solid ${N.line}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', background: '#F7EFE3', borderBottom: `1px solid ${N.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Orden · C-248</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>Para llevar</div>
            </div>
            <Badge color={p.accent} soft={p.accentSoft} dot>Cliente · Mariana</Badge>
          </div>
        </div>

        {/* Modifier panel for the active item */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${N.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ATLAS_MONO, fontWeight: 600 }}>1×</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Latte vainilla 12 oz</div>
              <div style={{ fontSize: 11, color: N.muted, fontFamily: ATLAS_MONO }}>Base $48 + modificadores</div>
            </div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 16, fontWeight: 600 }}>{mxn(60)}</div>
          </div>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Modificadores</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {modifiers.map((m, i) => (
              <div key={i} style={{
                padding: '6px 10px', borderRadius: 999, fontSize: 11.5,
                background: m.active ? p.accent : '#F7EFE3',
                color: m.active ? '#fff' : N.body,
                fontWeight: m.active ? 500 : 400,
                display: 'inline-flex', gap: 5,
              }}>
                {m.name}{m.extra > 0 && <span style={{ fontFamily: ATLAS_MONO, opacity: 0.7 }}>+${m.extra}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Order items */}
        <div style={{ flex: 1, padding: '6px 20px 12px', overflow: 'hidden' }}>
          {[
            { qty: 1, name: 'Latte vainilla 12 oz', price: 60, mods: 'Avena +12' },
            { qty: 2, name: 'Croissant mantequilla', price: 45 },
            { qty: 1, name: 'Cold brew + leche avena', price: 70, mods: 'Sin azúcar' },
            { qty: 1, name: 'Sandwich pavo',  price: 70 },
          ].map((it, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 80px',
              gap: 10, padding: '12px 0', alignItems: 'center',
              borderBottom: i < 3 ? `1px solid ${N.line}` : 'none',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: p.accentSoft, color: p.accent, fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.qty}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{it.name}</div>
                {it.mods && <div style={{ fontSize: 10.5, color: p.accent, fontFamily: ATLAS_MONO, marginTop: 2 }}>↳ {it.mods}</div>}
              </div>
              <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 14, fontWeight: 600 }}>{mxn(it.price * it.qty)}</div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div style={{ padding: '16px 20px', background: '#F7EFE3', borderTop: `1px solid ${N.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: N.muted }}>Total</span>
            <span style={{ fontFamily: ATLAS_MONO, fontSize: 28, fontWeight: 600, letterSpacing: -0.6 }}>{mxn(290.00)}</span>
          </div>
          <Button label="Cobrar y mandar a barra" kind="primary" preset={p} icon={Icon.arrowRight} />
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Cola de pedidos (barista) ───────────────────────────
function CafeQueue() {
  const p = cafeP();
  const cols = [
    { key: 'new', title: 'En cola', accent: '#9A6610', soft: '#FBF1DC', orders: [
      { id: 'C-251', name: 'Sofía', channel: 'Para llevar', mins: 1, items: [['1','Latte vainilla 12oz','avena · sin azúcar'],['1','Concha','—']] },
      { id: 'C-252', name: 'Diego', channel: 'Barra', mins: 0, items: [['2','Americano','—'],['1','Croissant jamón','tostado']] },
      { id: 'C-253', name: 'Renata', channel: 'Para llevar', mins: 2, items: [['1','Matcha latte','almendra'],['1','Cold brew','—']] },
    ] },
    { key: 'making', title: 'Preparando', accent: p.accent, soft: p.accentSoft, orders: [
      { id: 'C-249', name: 'Mariana', channel: 'Para llevar', mins: 4, urgent: true, items: [['1','Latte vainilla 12oz','avena +12'],['1','Cold brew','sin azúcar']] },
      { id: 'C-250', name: 'Pablo', channel: 'Barra', mins: 3, items: [['1','Capuchino','—'],['1','Sandwich pavo','sin jitomate']] },
    ] },
    { key: 'ready', title: 'Listo', accent: '#0E8A4E', soft: '#E3F4EA', orders: [
      { id: 'C-247', name: 'Lucía', channel: 'Para llevar', mins: 6, items: [['2','Espresso doble','—']] },
      { id: 'C-248', name: 'Andrés', channel: 'Barra', mins: 5, items: [['1','Mocha','crema batida'],['1','Frappé chocolate','—']] },
    ] },
  ];
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F7EFE3', fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Pedidos" items={cafeSidebarItems}
        footer={<SidebarUser preset={p} name="Bruno Cano" role="Barista líder" branch="Roma Norte" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Cola de pedidos · barra"
          sub="TURNO MAÑANA · 6 ACTIVOS · ESPERA PROM. 3.8 MIN · 248 SERVIDOS HOY"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[['● 3', 'bebidas', p.accent],['● 1', 'alimentos', '#9A6610']].map(([v,l,c],i)=>(
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', background: N.card, border: `1px solid ${N.line}`, borderRadius: 8 }}>
                  <span style={{ fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 600, color: c }}>{v}</span>
                  <span style={{ fontSize: 11.5, color: N.muted }}>{l}</span>
                </div>
              ))}
            </div>
          }
        />
        <div style={{ flex: 1, padding: '20px 26px', background: '#FBF6EE', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, height: '100%' }}>
            {cols.map((col) => (
              <div key={col.key} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: col.accent }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: N.ink }}>{col.title}</span>
                  </div>
                  <span style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, background: N.card, padding: '2px 8px', borderRadius: 999, border: `1px solid ${N.line}` }}>{col.orders.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
                  {col.orders.map((o) => (
                    <div key={o.id} style={{
                      background: N.card, border: `1px solid ${o.urgent ? col.accent : N.line}`,
                      borderLeft: `4px solid ${col.accent}`, borderRadius: 10, padding: 14,
                      boxShadow: o.urgent ? `0 4px 14px ${col.accent}24` : '0 1px 0 rgba(15,15,15,0.02)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: N.ink, letterSpacing: -0.2 }}>{o.name}</div>
                          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 2 }}>{o.id} · {o.channel}</div>
                        </div>
                        <span style={{ fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 700, color: o.mins >= 4 && col.key !== 'ready' ? '#B43E2E' : col.accent }}>{o.mins}m</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {o.items.map(([q, n, mod], j) => (
                          <div key={j} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 8 }}>
                            <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: col.accent, fontWeight: 600 }}>{q}×</div>
                            <div>
                              <div style={{ fontSize: 12.5, color: N.body, fontWeight: 500 }}>{n}</div>
                              {mod !== '—' && <div style={{ fontSize: 10.5, color: N.muted, fontFamily: ATLAS_MONO, marginTop: 1 }}>↳ {mod}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{
                        padding: '8px 0', textAlign: 'center', borderRadius: 7, fontFamily: ATLAS_MONO, fontSize: 11, fontWeight: 700,
                        background: col.key === 'ready' ? col.accent : col.soft, color: col.key === 'ready' ? '#fff' : col.accent,
                      }}>{col.key === 'new' ? 'EMPEZAR →' : col.key === 'making' ? 'MARCAR LISTO ✓' : 'ENTREGAR ✓'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 04 · Recetas e insumos (detalle) ─────────────────────────
function CafeRecipes() {
  const p = cafeP();
  const recipes = [
    { name: 'Latte vainilla 12 oz', cost: 14.20, price: 52, margin: 73, active: true },
    { name: 'Espresso doble', cost: 6.80, price: 36, margin: 81 },
    { name: 'Cold brew 16 oz', cost: 16.50, price: 58, margin: 72 },
    { name: 'Matcha latte', cost: 19.40, price: 64, margin: 70 },
    { name: 'Croissant mantequilla', cost: 12.40, price: 45, margin: 72 },
    { name: 'Sandwich pavo', cost: 28.00, price: 70, margin: 60 },
  ];
  const ingredients = [
    { name: 'Espresso (18 g)', qty: '18 g', cost: 5.40, c: p.accent },
    { name: 'Leche entera', qty: '220 ml', cost: 4.60, c: '#0EA5E9' },
    { name: 'Jarabe de vainilla', qty: '20 ml', cost: 2.20, c: '#9A6610' },
    { name: 'Vaso 12 oz + tapa', qty: '1 pza', cost: 1.60, c: N.muted },
    { name: 'Tapa y faja', qty: '1 pza', cost: 0.40, c: N.faint },
  ];
  const insumos = [
    { name: 'Café especialidad', cur: 2.2, target: 8, unit: 'kg', status: 'crit' },
    { name: 'Leche entera', cur: 24, target: 80, unit: 'L', status: 'low' },
    { name: 'Jarabe vainilla', cur: 1.8, target: 4, unit: 'L', status: 'low' },
    { name: 'Vasos 12 oz', cur: 420, target: 600, unit: 'pza', status: 'ok' },
  ];
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F7EFE3', fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Recetas" items={cafeSidebarItems}
        footer={<SidebarUser preset={p} name="Bruno Cano" role="Barista líder" branch="Roma Norte" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Recetas e insumos" sub="46 RECETAS ACTIVAS · DESCUENTO AUTOMÁTICO DE INSUMOS · MERMA <2%" preset={p}
          right={<Button label="Nueva receta" kind="primary" preset={p} icon={Icon.plus} />} />
        <div style={{ flex: 1, padding: '20px 26px', background: '#FBF6EE', overflow: 'hidden', display: 'flex', gap: 16 }}>
          {/* Recipe list */}
          <Card pad={14} style={{ width: 250, flexShrink: 0 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase', padding: '2px 4px 10px' }}>Recetas</div>
            {recipes.map((r, i) => (
              <div key={i} style={{ padding: '11px 12px', borderRadius: 8, marginBottom: 4, background: r.active ? p.accentSoft : 'transparent', border: r.active ? `1px solid ${p.accent}` : '1px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12.5, fontWeight: r.active ? 600 : 500, color: r.active ? p.accentInk : N.body }}>{r.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted }}>
                  <span>costo {mxn(r.cost)}</span>
                  <span style={{ color: r.margin >= 70 ? '#0E8A4E' : '#9A6610', fontWeight: 600 }}>{r.margin}%</span>
                </div>
              </div>
            ))}
          </Card>

          {/* Selected recipe detail */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <Card pad={22}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: p.accentInk, letterSpacing: 0.8, textTransform: 'uppercase' }}>Receta · bebida</div>
                  <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, letterSpacing: -0.5 }}>Latte vainilla 12 oz</div>
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  {[['Costo', mxn(14.20), N.ink],['Precio', mxn(52.00), N.ink],['Margen', '73%', '#0E8A4E']].map(([l,v,c],i)=>(
                    <div key={i} style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{l}</div>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 20, fontWeight: 600, color: c, marginTop: 3 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: p.accentSoft, borderRadius: 8, marginBottom: 16 }}>
                <Icon.sparkles size={15} color={p.accent} />
                <span style={{ fontSize: 12, color: p.accentInk }}>Cada venta <strong>descuenta automáticamente</strong> espresso, leche, jarabe y vaso del inventario de insumos.</span>
              </div>

              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Ingredientes · descuento por unidad</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 90px', gap: 8, padding: '8px 0', fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.faint, letterSpacing: 0.5, textTransform: 'uppercase', borderBottom: `1px solid ${N.line}` }}>
                <span>Insumo</span><span style={{ textAlign: 'right' }}>Cantidad</span><span style={{ textAlign: 'right' }}>Costo</span><span style={{ textAlign: 'right' }}>% del total</span>
              </div>
              {ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 90px', gap: 8, alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${N.line}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: ing.c }} /><span style={{ fontSize: 13, fontWeight: 500 }}>{ing.name}</span></div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 12, color: N.body }}>{ing.qty}</div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 12.5, fontWeight: 600 }}>{mxn(ing.cost)}</div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 11.5, color: N.muted }}>{Math.round((ing.cost/14.20)*100)}%</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14, marginTop: 2 }}>
                <span style={{ fontSize: 12.5, color: N.muted }}>Costo total de insumos por bebida</span>
                <span style={{ fontFamily: ATLAS_MONO, fontSize: 20, fontWeight: 600 }}>{mxn(14.20)}</span>
              </div>
            </Card>
          </div>

          {/* Insumos + merma */}
          <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card pad={18}>
              <SectionTitle action="Pedir →">Insumos · estado</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insumos.map((it, i) => {
                  const pct = (it.cur / it.target) * 100;
                  const c = it.status === 'crit' ? '#B43E2E' : it.status === 'low' ? '#9A6610' : '#0E8A4E';
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>{it.name}</span>
                        <span style={{ fontFamily: ATLAS_MONO, color: c, fontWeight: 600 }}>{it.cur}/{it.target} {it.unit}</span>
                      </div>
                      <div style={{ height: 5, background: N.line, borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(pct,100)}%`, height: '100%', background: c }} /></div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, padding: 10, background: '#FBE9E5', borderRadius: 7, fontSize: 11.5, color: '#B43E2E', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon.warning size={14} color="#B43E2E" /><span><strong>Café especialidad</strong> crítico · alcanza 1.2 días</span>
              </div>
            </Card>
            <Card pad={18}>
              <SectionTitle>Merma estimada · hoy</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Donut value={0.018} label="Merma" color={p.accent} />
                <div style={{ flex: 1, fontSize: 11.5, color: N.body, lineHeight: 1.5 }}>1.8% del consumo. Principalmente leche vaporizada de más en hora pico.</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 04b · Cola móvil (barista) ───────────────────────────────
function CafeQueueMobile() {
  const p = cafeP();
  const orders = [
    { id: 'C-249', name: 'Mariana', channel: 'Para llevar', mins: 4, status: 'making', urgent: true, items: [['1','Latte vainilla','avena +12'],['1','Cold brew','sin azúcar']] },
    { id: 'C-250', name: 'Pablo', channel: 'Barra', mins: 3, status: 'making', items: [['1','Capuchino','—'],['1','Sandwich pavo','sin jitomate']] },
    { id: 'C-251', name: 'Sofía', channel: 'Para llevar', mins: 1, status: 'new', items: [['1','Latte vainilla','avena · s/azúcar'],['1','Concha','—']] },
    { id: 'C-252', name: 'Diego', channel: 'Barra', mins: 0, status: 'new', items: [['2','Americano','—']] },
  ];
  const sc = { making: p.accent, new: '#9A6610', ready: '#0E8A4E' };
  return (
    <div style={{ width: '100%', height: '100%', background: '#F7EFE3', display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: N.card, borderBottom: `1px solid ${N.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3 }}>Cola de barra</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 2 }}>BRUNO C. · ESPERA PROM. 3.8 MIN</div>
          </div>
          <Badge color={p.accent} soft={p.accentSoft} dot>6 activos</Badge>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map((o) => (
          <div key={o.id} style={{ background: N.card, border: `1px solid ${o.urgent ? sc[o.status] : N.line}`, borderLeft: `4px solid ${sc[o.status]}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2 }}>{o.name}</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 2 }}>{o.id} · {o.channel} · {o.status === 'making' ? 'preparando' : 'en cola'}</div>
              </div>
              <span style={{ fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 700, color: o.mins >= 4 ? '#B43E2E' : sc[o.status] }}>{o.mins}m</span>
            </div>
            {o.items.map(([q,n,mod],j)=>(
              <div key={j} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: sc[o.status], fontWeight: 600 }}>{q}×</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: N.body }}>{n}</div>
                  {mod !== '—' && <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, marginTop: 1 }}>↳ {mod}</div>}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: '9px 0', textAlign: 'center', borderRadius: 8, fontFamily: ATLAS_MONO, fontSize: 11.5, fontWeight: 700, background: o.status === 'making' ? p.accent : p.accentSoft, color: o.status === 'making' ? '#fff' : p.accentInk }}>
              {o.status === 'making' ? 'MARCAR LISTO ✓' : 'EMPEZAR →'}
            </div>
          </div>
        ))}
      </div>
      <div style={{ paddingBottom: 14, display: 'flex', justifyContent: 'center', background: '#F7EFE3' }}>
        <div style={{ width: 100, height: 4, background: N.ink, opacity: 0.25, borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ─── 05 · Hero ────────────────────────────────────────────────
function CafeHero() {
  const p = cafeP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#FBF5EA', position: 'relative', overflow: 'hidden', fontFamily: ATLAS_FONT }}>
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 90% 110%, ${p.accent}25, transparent 50%), radial-gradient(circle at 5% 0%, ${p.accent2}40, transparent 50%)`,
      }} />
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, position: 'relative' }}>
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent, color: '#fff', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 500 }}>PRESET 07</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accentInk, letterSpacing: 1.4, textTransform: 'uppercase' }}>Barra · recetas · insumos</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 60, fontWeight: 500, lineHeight: 1, letterSpacing: -1.5, color: N.ink }}>
            Atlas One <em style={{ color: p.accent, fontStyle: 'italic' }}>Café</em>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.3, color: N.body }}>
            Para barras donde un buen latte vale tanto como una operación impecable.
          </div>
          <div style={{ fontSize: 15, color: N.body, lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 480 }}>
            POS visual para barra rápida, modificadores con un toque, recetas con costo en vivo, control de insumos y merma. Café de especialidad, panadería y mostrador para llevar.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['42 órdenes/h', 'en hora pico'], ['68%', 'margen promedio'], ['<2%', 'merma controlada']].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: p.accent, letterSpacing: -0.6, minWidth: 130 }}>{k}</div>
                <div style={{ fontSize: 13, color: N.body }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            <Button label="Probar 1 mes gratis" kind="primary" preset={p} icon={Icon.arrowRight} />
            <Button label="Ver demo" kind="secondary" />
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 20, right: 0 }}>
            <TabletFrame width={520}>
              <div style={{ width: 1280, height: 800, transform: 'scale(0.39)', transformOrigin: 'top left' }}>
                <CafeTouch />
              </div>
            </TabletFrame>
          </div>
          <div style={{ position: 'absolute', bottom: 20, left: 0 }}>
            <LaptopFrame width={520}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.347)', transformOrigin: 'top left' }}>
                <CafeDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{
            position: 'absolute', top: 360, right: 40, padding: 14,
            background: '#fff', borderRadius: 12, width: 190, transform: 'rotate(3deg)',
            border: `1.5px solid ${p.accent}`, boxShadow: `0 10px 30px ${p.accent}30`,
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Margen · Latte vainilla</div>
            <div style={{ fontSize: 32, fontWeight: 600, color: p.accent, marginTop: 4, letterSpacing: -0.6, fontFamily: ATLAS_FONT }}>73%</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 2 }}>Costo $14.20 · Precio $52</div>
          </div>
        </div>
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 70px', display: 'flex', alignItems: 'center', gap: 16,
        borderTop: `1px solid ${p.accent}20`, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)',
      }}>
        <Wordmark color={N.ink} accent={p.accent} size={13} />
        <div style={{ width: 1, height: 18, background: N.line2 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6 }}>MENÚ VISUAL · MODIFICADORES · RECETAS · INSUMOS · MERMA</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>atlas.tech / cafe</div>
      </div>
    </div>
  );
}

Object.assign(window, { CafeDesktop, CafeTouch, CafeQueue, CafeQueueMobile, CafeRecipes, CafeHero });
