// custom.jsx — Atlas One Custom (Preset 11)
// Color: Neutral premium con acentos configurables. Modular, flexible.

const customP = () => PRESETS.custom;

const customSidebarItems = [
  { header: 'Constructor' },
  { icon: Icon.layers,   label: 'Mapa de proceso' },
  { icon: Icon.box,      label: 'Módulos',         badge: '14' },
  { icon: Icon.cog,      label: 'Flujos especiales' },
  { header: 'Configuración' },
  { icon: Icon.user,     label: 'Roles' },
  { icon: Icon.zap,      label: 'Integraciones' },
  { icon: Icon.chart,    label: 'KPIs personalizados' },
  { header: 'Entrega' },
  { icon: Icon.shield,   label: 'Validación' },
  { icon: Icon.check,    label: 'Publicar' },
];

// ─── 01 · Desktop · Mapa de proceso / constructor ─────────────
function CustomDesktop() {
  const p = customP();
  // Process map: nodes connected in a flow
  const nodes = [
    { x: 60,  y: 60,  w: 130, h: 60, label: 'Recepción',  kind: 'in',  icon: '○' },
    { x: 60,  y: 180, w: 130, h: 60, label: 'Diagnóstico', kind: 'op',  icon: '◉' },
    { x: 60,  y: 300, w: 130, h: 60, label: 'Cotización', kind: 'op',  icon: '◇' },
    { x: 280, y: 60,  w: 130, h: 60, label: 'Aprobación', kind: 'gate', icon: '◆' },
    { x: 280, y: 180, w: 130, h: 60, label: 'En proceso', kind: 'op',  icon: '◉' },
    { x: 280, y: 300, w: 130, h: 60, label: 'Pruebas',    kind: 'op',  icon: '◉' },
    { x: 500, y: 60,  w: 130, h: 60, label: 'Cobro',      kind: 'gate', icon: '◆' },
    { x: 500, y: 180, w: 130, h: 60, label: 'Entrega',    kind: 'out', icon: '●' },
    { x: 500, y: 300, w: 130, h: 60, label: 'Seguimiento', kind: 'out', icon: '●' },
  ];
  const edges = [
    [0, 1], [1, 2], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
  ];

  const palette = [
    { name: 'Punto de venta',    icon: Icon.cart,     used: true },
    { name: 'Inventario',        icon: Icon.pkg,      used: true },
    { name: 'Clientes',          icon: Icon.users,    used: true },
    { name: 'Agenda',            icon: Icon.calendar, used: true },
    { name: 'Órdenes de trabajo',icon: Icon.wrench,   used: true },
    { name: 'Cotizaciones',      icon: Icon.document, used: true },
    { name: 'Comisiones',        icon: Icon.bars },
    { name: 'Mesas · KDS',       icon: Icon.table },
    { name: 'Recetas',           icon: Icon.utensils },
    { name: 'Membresías',        icon: Icon.heart },
    { name: 'Multisucursal',     icon: Icon.branch },
    { name: 'Auditoría',         icon: Icon.shield },
  ];

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F5F2EB', fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Mapa de proceso" items={customSidebarItems}
        footer={<SidebarUser preset={p} name="Atlas Team" role="Implementación" branch="Cliente · Lavandería Aqua" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Constructor de plataforma · Lavandería industrial Aqua"
          sub="14 MÓDULOS DISPONIBLES · 9 ACTIVOS · 3 FLUJOS PERSONALIZADOS · ENTREGA 12 DIC"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button label="Vista previa" kind="secondary" />
              <div style={{ padding: '8px 14px', background: p.accent2, color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Icon.check size={14} color="#fff" strokeWidth={2.2} /> Publicar v0.6
              </div>
            </div>
          }
        />

        <div style={{ flex: 1, padding: '18px 24px 22px', background: '#FBFAF6', display: 'flex', gap: 14, overflow: 'hidden' }}>
          {/* Process canvas */}
          <div style={{ flex: 1, background: '#fff', border: `1px solid ${N.line}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Mapa de operación · flujo lavandería</div>
                <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4, color: N.ink }}>Construye el proceso real, no uno genérico</div>
              </div>
              <div style={{ display: 'flex', gap: 6, fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>
                <Legend dot="○" label="Entrada" />
                <Legend dot="◉" label="Operación" />
                <Legend dot="◆" label="Compuerta" />
                <Legend dot="●" label="Salida" />
              </div>
            </div>

            <div style={{ flex: 1, position: 'relative', background: '#FBFAF6', borderRadius: 8, overflow: 'hidden',
              backgroundImage: 'radial-gradient(circle, #E8E5DD 1px, transparent 1px)', backgroundSize: '16px 16px',
            }}>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                {edges.map(([a, b], i) => {
                  const na = nodes[a], nb = nodes[b];
                  const x1 = na.x + na.w, y1 = na.y + na.h / 2;
                  const x2 = nb.x, y2 = nb.y + nb.h / 2;
                  const mx = (x1 + x2) / 2;
                  return (
                    <g key={i}>
                      <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} stroke={N.line2} strokeWidth="1.5" fill="none" strokeDasharray={i > 5 ? '4 3' : '0'} />
                      <circle cx={x2} cy={y2} r="3" fill={N.body} />
                    </g>
                  );
                })}
              </svg>
              {nodes.map((n, i) => (
                <div key={i} style={{
                  position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h,
                  background: n.kind === 'in' ? '#FBFAF6' : n.kind === 'gate' ? '#fff' : N.card,
                  border: n.kind === 'gate' ? `1.5px dashed ${p.accent2}` : `1px solid ${N.line2}`,
                  borderRadius: n.kind === 'gate' ? 10 : 8,
                  padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  boxShadow: '0 1px 0 rgba(15,15,15,0.04)',
                }}>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.3 }}>{n.icon} · MOD-{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: N.ink, marginTop: 2 }}>{n.label}</div>
                </div>
              ))}
              {/* Floating annotation */}
              <div style={{
                position: 'absolute', right: 24, top: 24, width: 200, padding: 12,
                background: p.accent2 + '15', border: `1px solid ${p.accent2}50`, borderRadius: 8,
                fontFamily: ATLAS_FONT,
              }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: p.accent2, letterSpacing: 0.5, textTransform: 'uppercase' }}>Compuerta personalizada</div>
                <div style={{ fontSize: 12, color: N.body, marginTop: 4, lineHeight: 1.4 }}>Aprobación requerida si el monto supera $5,000 o si hay refacciones especiales.</div>
              </div>
            </div>
          </div>

          {/* Module palette */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card pad={16} style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Paleta de módulos</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.faint }}>9 / 14</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {palette.map((m, i) => {
                  const IconCmp = m.icon;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 7,
                      background: m.used ? p.accentSoft : '#FBFAF6',
                      border: `1px solid ${m.used ? p.accent2 + '40' : N.line}`,
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 5,
                        background: m.used ? p.accent2 : N.card,
                        color: m.used ? '#fff' : N.muted,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconCmp size={13} color={m.used ? '#fff' : N.muted} />
                      </div>
                      <span style={{ flex: 1, fontSize: 12.5, color: m.used ? N.ink : N.body, fontWeight: m.used ? 500 : 400 }}>{m.name}</span>
                      {m.used ? (
                        <Icon.check size={13} color={p.accent2} />
                      ) : (
                        <Icon.plus size={13} color={N.muted} />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card pad={16}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>KPIs personalizados</div>
              {[
                ['Kg de ropa procesada',  '/día'],
                ['Reclamos por unidad',    '/mes'],
                ['Reposición de químicos', '/sem'],
              ].map(([n, u], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i ? `1px solid ${N.line}` : 'none' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: p.accent2 }} />
                  <span style={{ flex: 1, fontSize: 12.5, color: N.body }}>{n}</span>
                  <span style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>{u}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '6px 10px', background: N.page, borderRadius: 6, fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, textAlign: 'center', border: `1px dashed ${N.line2}` }}>
                + Agregar KPI
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 13, color: N.body }}>{dot}</span>{label}
    </span>
  );
}

// ─── 02 · Configuración de accent / theming ───────────────────
function CustomTouch() {
  const p = customP();
  const accentChoices = [
    { name: 'Cobalto',     color: '#2563EB' },
    { name: 'Esmeralda',   color: '#10B981' },
    { name: 'Cobre',       color: '#B45309' },
    { name: 'Carmesí',     color: '#DC2626' },
    { name: 'Violeta',     color: '#7C3AED' },
    { name: 'Carbón',      color: '#0A0A0A',  active: true },
    { name: 'Turquesa',    color: '#0EA5A4' },
    { name: 'Ámbar',       color: '#D97706' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', background: '#F5F2EB', display: 'flex', fontFamily: ATLAS_FONT }}>
      <div style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', gap: 18, overflow: 'hidden' }}>
        <div>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Identidad del cliente · paso 3 de 7</div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 32, fontWeight: 500, color: N.ink, marginTop: 6, letterSpacing: -0.6 }}>Color de acento</div>
          <div style={{ fontSize: 13.5, color: N.body, marginTop: 6, maxWidth: 600, lineHeight: 1.5 }}>Tu marca define el sistema. Elige un acento y vamos a aplicarlo a sidebar, botones, gráficos y exportables — todo Atlas One se adapta.</div>
        </div>

        {/* Accent grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {accentChoices.map((a, i) => (
            <div key={i} style={{
              background: '#fff', border: a.active ? `2px solid ${a.color}` : `1px solid ${N.line}`,
              borderRadius: 14, padding: 16, position: 'relative', cursor: 'pointer',
            }}>
              {a.active && (
                <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 999, background: a.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon.check size={12} color="#fff" strokeWidth={2.4} />
                </div>
              )}
              <div style={{
                height: 56, borderRadius: 8,
                background: a.color,
                backgroundImage: `linear-gradient(135deg, ${a.color}, ${a.color}90)`,
                marginBottom: 12,
              }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: N.ink }}>{a.name}</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, marginTop: 2 }}>{a.color.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div style={{ flex: 1, background: '#fff', border: `1px solid ${N.line}`, borderRadius: 12, overflow: 'hidden', display: 'flex' }}>
          {/* Mini sidebar */}
          <div style={{ width: 140, background: '#0A0A0A', color: '#E8E5DD', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 12px' }}>
              <AtlasMark size={16} color="#E8E5DD" accent="#A78BFA" />
              <div style={{ fontSize: 11, fontWeight: 600 }}>Atlas One</div>
            </div>
            {[
              { l: 'Inicio',     active: true, icon: Icon.home },
              { l: 'Operación',  icon: Icon.cart },
              { l: 'Equipo',     icon: Icon.users },
              { l: 'Reportes',   icon: Icon.chart },
              { l: 'Ajustes',    icon: Icon.cog },
            ].map((it, i) => {
              const IconCmp = it.icon;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                  borderRadius: 5, fontSize: 11.5,
                  background: it.active ? '#1A1A1A' : 'transparent',
                  color: it.active ? '#E8E5DD' : '#7A7872',
                  position: 'relative',
                }}>
                  {it.active && <span style={{ position: 'absolute', left: -8, top: 6, bottom: 6, width: 2, background: '#A78BFA' }} />}
                  <IconCmp size={12} color={it.active ? '#A78BFA' : '#7A7872'} />
                  <span>{it.l}</span>
                </div>
              );
            })}
          </div>

          <div style={{ flex: 1, padding: 24, background: '#FBFAF6' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 24, fontWeight: 500, letterSpacing: -0.4 }}>Vista previa en vivo</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>SE APLICA AL PUBLICAR</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {[['Ingreso', mxn(28430), '+18%'], ['Tickets', '143', '+9%'], ['Margen', '64%', '+2 pp']].map(([l, v, d], i) => (
                <div key={i} style={{ background: '#fff', border: `1px solid ${N.line}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{l}</div>
                  <div style={{ fontSize: 19, fontWeight: 600, marginTop: 4, color: N.ink, letterSpacing: -0.3 }}>{v}</div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#0E8A4E', marginTop: 2 }}>{d}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: `1px solid ${N.line}`, borderRadius: 8, padding: 14 }}>
              <BarChart
                data={[
                  { label: 'L', value: 4 }, { label: 'M', value: 6 }, { label: 'M', value: 5 },
                  { label: 'J', value: 8 }, { label: 'V', value: 11, highlight: true },
                  { label: 'S', value: 14, highlight: true }, { label: 'D', value: 7 },
                ]}
                width={460} height={120} color="#0A0A0A" soft={N.line}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button label="Botón primario" kind="primary" preset={p} />
              <Button label="Botón acento" kind="accent" preset={p} />
              <Button label="Botón secundario" kind="secondary" />
            </div>
          </div>
        </div>
      </div>

      {/* Steps right */}
      <div style={{ width: 240, background: '#fff', borderLeft: `1px solid ${N.line}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Pasos del builder</div>
        {[
          ['Información del negocio', 'done'],
          ['Tipografía',              'done'],
          ['Color de acento',         'active'],
          ['Logo y marca',            'next'],
          ['Módulos activos',         'next'],
          ['Roles y permisos',        'next'],
          ['Revisión final',          'next'],
        ].map(([n, s], i) => {
          const c = s === 'done' ? '#0E8A4E' : s === 'active' ? p.accent2 : N.line2;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${N.line}` : 'none' }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: s === 'done' ? c : 'transparent', border: s === 'done' ? 'none' : `1.5px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: ATLAS_MONO, fontSize: 10, fontWeight: 600 }}>
                {s === 'done' ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12.5, color: s === 'next' ? N.muted : N.ink, fontWeight: s === 'active' ? 600 : 400 }}>{n}</span>
            </div>
          );
        })}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, padding: '10px 14px', background: '#F5F2EB', color: N.ink, borderRadius: 7, fontSize: 12.5, fontWeight: 500, textAlign: 'center' }}>← Anterior</div>
          <div style={{ flex: 1, padding: '10px 14px', background: p.accent2, color: '#fff', borderRadius: 7, fontSize: 12.5, fontWeight: 600, textAlign: 'center' }}>Continuar →</div>
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Hero ────────────────────────────────────────────────
function CustomHero() {
  const p = customP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#F5F2EB', position: 'relative', overflow: 'hidden', fontFamily: ATLAS_FONT }}>
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 100% 0%, ${p.accent2}30, transparent 50%), radial-gradient(circle at 0% 100%, #2563EB18, transparent 50%)`,
      }} />
      {/* Grid bg pattern */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, position: 'relative' }}>
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: '#0A0A0A', color: '#fff', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 500 }}>PRESET 11</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 1.4, textTransform: 'uppercase' }}>Constructor a la medida</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 64, fontWeight: 500, lineHeight: 1, letterSpacing: -1.8, color: N.ink }}>
            Atlas One <em style={{ fontStyle: 'italic' }}>Custom.</em>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.3, color: N.body }}>
            Cuando ningún preset describe exactamente cómo opera el negocio, lo configuramos.
          </div>
          <div style={{ fontSize: 15, color: N.body, lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 480 }}>
            Lavanderías industriales, escuelas privadas, gimnasios con membresía híbrida, distribuidoras locales. Construimos el mapa de proceso, activamos los módulos correctos y entregamos Atlas One con la identidad del cliente.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: Icon.layers,   t: 'Mapa de proceso construido contigo, no a partir de plantillas' },
              { icon: Icon.box,      t: '14 módulos activables · todos los presets como punto de partida' },
              { icon: Icon.zap,      t: 'Integraciones y KPIs definidos por tu equipo' },
            ].map((f, i) => {
              const IconCmp = f.icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', border: `1.5px solid ${p.accent2}50`, color: p.accent2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconCmp size={17} color={p.accent2} />
                  </div>
                  <div style={{ fontSize: 14, color: N.body }}>{f.t}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
            <div style={{ padding: '10px 16px', background: '#0A0A0A', color: '#fff', borderRadius: 7, fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              Hablar con implementación <Icon.arrowRight size={14} color="#fff" />
            </div>
            <div style={{ padding: '10px 16px', color: N.ink, border: `1px solid ${N.line2}`, borderRadius: 7, fontWeight: 500, fontSize: 13 }}>
              Ver casos
            </div>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 30, right: 0 }}>
            <LaptopFrame width={700}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.475)', transformOrigin: 'top left' }}>
                <CustomDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{
            position: 'absolute', bottom: 30, left: -20, padding: 16, width: 220,
            background: '#fff', border: `1.5px solid ${p.accent2}`, borderRadius: 12,
            boxShadow: `0 14px 32px ${p.accent2}30`, transform: 'rotate(-3deg)',
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>14 módulos · 9 activos</div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {Array.from({length: 14}).map((_, i) => (
                <div key={i} style={{
                  aspectRatio: '1',
                  background: i < 9 ? p.accent2 : '#F5F2EB',
                  border: i < 9 ? 'none' : `1px dashed ${N.line2}`,
                  borderRadius: 4,
                }} />
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: N.body }}>Construcción <strong>64% completa</strong> · entrega 12 dic</div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 70px', display: 'flex', alignItems: 'center', gap: 16,
        borderTop: `1px solid ${N.line}`, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)',
      }}>
        <Wordmark color={N.ink} accent={p.accent2} size={13} />
        <div style={{ width: 1, height: 18, background: N.line2 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6 }}>MAPA DE PROCESO · MÓDULOS · ROLES · KPIS · INTEGRACIONES</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>atlas.tech / custom</div>
      </div>
    </div>
  );
}

Object.assign(window, { CustomDesktop, CustomTouch, CustomHero });
