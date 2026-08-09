// deck.jsx — The full commercial deck. 25 slides, 1920×1080.

const TOT = 25;

// ─── Slide 01 · Cover ─────────────────────────────────────────
function S01_Cover() {
  return (
    <section style={{
      width: 1920, height: 1080,
      background: '#0A0A0A', color: '#FBFAF6', fontFamily: ATLAS_FONT,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background pattern + gradient */}
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 80% 30%, rgba(96,165,250,0.16), transparent 50%), radial-gradient(circle at 20% 80%, rgba(167,139,250,0.14), transparent 50%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px',
      }} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 50, left: 70, right: 70,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Wordmark color="#FBFAF6" accent="#A78BFA" size={26} />
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 18, color: '#9C9B95', letterSpacing: 1.6, textTransform: 'uppercase' }}>Deck comercial · v7 · noviembre 2026</div>
      </div>

      {/* Big composition */}
      <div style={{ position: 'absolute', inset: '180px 70px 200px', display: 'flex', alignItems: 'center', gap: 80 }}>
        <div style={{ flex: '0 0 980px' }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 24, color: '#A78BFA', letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: 600 }}>Software comercial · 11 presets · 1 plataforma</div>
          <h1 style={{
            fontFamily: ATLAS_SERIF, fontSize: 168, fontWeight: 500,
            letterSpacing: -6, lineHeight: 0.92, margin: '34px 0 0', color: '#FBFAF6',
          }}>
            Atlas <em style={{ color: '#60A5FA', fontStyle: 'italic' }}>One.</em>
          </h1>
          <div style={{
            fontFamily: ATLAS_SERIF, fontSize: 46, fontWeight: 400,
            color: '#C7C2BD', marginTop: 30, letterSpacing: -0.8, lineHeight: 1.15, maxWidth: 880,
          }}>
            Software todo-en-uno para vender, controlar y crecer.
          </div>
          <div style={{ fontFamily: ATLAS_FONT, fontSize: 24, color: '#9C9B95', marginTop: 22, lineHeight: 1.5, maxWidth: 760 }}>
            Punto de venta, caja, inventario, clientes y reportes — configurados según tu tipo de negocio.
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 56 }}>
            <div style={{ padding: '20px 30px', background: '#60A5FA', color: '#0A0A0A', borderRadius: 10, fontWeight: 700, fontSize: 22, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: ATLAS_FONT, letterSpacing: 0.4 }}>
              1 MES GRATIS PARA PROBARLO
            </div>
            <div style={{ padding: '20px 30px', background: 'transparent', color: '#FBFAF6', border: '1.5px solid #3A3A3D', borderRadius: 10, fontWeight: 500, fontSize: 22, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              DESDE $12 MXN AL DÍA
            </div>
          </div>
        </div>

        {/* Floating preset palette */}
        <div style={{ flex: 1, position: 'relative', height: 580 }}>
          <div style={{
            position: 'absolute', right: 0, top: 30,
            display: 'grid', gridTemplateColumns: 'repeat(4, 88px)', gap: 14,
          }}>
            {Object.values(PRESETS).map((p, i) => (
              <div key={i} style={{
                width: 88, height: 88, borderRadius: 16,
                background: p.accent,
                backgroundImage: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`,
                position: 'relative', overflow: 'hidden',
                boxShadow: `0 8px 24px ${p.accent}30`,
                transform: `rotate(${(i % 3 - 1) * 1.5}deg)`,
                display: 'flex', alignItems: 'flex-end', padding: 12,
              }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 14, color: '#FFFFFF', opacity: 0.9, fontWeight: 600, letterSpacing: 0.5 }}>{String(i + 1).padStart(2, '0')}</div>
              </div>
            ))}
          </div>
          <div style={{
            position: 'absolute', right: 380, top: 220,
            padding: 22, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
            backdropFilter: 'blur(20px)', width: 260, transform: 'rotate(-3deg)',
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 14, color: '#A78BFA', letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 600 }}>Una plataforma</div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 30, color: '#FBFAF6', marginTop: 8, letterSpacing: -0.4, lineHeight: 1.1 }}>Once configuraciones</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 15, color: '#9C9B95', marginTop: 10 }}>Mismo ADN visual. Cada giro con su piel.</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 50, left: 70, right: 70,
        display: 'flex', alignItems: 'center', gap: 16, fontFamily: ATLAS_MONO, fontSize: 14, color: '#9C9B95', letterSpacing: 1,
      }}>
        <div>UN SOLO SOFTWARE · CONFIGURADO PARA TU NEGOCIO · PREPARADO PARA EVOLUCIONAR</div>
        <div style={{ flex: 1 }} />
        <div>01 / {TOT}</div>
      </div>
    </section>
  );
}

// ─── Slide 02 · Problema ──────────────────────────────────────
function S02_Problem() {
  return (
    <SlideFrame section="EL PROBLEMA" page={2} total={TOT}>
      <SlideHeadline
        kicker="El problema · operación sin visibilidad"
        title="Muchos negocios venden todos los días."
        subtitle="Pero pocos tienen control real. El problema no es cobrar — es operar sin visibilidad."
        size="lg"
      />
      <div style={{ display: 'flex', gap: 26, marginTop: 64, flex: 1 }}>
        <DeckCard
          kicker="01" icon={Icon.warning} accent="#B43E2E"
          title="Inventario que no cuadra"
          body="Pérdidas, faltantes, robo hormiga y compras a ciegas. El stock real no coincide con el sistema, y el dueño nunca está seguro de cuánto vendió ni cuánto debe reponer."
        />
        <DeckCard
          kicker="02" icon={Icon.cash} accent="#9A6610"
          title="Caja sin trazabilidad"
          body="Cortes confusos, diferencias entre turnos y poca claridad por usuario o sucursal. Nadie sabe exactamente qué pasó ayer entre las 14:00 y las 18:00."
        />
        <DeckCard
          kicker="03" icon={Icon.bars} accent="#5B3FB8"
          title="Crecimiento desordenado"
          body="Más cajas, más sucursales, más personal — pero sin un sistema que acompañe la operación. Cada nueva sucursal añade riesgo en vez de aliviarlo."
        />
      </div>
      <div style={{ marginTop: 48, padding: '24px 32px', background: 'rgba(10,10,10,0.04)', borderRadius: 12, fontFamily: ATLAS_SERIF, fontSize: 26, fontStyle: 'italic', color: '#2A2A28' }}>
        Atlas One ordena la venta diaria y la convierte en datos para decidir mejor.
      </div>
    </SlideFrame>
  );
}

// ─── Slide 03 · Solución ──────────────────────────────────────
function S03_Solution() {
  return (
    <SlideFrame section="LA SOLUCIÓN" page={3} total={TOT}>
      <SlideHeadline
        kicker="Un solo software · configurado para tu operación"
        title="No son varios sistemas separados."
        subtitle="Activamos la experiencia que tu negocio necesita — y solo esa."
      />
      <div style={{ display: 'flex', gap: 20, marginTop: 56, flex: 1, alignItems: 'stretch' }}>
        {[
          { n: '01', title: 'Empieza', body: 'Punto de venta, caja, productos y reportes desde el día uno.', accent: '#2563EB' },
          { n: '02', title: 'Agrega', body: 'Inventario, citas, comisiones, mesas, recetas o compras según tu giro.', accent: '#0F766E' },
          { n: '03', title: 'Crece', body: 'Más cajas, usuarios, sucursales y módulos sin migrar a otro sistema.', accent: '#6D28D9' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: 32, background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 16, position: 'relative' }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 56, fontWeight: 500, color: s.accent, lineHeight: 1, letterSpacing: -2 }}>{s.n}</div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 38, fontWeight: 500, color: '#0A0A0A', letterSpacing: -0.6, lineHeight: 1.1 }}>{s.title}</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 17, color: '#2A2A28', lineHeight: 1.5 }}>{s.body}</div>
            <div style={{ marginTop: 'auto', height: 6, background: s.accent, borderRadius: 3, opacity: 0.85 }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 36, padding: '24px 32px', background: '#0A0A0A', color: '#FBFAF6', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 6, height: 60, background: '#A78BFA', borderRadius: 3 }} />
        <div>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: '#A78BFA', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>La promesa comercial</div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, marginTop: 6, fontStyle: 'italic', letterSpacing: -0.3, lineHeight: 1.2 }}>"Tú operas tu negocio; Atlas One te da control, datos y velocidad desde el día uno."</div>
        </div>
      </div>
    </SlideFrame>
  );
}

// ─── Slide 04 · 1 mes gratis ──────────────────────────────────
function S04_Trial() {
  return (
    <SlideFrame section="PRUEBA · 1 MES GRATIS" page={4} total={TOT} accent="#2563EB">
      <SlideHeadline
        kicker="Prueba antes de cambiar"
        title="Un mes para validar en operación real."
        subtitle="Especial para negocios que ya usan un POS y quieren validar antes de cambiar."
      />

      <div style={{ display: 'flex', gap: 60, marginTop: 60, flex: 1 }}>
        <div style={{ flex: '0 0 680px' }}>
          <BigStat value="1" unit="mes" color="#2563EB" />
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 42, fontWeight: 500, color: '#0A0A0A', marginTop: 24, letterSpacing: -0.8, lineHeight: 1.1 }}>
            gratis para probarlo en operación real.
          </div>
          <div style={{ fontFamily: ATLAS_FONT, fontSize: 18, color: '#2A2A28', marginTop: 22, lineHeight: 1.55, maxWidth: 600 }}>
            No te pedimos que creas en promesas. Te damos un mes para probarlo, compararlo contra tu sistema actual y decidir con calma.
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            ['Comparas velocidad',  'Caja, tickets y flujo de venta en tu mostrador.'],
            ['Validas tu operación', 'Productos, clientes, reportes y la realidad de tu equipo.'],
            ['Decides con calma',    'Sin presión y con acompañamiento de implementación.'],
          ].map(([t, b], i) => (
            <div key={i} style={{ padding: 26, background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 22 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: '#2563EB18', color: '#2563EB', fontFamily: ATLAS_MONO, fontSize: 22, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, fontWeight: 500, color: '#0A0A0A', letterSpacing: -0.4 }}>{t}</div>
                <div style={{ fontFamily: ATLAS_FONT, fontSize: 16, color: '#2A2A28', marginTop: 4, lineHeight: 1.45 }}>{b}</div>
              </div>
              <Icon.arrowRight size={20} color="#6B6B66" />
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}

// ─── Slide 05 · Pricing entry ─────────────────────────────────
function S05_Pricing() {
  return (
    <SlideFrame section="ENTRADA ACCESIBLE" page={5} total={TOT} accent="#0F766E">
      <SlideHeadline
        kicker="Digitalizar tu negocio · desde $12 MXN al día"
        title="Sin inversión pesada. Crece por módulos."
        subtitle="Para negocios sencillos que necesitan vender mejor sin reescribir su operación."
      />
      <div style={{ display: 'flex', gap: 60, marginTop: 50, flex: 1, alignItems: 'center' }}>
        <div style={{ flex: '0 0 720px' }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 20, color: '#6B6B66', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 30, fontWeight: 500 }}>desde</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: ATLAS_SERIF, fontSize: 220, fontWeight: 500, color: '#0F766E', lineHeight: 0.86, letterSpacing: -8 }}>$12</span>
            <div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 24, color: '#0A0A0A', letterSpacing: 1.4, fontWeight: 500 }}>MXN</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 20, color: '#6B6B66', letterSpacing: 1.2, marginTop: 6 }}>AL DÍA</div>
            </div>
          </div>
          <div style={{ fontFamily: ATLAS_FONT, fontSize: 22, color: '#2A2A28', marginTop: 40, lineHeight: 1.55, maxWidth: 640 }}>
            Entrada accesible para negocios que quieren comenzar con POS, caja y control básico. Después activas módulos según necesites — no compras "cajas vacías".
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            ['Sin inversión pesada',  'Empieza con lo esencial y crece por módulos.', Icon.zap, '#0F766E'],
            ['Software en evolución', 'Mejoras continuas, nuevos módulos y roadmap de IA.', Icon.sparkles, '#6D28D9'],
            ['Configuración guiada',  'No compras cajas vacías; preparamos el sistema para tu operación.', Icon.cog, '#0EA5E9'],
          ].map(([t, b, IconCmp, c], i) => (
            <div key={i} style={{ padding: 22, background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 14, display: 'flex', gap: 18, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: `${c}18`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCmp size={22} color={c} />
              </div>
              <div>
                <div style={{ fontFamily: ATLAS_SERIF, fontSize: 22, fontWeight: 500, color: '#0A0A0A', letterSpacing: -0.3 }}>{t}</div>
                <div style={{ fontFamily: ATLAS_FONT, fontSize: 14.5, color: '#2A2A28', marginTop: 4, lineHeight: 1.45 }}>{b}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}

// ─── Slide 06 · Qué incluye ───────────────────────────────────
function S06_WhatsIncluded() {
  const modules = [
    { name: 'Punto de venta',  icon: Icon.cart,     base: true },
    { name: 'Caja y cortes',   icon: Icon.receipt,  base: true },
    { name: 'Productos',       icon: Icon.pkg,      base: true },
    { name: 'Inventario',      icon: Icon.box,      base: true },
    { name: 'Clientes',        icon: Icon.users,    base: true },
    { name: 'Reportes',        icon: Icon.chart,    base: true },
    { name: 'Usuarios',        icon: Icon.user,     base: true },
    { name: 'Sucursales',      icon: Icon.branch,   base: true },
    { name: 'Tickets',         icon: Icon.document, extra: true },
    { name: 'Respaldo en nube',icon: Icon.shield,   extra: true },
    { name: 'Multicaja',       icon: Icon.layers,   extra: true },
    { name: 'Auditoría',       icon: Icon.check,    extra: true },
  ];
  return (
    <SlideFrame section="QUÉ INCLUYE ATLAS ONE" page={6} total={TOT}>
      <SlideHeadline
        kicker="La base · una sola plataforma"
        title="Vender, controlar y entender tu negocio."
        subtitle="Activamos únicamente lo que aporta valor a tu operación inicial. Después puedes crecer sin cambiar de sistema."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginTop: 60, flex: 1 }}>
        {modules.map((m, i) => {
          const IconCmp = m.icon;
          return (
            <div key={i} style={{
              padding: 26, background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 14,
              display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start',
              position: 'relative',
            }}>
              <div style={{ width: 52, height: 52, borderRadius: 11, background: m.base ? '#0A0A0A' : '#F5F2EB', color: m.base ? '#FBFAF6' : '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCmp size={24} color={m.base ? '#FBFAF6' : '#0A0A0A'} />
              </div>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 22, fontWeight: 500, color: '#0A0A0A', letterSpacing: -0.3 }}>{m.name}</div>
              <div style={{ marginTop: 'auto', fontFamily: ATLAS_MONO, fontSize: 11, color: m.base ? '#0A0A0A' : '#6B6B66', letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 500 }}>{m.base ? '● Base' : '○ Adicional'}</div>
            </div>
          );
        })}
      </div>
    </SlideFrame>
  );
}

// ─── Slide 07 · Multiplataforma ───────────────────────────────
function S07_Multiplatform() {
  return (
    <SlideFrame section="OPERACIÓN MULTIPLATAFORMA" page={7} total={TOT}>
      <SlideHeadline
        kicker="Donde trabaja tu negocio"
        title="Móvil, tableta, PC. Lo mismo en cualquier dispositivo."
        subtitle="Multiplataforma, móvil y preparado para operación real desde el día uno."
      />
      <div style={{ display: 'flex', gap: 26, marginTop: 56, flex: 1 }}>
        {[
          { t: 'Móvil, tableta o PC', d: 'Consulta, vende o administra desde diferentes dispositivos.', icon: Icon.phone },
          { t: 'Windows, Mac, Linux', d: 'Compatible con entornos comunes de negocio y equipos existentes.', icon: Icon.cog },
          { t: 'Respaldo en nube',    d: 'Tu información no depende de una sola computadora.', icon: Icon.shield },
          { t: 'Multicaja y multiusuario', d: 'Agrega cajas y usuarios según crezca la operación.', icon: Icon.users },
        ].map((f, i) => {
          const IconCmp = f.icon;
          return (
            <div key={i} style={{ flex: 1, padding: 32, background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ width: 60, height: 60, borderRadius: 14, background: '#0A0A0A', color: '#FBFAF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCmp size={28} color="#FBFAF6" />
              </div>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 30, fontWeight: 500, color: '#0A0A0A', letterSpacing: -0.5, lineHeight: 1.15 }}>{f.t}</div>
              <div style={{ fontFamily: ATLAS_FONT, fontSize: 16, color: '#2A2A28', lineHeight: 1.5 }}>{f.d}</div>
            </div>
          );
        })}
      </div>
    </SlideFrame>
  );
}

// ─── Slide 08 · Configurable por giro ─────────────────────────
function S08_ByVertical() {
  return (
    <SlideFrame section="CONFIGURADO POR GIRO" page={8} total={TOT}>
      <SlideHeadline
        kicker="Un giro · una piel · la misma plataforma"
        title="Una barbería, una ferretería y un restaurante no operan igual."
        subtitle="El software tampoco debería sentirse igual. Por eso Atlas One se adapta a 11 configuraciones — y a las que falten."
      />
      <div style={{ display: 'flex', gap: 20, marginTop: 56, flex: 1 }}>
        {[
          { t: 'Belleza, barberías y uñas',  d: 'Citas, servicios, colaboradores, comisiones, productos y clientes recurrentes.', presets: [PRESETS.barber, PRESETS.beauty] },
          { t: 'Ferreterías, farmacias, refacciones', d: 'Miles de SKUs, unidades de medida, precios por volumen, inventario estricto y stock por sucursal.', presets: [PRESETS.retail] },
          { t: 'Cafeterías, restaurantes, comida', d: 'Venta rápida, comandas, recetas, insumos, turnos, mesas y control de merma.', presets: [PRESETS.restaurant, PRESETS.cafe, PRESETS.bar] },
        ].map((g, i) => (
          <div key={i} style={{ flex: 1, padding: 32, background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {g.presets.map((p, j) => (
                <div key={j} style={{
                  width: 44, height: 44, borderRadius: 10, background: p.accent,
                  backgroundImage: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`,
                  border: '2px solid #FFFFFF', marginLeft: j > 0 ? -14 : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: ATLAS_MONO, fontSize: 11, color: '#FFFFFF', fontWeight: 600,
                }}>{p.name.replace('Atlas One ', '').replace('Atlas ', '')[0]}</div>
              ))}
            </div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, fontWeight: 500, color: '#0A0A0A', letterSpacing: -0.4, lineHeight: 1.15 }}>{g.t}</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 16, color: '#2A2A28', lineHeight: 1.5 }}>{g.d}</div>
            <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.presets.map(p => (
                <span key={p.name} style={{ padding: '5px 10px', background: '#F5F2EB', color: '#0A0A0A', fontFamily: ATLAS_MONO, fontSize: 11, borderRadius: 999, fontWeight: 500 }}>{p.name.replace('Atlas One ', '').replace('Atlas ', '').toUpperCase()}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

Object.assign(window, { S01_Cover, S02_Problem, S03_Solution, S04_Trial, S05_Pricing, S06_WhatsIncluded, S07_Multiplatform, S08_ByVertical });

// ─── Slides 09-19 · 11 PRESETS ────────────────────────────────
// Common template via PresetSlide. Audience/modules/uiItems/benefit come from the PDF.

function S09_POS() {
  return <PresetSlide preset={PRESETS.pos} presetN={1} page={9} total={TOT}
    audience="Negocios pequeños, mostradores, tiendas, servicios y operaciones que necesitan ordenar su venta diaria."
    modules={['Venta rápida', 'Caja y cortes', 'Productos', 'Tickets', 'Clientes', 'Reportes básicos']}
    uiItems={['Pantalla de venta táctil', 'Carrito rápido', 'Corte de caja', 'Ticket profesional']}
    benefit="Empieza sin complicaciones y deja de depender de libretas, Excel o notas sueltas." />;
}
function S10_Retail() {
  return <PresetSlide preset={PRESETS.retail} presetN={2} page={10} total={TOT}
    audience="Ferreterías, farmacias independientes, minisúpers, papelerías, refaccionarias y tiendas de alto flujo."
    modules={['SKUs', 'Código de barras', 'Inventario', 'Precios por nivel', 'Multicaja', 'Sucursales']}
    uiItems={['Buscador por SKU', 'Stock crítico', 'Ajustes autorizados', 'Ventas por departamento']}
    benefit="Reduce pérdidas, detecta faltantes y conoce qué productos realmente mueven el negocio." />;
}
function S11_Barber() {
  return <PresetSlide preset={PRESETS.barber} presetN={3} page={11} total={TOT}
    audience="Barberías con alta recurrencia, varios barberos, servicios premium y venta de productos complementarios."
    modules={['Citas', 'Servicios', 'Comisiones', 'Clientes frecuentes', 'Productos', 'Paquetes']}
    uiItems={['Agenda por barbero', 'Servicios más vendidos', 'Comisiones por corte', 'Historial del cliente']}
    benefit="Mide el rendimiento de cada barbero y convierte cada visita en recurrencia." />;
}
function S12_Beauty() {
  return <PresetSlide preset={PRESETS.beauty} presetN={4} page={12} total={TOT}
    audience="Nail bars, salones de uñas, estéticas, spas, depilación, tratamientos y negocios de bienestar."
    modules={['Agenda', 'Servicios', 'Membresías', 'Comisiones', 'Clientes', 'Venta de productos']}
    uiItems={['Calendario por profesional', 'Paquetes prepagados', 'Ticket servicio + producto', 'Clientas inactivas']}
    benefit="Ordena la agenda, controla ventas por profesional y aumenta la recompra." />;
}
function S13_Health() {
  return <PresetSlide preset={PRESETS.health} presetN={5} page={13} total={TOT}
    audience="Consultorios médicos, dentales, fisioterapia, quiropráctica y servicios profesionales de salud."
    modules={['Citas', 'Pacientes', 'Pagos', 'Servicios', 'Historial básico', 'Reportes']}
    uiItems={['Agenda clínica', 'Ficha del paciente', 'Cobro por consulta', 'Recordatorios']}
    benefit="Mejora la organización del consultorio y evita perder pacientes por falta de seguimiento." />;
}
function S14_Restaurant() {
  return <PresetSlide preset={PRESETS.restaurant} presetN={6} page={14} total={TOT}
    audience="Restaurantes, taquerías, fondas modernas y negocios con atención en mesa o mostrador."
    modules={['Mesas', 'Comandas', 'KDS', 'Caja', 'Recetas', 'Meseros']}
    uiItems={['Plano de mesas', 'Comanda a cocina', 'Cuenta por mesa', 'Ventas por mesero']}
    benefit="Reduce errores de pedido y mejora el control desde el salón hasta la cocina." />;
}
function S15_Cafe() {
  return <PresetSlide preset={PRESETS.cafe} presetN={7} page={15} total={TOT}
    audience="Barras de café, cafeterías de especialidad, panaderías, food counters y conceptos para llevar."
    modules={['Menú visual', 'Combos', 'Recetas', 'Insumos', 'Caja rápida', 'Reportes por horario']}
    uiItems={['POS de barra', 'Modificadores', 'Costo por receta', 'Horas pico']}
    benefit="Acelera la atención y entiende qué productos dejan mejor margen." />;
}
function S16_Bar() {
  return <PresetSlide preset={PRESETS.bar} presetN={8} page={16} total={TOT}
    audience="Bares, cantinas, lounges, cervecerías y negocios con consumo por mesa o barra."
    modules={['Barra', 'Mesas', 'Inventario líquido', 'Turnos', 'Promociones', 'Cortes']}
    uiItems={['Venta por barra', 'Control de botellas', 'Corte por turno', 'Promos por horario']}
    benefit="Mejor control de insumos sensibles y mayor visibilidad de ventas por turno." />;
}
function S17_Services() {
  return <PresetSlide preset={PRESETS.services} presetN={9} page={17} total={TOT}
    audience="Talleres, mantenimiento, servicios técnicos, reparación, instalación y negocios B2B locales."
    modules={['Órdenes de trabajo', 'Cotizaciones', 'Clientes', 'Estatus', 'Pagos', 'Inventario básico']}
    uiItems={['Flujo de orden', 'Cotización rápida', 'Estatus por cliente', 'Servicios pendientes']}
    benefit="Da seguimiento profesional a cada servicio y evita perder trabajos por falta de control." />;
}
function S18_Enterprise() {
  return <PresetSlide preset={PRESETS.enterprise} presetN={10} page={18} total={TOT}
    audience="Negocios con varias sucursales, áreas operativas, reportes ejecutivos e integraciones a la medida."
    modules={['Multi-sucursal', 'RBAC', 'API', 'Reportes ejecutivos', 'Integraciones', 'IA futura']}
    uiItems={['Dashboard directivo', 'Sucursales comparadas', 'Permisos por rol', 'Integraciones']}
    benefit="Crece sin cambiar de sistema: cada módulo adicional se activa sobre la misma plataforma." />;
}
function S19_Custom() {
  return <PresetSlide preset={PRESETS.custom} presetN={11} page={19} total={TOT}
    audience="Operaciones mixtas, modelos especiales, giros no tradicionales o negocios con procesos particulares."
    modules={['Configuración manual', 'Módulos activables', 'Roles', 'Flujos especiales', 'Reportes', 'Integraciones']}
    uiItems={['Mapa de proceso', 'Módulos activos', 'Panel operativo', 'KPIs personalizados']}
    benefit="No obligamos al negocio a adaptarse al software; configuramos el software para que acompañe su forma de trabajar." />;
}

// ─── Slide 20 · Beneficios para dueños ────────────────────────
function S20_Benefits() {
  const benefits = [
    { t: 'Control en tiempo real',  d: 'Ventas, caja, productos y reportes claros · sin esperar al cierre.',     icon: Icon.pulse,   c: '#2563EB' },
    { t: 'Menos pérdidas',          d: 'Mejor seguimiento de inventario, diferencias y movimientos.',           icon: Icon.shield,  c: '#0F766E' },
    { t: 'Mejores decisiones',      d: 'Identifica productos estrella, horarios fuertes y áreas de oportunidad.',icon: Icon.sparkles,c: '#6D28D9' },
    { t: 'Equipo más ordenado',     d: 'Usuarios, roles, cortes y responsabilidades claras.',                   icon: Icon.users,   c: '#0EA5E9' },
    { t: 'Base para crecer',        d: 'Más cajas, sucursales y módulos cuando el negocio lo necesite.',         icon: Icon.layers,  c: '#E2531B' },
    { t: 'Menos dependencia',       d: 'Deja atrás libretas, Excel o información solo en la memoria del encargado.', icon: Icon.zap, c: '#B45309' },
  ];
  return (
    <SlideFrame section="BENEFICIOS PARA EL DUEÑO" page={20} total={TOT}>
      <SlideHeadline
        kicker="Control aunque no estés físicamente en la caja"
        title="Lo que cambia para el dueño del negocio."
        subtitle="Atlas One no solo es POS. Es la diferencia entre suponer y saber."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 56, flex: 1 }}>
        {benefits.map((b, i) => {
          const IconCmp = b.icon;
          return (
            <div key={i} style={{ padding: 28, background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: `${b.c}15`, color: b.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCmp size={22} color={b.c} />
                </div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: b.c, letterSpacing: 0.8, fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</div>
              </div>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 500, color: '#0A0A0A', letterSpacing: -0.4, lineHeight: 1.15 }}>{b.t}</div>
              <div style={{ fontFamily: ATLAS_FONT, fontSize: 15, color: '#2A2A28', lineHeight: 1.5 }}>{b.d}</div>
            </div>
          );
        })}
      </div>
    </SlideFrame>
  );
}

// ─── Slide 21 · Velocidad y operación ─────────────────────────
function S21_Speed() {
  return (
    <SlideFrame section="VELOCIDAD EN OPERACIÓN" page={21} total={TOT} accent="#2563EB">
      <SlideHeadline
        kicker="Más velocidad en mostrador · menos errores"
        title="Atlas One está diseñado para el día a día."
        subtitle="Vender, cobrar, imprimir y controlar. El objetivo: que la operación sea más rápida, clara y medible."
      />
      <div style={{ display: 'flex', gap: 50, marginTop: 56, flex: 1 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
          {[
            'Cobro más rápido en caja, barra o mostrador.',
            'Productos organizados por categoría, SKU o búsqueda.',
            'Tickets profesionales e impresión térmica.',
            'Cortes de caja y ventas por turno o colaborador.',
            'Reportes simples para entender qué está pasando.',
          ].map((line, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 22px', background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2563EB', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon.check size={18} color="#FFFFFF" strokeWidth={2.4} />
              </div>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 22, color: '#0A0A0A', letterSpacing: -0.3, lineHeight: 1.3 }}>{line}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: 'perspective(2000px) rotateY(-8deg) rotateX(1deg)' }}>
            <UIView width={1280} height={800} scale={0.65}>
              <PosTouch />
            </UIView>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

// ─── Slide 22 · Evolución ─────────────────────────────────────
function S22_Evolution() {
  return (
    <SlideFrame section="EVOLUCIÓN CONTINUA" page={22} total={TOT} accent="#6D28D9">
      <SlideHeadline
        kicker="No es una herramienta cerrada · es una plataforma"
        title="Atlas One mejora con cada release."
        subtitle="Cada nuevo módulo se activa cuando tu negocio lo necesita. No cambias de sistema: creces dentro de Atlas One."
      />
      <div style={{ display: 'flex', gap: 24, marginTop: 60, flex: 1 }}>
        {[
          { stage: 'HOY',         color: '#0A0A0A',  items: ['POS', 'Caja', 'Productos', 'Clientes', 'Inventario', 'Reportes'] },
          { stage: 'SIGUIENTE',   color: '#2563EB',  items: ['Citas', 'Compras', 'Comisiones', 'Recetas', 'Mesas', 'Módulos especializados'] },
          { stage: 'FUTURO',      color: '#6D28D9',  items: ['Automatización', 'Integraciones avanzadas', 'Asistentes de IA', 'Insights ejecutivos'] },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: 32, background: i === 2 ? '#0A0A0A' : '#FFFFFF', color: i === 2 ? '#FBFAF6' : '#0A0A0A', border: i === 2 ? 'none' : '1px solid #E8E5DD', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', overflow: 'hidden' }}>
            {i === 2 && (
              <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${s.color}, transparent 70%)`, filter: 'blur(40px)' }} />
            )}
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 14, color: s.color, letterSpacing: 2, fontWeight: 600 }}>● {s.stage}</div>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 38, fontWeight: 500, marginTop: 10, letterSpacing: -0.6, lineHeight: 1.1 }}>
                {i === 0 ? 'La base que vende' : i === 1 ? 'Capas que profundizan' : 'IA práctica para dueños'}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, position: 'relative' }}>
              {s.items.map(it => (
                <span key={it} style={{ padding: '8px 14px', background: i === 2 ? 'rgba(255,255,255,0.08)' : '#F5F2EB', color: i === 2 ? '#FBFAF6' : '#2A2A28', borderRadius: 999, fontSize: 14, fontWeight: 500 }}>{it}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

// ─── Slide 23 · IA próximamente ───────────────────────────────
function S23_AI() {
  return (
    <section style={{
      width: 1920, height: 1080, background: '#08060F', color: '#F0EBFA',
      fontFamily: ATLAS_FONT, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -300, left: -200, width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, #6D28D940, transparent 60%)', filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: -200, right: -100, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #3B82F640, transparent 60%)', filter: 'blur(80px)' }} />

      {/* Header */}
      <div style={{ position: 'absolute', top: 40, left: 60, right: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Wordmark color="#F0EBFA" accent="#A78BFA" size={16} />
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: '#7B6EA8', letterSpacing: 0.8, textTransform: 'uppercase' }}>ATLAS IA · PRÓXIMAMENTE</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: '#7B6EA8' }}>23 / {TOT}</div>
      </div>

      <div style={{ position: 'absolute', inset: '120px 60px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 999, marginBottom: 24 }}>
          <Icon.sparkles size={16} color="#A78BFA" />
          <span style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: '#A78BFA', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Atlas IA · beta privada</span>
        </div>
        <h1 style={{ fontFamily: ATLAS_SERIF, fontSize: 88, fontWeight: 500, letterSpacing: -2.4, lineHeight: 1, margin: 0, color: '#F0EBFA' }}>
          IA útil, no decorativa.
        </h1>
        <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, color: '#C7BEE0', marginTop: 18, letterSpacing: -0.3, maxWidth: 1100, lineHeight: 1.3 }}>
          La inteligencia artificial se integrará como apoyo práctico para entender ventas, inventario y oportunidades. Recomendaciones accionables para mejorar el negocio.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 60 }}>
          {[
            ['¿Qué productos se están vendiendo menos?',         '↓ ventas vs. mes pasado',         '#A78BFA'],
            ['¿Qué día conviene comprar más inventario?',        'Predicción de demanda · 14 días', '#22D3EE'],
            ['¿Qué clientes dejaron de venir?',                  'Lista priorizada · WhatsApp',     '#34D399'],
            ['¿Qué colaborador genera más ventas?',              'Ranking por mes · comisión',      '#FBBF24'],
            ['¿Dónde se están generando pérdidas?',              'Comparativa SKU · sucursal',      '#FB7185'],
            ['¿Qué horario te conviene reforzar staff?',         'Hora pico · sugerencia',          '#A78BFA'],
          ].map(([q, h, c], i) => (
            <div key={i} style={{ padding: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, borderLeft: `3px solid ${c}` }}>
              <div style={{ fontFamily: ATLAS_SERIF, fontSize: 22, color: '#F0EBFA', letterSpacing: -0.3, lineHeight: 1.25, fontStyle: 'italic' }}>{q}</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: c, marginTop: 10, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600 }}>↳ {h}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: 60, right: 60, display: 'flex', alignItems: 'center', fontFamily: ATLAS_MONO, fontSize: 11, color: '#7B6EA8', letterSpacing: 0.6 }}>
        <div>RECOMENDACIONES ACCIONABLES · NO MAGIA · NO DECORACIÓN</div>
        <div style={{ flex: 1 }} />
        <div>atlas.tech · IA</div>
      </div>
    </section>
  );
}

// ─── Slide 24 · Growth path / pricing ─────────────────────────
function S24_Growth() {
  return (
    <SlideFrame section="EMPIEZA CON POS · CRECE CON ATLAS ONE" page={24} total={TOT} accent="#0F766E">
      <SlideHeadline
        kicker="El cliente empieza barato · se queda porque cada mejora es activación, no migración"
        title="Crece dentro del sistema. Sin reinstalar nada."
        subtitle="POS → Inventario → Compras → Citas/Comisiones → Recetas/Mesas → IA · cada paso desbloquea capacidades sin migrar."
      />
      <div style={{ marginTop: 60, flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Path */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '30px 0' }}>
          {[
            { l: 'POS',          c: '#2563EB' },
            { l: 'Inventario',   c: '#0B3A8F' },
            { l: 'Compras',      c: '#0F766E' },
            { l: 'Citas / Comis.', c: '#B16E78' },
            { l: 'Recetas / Mesas', c: '#E2531B' },
            { l: 'IA · Integr.', c: '#6D28D9' },
          ].map((step, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 96, height: 96, borderRadius: 24, background: step.c,
                  backgroundImage: `linear-gradient(135deg, ${step.c}, ${step.c}90)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: ATLAS_MONO, fontSize: 24, color: '#FFFFFF', fontWeight: 700, letterSpacing: 0.5,
                  boxShadow: `0 12px 32px ${step.c}30`,
                }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontFamily: ATLAS_SERIF, fontSize: 22, fontWeight: 500, color: '#0A0A0A', letterSpacing: -0.3, textAlign: 'center', maxWidth: 160 }}>{step.l}</div>
              </div>
              {i < 5 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: -34 }}>
                  <div style={{ width: '100%', height: 2, background: '#D9D5CB', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: -3, right: 0, width: 8, height: 8, borderRadius: 999, background: '#D9D5CB' }} />
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 'auto' }}>
          <div style={{ flex: 1, padding: 32, background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: 14 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: '#2563EB', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>Para negocios sencillos</div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 36, fontWeight: 500, marginTop: 10, letterSpacing: -0.6, color: '#0A0A0A' }}>Desde $12 MXN al día</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 16, color: '#2A2A28', marginTop: 8, lineHeight: 1.5 }}>Para comenzar con lo esencial — POS, caja y control básico — sin inversión pesada.</div>
          </div>
          <div style={{ flex: 1, padding: 32, background: '#0A0A0A', color: '#FBFAF6', borderRadius: 14 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: '#A78BFA', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>Para negocios en crecimiento</div>
            <div style={{ fontFamily: ATLAS_SERIF, fontSize: 36, fontWeight: 500, marginTop: 10, letterSpacing: -0.6 }}>Tantos módulos como necesites</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 16, color: '#C7C2BD', marginTop: 8, lineHeight: 1.5 }}>Más usuarios, cajas, sucursales y módulos según la operación. Cada paso es activación — no migración.</div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

// ─── Slide 25 · CTA / cierre ──────────────────────────────────
function S25_Closing() {
  return (
    <section style={{
      width: 1920, height: 1080, background: '#0A0A0A', color: '#FBFAF6',
      fontFamily: ATLAS_FONT, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 80% 20%, rgba(96,165,250,0.18), transparent 50%), radial-gradient(circle at 20% 90%, rgba(167,139,250,0.12), transparent 50%)` }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div style={{ position: 'absolute', top: 50, left: 70, right: 70, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Wordmark color="#FBFAF6" accent="#A78BFA" size={18} />
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: '#7A7872', letterSpacing: 1.2 }}>25 / {TOT}</div>
      </div>

      <div style={{ position: 'absolute', inset: '180px 70px 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 16, color: '#A78BFA', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Vende mejor · controla más · crece con datos</div>
        <h1 style={{
          fontFamily: ATLAS_SERIF, fontSize: 180, fontWeight: 500,
          letterSpacing: -7, lineHeight: 0.9, margin: '24px 0 0',
        }}>
          Atlas One.
        </h1>
        <div style={{ fontFamily: ATLAS_SERIF, fontSize: 40, fontWeight: 400, color: '#C7C2BD', marginTop: 24, letterSpacing: -0.6, lineHeight: 1.2, maxWidth: 1300 }}>
          Agenda una demo, prueba 1 mes gratis y configura Atlas One para tu tipo de negocio.
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 60, alignItems: 'center' }}>
          <div style={{ padding: '20px 32px', background: '#60A5FA', color: '#0A0A0A', borderRadius: 10, fontWeight: 700, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: ATLAS_FONT, boxShadow: '0 0 40px rgba(96,165,250,0.25)' }}>
            1 MES GRATIS · AGENDA DEMO <Icon.arrowRight size={18} color="#0A0A0A" />
          </div>
          <div style={{ padding: '20px 32px', background: 'transparent', color: '#FBFAF6', border: '1.5px solid #3A3A3D', borderRadius: 10, fontWeight: 500, fontSize: 18 }}>
            DESDE $12 MXN AL DÍA
          </div>
        </div>

        <div style={{ display: 'flex', gap: 50, marginTop: 80, fontFamily: ATLAS_FONT }}>
          <div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: '#7A7872', letterSpacing: 1.2, textTransform: 'uppercase' }}>Contacto comercial</div>
            <div style={{ fontSize: 22, marginTop: 6, color: '#FBFAF6' }}>ventas@atlas.tech</div>
          </div>
          <div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: '#7A7872', letterSpacing: 1.2, textTransform: 'uppercase' }}>Web</div>
            <div style={{ fontSize: 22, marginTop: 6, color: '#FBFAF6' }}>atlas.tech</div>
          </div>
          <div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: '#7A7872', letterSpacing: 1.2, textTransform: 'uppercase' }}>WhatsApp</div>
            <div style={{ fontSize: 22, marginTop: 6, color: '#FBFAF6' }}>+52 55 0000 0000</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 50, left: 70, right: 70, display: 'flex', alignItems: 'center', fontFamily: ATLAS_MONO, fontSize: 13, color: '#7A7872', letterSpacing: 0.6 }}>
        <div>UN SOLO SOFTWARE · CONFIGURADO PARA TU NEGOCIO · PREPARADO PARA EVOLUCIONAR</div>
        <div style={{ flex: 1 }} />
        <div>BY ATLAS TECH · 2026</div>
      </div>
    </section>
  );
}

// ─── Mount the deck ───────────────────────────────────────────
function Deck() {
  return (
    <deck-stage width="1920" height="1080">
      <S01_Cover />
      <S02_Problem />
      <S03_Solution />
      <S04_Trial />
      <S05_Pricing />
      <S06_WhatsIncluded />
      <S07_Multiplatform />
      <S08_ByVertical />
      <S09_POS />
      <S10_Retail />
      <S11_Barber />
      <S12_Beauty />
      <S13_Health />
      <S14_Restaurant />
      <S15_Cafe />
      <S16_Bar />
      <S17_Services />
      <S18_Enterprise />
      <S19_Custom />
      <S20_Benefits />
      <S21_Speed />
      <S22_Evolution />
      <S23_AI />
      <S24_Growth />
      <S25_Closing />
    </deck-stage>
  );
}

ReactDOM.createRoot(document.getElementById('deck-root')).render(<Deck />);
