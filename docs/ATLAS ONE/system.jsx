// system.jsx — Atlas One shared design system
// Tokens, primitives, icons, device frames, sidebar/topbar, shell helpers.
// Light-mode canvas with dark per-preset sidebar.

// ─── TOKENS ───────────────────────────────────────────────────
const ATLAS_FONT = "'IBM Plex Sans', system-ui, sans-serif";
const ATLAS_MONO = "'IBM Plex Mono', ui-monospace, monospace";
const ATLAS_SERIF = "'IBM Plex Serif', Georgia, serif";

// Neutral light-mode canvas (warm off-white)
const N = {
  canvas: '#F6F4EF',     // app outer bg (warm)
  page:   '#FBFAF6',     // page bg inside main area
  card:   '#FFFFFF',     // card surface
  ink:    '#0B0B0B',     // primary text
  body:   '#2A2A28',     // body text
  muted:  '#6B6B66',     // secondary
  faint:  '#9C9B95',     // tertiary
  line:   '#E8E5DD',     // hairline
  line2:  '#D9D5CB',     // stronger hairline
  chip:   '#F2EFE7',     // chip / subtle fill
  // Dark sidebar shades (per-preset gets tinted)
  inkDark: '#0E0E10',
  inkSoft: '#19191C',
};

// Per-preset accent system — each preset has:
//   accent: primary brand color
//   accentSoft: low-saturation surface tint
//   accent2: complementary accent
//   sidebar: { bg, fg, mute, activeBg, accent }  dark navigation rail
//   tint: tinted bg for hero sections
const PRESETS = {
  pos: {
    name: 'Atlas POS',
    tagline: 'Entrada universal',
    description: 'Vender, cobrar y controlar caja desde el día uno.',
    accent: '#2563EB',
    accent2: '#60A5FA',
    accentSoft: '#EEF3FE',
    accentInk: '#1E3A8A',
    tint: '#EDF2FB',
    sidebar: { bg: '#0F1726', fg: '#E6EEFB', mute: '#7C8AA8', activeBg: '#1A2740', accent: '#60A5FA' },
  },
  retail: {
    name: 'Atlas One Retail',
    tagline: 'Inventario que cuadra',
    description: 'Productos, SKU, stock y mostrador para tiendas con inventario exigente.',
    accent: '#0B3A8F',
    accent2: '#06B6D4',
    accentSoft: '#E6F0FB',
    accentInk: '#082A6B',
    tint: '#E8F1FB',
    sidebar: { bg: '#0A1426', fg: '#DCE7F6', mute: '#6E80A0', activeBg: '#102348', accent: '#22D3EE' },
  },
  barber: {
    name: 'Atlas One Barber',
    tagline: 'Silla, navaja y agenda',
    description: 'Agenda por barbero, servicios, comisiones y clientes frecuentes.',
    accent: '#0F766E',      // teal / acero
    accent2: '#22D3B8',
    accentSoft: '#EBF2F1',
    accentInk: '#064E47',
    tint: '#EEF1F0',
    sidebar: { bg: '#0B0B0C', fg: '#E8E6E2', mute: '#7A7872', activeBg: '#171716', accent: '#22D3B8' },
  },
  restaurant: {
    name: 'Atlas One Restaurant',
    tagline: 'Salón, comanda y cocina',
    description: 'Plano de mesas, comandas, KDS y operación por turno.',
    accent: '#E2531B',
    accent2: '#F59E0B',
    accentSoft: '#FBEEE5',
    accentInk: '#8A2C0A',
    tint: '#F8EEE6',
    sidebar: { bg: '#1A0F0A', fg: '#F4E9DF', mute: '#8C7E72', activeBg: '#2A1A11', accent: '#F59E0B' },
  },
  beauty: {
    name: 'Atlas One Beauty',
    tagline: 'Salón, agenda y membresías',
    description: 'Estéticas, uñas, spa y bienestar con alta recurrencia.',
    accent: '#B16E78',
    accent2: '#D9B58C',
    accentSoft: '#F4E8E8',
    accentInk: '#6E3F47',
    tint: '#F6ECE8',
    sidebar: { bg: '#1C1212', fg: '#F2E7E5', mute: '#9D817F', activeBg: '#2A1B1B', accent: '#D9B58C' },
  },
  health: {
    name: 'Atlas One Health',
    tagline: 'Agenda y expediente clínico',
    description: 'Consultorios, citas, pacientes y seguimiento clínico.',
    accent: '#0E9F9C',
    accent2: '#7DD3FC',
    accentSoft: '#E1F5F4',
    accentInk: '#075E5C',
    tint: '#E7F3F2',
    sidebar: { bg: '#0E1F23', fg: '#E1F5F4', mute: '#6E8C8E', activeBg: '#16323A', accent: '#5EEAD4' },
  },
  cafe: {
    name: 'Atlas One Café',
    tagline: 'Barra rápida, recetas, insumos',
    description: 'Cafeterías, panaderías y barras con alta demanda.',
    accent: '#8B4A2B',
    accent2: '#D9A668',
    accentSoft: '#F4E8DB',
    accentInk: '#5A2F18',
    tint: '#F1E5D2',
    sidebar: { bg: '#2A1810', fg: '#F4E8DB', mute: '#A48667', activeBg: '#3D2418', accent: '#D9A668' },
  },
  bar: {
    name: 'Atlas One Bar',
    tagline: 'Barra, mesas, inventario líquido',
    description: 'Bares, cantinas y lounges con control nocturno.',
    accent: '#7C3AED',
    accent2: '#22D3EE',
    accentSoft: '#EFE6FB',
    accentInk: '#4C1D95',
    tint: '#1A0B2E',         // dark mode for bar by default
    sidebar: { bg: '#0A0418', fg: '#E9D8FD', mute: '#7A6BA0', activeBg: '#1A0B2E', accent: '#22D3EE' },
  },
  services: {
    name: 'Atlas One Services',
    tagline: 'Órdenes y seguimiento técnico',
    description: 'Talleres, mantenimiento y servicios técnicos.',
    accent: '#0E7C5C',
    accent2: '#0EA5E9',
    accentSoft: '#E2F1EB',
    accentInk: '#063D2C',
    tint: '#E8F1ED',
    sidebar: { bg: '#0E1614', fg: '#D8E5DF', mute: '#6E8278', activeBg: '#152620', accent: '#34D399' },
  },
  enterprise: {
    name: 'Atlas One Enterprise',
    tagline: 'Multisucursal e integraciones',
    description: 'Operación avanzada, KPIs ejecutivos y módulos a la medida.',
    accent: '#6D28D9',
    accent2: '#3B82F6',
    accentSoft: '#EDE7FA',
    accentInk: '#3D1798',
    tint: '#0E0817',
    sidebar: { bg: '#08060F', fg: '#E2DAFB', mute: '#7B6EA8', activeBg: '#15102A', accent: '#A78BFA' },
  },
  custom: {
    name: 'Atlas One Custom',
    tagline: 'Configuración a la medida',
    description: 'Constructor de módulos para giros con reglas propias.',
    accent: '#0A0A0A',
    accent2: '#A78BFA',
    accentSoft: '#F0EDE5',
    accentInk: '#0A0A0A',
    tint: '#F2EFE7',
    sidebar: { bg: '#0F0F0F', fg: '#E8E5DD', mute: '#7A7872', activeBg: '#1C1C1C', accent: '#A78BFA' },
  },
};

// ─── ICONS ────────────────────────────────────────────────────
// Lucide-style stroke icons, 1.6 stroke, sized at parent fontSize via em.
const I = (path, vb = 24) => ({ size = 18, color = 'currentColor', strokeWidth = 1.6, style = {} } = {}) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    {path}
  </svg>
);

const Icon = {
  home:       I(<><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/></>),
  cart:       I(<><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/><path d="M3 4h2l2.5 11h11l2-8H6"/></>),
  box:        I(<><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></>),
  users:      I(<><circle cx="9" cy="9" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.5"/><path d="M17 13c2.8 0 5 2.2 5 5"/></>),
  user:       I(<><circle cx="12" cy="9" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></>),
  chart:      I(<><path d="M4 20V8M10 20V4M16 20v-8M22 20H2"/></>),
  bars:       I(<><rect x="4" y="11" width="3" height="9"/><rect x="10.5" y="7" width="3" height="13"/><rect x="17" y="14" width="3" height="6"/></>),
  bank:       I(<><path d="M3 9l9-5 9 5M5 9v9M19 9v9M9 9v9M15 9v9M3 20h18"/></>),
  branch:     I(<><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></>),
  calendar:   I(<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></>),
  scissors:   I(<><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4L8.5 16M14.5 10L20 20M8.5 8L13 12.5"/></>),
  table:      I(<><rect x="3" y="6" width="18" height="14" rx="1.5"/><path d="M3 11h18M9 11v9M15 11v9"/></>),
  utensils:   I(<><path d="M5 3v7c0 1.5 1 2.5 2.5 2.5S10 11.5 10 10V3M7.5 12.5V21"/><path d="M17 3c-1.5 0-3 2-3 5s1 4 2 4v9"/></>),
  flame:      I(<><path d="M12 3s4 4 4 9a4 4 0 11-8 0c0-3 2-4 2-4s-1 4 2 4 2-3 0-9z"/></>),
  search:     I(<><circle cx="11" cy="11" r="6.5"/><path d="M21 21l-5-5"/></>),
  bell:       I(<><path d="M6 16V11a6 6 0 1112 0v5l1.5 2H4.5L6 16z"/><path d="M10 21h4"/></>),
  plus:       I(<><path d="M12 5v14M5 12h14"/></>),
  arrowRight: I(<><path d="M5 12h14M13 6l6 6-6 6"/></>),
  arrowUp:    I(<><path d="M12 19V5M6 11l6-6 6 6"/></>),
  arrowDown:  I(<><path d="M12 5v14M6 13l6 6 6-6"/></>),
  cog:        I(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.4H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></>),
  receipt:    I(<><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3z"/><path d="M9 8h6M9 12h6M9 16h4"/></>),
  card:       I(<><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19"/></>),
  cash:       I(<><rect x="2.5" y="6" width="19" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></>),
  qr:         I(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></>),
  printer:    I(<><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M6 17h12v4H6z"/></>),
  fire:       I(<><path d="M12 2c0 4-5 5-5 11a5 5 0 0010 0c0-2-1-3-2-4 0 2-1 3-2 3 1-3-1-7-1-10z"/></>),
  pkg:        I(<><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M16.5 5.2L7.5 9.5M3 7l9 4 9-4M12 11v10"/></>),
  tag:        I(<><path d="M3 12V3h9l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.4"/></>),
  truck:      I(<><rect x="2" y="7" width="11" height="9" rx="1"/><path d="M13 10h5l3 3v3h-8M5 16a2 2 0 104 0M16 16a2 2 0 104 0"/></>),
  warning:    I(<><path d="M12 3l10 17H2L12 3z"/><path d="M12 10v5M12 18v.5"/></>),
  check:      I(<path d="M4 12l5 5 11-12"/>),
  clock:      I(<><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>),
  star:       I(<path d="M12 3l2.7 5.7 6.3.9-4.5 4.4 1 6.3L12 17.3l-5.6 3 1.1-6.3L3 9.6l6.3-.9L12 3z"/>),
  phone:      I(<><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 19h4"/></>),
  more:       I(<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>),
  filter:     I(<><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></>),
  download:   I(<><path d="M12 4v12M6 11l6 6 6-6M4 20h16"/></>),
  document:   I(<><path d="M6 3h8l5 5v13H6V3z"/><path d="M14 3v5h5"/></>),
  sparkles:   I(<><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></>),
  building:   I(<><path d="M3 21V6l7-3v18M10 21V9l11 3v9M3 21h18M14 13v2M14 17v2M17 13v2M17 17v2"/></>),
  beaker:     I(<><path d="M9 3h6M10 3v6L5 19c-.6 1 .2 2 1.4 2h11.2c1.2 0 2-1 1.4-2L14 9V3"/><path d="M7 15h10"/></>),
  heart:      I(<path d="M12 20s-8-5-8-12a4 4 0 017-2 4 4 0 017 2c0 7-8 12-8 12z"/>),
  pulse:      I(<><path d="M3 12h4l2-6 4 12 2-6h6"/></>),
  cross:      I(<><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></>),
  coffee:     I(<><path d="M4 8h13v8a4 4 0 01-4 4H8a4 4 0 01-4-4V8z"/><path d="M17 10h2a2 2 0 010 4h-2"/><path d="M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2"/></>),
  wine:       I(<><path d="M7 3h10c0 5-2 8-5 8s-5-3-5-8z"/><path d="M12 11v8M9 21h6"/></>),
  cocktail:   I(<><path d="M3 4h18l-9 10v6M8 21h8"/></>),
  wrench:     I(<><path d="M15 6a4 4 0 11-1.8 7.6L5 22l-3-3 8.4-8.2A4 4 0 0115 6z"/></>),
  layers:     I(<><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 18l9 5 9-5"/></>),
  shield:     I(<><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/></>),
  zap:        I(<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>),
};

// ─── WORDMARK / ATLAS MARK ────────────────────────────────────
// Geometric mark: an offset square + dot. Reads as "compass / corner stone".
function AtlasMark({ size = 22, color = 'currentColor', accent = null }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke={color} strokeWidth="1.6"/>
      <rect x="8" y="8" width="11.5" height="11.5" rx="2" fill={accent || color}/>
    </svg>
  );
}

function Wordmark({ color = N.ink, accent = null, size = 16, sub = null, mono = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, fontFamily: ATLAS_FONT }}>
      <AtlasMark size={size + 6} color={color} accent={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <div style={{ fontSize: size, fontWeight: 600, letterSpacing: -0.2 }}>
          Atlas<span style={{ fontWeight: 400, opacity: 0.85 }}> One</span>
        </div>
        {sub && (
          <div style={{ fontFamily: ATLAS_MONO, fontSize: size * 0.55, color: 'currentColor', opacity: 0.55, marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── SHELL: SIDEBAR + TOPBAR ──────────────────────────────────
function Sidebar({ preset, active, items, footer, width = 232 }) {
  const sb = preset.sidebar;
  return (
    <aside style={{
      width, flexShrink: 0, background: sb.bg, color: sb.fg,
      display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT,
      padding: '20px 14px 16px',
    }}>
      <div style={{ padding: '4px 6px 22px' }}>
        <Wordmark color={sb.fg} accent={sb.accent} size={15} sub={preset.tagline} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map((it, i) => {
          if (it.header) return (
            <div key={i} style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: sb.mute, padding: '14px 10px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>{it.header}</div>
          );
          const isActive = it.label === active;
          const IconCmp = it.icon;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 7,
              background: isActive ? sb.activeBg : 'transparent',
              color: isActive ? sb.fg : sb.mute,
              fontSize: 13.5, fontWeight: isActive ? 500 : 400,
              position: 'relative',
            }}>
              {isActive && <span style={{ position: 'absolute', left: -14, top: 8, bottom: 8, width: 2, borderRadius: 2, background: sb.accent }} />}
              {IconCmp && <IconCmp size={16} color={isActive ? sb.accent : sb.mute} />}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge != null && (
                <span style={{
                  fontFamily: ATLAS_MONO, fontSize: 10, fontWeight: 500,
                  background: isActive ? sb.accent : 'rgba(255,255,255,0.08)',
                  color: isActive ? sb.bg : sb.mute,
                  padding: '2px 6px', borderRadius: 999, minWidth: 18, textAlign: 'center',
                }}>{it.badge}</span>
              )}
            </div>
          );
        })}
      </div>
      {footer}
    </aside>
  );
}

function SidebarUser({ preset, name, role, branch }) {
  const sb = preset.sidebar;
  return (
    <div style={{
      marginTop: 12, padding: '10px 10px', borderTop: `1px solid ${sb.activeBg}`,
      display: 'flex', alignItems: 'center', gap: 10, fontFamily: ATLAS_FONT,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: sb.accent, color: sb.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 600, fontSize: 12,
      }}>{name.split(' ').map(n => n[0]).slice(0,2).join('')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: sb.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 10.5, color: sb.mute, fontFamily: ATLAS_MONO, letterSpacing: 0.3 }}>{role} · {branch}</div>
      </div>
      <Icon.cog size={14} color={sb.mute} />
    </div>
  );
}

function Topbar({ title, sub, preset, right, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '18px 28px 16px', borderBottom: `1px solid ${N.line}`,
      background: N.card, fontFamily: ATLAS_FONT,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 600, color: N.ink, letterSpacing: -0.2 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: N.muted, marginTop: 2, fontFamily: ATLAS_MONO }}>{sub}</div>}
      </div>
      {children}
      {right}
    </div>
  );
}

function SearchInput({ placeholder = 'Buscar productos, clientes, tickets…', width = 320, preset }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width, padding: '7px 12px',
      border: `1px solid ${N.line}`, borderRadius: 8, background: N.page,
      color: N.muted, fontSize: 13, fontFamily: ATLAS_FONT,
    }}>
      <Icon.search size={15} color={N.muted} />
      <span style={{ flex: 1, color: N.muted }}>{placeholder}</span>
      <span style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.faint, padding: '1px 5px', border: `1px solid ${N.line2}`, borderRadius: 4 }}>⌘ K</span>
    </div>
  );
}

function Button({ label, kind = 'primary', preset, icon: IconCmp, size = 'md' }) {
  const accent = preset?.accent || N.ink;
  const styles = {
    primary: { background: accent, color: '#fff', border: 'none' },
    secondary: { background: N.card, color: N.ink, border: `1px solid ${N.line2}` },
    ghost: { background: 'transparent', color: N.ink, border: 'none' },
    accent: { background: preset?.accentSoft || N.chip, color: preset?.accentInk || N.ink, border: 'none' },
  }[kind];
  const sizing = size === 'sm' ? { padding: '5px 10px', fontSize: 12 } : { padding: '8px 14px', fontSize: 13 };
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, ...styles, ...sizing,
      borderRadius: 7, fontFamily: ATLAS_FONT, fontWeight: 500, lineHeight: 1, cursor: 'pointer',
    }}>
      {IconCmp && <IconCmp size={14} color="currentColor" />}
      {label}
    </button>
  );
}

// ─── CARD ─────────────────────────────────────────────────────
function Card({ children, pad = 18, style = {}, accent = false }) {
  return (
    <div style={{
      background: N.card, border: `1px solid ${N.line}`, borderRadius: 12,
      padding: pad, fontFamily: ATLAS_FONT,
      boxShadow: '0 1px 0 rgba(15,15,15,0.02)',
      ...(accent ? { borderColor: 'transparent', boxShadow: `0 0 0 1px ${N.line}` } : {}),
      ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{children}</div>
      {action && <div style={{ fontSize: 12, color: N.muted, fontFamily: ATLAS_FONT, cursor: 'pointer' }}>{action}</div>}
    </div>
  );
}

// KPI card — large number, label, trend
function Kpi({ label, value, unit, delta, trend = [], accent, sub }) {
  const positive = delta && delta.startsWith('+');
  return (
    <Card pad={18} style={{ minHeight: 132, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11.5, fontFamily: ATLAS_MONO, letterSpacing: 0.8, color: N.muted, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: N.ink, letterSpacing: -0.8, fontFeatureSettings: '"tnum"' }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: N.muted, fontFamily: ATLAS_MONO }}>{unit}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        {sub ? (
          <div style={{ fontSize: 11.5, color: N.muted, fontFamily: ATLAS_MONO }}>{sub}</div>
        ) : (
          delta && <div style={{
            fontSize: 12, fontFamily: ATLAS_MONO, color: positive ? '#0E8A4E' : '#B43E2E',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            {positive ? <Icon.arrowUp size={11} /> : <Icon.arrowDown size={11} />}
            {delta}
          </div>
        )}
        {trend.length > 0 && <Sparkline values={trend} color={accent || N.body} width={70} height={22} />}
      </div>
    </Card>
  );
}

// ─── CHARTS ───────────────────────────────────────────────────
function Sparkline({ values, color = '#0B0B0B', width = 120, height = 32, fill = false }) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return [x, y];
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dFill = `${d} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {fill && <path d={dFill} fill={color} opacity="0.12" />}
      <path d={d} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function BarChart({ data, width = 480, height = 180, color = '#0B0B0B', soft = '#E8E5DD' }) {
  const max = Math.max(...data.map(d => d.value));
  const barW = (width - 20) / data.length - 8;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 36);
        const x = 10 + i * (barW + 8);
        const y = height - 22 - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={d.highlight ? color : soft} />
            <text x={x + barW/2} y={height - 6} fontSize="10" fontFamily={ATLAS_MONO} fill={N.muted} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ series, width = 520, height = 200, color = '#0B0B0B', color2 = '#9C9B95', labels = [] }) {
  // series: [{values:[]}, {values:[]}]
  const all = series.flatMap(s => s.values);
  const min = Math.min(...all), max = Math.max(...all), span = (max - min) || 1;
  const px = (i, n) => 30 + (i / (n - 1)) * (width - 50);
  const py = (v) => (height - 30) - ((v - min) / span) * (height - 50);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line key={i} x1={30} x2={width - 10} y1={height - 30 - t * (height - 50)} y2={height - 30 - t * (height - 50)} stroke={N.line} strokeDasharray="2 3" />
      ))}
      {series.map((s, si) => {
        const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i, s.values.length)},${py(v)}`).join(' ');
        const dFill = `${d} L${px(s.values.length - 1, s.values.length)},${height - 30} L${px(0, s.values.length)},${height - 30} Z`;
        const c = si === 0 ? color : color2;
        return (
          <g key={si}>
            {si === 0 && <path d={dFill} fill={c} opacity="0.08" />}
            <path d={d} stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text key={i} x={px(i, labels.length)} y={height - 10} fontSize="10" fontFamily={ATLAS_MONO} fill={N.muted} textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
}

function Donut({ value = 0.72, label, size = 110, color = '#0B0B0B', track = '#EEEAE0' }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const dash = value * c;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth="7" fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 600, fontFamily: ATLAS_FONT, color: N.ink, fontFeatureSettings: '"tnum"' }}>{Math.round(value * 100)}<span style={{ fontSize: 11, color: N.muted, fontFamily: ATLAS_MONO }}>%</span></div>
        {label && <div style={{ fontSize: 10, color: N.muted, fontFamily: ATLAS_MONO, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>}
      </div>
    </div>
  );
}

// ─── BADGES / PILLS ───────────────────────────────────────────
function Badge({ children, color, soft, dot = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 999, fontSize: 11,
      fontFamily: ATLAS_MONO, fontWeight: 500, letterSpacing: 0.2,
      background: soft || 'rgba(0,0,0,0.04)', color: color || N.body,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: color || N.body }} />}
      {children}
    </span>
  );
}

function Avatar({ name, size = 28, color = '#E8E5DD' }) {
  const initials = name.split(' ').map(n => n[0]).slice(0,2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      color: N.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, fontFamily: ATLAS_FONT, flexShrink: 0,
    }}>{initials}</div>
  );
}

// ─── DEVICE FRAMES ────────────────────────────────────────────
// Generic laptop bezel (16:10 screen). Renders scaled-to-fit content via CSS.
function LaptopFrame({ children, width = 720, accent = '#0B0B0B' }) {
  const h = width * 0.62;
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: '100%', background: '#1c1b18', borderRadius: '14px 14px 4px 4px',
        padding: '10px 10px 12px', position: 'relative',
      }}>
        <div style={{
          background: '#0a0a09', borderRadius: 4, overflow: 'hidden',
          width: '100%', height: h - 22, position: 'relative',
        }}>
          {/* camera */}
          <div style={{ position: 'absolute', left: '50%', top: 4, transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: 999, background: '#000', border: '1px solid #2a2a28', zIndex: 2 }} />
          <div style={{ position: 'absolute', inset: '12px 6px 6px', background: '#fff', borderRadius: 2, overflow: 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
      {/* base */}
      <div style={{ width: '108%', height: 9, background: 'linear-gradient(180deg, #c5c2bb 0%, #8e8b84 100%)', borderRadius: '0 0 9px 9px' }} />
      <div style={{ width: '60px', height: 4, background: '#5a5751', borderRadius: '0 0 4px 4px', marginTop: -1 }} />
    </div>
  );
}

function TabletFrame({ children, width = 580, vertical = false }) {
  // Landscape tablet
  const ratio = vertical ? (4/3) : (3/4);
  const h = width * ratio;
  return (
    <div style={{
      width, height: h, background: '#15140f', borderRadius: 22, padding: 11,
      position: 'relative',
    }}>
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', width: '100%', height: '100%', position: 'relative' }}>
        {children}
      </div>
      {/* camera */}
      {!vertical && <div style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', width: 5, height: 5, borderRadius: 999, background: '#3a3933' }} />}
    </div>
  );
}

function PhoneFrame({ children, width = 280 }) {
  const h = width * (844/390);
  return (
    <div style={{
      width, height: h, background: '#0e0d0a', borderRadius: 34, padding: 8,
      position: 'relative', boxShadow: 'inset 0 0 0 1px #2a2925',
    }}>
      <div style={{ background: '#fff', borderRadius: 28, overflow: 'hidden', width: '100%', height: '100%', position: 'relative' }}>
        {/* dynamic island */}
        <div style={{ position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%)', width: 78, height: 20, borderRadius: 999, background: '#0e0d0a', zIndex: 5 }} />
        {/* status bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 22px 0', fontSize: 11, fontFamily: ATLAS_FONT, fontWeight: 600, color: N.ink, zIndex: 4 }}>
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center', opacity: 0.9 }}>
            <svg width="14" height="9" viewBox="0 0 14 9"><path d="M1 7l2-2 2 2 3-4 5 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/></svg>
            <span style={{ width: 18, height: 9, border: '1px solid currentColor', borderRadius: 2, position: 'relative' }}>
              <span style={{ position: 'absolute', inset: 1, width: '70%', background: 'currentColor', borderRadius: 1 }} />
            </span>
          </span>
        </div>
        <div style={{ paddingTop: 32, height: '100%' }}>{children}</div>
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────
function mxn(n) {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function mxnInt(n) { return '$' + n.toLocaleString('es-MX'); }

function VStack({ gap = 12, children, style }) { return <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>{children}</div>; }
function HStack({ gap = 12, children, style }) { return <div style={{ display: 'flex', flexDirection: 'row', gap, ...style }}>{children}</div>; }

// Tinted background section (used inside hero compositions)
function HeroBg({ preset, children, style }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: preset.tint,
      backgroundImage: `radial-gradient(circle at 20% 0%, ${preset.accent}15, transparent 50%), radial-gradient(circle at 80% 100%, ${preset.accent2}20, transparent 60%)`,
      position: 'relative', overflow: 'hidden', ...style,
    }}>{children}</div>
  );
}

Object.assign(window, {
  ATLAS_FONT, ATLAS_MONO, ATLAS_SERIF,
  N, PRESETS, Icon, AtlasMark, Wordmark,
  Sidebar, SidebarUser, Topbar, SearchInput, Button,
  Card, SectionTitle, Kpi,
  Sparkline, BarChart, LineChart, Donut,
  Badge, Avatar,
  LaptopFrame, TabletFrame, PhoneFrame,
  mxn, mxnInt, VStack, HStack, HeroBg,
});
