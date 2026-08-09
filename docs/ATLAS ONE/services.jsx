// services.jsx — Atlas One Services (Preset 09)
// Color: Verde esmeralda + azul petróleo. Técnica, operativa, robusta.

const servicesP = () => PRESETS.services;

const servicesSidebarItems = [
  { header: 'Operación' },
  { icon: Icon.wrench,    label: 'Órdenes de trabajo', badge: '18' },
  { icon: Icon.document,  label: 'Cotizaciones',       badge: '6' },
  { icon: Icon.users,     label: 'Clientes' },
  { icon: Icon.user,      label: 'Técnicos' },
  { header: 'Recursos' },
  { icon: Icon.pkg,       label: 'Refacciones' },
  { icon: Icon.truck,     label: 'Servicio campo' },
  { header: 'Negocio' },
  { icon: Icon.card,      label: 'Cobros' },
  { icon: Icon.chart,     label: 'Reportes' },
  { icon: Icon.cog,       label: 'Ajustes' },
];

// ─── 01 · Desktop · Órdenes de trabajo (kanban + lista) ───────
function ServicesDesktop() {
  const p = servicesP();

  const columns = [
    { id: 'recibido', name: 'Recibido',  count: 4,  color: '#94A3B8' },
    { id: 'cotizado', name: 'Cotizado',  count: 3,  color: '#0EA5E9' },
    { id: 'en-curso', name: 'En curso',  count: 6,  color: p.accent },
    { id: 'pruebas',  name: 'Pruebas',   count: 3,  color: '#F59E0B' },
    { id: 'listo',    name: 'Listo',     count: 2,  color: '#0E8A4E' },
  ];

  const orders = {
    recibido: [
      { id: 'OT-1842', client: 'Diana Velasco',  asset: 'iPhone 14 Pro', issue: 'Pantalla quebrada', tech: null, age: '12 min', priority: 'normal' },
      { id: 'OT-1841', client: 'Mauricio H.',    asset: 'Lavadora LG', issue: 'No drena',    tech: null, age: '2 h', priority: 'normal' },
    ],
    cotizado: [
      { id: 'OT-1839', client: 'Constructora R.',asset: 'Compresor 80L', issue: 'Cambio motor', tech: 'Iván P.', age: '1 d', priority: 'alta', value: 4820 },
    ],
    'en-curso': [
      { id: 'OT-1830', client: 'Lourdes T.',     asset: 'Refrigerador Mabe', issue: 'No enfría', tech: 'Saúl M.', age: '3 h', priority: 'alta', value: 1480, prog: 0.7 },
      { id: 'OT-1828', client: 'Pedro Alanís',   asset: 'PC Workstation',    issue: 'Cambio SSD + RAM', tech: 'César L.', age: '5 h', priority: 'normal', value: 3260, prog: 0.45 },
      { id: 'OT-1825', client: 'Inmob. Norte',   asset: 'Aire mini split',   issue: 'Recarga gas', tech: 'Iván P.', age: '1 d', priority: 'normal', value: 1820, prog: 0.85 },
    ],
    pruebas: [
      { id: 'OT-1820', client: 'Carolina S.',    asset: 'MacBook Pro 14', issue: 'Reemplazo batería', tech: 'César L.', age: '2 d', priority: 'normal', value: 2980 },
    ],
    listo: [
      { id: 'OT-1815', client: 'Andrés Reyes',   asset: 'iPad Air',        issue: 'Pantalla',      tech: 'Saúl M.', age: '3 d', value: 3640, ready: true },
    ],
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F4F8F6', fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Órdenes de trabajo" items={servicesSidebarItems}
        footer={<SidebarUser preset={p} name="César López" role="Coordinador" branch="Taller Sur" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Órdenes de trabajo"
          sub="18 ACTIVAS · 6 COTIZACIONES PENDIENTES · 4 TÉCNICOS EN CAMPO"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SearchInput preset={p} placeholder="Buscar OT, cliente o equipo…" width={300} />
              <Button label="+ Orden" kind="primary" preset={p} icon={Icon.plus} />
            </div>
          }
        />

        <div style={{ flex: 1, padding: '18px 24px 22px', background: '#F8FAF8', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <Kpi label="Órdenes activas" value="18" sub="↑2 vs ayer" />
            <Kpi label="Tiempo prom. cierre" value="3.2 d" delta="-0.4d" trend={[5,5,4,5,4,4,3,4,3,3,4,3]} accent={p.accent} />
            <Kpi label="Cotizaciones pend." value="6" sub="3 con 48h de atraso" />
            <Kpi label="Ingresos · semana" value={mxnInt(28460)} delta="+11%" trend={[4,5,6,5,7,6,8,7,9,8,10,12]} accent={p.accent} />
            <Kpi label="Satisfacción" value="4.7 / 5" sub="98 reseñas" />
          </div>

          {/* Kanban */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, overflow: 'hidden' }}>
            {columns.map(col => (
              <div key={col.id} style={{
                background: '#fff', border: `1px solid ${N.line}`, borderRadius: 12,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${N.line}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: col.color }} />
                  <span style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.body, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 500 }}>{col.name}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>{col.count}</span>
                </div>
                <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  {(orders[col.id] || []).map(o => (
                    <div key={o.id} style={{
                      background: N.page, border: `1px solid ${N.line}`, borderRadius: 8,
                      padding: 11, display: 'flex', flexDirection: 'column', gap: 6,
                      borderLeft: `3px solid ${col.color}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: p.accentInk, fontWeight: 600 }}>{o.id}</div>
                        {o.priority === 'alta' && <span style={{ fontFamily: ATLAS_MONO, fontSize: 9, padding: '1px 6px', background: '#FBE7E1', color: '#B43E2E', borderRadius: 4, fontWeight: 600 }}>ALTA</span>}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: N.ink, lineHeight: 1.3 }}>{o.asset}</div>
                      <div style={{ fontSize: 11, color: N.muted }}>{o.issue}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted }}>{o.client.split(' ')[0]}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {o.tech && <div style={{ width: 16, height: 16, borderRadius: 4, background: col.color, color: '#fff', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{o.tech.split(' ').map(n => n[0]).join('')}</div>}
                          <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.faint }}>{o.age}</div>
                        </div>
                      </div>
                      {o.prog != null && (
                        <div style={{ height: 3, background: N.line, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${o.prog * 100}%`, height: '100%', background: col.color }} />
                        </div>
                      )}
                      {o.value && (
                        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, fontWeight: 600, color: p.accent, marginTop: 2 }}>{mxn(o.value)}</div>
                      )}
                      {o.ready && (
                        <div style={{ padding: '5px 8px', background: '#E3F4EA', color: '#0E8A4E', borderRadius: 4, fontFamily: ATLAS_MONO, fontSize: 10, fontWeight: 600, textAlign: 'center', letterSpacing: 0.4 }}>LISTO · AVISAR CLIENTE</div>
                      )}
                    </div>
                  ))}
                  {col.count > (orders[col.id] || []).length && (
                    <div style={{ padding: 8, color: N.muted, fontSize: 11, fontFamily: ATLAS_MONO, textAlign: 'center', borderRadius: 6, border: `1px dashed ${N.line2}` }}>
                      + {col.count - (orders[col.id] || []).length} más
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 02 · Tablet · Ficha de orden de trabajo ──────────────────
function ServicesTouch() {
  const p = servicesP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#F4F8F6', display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', background: '#FFF', borderBottom: `1px solid ${N.line}` }}>
        <Wordmark color={N.ink} accent={p.accent} size={14} sub="SERVICES · TALLER SUR" />
        <div style={{ width: 1, height: 22, background: N.line }} />
        <Badge color={p.accent} soft={p.accentSoft} dot>OT-1830 · EN CURSO</Badge>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>TÉCNICO · SAÚL M. · 14:48</div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Order header */}
          <Card pad={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.6 }}>ORDEN DE TRABAJO</div>
                <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, letterSpacing: -0.4 }}>OT-1830</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 12, color: N.body }}>
                  <div><span style={{ color: N.muted }}>Cliente · </span><strong>Lourdes Toledo</strong></div>
                  <div><span style={{ color: N.muted }}>Recibido · </span><span style={{ fontFamily: ATLAS_MONO }}>25 NOV 11:22</span></div>
                  <div><span style={{ color: N.muted }}>Compromiso · </span><span style={{ fontFamily: ATLAS_MONO, color: '#9A6610' }}>27 NOV 14:00</span></div>
                </div>
              </div>
              <Badge color="#B43E2E" soft="#FBE7E1" dot>Prioridad alta</Badge>
            </div>

            {/* Status flow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 18 }}>
              {['Recibido', 'Cotizado', 'En curso', 'Pruebas', 'Listo'].map((s, i) => {
                const active = i <= 2;
                const current = i === 2;
                return (
                  <React.Fragment key={s}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 999,
                        background: active ? p.accent : '#fff',
                        border: active ? 'none' : `1.5px solid ${N.line2}`,
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: ATLAS_MONO, fontSize: 11, fontWeight: 600,
                        boxShadow: current ? `0 0 0 4px ${p.accent}30` : 'none',
                      }}>{active && i < 2 ? '✓' : i + 1}</div>
                      <div style={{ fontSize: 12, color: active ? N.ink : N.muted, fontWeight: current ? 600 : 400 }}>{s}</div>
                    </div>
                    {i < 4 && <div style={{ flex: 1, height: 2, background: i < 2 ? p.accent : N.line2, margin: '0 10px' }} />}
                  </React.Fragment>
                );
              })}
            </div>
          </Card>

          {/* Equipment + diagnostic */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 14, flex: 1, overflow: 'hidden' }}>
            <Card pad={18}>
              <SectionTitle>Equipo recibido</SectionTitle>
              <div style={{ fontSize: 17, fontWeight: 600, color: N.ink }}>Refrigerador Mabe</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, marginTop: 4 }}>MOD. RME360 · SN MX48201 · 2019</div>
              <div style={{ marginTop: 14, padding: 14, background: N.page, borderRadius: 8 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Reportado por cliente</div>
                <div style={{ fontSize: 12.5, color: N.body, lineHeight: 1.5 }}>"No enfría desde hace 3 días. Hace ruido al encender. Ya revisamos que esté conectado y la luz interior sí prende."</div>
              </div>
              <div style={{ marginTop: 12, padding: 14, background: p.accentSoft, borderRadius: 8 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: p.accentInk, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Diagnóstico técnico</div>
                <div style={{ fontSize: 12.5, color: N.body, lineHeight: 1.5 }}>Compresor con baja presión. Se requiere recarga de gas R134a y reemplazo de capacitor de arranque. Sin daño estructural.</div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: N.muted }}>
                <span>Diagnosticó · Saúl M.</span>
                <span style={{ fontFamily: ATLAS_MONO }}>25 NOV · 14:18</span>
              </div>
            </Card>

            <Card pad={18}>
              <SectionTitle>Refacciones y mano de obra</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['REF', 'Gas refrigerante R134a · 800 g',  1, 480.00, true],
                  ['REF', 'Capacitor arranque 40 µF',       1, 220.00, true],
                  ['MO',  'Diagnóstico técnico',            1, 250.00, true],
                  ['MO',  'Servicio recarga + soldadura',   1, 480.00, true],
                  ['MO',  'Pruebas de operación · 24h',     1,  50.00, false],
                ].map(([type, name, qty, price, done], i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 30px 80px 12px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${N.line}` : 'none' }}>
                    <div style={{ padding: '2px 6px', background: type === 'REF' ? '#E5ECFB' : '#FBEFD7', color: type === 'REF' ? '#1F4FC8' : '#9A6610', borderRadius: 4, fontFamily: ATLAS_MONO, fontSize: 9.5, fontWeight: 600, textAlign: 'center' }}>{type}</div>
                    <div style={{ fontSize: 12.5, color: N.ink }}>{name}</div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, textAlign: 'right' }}>{qty}×</div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{mxn(price)}</div>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: done ? '#0E8A4E' : '#D1D5DB' }} />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${N.line}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: N.muted }}>Refacciones</span><span style={{ fontFamily: ATLAS_MONO }}>{mxn(700)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: N.muted }}>Mano de obra</span><span style={{ fontFamily: ATLAS_MONO }}>{mxn(780)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Total</span>
                  <span style={{ fontFamily: ATLAS_MONO, fontSize: 18, fontWeight: 600, color: p.accent }}>{mxn(1480)}</span>
                </div>
                <div style={{ marginTop: 10, padding: '6px 10px', background: '#E3F4EA', color: '#0E8A4E', borderRadius: 6, fontSize: 11.5, fontFamily: ATLAS_MONO, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon.check size={12} color="#0E8A4E" /> Cotización aprobada por cliente · 25 NOV 17:42
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div style={{ width: 260, background: '#FFF', borderLeft: `1px solid ${N.line}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Estado actual</div>
          <div style={{ padding: 12, background: p.accentSoft, borderRadius: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: p.accentInk }}>Reparando · 70%</div>
            <div style={{ height: 4, background: '#fff', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', background: p.accent }} />
            </div>
            <div style={{ fontSize: 11, color: N.muted, marginTop: 6, fontFamily: ATLAS_MONO }}>2h 14m invertidas · 3h estimado total</div>
          </div>

          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 8 }}>Acciones</div>
          {[
            { l: 'Pasar a pruebas', icon: Icon.check, primary: true },
            { l: 'Adjuntar foto',   icon: Icon.plus },
            { l: 'Pedir refacción', icon: Icon.truck },
            { l: 'Notificar cliente', icon: Icon.bell },
          ].map((a, i) => {
            const IconCmp = a.icon;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 8,
                background: a.primary ? p.accent : N.page,
                color: a.primary ? '#fff' : N.ink, fontWeight: a.primary ? 600 : 500, fontSize: 13,
              }}>
                <IconCmp size={15} color={a.primary ? '#fff' : p.accent} />
                <span>{a.l}</span>
              </div>
            );
          })}

          <div style={{ marginTop: 'auto', padding: 12, background: N.page, borderRadius: 8 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Garantía</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: N.ink, marginTop: 2 }}>90 días en refacción</div>
            <div style={{ fontSize: 10.5, color: N.muted, fontFamily: ATLAS_MONO, marginTop: 2 }}>Aplica solo a falla original</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Hero ────────────────────────────────────────────────
function ServicesHero() {
  const p = servicesP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#F4F8F6', position: 'relative', overflow: 'hidden', fontFamily: ATLAS_FONT }}>
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(180deg, transparent 60%, ${p.accent}10), repeating-linear-gradient(135deg, transparent 0 80px, ${p.accent}05 80px 81px)`,
      }} />
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, position: 'relative' }}>
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent, color: '#fff', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 500 }}>PRESET 09</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accentInk, letterSpacing: 1.4, textTransform: 'uppercase' }}>Órdenes y seguimiento</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 60, fontWeight: 500, lineHeight: 1, letterSpacing: -1.5, color: N.ink }}>
            Atlas One <span style={{ color: p.accent }}>Services</span>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.3, color: N.body }}>
            Ningún trabajo se pierde entre cotización y entrega.
          </div>
          <div style={{ fontSize: 15, color: N.body, lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 480 }}>
            Talleres, mantenimiento, servicios técnicos e instalación. Órdenes de trabajo con estatus visible, cotizaciones digitales, refacciones, tiempos y cobros — todo conectado.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {[['3.2 d', 'cierre promedio'], ['18', 'órdenes activas/taller'], ['4.7★', 'satisfacción promedio'], ['100%', 'historial por equipo']].map(([k, v], i) => (
              <div key={i} style={{ paddingLeft: 14, borderLeft: `2px solid ${p.accent}` }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: p.accentInk, letterSpacing: -0.4 }}>{k}</div>
                <div style={{ fontSize: 12, color: N.muted, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button label="Solicitar demo técnica" kind="primary" preset={p} icon={Icon.arrowRight} />
            <Button label="Ver flujo de OT" kind="secondary" />
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 30, right: 0 }}>
            <LaptopFrame width={700}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.475)', transformOrigin: 'top left' }}>
                <ServicesDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{
            position: 'absolute', bottom: 30, left: -10, padding: 16, width: 240,
            background: '#fff', border: `1.5px solid ${p.accent}`, borderRadius: 12,
            boxShadow: `0 14px 32px ${p.accent}25`, transform: 'rotate(-2deg)',
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>OT-1830 · en curso</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>Refrigerador Mabe</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 12 }}>
              {[true, true, true, false, false].map((on, i) => (
                <React.Fragment key={i}>
                  <div style={{ width: 14, height: 14, borderRadius: 999, background: on ? p.accent : '#E5E7EB' }} />
                  {i < 4 && <div style={{ flex: 1, height: 2, background: i < 2 ? p.accent : '#E5E7EB' }} />}
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 8, background: p.accentSoft, borderRadius: 6, fontSize: 11, color: p.accentInk, fontFamily: ATLAS_MONO }}>
              <strong>70%</strong> · 2h 14m de 3h estimadas
            </div>
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
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6 }}>ÓRDENES · COTIZACIONES · TÉCNICOS · REFACCIONES · GARANTÍA</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>atlas.tech / services</div>
      </div>
    </div>
  );
}

Object.assign(window, { ServicesDesktop, ServicesTouch, ServicesHero });
