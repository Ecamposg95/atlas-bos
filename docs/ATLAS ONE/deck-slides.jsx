// deck-slides.jsx — Shared slide chrome + helpers for the commercial deck.
// Each slide is 1920×1080 with a consistent header/footer.

// Slide frame — common chrome
function SlideFrame({ children, bg = '#FBFAF6', section, page, total = 25, accent = '#0A0A0A', dark = false, style }) {
  const fg = dark ? '#E8E5DD' : '#0A0A0A';
  const muted = dark ? '#7A7872' : '#6B6B66';
  const line = dark ? 'rgba(255,255,255,0.08)' : '#E8E5DD';
  return (
    <section style={{ width: 1920, height: 1080, background: bg, color: fg, fontFamily: ATLAS_FONT, position: 'relative', overflow: 'hidden', ...style }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 44, left: 60, right: 60,
        display: 'flex', alignItems: 'center', gap: 18, zIndex: 5, height: 40,
      }}>
        <Wordmark color={fg} accent={accent} size={22} />
        <div style={{ width: 1, height: 28, background: line }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 14, color: muted, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>{section}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 14, color: muted, letterSpacing: 0.6 }}>
          {String(page).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>
      </div>
      {/* Body */}
      <div style={{ position: 'absolute', inset: '120px 60px 86px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 32, left: 60, right: 60,
        display: 'flex', alignItems: 'center', gap: 16,
        fontFamily: ATLAS_MONO, fontSize: 13, color: muted, letterSpacing: 0.8,
      }}>
        <div>UN SOLO SOFTWARE · CONFIGURADO PARA TU NEGOCIO</div>
        <div style={{ flex: 1 }} />
        <div>atlas.tech · BY ATLAS TECH</div>
      </div>
    </section>
  );
}

// Headline component: serif title with optional accent line
function SlideHeadline({ kicker, title, subtitle, accent = '#0A0A0A', dark = false, size = 'lg' }) {
  const muted = dark ? '#7A7872' : '#6B6B66';
  const body = dark ? '#C7C2BD' : '#2A2A28';
  const fg = dark ? '#E8E5DD' : '#0A0A0A';
  const titleSize = size === 'xl' ? 104 : size === 'lg' ? 76 : 60;
  return (
    <div>
      {kicker && (
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 18, color: accent, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>{kicker}</div>
      )}
      <h1 style={{
        fontFamily: ATLAS_SERIF, fontSize: titleSize, fontWeight: 500,
        letterSpacing: -2, lineHeight: 1.02, margin: 0, color: fg,
      }}>{title}</h1>
      {subtitle && (
        <div style={{ fontFamily: ATLAS_SERIF, fontSize: 30, fontWeight: 400, color: body, marginTop: 20, letterSpacing: -0.4, lineHeight: 1.25, maxWidth: 1100 }}>{subtitle}</div>
      )}
    </div>
  );
}

// Big stat — useful for the trial / pricing slides
function BigStat({ value, unit, label, color = '#0A0A0A' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontFamily: ATLAS_SERIF, fontSize: 180, fontWeight: 500, color, lineHeight: 0.9, letterSpacing: -6 }}>{value}</span>
      {unit && <span style={{ fontFamily: ATLAS_MONO, fontSize: 22, color, letterSpacing: 1, textTransform: 'uppercase' }}>{unit}</span>}
      {label && <span style={{ fontFamily: ATLAS_FONT, fontSize: 22, color: '#6B6B66', marginLeft: 14 }}>{label}</span>}
    </div>
  );
}

// Card with kicker + title + body
function DeckCard({ kicker, title, body, accent = '#0A0A0A', icon: IconCmp, dark = false }) {
  const bg = dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF';
  const border = dark ? 'rgba(255,255,255,0.08)' : '#E8E5DD';
  const titleC = dark ? '#E8E5DD' : '#0A0A0A';
  const bodyC = dark ? '#C7C2BD' : '#2A2A28';
  return (
    <div style={{
      flex: 1, background: bg, border: `1px solid ${border}`,
      borderRadius: 16, padding: 32,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {IconCmp && (
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCmp size={24} color={accent} />
        </div>
      )}
      {kicker && <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: accent, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>{kicker}</div>}
      <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, fontWeight: 500, color: titleC, letterSpacing: -0.5, lineHeight: 1.15 }}>{title}</div>
      <div style={{ fontFamily: ATLAS_FONT, fontSize: 16, color: bodyC, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

// Inline chip / pill — for modules listing in preset slides
function Chip({ label, accent = '#0A0A0A' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', background: `${accent}10`, color: accent,
      borderRadius: 999, fontSize: 14, fontWeight: 500,
    }}>{label}</span>
  );
}

// Mini UI viewer — scales an existing desktop component into a card frame
function UIView({ children, width = 1440, height = 900, scale = 0.65, frame = true }) {
  return (
    <div style={{
      width: width * scale, height: height * scale,
      border: frame ? '1px solid #D9D5CB' : 'none',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: frame ? '0 30px 80px rgba(15,15,15,0.18)' : 'none',
      background: '#FFF',
    }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

// Preset slide template (used by slides 9-19)
function PresetSlide({ preset, presetN, page, total, modules, audience, uiItems, benefit, slideComp }) {
  const p = preset;
  const dark = ['bar', 'enterprise'].some(k => PRESETS[k] === preset);

  // Choose visual based on preset key
  const slideKey = Object.keys(PRESETS).find(k => PRESETS[k] === preset);
  const Desktop = {
    pos: PosDesktop, retail: RetailDesktop, barber: BarberDesktop,
    beauty: BeautyDesktop, health: HealthDesktop, restaurant: RestaurantDesktop,
    cafe: CafeDesktop, bar: BarDesktop, services: ServicesDesktop,
    enterprise: EnterpriseDesktop, custom: CustomDesktop,
  }[slideKey];

  const bg = dark ? '#08060F' : p.tint || '#F5F1EC';
  const fg = dark ? '#E8E5DD' : '#0A0A0A';
  const body = dark ? '#C7C2BD' : '#2A2A28';
  const muted = dark ? '#7A7872' : '#6B6B66';

  return (
    <SlideFrame
      bg={bg} accent={p.accent2 || p.accent} dark={dark}
      section={`${p.name.toUpperCase()} · PRESET ${String(presetN).padStart(2, '0')}`}
      page={page} total={total}
      style={{
        backgroundImage: dark
          ? `radial-gradient(circle at 100% 0%, ${p.accent}30, transparent 50%), radial-gradient(circle at 0% 100%, ${p.accent2}25, transparent 55%)`
          : `radial-gradient(circle at 100% 0%, ${p.accent}15, transparent 50%), radial-gradient(circle at 0% 100%, ${p.accent2}25, transparent 55%)`,
      }}
    >
      <div style={{ display: 'flex', gap: 60, flex: 1, paddingTop: 30 }}>
        {/* Left column · copy */}
        <div style={{ flex: '0 0 740px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <span style={{ padding: '6px 12px', background: p.accent2 || p.accent, color: dark ? '#0A0A0A' : '#FFFFFF', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 600, letterSpacing: 0.6 }}>PRESET {String(presetN).padStart(2, '0')}</span>
            <span style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{p.tagline}</span>
          </div>

          <h1 style={{
            fontFamily: ATLAS_SERIF, fontSize: 96, fontWeight: 500,
            letterSpacing: -3, lineHeight: 0.98, margin: 0, color: fg,
          }}>
            {p.name.replace('Atlas One ', '').replace('Atlas ', '')}
          </h1>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 24, color: body, marginTop: 14, fontStyle: 'italic', letterSpacing: -0.3 }}>
            <span style={{ color: muted, fontStyle: 'normal', fontFamily: ATLAS_FONT, fontSize: 18 }}>Atlas One </span>
            <span style={{ color: p.accent2 || p.accent }}>{p.name.replace('Atlas One ', '').replace('Atlas ', '')}</span>
          </div>

          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 30, fontWeight: 400, color: body, marginTop: 32, letterSpacing: -0.5, lineHeight: 1.2, maxWidth: 680 }}>{p.description}</div>

          <div style={{ marginTop: 36 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>Para quién es</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 17, color: body, lineHeight: 1.5, maxWidth: 680 }}>{audience}</div>
          </div>

          <div style={{ marginTop: 26 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>Módulos que se activan según la operación</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {modules.map((m, i) => <Chip key={i} label={m} accent={p.accent2 || p.accent} />)}
            </div>
          </div>

          <div style={{
            marginTop: 'auto', paddingTop: 26,
            padding: '20px 24px',
            background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : `${p.accent}30`}`,
            borderRadius: 14, borderLeft: `4px solid ${p.accent2 || p.accent}`,
            marginRight: 40,
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2 || p.accent, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>Beneficio para el dueño</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 18, color: fg, marginTop: 6, lineHeight: 1.4 }}>{benefit}</div>
          </div>
        </div>

        {/* Right column · UI mockup */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'relative',
            transform: 'perspective(2200px) rotateY(-6deg) rotateX(1.5deg)',
            transformStyle: 'preserve-3d',
          }}>
            <UIView width={1440} height={900} scale={0.66}>
              {Desktop && <Desktop />}
            </UIView>
          </div>

          {/* UI items overlay */}
          {uiItems && (
            <div style={{
              position: 'absolute', bottom: -20, right: -30, width: 320,
              padding: 20, background: dark ? '#0F0B1F' : '#FFFFFF',
              borderRadius: 14, border: `1.5px solid ${p.accent2 || p.accent}`,
              boxShadow: `0 20px 50px ${p.accent2 || p.accent}30`,
              transform: 'rotate(-2deg)',
            }}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent2 || p.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>UI especializada</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {uiItems.map((u, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: p.accent2 || p.accent }} />
                    <span style={{ fontFamily: ATLAS_FONT, fontSize: 14, color: dark ? '#E8E5DD' : '#2A2A28' }}>{u}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </SlideFrame>
  );
}

Object.assign(window, {
  SlideFrame, SlideHeadline, BigStat, DeckCard, Chip, UIView, PresetSlide,
});
