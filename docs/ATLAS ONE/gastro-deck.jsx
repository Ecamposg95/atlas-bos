// gastro-deck.jsx — Atlas One Gastro Suite · executive deck (15 slides, 1920×1080)
// Premium dark, warm accents, big UI mockups. Aimed at restaurant groups.

const GTOT = 15;

// ─── Palette ──────────────────────────────────────────────────
const G = {
  bg:    '#0B0A09',          // warm near-black
  bg2:   '#100E0B',
  panel: 'rgba(255,255,255,0.045)',
  panelBorder: 'rgba(255,255,255,0.09)',
  ink:   '#F6F1E9',          // warm white
  body:  '#B9B2A6',
  muted: '#7E776C',
  gold:  '#E8A33D',          // suite primary
  amber: '#F59E0B',
  coral: '#E2531B',          // restaurant
  violet:'#8B5CF6',          // bar
  cyan:  '#22D3EE',
  espresso: '#D9A668',       // café
};

// ─── Frame ────────────────────────────────────────────────────
function GFrame({ children, section, page, accent = G.gold, bg = G.bg, glow, style }) {
  return (
    <section style={{
      width: 1920, height: 1080, background: bg, color: G.ink,
      fontFamily: ATLAS_FONT, position: 'relative', overflow: 'hidden', ...style,
    }}>
      {/* warm glows */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage:
        glow || `radial-gradient(ellipse at 85% 10%, ${accent}22, transparent 55%), radial-gradient(ellipse at 5% 95%, ${G.violet}14, transparent 55%)` }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage:
        'radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      <div style={{ position: 'absolute', top: 46, left: 64, right: 64, display: 'flex', alignItems: 'center', gap: 18, zIndex: 5, height: 40 }}>
        <Wordmark color={G.ink} accent={accent} size={20} />
        <div style={{ width: 1, height: 26, background: G.panelBorder }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: G.muted, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 500 }}>{section}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: G.muted, letterSpacing: 0.6 }}>{String(page).padStart(2, '0')} / {GTOT}</div>
      </div>

      <div style={{ position: 'absolute', inset: '124px 64px 84px', display: 'flex', flexDirection: 'column', zIndex: 2 }}>
        {children}
      </div>

      <div style={{ position: 'absolute', bottom: 34, left: 64, right: 64, display: 'flex', alignItems: 'center', fontFamily: ATLAS_MONO, fontSize: 12, color: G.muted, letterSpacing: 0.8, zIndex: 5 }}>
        <div>ATLAS ONE GASTRO SUITE · OPERACIÓN GASTRONÓMICA INTELIGENTE</div>
        <div style={{ flex: 1 }} />
        <div>atlas.tech / gastro</div>
      </div>
    </section>
  );
}

// Framed dark UI mockup (for dark-UI components like Bar)
function GMock({ children, w = 1440, h = 900, scale = 0.5, accent = G.gold, rotate = 0 }) {
  return (
    <div style={{
      width: w * scale, height: h * scale, borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${G.panelBorder}`, boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px ${accent}20`,
      transform: rotate ? `rotate(${rotate}deg)` : 'none', background: '#000',
    }}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}

// ─── S1 · Cover ───────────────────────────────────────────────
function GS01() {
  return (
    <section style={{ width: 1920, height: 1080, background: G.bg, color: G.ink, fontFamily: ATLAS_FONT, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage:
        `radial-gradient(ellipse at 78% 18%, ${G.gold}2E, transparent 52%), radial-gradient(ellipse at 12% 88%, ${G.violet}24, transparent 55%), radial-gradient(ellipse at 95% 95%, ${G.coral}1C, transparent 50%)` }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage:
        'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      <div style={{ position: 'absolute', top: 52, left: 70, right: 70, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Wordmark color={G.ink} accent={G.gold} size={26} />
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 18, color: G.muted, letterSpacing: 1.6, textTransform: 'uppercase' }}>Deck ejecutivo · grupos restauranteros</div>
      </div>

      <div style={{ position: 'absolute', inset: '188px 70px 150px', display: 'flex', alignItems: 'center', gap: 60 }}>
        <div style={{ flex: '0 0 920px' }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 22, color: G.gold, letterSpacing: 2.4, textTransform: 'uppercase', fontWeight: 600 }}>Restaurante · Bar · Cafetería · Multi-sucursal</div>
          <h1 style={{ fontFamily: ATLAS_SERIF, fontSize: 132, fontWeight: 500, letterSpacing: -4.5, lineHeight: 1.0, margin: '30px 0 0', color: G.ink }}>
            Atlas One<br /><em style={{ color: G.gold, fontStyle: 'italic' }}>Gastro Suite.</em>
          </h1>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 40, fontWeight: 400, color: '#D9D2C7', marginTop: 30, letterSpacing: -0.6, lineHeight: 1.18, maxWidth: 820 }}>
            La plataforma operativa para restaurantes, bares y cafeterías que quieren escalar con control.
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 50 }}>
            {['Operar', 'Controlar', 'Escalar'].map((t, i) => (
              <div key={i} style={{ padding: '12px 22px', borderRadius: 999, border: `1px solid ${G.panelBorder}`, background: G.panel, fontFamily: ATLAS_MONO, fontSize: 18, letterSpacing: 1, color: G.body, textTransform: 'uppercase' }}>{t}</div>
            ))}
          </div>
        </div>

        {/* Fanned mockups */}
        <div style={{ flex: 1, position: 'relative', height: 620 }}>
          <div style={{ position: 'absolute', top: 40, right: 230 }}><GMock w={1440} h={900} scale={0.4} accent={G.coral} rotate={-3}><RestaurantDashboard /></GMock></div>
          <div style={{ position: 'absolute', top: 250, right: 0 }}><GMock w={1440} h={900} scale={0.34} accent={G.violet} rotate={3}><BarDesktop /></GMock></div>
          <div style={{ position: 'absolute', top: 0, right: 30 }}><GMock w={390} h={844} scale={0.42} accent={G.espresso} rotate={4}><CafeQueueMobile /></GMock></div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 52, left: 70, right: 70, display: 'flex', alignItems: 'center', fontFamily: ATLAS_MONO, fontSize: 14, color: G.muted, letterSpacing: 1 }}>
        <div>UNA MISMA ARQUITECTURA · DIFERENTES EXPERIENCIAS OPERATIVAS</div>
        <div style={{ flex: 1 }} />
        <div>01 / {GTOT}</div>
      </div>
    </section>
  );
}

// ─── S2 · La oportunidad ──────────────────────────────────────
function GS02() {
  return (
    <GFrame section="LA OPORTUNIDAD" page={2} accent={G.gold}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 1500 }}>
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 18, color: G.gold, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, marginBottom: 26 }}>La gastronomía moderna</div>
        <h1 style={{ fontFamily: ATLAS_SERIF, fontSize: 96, fontWeight: 500, letterSpacing: -3, lineHeight: 1.06, margin: 0, color: G.ink }}>
          Opera con datos,<br />no con <em style={{ color: G.gold, fontStyle: 'italic' }}>suposiciones.</em>
        </h1>
        <div style={{ fontFamily: ATLAS_SERIF, fontSize: 34, fontWeight: 400, color: G.body, marginTop: 36, letterSpacing: -0.4, lineHeight: 1.35, maxWidth: 1200 }}>
          Los negocios gastronómicos no pierden dinero solo por vender poco. Pierden por falta de control en inventario, caja, merma, tiempos y recetas.
        </div>
        <div style={{ display: 'flex', gap: 50, marginTop: 64 }}>
          {[['68%', 'de los grupos no concilia merma a tiempo'], ['1 de 3', 'unidades opera sin reportes diarios'], ['−4 a 8%', 'de margen se fuga sin control de insumos']].map(([v, l], i) => (
            <div key={i} style={{ flex: 1, paddingLeft: 22, borderLeft: `2px solid ${G.gold}` }}>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 64, fontWeight: 500, color: G.ink, letterSpacing: -1.5, lineHeight: 1 }}>{v}</div>
              <div style={{ fontFamily: ATLAS_FONT, fontSize: 18, color: G.body, marginTop: 12, lineHeight: 1.4, maxWidth: 320 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </GFrame>
  );
}

// ─── S3 · Fragmentación operativa ─────────────────────────────
function GS03() {
  const blocks = ['Caja', 'Cocina', 'Barra', 'Inventario', 'Compras', 'Recetas', 'Personal', 'Reportes', 'Sucursales'];
  const icons = [Icon.cash, Icon.flame, Icon.cocktail, Icon.box, Icon.truck, Icon.beaker, Icon.users, Icon.chart, Icon.branch];
  return (
    <GFrame section="EL DOLOR DEL GRUPO" page={3} accent={G.coral}>
      <SlideHeadlineDark kicker="Cuando el negocio crece" title="La operación se fragmenta." accent={G.coral}
        subtitle="Cada área se vuelve una isla. Más unidades significan más puntos ciegos — no más control." />
      <div style={{ display: 'flex', gap: 44, marginTop: 50, flex: 1 }}>
        <div style={{ flex: '0 0 880px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignContent: 'center' }}>
          {blocks.map((b, i) => {
            const IconCmp = icons[i];
            return (
              <div key={i} style={{ padding: '22px 20px', background: G.panel, border: `1px solid ${G.panelBorder}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14, opacity: 0.92 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(226,83,27,0.14)', color: G.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconCmp size={21} color={G.coral} /></div>
                <span style={{ fontFamily: ATLAS_SERIF, fontSize: 24, color: G.ink, letterSpacing: -0.3 }}>{b}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: G.muted }}>aislado</span>
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 46, fontWeight: 500, fontStyle: 'italic', color: G.ink, letterSpacing: -1, lineHeight: 1.15 }}>
            El reto no es abrir más unidades.
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 46, fontWeight: 500, color: G.gold, letterSpacing: -1, lineHeight: 1.15, marginTop: 14 }}>
            Es controlarlas con consistencia.
          </div>
        </div>
      </div>
    </GFrame>
  );
}

// Dark headline helper
function SlideHeadlineDark({ kicker, title, subtitle, accent = G.gold }) {
  return (
    <div>
      {kicker && <div style={{ fontFamily: ATLAS_MONO, fontSize: 17, color: accent, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 18, fontWeight: 600 }}>{kicker}</div>}
      <h1 style={{ fontFamily: ATLAS_SERIF, fontSize: 80, fontWeight: 500, letterSpacing: -2.2, lineHeight: 1.02, margin: 0, color: G.ink }}>{title}</h1>
      {subtitle && <div style={{ fontFamily: ATLAS_SERIF, fontSize: 30, fontWeight: 400, color: G.body, marginTop: 20, letterSpacing: -0.4, lineHeight: 1.3, maxWidth: 1180 }}>{subtitle}</div>}
    </div>
  );
}

// ─── S4 · La solución ─────────────────────────────────────────
function GS04() {
  const configs = [
    ['Restaurante', G.coral], ['Bar', G.violet], ['Cafetería', G.espresso],
    ['Dark kitchen', G.amber], ['Grupo multi-sucursal', G.gold], ['Conceptos híbridos', G.cyan],
  ];
  return (
    <GFrame section="LA SOLUCIÓN" page={4} accent={G.gold}>
      <SlideHeadlineDark kicker="Una sola plataforma · configurada por operación" title="No son tres softwares diferentes."
        subtitle="Es Atlas One, configurado para cada tipo de operación gastronómica. Misma arquitectura, misma data, distinta experiencia." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 56, flex: 1, alignContent: 'center' }}>
        {configs.map(([t, c], i) => (
          <div key={i} style={{ padding: '30px 28px', background: G.panel, border: `1px solid ${G.panelBorder}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 16, borderTop: `3px solid ${c}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: c, boxShadow: `0 0 18px ${c}80` }} />
              <span style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: G.muted, letterSpacing: 1 }}>{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 34, fontWeight: 500, color: G.ink, letterSpacing: -0.6 }}>{t}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 36, padding: '22px 30px', background: G.panel, border: `1px solid ${G.panelBorder}`, borderLeft: `4px solid ${G.gold}`, borderRadius: 12, fontFamily: ATLAS_SERIF, fontSize: 28, fontStyle: 'italic', color: G.ink, letterSpacing: -0.3 }}>
        Del pedido al inventario. De la caja al dashboard. De la sucursal al grupo completo.
      </div>
    </GFrame>
  );
}

// ─── Reusable UI slide (Restaurant / Bar / Café) ──────────────
function GUISlide({ section, page, accent, name, headline, sub, points, Mock, MockDark, floatLabel, floatStat, floatStatLabel, photoId, photoCaption }) {
  return (
    <GFrame section={section} page={page} accent={accent}>
      <div style={{ display: 'flex', gap: 56, flex: 1 }}>
        {/* Copy */}
        <div style={{ flex: '0 0 700px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <span style={{ padding: '6px 13px', background: accent, color: '#0B0A09', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}>{name}</span>
          </div>
          <h1 style={{ fontFamily: ATLAS_SERIF, fontSize: 72, fontWeight: 500, letterSpacing: -2, lineHeight: 1.04, margin: 0, color: G.ink }}>{headline}</h1>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 27, fontWeight: 400, color: G.body, marginTop: 22, letterSpacing: -0.3, lineHeight: 1.3, maxWidth: 640 }}>{sub}</div>
          <div style={{ marginTop: 36, display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {points.map((m, i) => (
              <span key={i} style={{ padding: '9px 15px', background: G.panel, border: `1px solid ${G.panelBorder}`, color: G.body, borderRadius: 999, fontFamily: ATLAS_FONT, fontSize: 15 }}>{m}</span>
            ))}
          </div>
          {photoId && (
            <div style={{ marginTop: 'auto', paddingTop: 28 }}>
              <image-slot id={photoId} shape="rounded" radius="14" placeholder={photoCaption} style={{ display: 'block', width: '100%', height: 168, border: `1px solid ${G.panelBorder}` }}></image-slot>
            </div>
          )}
        </div>

        {/* Mockup */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: 'perspective(2400px) rotateY(-7deg) rotateX(2deg)' }}>
            <GMock w={1440} h={900} scale={0.62} accent={accent}>{Mock}</GMock>
          </div>
          {MockDark && (
            <div style={{ position: 'absolute', bottom: -28, left: -36 }}>
              <GMock w={1440} h={900} scale={0.3} accent={accent} rotate={-4}>{MockDark}</GMock>
            </div>
          )}
          <div style={{ position: 'absolute', top: -10, right: -20, padding: 20, background: '#15120D', border: `1.5px solid ${accent}`, borderRadius: 14, width: 230, boxShadow: `0 18px 50px ${accent}40`, transform: 'rotate(2deg)' }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: accent, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>{floatLabel}</div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 44, fontWeight: 500, color: G.ink, marginTop: 6, letterSpacing: -1, lineHeight: 1 }}>{floatStat}</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 13, color: G.body, marginTop: 6 }}>{floatStatLabel}</div>
          </div>
        </div>
      </div>
    </GFrame>
  );
}

// ─── S5 · Restaurant ──────────────────────────────────────────
function GS05() {
  return <GUISlide section="ATLAS ONE RESTAURANT" page={5} accent={G.coral} name="RESTAURANT"
    headline={<>Sala, cocina y caja,<br />coordinadas.</>}
    sub="Plano de mesas, comandas, KDS de cocina y caja — sincronizados en una sola operación viva."
    points={['Plano de mesas', 'Comandas', 'Meseros', 'Cocina · KDS', 'Cuentas', 'Turnos', 'Ticket promedio']}
    Mock={<RestaurantDesktop />} MockDark={<RestaurantCheckout />}
    floatLabel="Ticket promedio" floatStat="$487" floatStatLabel="+6% vs. semana pasada"
    photoId="rest-photo" photoCaption="Foto de salón / servicio en mesa" />;
}

// ─── S6 · Bar ─────────────────────────────────────────────────
function GS06() {
  return <GUISlide section="ATLAS ONE BAR" page={6} accent={G.violet} name="BAR"
    headline={<>La noche tiene mucho<br />que medir.</>}
    sub="Barra, cuentas abiertas, copeo, botellas y promociones por horario — con corte nocturno trazable."
    points={['Barra', 'Cuentas abiertas', 'Copeo', 'Botellas', 'Promociones', 'Corte nocturno']}
    Mock={<BarDesktop />} MockDark={<BarTabs />}
    floatLabel="Inventario líquido" floatStat="28/142" floatStatLabel="botellas descorchadas"
    photoId="bar-photo" photoCaption="Foto de barra / coctelería nocturna" />;
}

// ─── S7 · Café ────────────────────────────────────────────────
function GS07() {
  return <GUISlide section="ATLAS ONE CAFÉ" page={7} accent={G.espresso} name="CAFÉ"
    headline={<>Velocidad en mostrador,<br />costos bajo control.</>}
    sub="POS visual, cola de pedidos para barista, recetas con costo en vivo e insumos con descuento automático."
    points={['POS rápido', 'Menú visual', 'Para llevar', 'Baristas', 'Recetas', 'Insumos', 'Merma']}
    Mock={<CafeQueue />} MockDark={<CafeRecipes />}
    floatLabel="Margen promedio" floatStat="68%" floatStatLabel="merma controlada <2%"
    photoId="cafe-photo" photoCaption="Foto de barra de café / latte art" />;
}

// ─── S8 · Recetas, insumos y merma ────────────────────────────
function GS08() {
  const flow = [
    ['Venta', 'Se registra el pedido', Icon.cart, G.gold],
    ['Receta', 'Descuenta ingredientes', Icon.beaker, G.espresso],
    ['Inventario', 'Insumos y botellas bajan', Icon.box, G.coral],
    ['Merma', 'Queda registrada', Icon.warning, G.amber],
    ['Margen', 'Costo y rentabilidad', Icon.chart, G.violet],
  ];
  return (
    <GFrame section="CAPA ESTRATÉGICA" page={8} accent={G.espresso}>
      <SlideHeadlineDark kicker="Recetas · insumos · merma" title="Cada venta cuenta una historia." accent={G.espresso}
        subtitle="No basta con saber cuánto vendiste. Necesitas saber cuánto te costó venderlo." />
      <div style={{ display: 'flex', gap: 40, marginTop: 50, flex: 1 }}>
        <div style={{ flex: '0 0 720px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          {flow.map(([t, d, IconCmp, c], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: `${c}1F`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${c}50` }}><IconCmp size={24} color={c} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: ATLAS_SERIF, fontSize: 30, fontWeight: 500, color: G.ink, letterSpacing: -0.4 }}>{t}</div>
                <div style={{ fontFamily: ATLAS_FONT, fontSize: 16, color: G.body, marginTop: 2 }}>{d}</div>
              </div>
              {i < flow.length - 1 && <Icon.arrowDown size={18} color={G.muted} style={{ marginRight: 30 }} />}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: 'perspective(2400px) rotateY(-7deg) rotateX(2deg)' }}>
            <GMock w={1440} h={900} scale={0.66} accent={G.espresso}><CafeRecipes /></GMock>
          </div>
        </div>
      </div>
    </GFrame>
  );
}

// ─── S9 · Multi-sucursal ──────────────────────────────────────
function GS09() {
  return (
    <GFrame section="MULTI-SUCURSAL · REPORTES EJECUTIVOS" page={9} accent={G.gold}>
      <div style={{ display: 'flex', gap: 56, flex: 1 }}>
        <div style={{ flex: '0 0 660px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 17, color: G.gold, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 600, marginBottom: 18 }}>Una operación · varias unidades</div>
          <h1 style={{ fontFamily: ATLAS_SERIF, fontSize: 74, fontWeight: 500, letterSpacing: -2.2, lineHeight: 1.02, margin: 0, color: G.ink }}>
            Un solo tablero<br />de control.
          </h1>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 400, color: G.body, marginTop: 22, letterSpacing: -0.3, lineHeight: 1.3, maxWidth: 600 }}>
            El dueño no debería depender de estar físicamente en cada sucursal para saber qué está pasando.
          </div>
          <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {['Ventas por sucursal', 'Comparativo de unidades', 'Productos más vendidos', 'Stock crítico', 'Cierres de caja', 'Rentabilidad por concepto'].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: ATLAS_FONT, fontSize: 16, color: G.body }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: G.gold }} />{t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: 'perspective(2400px) rotateY(-7deg) rotateX(2deg)' }}>
            <GMock w={1440} h={900} scale={0.66} accent={G.gold}><EnterpriseDesktop /></GMock>
          </div>
        </div>
      </div>
    </GFrame>
  );
}

// ─── S10 · Beneficios para dirección ──────────────────────────
function GS10() {
  const benefits = [
    ['Mayor visibilidad', 'Ventas, caja e inventario en tiempo real, por unidad.', Icon.pulse],
    ['Menos fugas', 'Merma, faltantes y diferencias bajo control.', Icon.shield],
    ['Control de inventario', 'Insumos, botellas y recetas que cuadran.', Icon.box],
    ['Reportes por unidad', 'Cada sucursal medida con el mismo estándar.', Icon.chart],
    ['Estandarización', 'Misma operación replicable en cada apertura.', Icon.layers],
    ['Seguimiento de personal', 'Desempeño por mesero, barista y bartender.', Icon.users],
    ['Menos dependencia de Excel', 'Una fuente de verdad, no hojas sueltas.', Icon.document],
    ['Base para expansión', 'Crecer con datos, no con improvisación.', Icon.arrowUp],
  ];
  return (
    <GFrame section="BENEFICIOS PARA DIRECCIÓN" page={10} accent={G.gold}>
      <SlideHeadlineDark kicker="Lo que cambia para la dirección" title="Decisiones más rápidas. Crecimiento más claro."
        subtitle="Atlas One es la diferencia entre suponer y saber." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 50, flex: 1, alignContent: 'center' }}>
        {benefits.map(([t, d, IconCmp], i) => (
          <div key={i} style={{ padding: 24, background: G.panel, border: `1px solid ${G.panelBorder}`, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 11, background: `${G.gold}1A`, color: G.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconCmp size={21} color={G.gold} /></div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 23, fontWeight: 500, color: G.ink, letterSpacing: -0.3, lineHeight: 1.15 }}>{t}</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 14.5, color: G.body, lineHeight: 1.45 }}>{d}</div>
          </div>
        ))}
      </div>
    </GFrame>
  );
}

// ─── S11 · Beneficios para operación (roles) ──────────────────
function GS11() {
  const roles = [
    ['Dueño / Socio', 'Rentabilidad y comparativo de unidades', G.gold],
    ['Director de operación', 'KPIs consolidados y estándares', G.amber],
    ['Gerente', 'Turno, caja y alertas en vivo', G.coral],
    ['Cajero', 'Cobro, cortes y métodos de pago', G.espresso],
    ['Mesero', 'Comandas, mesas y cuentas', G.coral],
    ['Barista', 'Cola de pedidos y modificadores', G.espresso],
    ['Bartender', 'Barra, copeo y cuentas abiertas', G.violet],
    ['Cocina', 'KDS, tiempos y prioridad', G.amber],
    ['Inventario', 'Insumos, merma y pedidos', G.cyan],
  ];
  return (
    <GFrame section="BENEFICIOS PARA OPERACIÓN" page={11} accent={G.coral}>
      <SlideHeadlineDark kicker="Una herramienta para cada rol" title="Cada usuario ve lo que necesita." accent={G.coral}
        subtitle="La misma plataforma muestra a cada persona exactamente la vista que la ayuda a operar mejor." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 50, flex: 1, alignContent: 'center' }}>
        {roles.map(([r, d, c], i) => (
          <div key={i} style={{ padding: '22px 24px', background: G.panel, border: `1px solid ${G.panelBorder}`, borderRadius: 14, borderLeft: `4px solid ${c}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 500, color: G.ink, letterSpacing: -0.4 }}>{r}</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 15, color: G.body, lineHeight: 1.4 }}>{d}</div>
          </div>
        ))}
      </div>
    </GFrame>
  );
}

// ─── S12 · Plataforma en evolución ────────────────────────────
function GS12() {
  const cols = [
    ['HOY', G.gold, 'La base operativa', ['POS', 'Caja', 'Mesas', 'Comandas', 'Cocina', 'Inventario', 'Reportes']],
    ['SIGUIENTE', G.coral, 'Capas que profundizan', ['Recetas avanzadas', 'Compras', 'Multi-sucursal', 'Promociones', 'Integraciones']],
    ['FUTURO', G.violet, 'Inteligencia gastronómica', ['Asistentes de IA', 'Predicción de demanda', 'Alertas de merma', 'Insights ejecutivos']],
  ];
  return (
    <GFrame section="PLATAFORMA EN EVOLUCIÓN" page={12} accent={G.gold}>
      <SlideHeadlineDark kicker="No es un sistema estático" title="Una plataforma viva."
        subtitle="Atlas One Gastro Suite mejora con cada release. Creces dentro del sistema — no migras a otro." />
      <div style={{ display: 'flex', gap: 20, marginTop: 56, flex: 1 }}>
        {cols.map(([stage, c, title, items], i) => (
          <div key={i} style={{ flex: 1, padding: 30, background: i === 2 ? G.bg2 : G.panel, border: `1px solid ${i === 2 ? c + '50' : G.panelBorder}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden' }}>
            {i === 2 && <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${c}50, transparent 70%)`, filter: 'blur(50px)' }} />}
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 14, color: c, letterSpacing: 2, fontWeight: 600 }}>● {stage}</div>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 34, fontWeight: 500, marginTop: 10, letterSpacing: -0.6, lineHeight: 1.1, color: G.ink }}>{title}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, position: 'relative' }}>
              {items.map(it => <span key={it} style={{ padding: '8px 14px', background: i === 2 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)', color: G.body, borderRadius: 999, fontSize: 14 }}>{it}</span>)}
            </div>
          </div>
        ))}
      </div>
    </GFrame>
  );
}

// ─── S13 · IA para dueños ─────────────────────────────────────
function GS13() {
  const qs = [
    ['¿Qué productos tienen baja rentabilidad?', 'Ranking de margen · menú', G.violet],
    ['¿Qué conviene comprar esta semana?', 'Sugerencia de compra · insumos', G.cyan],
    ['¿Dónde hay mermas inusuales?', 'Alerta por sucursal · turno', G.coral],
    ['¿Qué sucursal rinde mejor?', 'Comparativo de unidades', G.gold],
    ['¿Cuáles son mis horas fuertes?', 'Hora pico · staff sugerido', G.amber],
    ['¿Qué mesero o bartender destaca?', 'Desempeño por persona', G.espresso],
  ];
  return (
    <section style={{ width: 1920, height: 1080, background: '#0A0712', color: G.ink, fontFamily: ATLAS_FONT, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -300, left: -200, width: 820, height: 820, borderRadius: '50%', background: `radial-gradient(circle, ${G.violet}45, transparent 62%)`, filter: 'blur(90px)' }} />
      <div style={{ position: 'absolute', bottom: -240, right: -120, width: 620, height: 620, borderRadius: '50%', background: `radial-gradient(circle, ${G.gold}30, transparent 62%)`, filter: 'blur(90px)' }} />
      <div style={{ position: 'absolute', top: 46, left: 64, right: 64, display: 'flex', alignItems: 'center', gap: 18, zIndex: 5 }}>
        <Wordmark color={G.ink} accent="#A78BFA" size={20} />
        <div style={{ width: 1, height: 26, background: G.panelBorder }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: '#9B8FC0', letterSpacing: 1.2, textTransform: 'uppercase' }}>ATLAS IA · PRÓXIMAMENTE</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: '#9B8FC0' }}>13 / {GTOT}</div>
      </div>
      <div style={{ position: 'absolute', inset: '128px 64px 80px', zIndex: 2 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '7px 14px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 999, marginBottom: 22 }}>
          <Icon.sparkles size={16} color="#A78BFA" />
          <span style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: '#C4B5FD', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>IA para dueños y dirección</span>
        </div>
        <h1 style={{ fontFamily: ATLAS_SERIF, fontSize: 80, fontWeight: 500, letterSpacing: -2.4, lineHeight: 1, margin: 0, color: G.ink }}>Mejores señales para decidir.</h1>
        <div style={{ fontFamily: ATLAS_SERIF, fontSize: 27, color: '#C9C0E0', marginTop: 16, letterSpacing: -0.3, maxWidth: 1150, lineHeight: 1.3 }}>
          La IA no reemplaza al operador. Le da claridad sobre rentabilidad, compras, merma y desempeño.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 50 }}>
          {qs.map(([q, h, c], i) => (
            <div key={i} style={{ padding: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, borderLeft: `3px solid ${c}` }}>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 23, color: G.ink, letterSpacing: -0.3, lineHeight: 1.25, fontStyle: 'italic' }}>{q}</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: c, marginTop: 10, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600 }}>↳ {h}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── S14 · Piloto ─────────────────────────────────────────────
function GS14() {
  const steps = [
    ['01', '1 mes de prueba', 'En operación real, sin compromiso.'],
    ['02', 'Una sucursal piloto', 'Validamos operación y adopción.'],
    ['03', 'Configuración inicial', 'Menú, recetas, insumos y roles.'],
    ['04', 'Capacitación operativa', 'Equipo listo en días, no meses.'],
    ['05', 'Evaluación de resultados', 'Reportes y aprendizajes medibles.'],
    ['06', 'Roadmap de escalamiento', 'Plan para llevar al grupo completo.'],
  ];
  return (
    <GFrame section="PILOTO · PRUEBA EN UNA UNIDAD" page={14} accent={G.gold}>
      <SlideHeadlineDark kicker="Para grupos restauranteros" title="Empieza con una unidad. Escala con datos."
        subtitle="Validamos operación, adopción y reportes en una sucursal antes de escalar al grupo completo." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 50, flex: 1, alignContent: 'center' }}>
        {steps.map(([n, t, d], i) => (
          <div key={i} style={{ padding: 28, background: G.panel, border: `1px solid ${G.panelBorder}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 40, fontWeight: 500, color: G.gold, letterSpacing: -1, lineHeight: 1 }}>{n}</div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, fontWeight: 500, color: G.ink, letterSpacing: -0.4, lineHeight: 1.1 }}>{t}</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 15.5, color: G.body, lineHeight: 1.45 }}>{d}</div>
          </div>
        ))}
      </div>
    </GFrame>
  );
}

// ─── S15 · Cierre ─────────────────────────────────────────────
function GS15() {
  return (
    <section style={{ width: 1920, height: 1080, background: G.bg, color: G.ink, fontFamily: ATLAS_FONT, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage:
        `radial-gradient(ellipse at 80% 18%, ${G.gold}30, transparent 52%), radial-gradient(ellipse at 12% 92%, ${G.violet}22, transparent 55%)` }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage:
        'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
      <div style={{ position: 'absolute', top: 52, left: 70, right: 70, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Wordmark color={G.ink} accent={G.gold} size={20} />
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: G.muted, letterSpacing: 1.2 }}>15 / {GTOT}</div>
      </div>
      <div style={{ position: 'absolute', inset: '210px 70px 180px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 17, color: G.gold, letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: 600 }}>Operar · controlar · escalar</div>
        <h1 style={{ fontFamily: ATLAS_SERIF, fontSize: 116, fontWeight: 500, letterSpacing: -4, lineHeight: 0.98, margin: '26px 0 0', color: G.ink }}>
          De la operación diaria<br />a la <em style={{ color: G.gold, fontStyle: 'italic' }}>inteligencia gastronómica.</em>
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 56 }}>
          {['Agendar demo ejecutiva', 'Seleccionar unidad piloto', 'Configurar operación', 'Medir resultados', 'Escalar al grupo'].map((t, i) => (
            <div key={i} style={{ padding: '14px 22px', borderRadius: 999, background: i === 0 ? G.gold : 'transparent', color: i === 0 ? '#0B0A09' : G.ink, border: i === 0 ? 'none' : `1px solid ${G.panelBorder}`, fontWeight: i === 0 ? 700 : 500, fontSize: 17, fontFamily: ATLAS_FONT, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {t}{i === 0 && <Icon.arrowRight size={17} color="#0B0A09" />}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 56, marginTop: 70 }}>
          {[['Contacto comercial', 'ventas@atlas.tech'], ['Web', 'atlas.tech / gastro'], ['WhatsApp', '+52 55 0000 0000']].map(([l, v], i) => (
            <div key={i}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: G.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{l}</div>
              <div style={{ fontSize: 22, marginTop: 6, color: G.ink }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 52, left: 70, right: 70, display: 'flex', alignItems: 'center', fontFamily: ATLAS_MONO, fontSize: 13, color: G.muted, letterSpacing: 0.8 }}>
        <div>ATLAS ONE GASTRO SUITE · RESTAURANT · BAR · CAFÉ</div>
        <div style={{ flex: 1 }} />
        <div>BY ATLAS TECH · 2026</div>
      </div>
    </section>
  );
}

// ─── Mount ────────────────────────────────────────────────────
function GastroDeck() {
  return (
    <deck-stage width="1920" height="1080">
      <GS01 /><GS02 /><GS03 /><GS04 /><GS05 /><GS06 /><GS07 /><GS08 />
      <GS09 /><GS10 /><GS11 /><GS12 /><GS13 /><GS14 /><GS15 />
    </deck-stage>
  );
}

ReactDOM.createRoot(document.getElementById('deck-root')).render(<GastroDeck />);
