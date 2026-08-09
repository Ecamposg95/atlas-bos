// barber.jsx — Atlas One Barber preset (Preset 03)
// Color: Carbón + grafito + acento acero. Premium, masculino.

const barberP = () => PRESETS.barber;

const barberSidebarItems = [
  { header: 'Hoy' },
  { icon: Icon.calendar, label: 'Agenda',          badge: '18' },
  { icon: Icon.scissors, label: 'Servicios' },
  { icon: Icon.user,     label: 'Barberos' },
  { header: 'Negocio' },
  { icon: Icon.users,    label: 'Clientes' },
  { icon: Icon.pkg,      label: 'Productos' },
  { icon: Icon.star,     label: 'Paquetes' },
  { icon: Icon.bars,     label: 'Comisiones' },
  { header: 'Operación' },
  { icon: Icon.cart,     label: 'POS' },
  { icon: Icon.chart,    label: 'Reportes' },
  { icon: Icon.cog,      label: 'Ajustes' },
];

const barbers = [
  { name: 'Diego R.',    role: 'Senior',   color: '#22D3B8' },
  { name: 'Marco V.',    role: 'Master',   color: '#A78BFA' },
  { name: 'Iván S.',     role: 'Junior',   color: '#F59E0B' },
  { name: 'Saúl T.',     role: 'Senior',   color: '#FB7185' },
];

// ─── 01 · Desktop · Agenda ────────────────────────────────────
function BarberDesktop() {
  const p = barberP();
  // Time slots from 10:00 to 20:00 in 30 min increments → 20 slots
  const slots = Array.from({ length: 21 }, (_, i) => {
    const h = 10 + Math.floor(i / 2);
    const m = (i % 2) === 0 ? '00' : '30';
    return `${String(h).padStart(2,'0')}:${m}`;
  });

  // Appointments: { barberIdx, startIdx, duration (in slots), client, service, color }
  const appts = [
    { b: 0, s: 1,  d: 2, client: 'Roberto M.',     svc: 'Corte + barba',  price: 380 },
    { b: 0, s: 5,  d: 1, client: 'Andrés C.',      svc: 'Corte clásico',  price: 220 },
    { b: 0, s: 8,  d: 3, client: 'Carlos V. ★',    svc: 'Premium · 60m',  price: 560 },
    { b: 0, s: 13, d: 2, client: 'Felipe G.',      svc: 'Corte + diseño', price: 420 },
    { b: 1, s: 0,  d: 2, client: 'Mauricio Z.',    svc: 'Barba completa', price: 280 },
    { b: 1, s: 4,  d: 3, client: 'Tomás L. ★',     svc: 'Master 60m',     price: 620 },
    { b: 1, s: 10, d: 2, client: 'Diego A.',       svc: 'Corte + lavado', price: 340 },
    { b: 1, s: 14, d: 2, client: 'Ramón P.',       svc: 'Corte clásico',  price: 220 },
    { b: 1, s: 17, d: 2, client: 'Walk-in',        svc: 'Corte rápido',   price: 180 },
    { b: 2, s: 2,  d: 1, client: 'Mateo H.',       svc: 'Corte junior',   price: 180 },
    { b: 2, s: 4,  d: 2, client: 'Jorge F.',       svc: 'Corte + barba',  price: 320 },
    { b: 2, s: 9,  d: 1, client: 'Pablo R.',       svc: 'Corte rápido',   price: 180 },
    { b: 2, s: 12, d: 2, client: 'Iván B.',        svc: 'Diseño',         price: 240 },
    { b: 3, s: 1,  d: 2, client: 'Esteban Q.',     svc: 'Corte + barba',  price: 380 },
    { b: 3, s: 6,  d: 3, client: 'Hugo D. ★',      svc: 'Premium 60m',    price: 560 },
    { b: 3, s: 11, d: 2, client: 'Sergio T.',      svc: 'Corte + lavado', price: 340 },
    { b: 3, s: 15, d: 2, client: 'Walk-in',        svc: 'Corte clásico',  price: 220 },
  ];

  const rowH = 30;
  const colWidth = 'minmax(0, 1fr)';

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F1EFE9', fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Agenda" items={barberSidebarItems}
        footer={<SidebarUser preset={p} name="Diego Reyes" role="Owner" branch="Polanco" />} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Agenda · viernes 25 de noviembre"
          sub="18 CITAS · 4 BARBEROS · 12 H DE OPERACIÓN · OCUPACIÓN 82%"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', background: N.card, border: `1px solid ${N.line}`, borderRadius: 8, padding: 2 }}>
                {['Día', 'Semana', 'Mes'].map((t, i) => (
                  <div key={t} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12.5, fontFamily: ATLAS_FONT, fontWeight: i === 0 ? 500 : 400,
                    background: i === 0 ? N.ink : 'transparent', color: i === 0 ? '#fff' : N.body,
                  }}>{t}</div>
                ))}
              </div>
              <Icon.search size={18} color={N.muted} />
              <Button label="+ Cita" kind="primary" preset={p} icon={Icon.plus} />
            </div>
          }
        />

        <div style={{ flex: 1, padding: '18px 22px 22px', background: '#FAF8F2', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KPIs strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <Kpi label="Citas del día" value="18" sub="3 walk-in · 1 cancelada" />
            <Kpi label="Ventas estimadas" value={mxnInt(7240)} delta="+11%" trend={[3,4,5,4,6,7,6,8,9,8,10,11]} accent={p.accent} />
            <Kpi label="Ticket promedio" value={mxn(412.00)} delta="+5%" trend={[5,6,7,6,8,7,8,9,8,9,10,10]} accent={p.accent} />
            <Kpi label="Ocupación" value="82%" sub="42 de 51 slots · 4 sillas" />
            <Kpi label="Comisiones del día" value={mxn(2014.00)} sub="40% promedio" />
          </div>

          {/* Agenda */}
          <div style={{ flex: 1, background: N.card, border: `1px solid ${N.line}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header: barber names */}
            <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${barbers.length}, ${colWidth})`, borderBottom: `1px solid ${N.line}` }}>
              <div style={{ padding: '14px 10px', fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, borderRight: `1px solid ${N.line}` }}>HORA</div>
              {barbers.map((b, i) => (
                <div key={i} style={{ padding: '12px 14px', borderRight: i < barbers.length - 1 ? `1px solid ${N.line}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: b.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, color: '#0B0B0B', fontSize: 12,
                  }}>{b.name.split(' ').map(n => n[0]).join('')}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 1 }}>{b.role.toUpperCase()} · SILLA {i + 1}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Body: grid of slots with appointments overlaid */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {/* Time grid */}
              <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${barbers.length}, ${colWidth})` }}>
                {slots.map((t, i) => (
                  <React.Fragment key={i}>
                    <div style={{
                      height: rowH, borderTop: i ? `1px solid ${N.line}` : 'none',
                      padding: '4px 10px', fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted,
                      borderRight: `1px solid ${N.line}`,
                      background: t.endsWith(':00') ? '#FBFAF6' : '#FFF',
                    }}>{t.endsWith(':00') ? t : ''}</div>
                    {barbers.map((_, bi) => (
                      <div key={bi} style={{
                        height: rowH, borderTop: i ? `1px solid ${i % 2 === 0 ? N.line : '#F4F2EC'}` : 'none',
                        borderRight: bi < barbers.length - 1 ? `1px solid ${N.line}` : 'none',
                      }} />
                    ))}
                  </React.Fragment>
                ))}
              </div>

              {/* Appointments */}
              {appts.map((a, i) => {
                const colPctStart = 64;
                const colW = `calc((100% - 64px) / ${barbers.length})`;
                const top = a.s * rowH;
                const h = a.d * rowH;
                const isPremium = a.client.includes('★');
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    top: top + 2, height: h - 4,
                    left: `calc(${colPctStart}px + ${a.b} * ${colW} + 4px)`,
                    width: `calc(${colW} - 8px)`,
                    background: barbers[a.b].color + (isPremium ? 'EE' : '38'),
                    borderRadius: 6,
                    padding: '6px 9px',
                    borderLeft: `3px solid ${barbers[a.b].color}`,
                    color: isPremium ? '#0B0B0B' : N.ink,
                    overflow: 'hidden',
                  }}>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: isPremium ? 'rgba(0,0,0,0.55)' : N.muted, letterSpacing: 0.3 }}>{slots[a.s]} · {a.d * 30}m</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{a.client}</div>
                    {a.d >= 2 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                        <div style={{ fontSize: 10.5, color: isPremium ? 'rgba(0,0,0,0.6)' : N.body }}>{a.svc}</div>
                        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, fontWeight: 600 }}>${a.price}</div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Current time line */}
              <div style={{ position: 'absolute', top: 4 * rowH + 18, left: 64, right: 0, height: 0, borderTop: `2px solid ${p.accent}`, zIndex: 5 }}>
                <div style={{ position: 'absolute', left: -8, top: -6, width: 10, height: 10, borderRadius: 999, background: p.accent }} />
                <div style={{ position: 'absolute', left: 6, top: -22, fontFamily: ATLAS_MONO, fontSize: 10, color: p.accent, fontWeight: 600, background: N.card, padding: '2px 6px', borderRadius: 4 }}>AHORA · 12:24</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 02 · Recepción táctil ────────────────────────────────────
function BarberTouch() {
  const p = barberP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#0F0F10', color: '#E8E6E2', display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT }}>
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px', background: '#0B0B0C', borderBottom: '1px solid #1A1A1B' }}>
        <Wordmark color="#E8E6E2" accent={p.accent2} size={14} sub="BARBER · POLANCO" />
        <div style={{ width: 1, height: 22, background: '#2A2A2B' }} />
        <Badge color={p.accent2} soft="rgba(34,211,184,0.12)" dot>RECEPCIÓN</Badge>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#7A7872', display: 'flex', gap: 14 }}>
          <span>VIE 25 NOV</span>
          <span>14:24</span>
          <span style={{ color: p.accent2 }}>● EN VIVO</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: in-progress chairs */}
        <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#7A7872', letterSpacing: 0.8, textTransform: 'uppercase' }}>En la silla · 4 servicios activos</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { barber: 'Diego R.',  chair: 1, client: 'Carlos V.',   svc: 'Premium · 60m', start: '12:00', remain: 24, total: 60, accent: '#22D3B8' },
              { barber: 'Marco V.',  chair: 2, client: 'Tomás L.',    svc: 'Master · 60m',  start: '12:10', remain: 14, total: 60, accent: '#A78BFA' },
              { barber: 'Iván S.',   chair: 3, client: 'Pablo R.',    svc: 'Corte rápido',  start: '12:18', remain:  4, total: 30, accent: '#F59E0B' },
              { barber: 'Saúl T.',   chair: 4, client: 'Hugo D.',     svc: 'Premium · 60m', start: '11:50', remain: 14, total: 60, accent: '#FB7185' },
            ].map((c, i) => {
              const pct = ((c.total - c.remain) / c.total);
              return (
                <div key={i} style={{
                  background: '#16161A', border: '1px solid #232327', borderRadius: 12, padding: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: '#7A7872', letterSpacing: 0.8 }}>SILLA {c.chair}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{c.client}</div>
                      <div style={{ fontSize: 12, color: '#7A7872', marginTop: 2 }}>{c.svc} · {c.barber}</div>
                    </div>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: c.accent, color: '#0B0B0B',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12,
                    }}>{c.barber.split(' ').map(n => n[0]).join('')}</div>
                  </div>
                  <div style={{ marginTop: 14, height: 4, background: '#26262A', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct * 100}%`, height: '100%', background: c.accent }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: ATLAS_MONO, fontSize: 11, color: '#A0A09A' }}>
                    <span>Inició {c.start}</span>
                    <span style={{ color: c.accent }}>{c.remain}m restantes</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Waitlist */}
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#7A7872', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 }}>Sala de espera · 3 clientes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['12:30', 'Roberto M.',   'Corte + barba',  'Diego R.',  '#22D3B8', 'Confirmada'],
              ['12:45', 'Felipe G.',    'Corte + diseño', 'Diego R.',  '#22D3B8', 'Walk-in'],
              ['13:00', 'Mauricio Z.',  'Barba completa', 'Marco V.',  '#A78BFA', 'Confirmada'],
            ].map(([t, name, svc, b, bc, status], i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '70px 1fr 1fr 130px 110px', gap: 10,
                padding: '12px 14px', background: '#16161A', border: '1px solid #232327', borderRadius: 10,
                alignItems: 'center',
              }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 14, fontWeight: 600, color: p.accent2 }}>{t}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
                  <div style={{ fontSize: 11, color: '#7A7872', marginTop: 2, fontFamily: ATLAS_MONO }}>{svc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: bc, color: '#0B0B0B', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{b.split(' ').map(n => n[0]).join('')}</div>
                  <div style={{ fontSize: 12 }}>{b}</div>
                </div>
                <div>
                  <Badge color={status === 'Confirmada' ? '#22D3B8' : '#F59E0B'} soft={status === 'Confirmada' ? 'rgba(34,211,184,0.14)' : 'rgba(245,158,11,0.14)'} dot>{status}</Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 7, background: '#22262A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon.scissors size={14} color="#E8E6E2" />
                  </div>
                  <div style={{ padding: '0 12px', height: 32, borderRadius: 7, background: p.accent2, color: '#0B0B0B', display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600 }}>
                    Iniciar
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: walk-in panel */}
        <div style={{ width: 320, background: '#0B0B0C', borderLeft: '1px solid #1A1A1B', padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#7A7872', letterSpacing: 0.8, textTransform: 'uppercase' }}>Walk-in rápido</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>Sin cita</div>
            <div style={{ fontSize: 12, color: '#7A7872', marginTop: 4 }}>Asigna el siguiente cliente al barbero disponible más pronto.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'Diego R.',  next: '12:30', color: '#22D3B8' },
              { name: 'Iván S.',   next: '12:35', color: '#F59E0B', highlight: true },
              { name: 'Marco V.',  next: '13:10', color: '#A78BFA' },
              { name: 'Saúl T.',   next: '13:00', color: '#FB7185' },
            ].map((b, i) => (
              <div key={i} style={{
                padding: '10px 12px', background: b.highlight ? 'rgba(34,211,184,0.08)' : '#16161A',
                border: b.highlight ? `1px solid ${p.accent2}` : '1px solid #232327',
                borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: b.color, color: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{b.name.split(' ').map(n => n[0]).join('')}</div>
                <div style={{ flex: 1, fontSize: 13 }}>{b.name}</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: b.highlight ? p.accent2 : '#7A7872' }}>libre {b.next}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '14px 16px', background: p.accent2, color: '#0B0B0B', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
              <Icon.plus size={18} color="#0B0B0B" strokeWidth={2.2} />
              <span style={{ flex: 1, fontSize: 14 }}>Nueva cita</span>
              <Icon.arrowRight size={16} color="#0B0B0B" />
            </div>
            <div style={{ padding: '14px 16px', background: '#16161A', color: '#E8E6E2', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon.cart size={18} color="#E8E6E2" />
              <span style={{ flex: 1, fontSize: 14 }}>Vender producto</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Móvil del barbero (vista comisión) ──────────────────
function BarberMobile() {
  const p = barberP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#0B0B0C', color: '#E8E6E2', display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#22D3B8', color: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>DR</div>
            <div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: '#7A7872', letterSpacing: 0.6 }}>SENIOR · SILLA 1</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>Diego Reyes</div>
            </div>
          </div>
          <Icon.bell size={18} color="#7A7872" />
        </div>

        {/* Earnings card */}
        <div style={{
          background: 'linear-gradient(135deg, #131418, #1F2228)',
          borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden',
          border: '1px solid #2A2C32',
        }}>
          <div style={{
            position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%',
            background: `radial-gradient(circle, ${p.accent2}30, transparent 70%)`,
          }} />
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: '#9C9B95', letterSpacing: 0.8 }}>COMISIÓN ACUMULADA · NOV</div>
          <div style={{ fontSize: 36, fontWeight: 600, marginTop: 6, letterSpacing: -1, fontFamily: ATLAS_FONT }}>
            <span style={{ color: p.accent2 }}>$</span>14,820<span style={{ fontSize: 18, color: '#7A7872', fontFamily: ATLAS_MONO }}>.50</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, fontSize: 11, fontFamily: ATLAS_MONO, color: '#9C9B95' }}>
            <div><span style={{ color: p.accent2 }}>●</span> 42 servicios</div>
            <div>●  18 productos</div>
            <div>●  9 paquetes</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '0 18px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          ['Hoy', mxn(820.00), '+18%'],
          ['Esta semana', mxn(3640.00), '+12%'],
        ].map(([l, v, d], i) => (
          <div key={i} style={{ background: '#16161A', border: '1px solid #232327', borderRadius: 10, padding: 12 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: '#7A7872', letterSpacing: 0.6, textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, fontFamily: ATLAS_FONT, letterSpacing: -0.4 }}>{v}</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: '#22D3B8', marginTop: 2 }}>{d}</div>
          </div>
        ))}
      </div>

      {/* Today's appointments */}
      <div style={{ padding: '6px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#7A7872', letterSpacing: 0.8, textTransform: 'uppercase' }}>Tus citas · hoy</div>
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2 }}>4 de 5 →</div>
      </div>
      <div style={{ flex: 1, padding: '8px 18px', overflow: 'hidden' }}>
        {[
          ['12:00', 'Carlos V.',   'Premium · 60m',  'EN CURSO',  '#22D3B8', true],
          ['13:00', 'Andrés C.',   'Corte clásico',  '13:00',     '#7A7872', false],
          ['14:00', 'Roberto M.',  'Corte + barba',  '14:00',     '#7A7872', false],
          ['16:30', 'Felipe G.',   'Corte + diseño', '16:30',     '#7A7872', false],
        ].map(([t, name, svc, status, c, active], i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '50px 1fr 70px', gap: 8,
            padding: '12px 12px', marginBottom: 6,
            background: active ? 'rgba(34,211,184,0.08)' : '#16161A',
            border: active ? `1px solid ${p.accent2}` : '1px solid #232327',
            borderRadius: 10, alignItems: 'center',
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 600, color: active ? p.accent2 : '#E8E6E2' }}>{t}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
              <div style={{ fontSize: 10.5, color: '#7A7872', marginTop: 2, fontFamily: ATLAS_MONO }}>{svc}</div>
            </div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: c, textAlign: 'right', fontWeight: 600 }}>{status}</div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#0B0B0C', borderTop: '1px solid #1A1A1B', padding: '8px 8px 24px' }}>
        {[
          { icon: Icon.home, l: 'Inicio', active: true },
          { icon: Icon.calendar, l: 'Agenda' },
          { icon: Icon.bars, l: 'Comisión' },
          { icon: Icon.user, l: 'Perfil' },
        ].map((n, i) => {
          const IconCmp = n.icon;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <IconCmp size={20} color={n.active ? p.accent2 : '#7A7872'} />
              <div style={{ fontSize: 10, color: n.active ? p.accent2 : '#7A7872', fontFamily: ATLAS_MONO }}>{n.l}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 04 · Hero comercial ──────────────────────────────────────
function BarberHero() {
  const p = barberP();
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, #0B0B0C 0%, #1A1A1D 60%, #0F0F10 100%)`,
      fontFamily: ATLAS_FONT, color: '#E8E6E2',
    }}>
      {/* Texture overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 12px), radial-gradient(circle at 80% 20%, ${p.accent2}18, transparent 50%)`,
      }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, position: 'relative' }}>
        {/* Left copy */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent2, color: '#0B0B0B', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 600 }}>PRESET 03</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2, letterSpacing: 1.4, textTransform: 'uppercase' }}>Silla, navaja, agenda</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 64, fontWeight: 500, lineHeight: 1, letterSpacing: -1.8 }}>
            Atlas One <em style={{ color: p.accent2, fontStyle: 'italic' }}>Barber</em>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, fontWeight: 400, lineHeight: 1.15, marginTop: 16, letterSpacing: -0.4, color: '#C5C2BB' }}>
            La operación de una barbería premium, en una sola plataforma.
          </div>
          <div style={{ fontSize: 15, color: '#9C9B95', lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 460 }}>
            Agenda por barbero, sillas, servicios, paquetes prepagados y comisiones — todo conectado a productos, ventas y reportes Atlas One.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: Icon.calendar, t: 'Agenda inteligente por silla y barbero' },
              { icon: Icon.bars,     t: 'Comisiones automáticas por servicio y producto' },
              { icon: Icon.star,     t: 'Paquetes prepagados y clientes frecuentes' },
            ].map((f, i) => {
              const IconCmp = f.icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,211,184,0.12)', color: p.accent2, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${p.accent2}40` }}>
                    <IconCmp size={17} color={p.accent2} />
                  </div>
                  <div style={{ fontSize: 14, color: '#E8E6E2' }}>{f.t}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
            <div style={{ padding: '10px 16px', background: p.accent2, color: '#0B0B0B', borderRadius: 7, fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              Probar 1 mes gratis <Icon.arrowRight size={14} color="#0B0B0B" />
            </div>
            <div style={{ padding: '10px 16px', background: 'transparent', color: '#E8E6E2', border: '1px solid #3A3A3D', borderRadius: 7, fontWeight: 500, fontSize: 13 }}>
              Ver demo
            </div>
          </div>
        </div>

        {/* Right: device + insight cards */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 40, right: 0 }}>
            <LaptopFrame width={700}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.475)', transformOrigin: 'top left' }}>
                <BarberDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{ position: 'absolute', bottom: 30, left: -30, transform: 'rotate(-3deg)' }}>
            <PhoneFrame width={210}>
              <div style={{ width: 390, height: 844, transform: 'scale(0.539)', transformOrigin: 'top left' }}>
                <BarberMobile />
              </div>
            </PhoneFrame>
          </div>

          {/* Floating stat card */}
          <div style={{
            position: 'absolute', top: 0, right: 40, padding: 16,
            background: 'rgba(11,11,12,0.85)', backdropFilter: 'blur(10px)',
            border: `1px solid rgba(34,211,184,0.3)`, borderRadius: 12, width: 220,
            boxShadow: `0 8px 30px ${p.accent2}20`,
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: '#9C9B95', letterSpacing: 0.6, textTransform: 'uppercase' }}>Ocupación</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <div style={{ fontSize: 32, fontWeight: 600, color: p.accent2, letterSpacing: -0.6 }}>82%</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#22D3B8' }}>+11%</div>
            </div>
            <div style={{ fontSize: 11, color: '#9C9B95', marginTop: 4 }}>42 de 51 slots ocupados · 4 sillas activas</div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 70px', display: 'flex', alignItems: 'center', gap: 16,
        borderTop: `1px solid rgba(34,211,184,0.2)`,
        background: 'rgba(11,11,12,0.7)', backdropFilter: 'blur(8px)',
      }}>
        <Wordmark color="#E8E6E2" accent={p.accent2} size={13} />
        <div style={{ width: 1, height: 18, background: '#3A3A3D' }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: '#7A7872', letterSpacing: 0.6 }}>AGENDA · SERVICIOS · COMISIONES · CLIENTES FRECUENTES</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: '#7A7872' }}>atlas.tech / barber</div>
      </div>
    </div>
  );
}

Object.assign(window, { BarberDesktop, BarberTouch, BarberMobile, BarberHero });
