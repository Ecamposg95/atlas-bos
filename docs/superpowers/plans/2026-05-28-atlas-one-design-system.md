# SP-0 · Atlas One Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Atlas One design system from the sandbox (`C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\system.jsx`) to `atlas-bos` as a new component layer (`frontend/src/components/atlas-one/*`) that coexists with the existing Tailwind+DaxCard system without replacing it.

**Architecture:** All new primitives live under `frontend/src/components/atlas-one/`. Tokens (palette `N`, `PRESETS`) are TypeScript constants in `tokens.ts`. CSS variables and IBM Plex font import live in `frontend/src/styles/atlas-one.css`. The existing `frontend/src/components/layout/Sidebar.tsx`, `DaxCard`, `KPICard v1/v2` remain untouched. Components are ported as faithful TypeScript ports of the sandbox JSX, using inline styles (matches sandbox idiom) and `data-preset` CSS vars where applicable.

**Tech Stack:** React 18 + Vite 5 + TypeScript 5.3 + IBM Plex (Google Fonts). No new dependencies. Existing Recharts/Chart.js libraries are NOT used — Atlas One charts are SVG inline.

**Spec:** `docs/superpowers/specs/2026-05-28-atlas-one-design-system-design.md`

---

## File Structure

### New files created
```
frontend/src/styles/atlas-one.css                       # CSS vars + IBM Plex import
frontend/src/components/atlas-one/
├── index.ts                                            # barrel export
├── tokens.ts                                           # N, PRESETS, INDUSTRY_TYPE_TO_PRESET
├── utils.ts                                            # mxn, mxnInt helpers
├── icons/iconLib.tsx                                   # 52 icons in one file
├── Card.tsx
├── SectionTitle.tsx
├── Badge.tsx
├── Avatar.tsx
├── Button.tsx
├── SearchInput.tsx
├── Topbar.tsx
├── SidebarUser.tsx
├── Sidebar.tsx
├── AtlasMark.tsx
├── Wordmark.tsx
├── Kpi.tsx
├── charts/Sparkline.tsx
├── charts/BarChart.tsx
├── charts/LineChart.tsx
├── charts/Donut.tsx
├── frames/LaptopFrame.tsx
├── frames/TabletFrame.tsx
└── frames/PhoneFrame.tsx
frontend/src/pages/__dev__/AtlasOnePreview.tsx          # dev-only preview route
```

### Existing files modified
```
frontend/src/index.css                                  # add IBM Plex font-family on body, reconcile preset accent hex
frontend/src/main.tsx                                   # import atlas-one.css
frontend/src/App.tsx                                    # add dev-only /__dev__/atlas-one-preview route
frontend/index.html                                     # add IBM Plex stylesheet link
```

### Commit cadence
One commit per task. Conventional commit format: `feat(atlas-one): <task summary>`.

---

## Task 1: CSS variables + IBM Plex font import

**Files:**
- Create: `frontend/src/styles/atlas-one.css`
- Modify: `frontend/index.html`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/src/styles/atlas-one.css`**

```css
/* Atlas One design tokens
 * Source of truth: C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\system.jsx
 */

:root {
  /* Warm canvas neutrals */
  --ao-canvas:   #F6F4EF;
  --ao-page:     #FBFAF6;
  --ao-card:     #FFFFFF;
  --ao-ink:      #0B0B0B;
  --ao-body:     #2A2A28;
  --ao-muted:    #6B6B66;
  --ao-faint:    #9C9B95;
  --ao-line:     #E8E5DD;
  --ao-line2:    #D9D5CB;
  --ao-chip:     #F2EFE7;
  --ao-ink-dark: #0E0E10;
  --ao-ink-soft: #19191C;

  /* Typography */
  --ao-font-sans:  'IBM Plex Sans', 'Montserrat', system-ui, -apple-system, sans-serif;
  --ao-font-mono:  'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace;
  --ao-font-serif: 'IBM Plex Serif', Georgia, serif;
}
```

- [ ] **Step 2: Add IBM Plex preconnect + stylesheet to `frontend/index.html`**

Insert these lines AFTER line 12 (the JetBrains Mono link), BEFORE the FontAwesome link:

```html
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Serif:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Note: `<link rel="preconnect" href="https://fonts.googleapis.com">` already exists at line 9 — reuse it.

- [ ] **Step 3: Import `atlas-one.css` in `frontend/src/main.tsx`**

Add this import line near the top, after the existing CSS imports (typically `import './index.css'`):

```typescript
import './styles/atlas-one.css';
```

- [ ] **Step 4: Verify build passes**

Run: `cd frontend && npm run build`
Expected: build succeeds, no new errors. CSS file is included in the bundle.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/atlas-one.css frontend/index.html frontend/src/main.tsx
git commit -m "feat(atlas-one): add CSS tokens + IBM Plex font import"
```

---

## Task 2: tokens.ts (N + PRESETS + INDUSTRY_TYPE_TO_PRESET)

**Files:**
- Create: `frontend/src/components/atlas-one/tokens.ts`

- [ ] **Step 1: Create `frontend/src/components/atlas-one/tokens.ts`**

Port literal from sandbox `system.jsx` lines 11-25 (N) and 33-155 (PRESETS). Type as TypeScript.

```typescript
/**
 * Atlas One design tokens
 * Source: C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\system.jsx (lines 11-155)
 */

export const ATLAS_FONT = "'IBM Plex Sans', system-ui, sans-serif";
export const ATLAS_MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const ATLAS_SERIF = "'IBM Plex Serif', Georgia, serif";

// Neutral light-mode canvas (warm off-white)
export const N = {
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
  inkDark: '#0E0E10',
  inkSoft: '#19191C',
} as const;

export interface PresetSidebar {
  bg: string;
  fg: string;
  mute: string;
  activeBg: string;
  accent: string;
}

export interface PresetConfig {
  name: string;
  tagline: string;
  description: string;
  accent: string;
  accent2: string;
  accentSoft: string;
  accentInk: string;
  tint: string;
  sidebar: PresetSidebar;
}

export const PRESETS: Record<string, PresetConfig> = {
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
    accent: '#0F766E',
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
  beauty_wellness: {
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
    tint: '#1A0B2E',
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

export type PresetKey = keyof typeof PRESETS;

/**
 * Maps backend IndustryType enum values to PRESETS keys.
 * Legacy values (ATLAS_ONE_BEAUTY, ATLAS_ONE_GASTRO) map to v2 equivalents.
 */
export const INDUSTRY_TYPE_TO_PRESET: Record<string, PresetKey> = {
  ATLAS_POS: 'pos',
  ATLAS_ONE_RETAIL: 'retail',
  ATLAS_ONE_BARBER: 'barber',
  ATLAS_ONE_BEAUTY_WELLNESS: 'beauty_wellness',
  ATLAS_ONE_HEALTH: 'health',
  ATLAS_ONE_RESTAURANT: 'restaurant',
  ATLAS_ONE_CAFE: 'cafe',
  ATLAS_ONE_BAR: 'bar',
  ATLAS_ONE_SERVICES: 'services',
  ATLAS_ONE_ENTERPRISE: 'enterprise',
  CUSTOM: 'custom',
  // Legacy taxonomy v1
  ATLAS_ONE_BEAUTY: 'beauty_wellness',
  ATLAS_ONE_GASTRO: 'restaurant',
};

export function presetFor(industryType: string | null | undefined): PresetConfig {
  if (!industryType) return PRESETS.pos;
  const key = INDUSTRY_TYPE_TO_PRESET[industryType];
  return PRESETS[key] || PRESETS.pos;
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/atlas-one/tokens.ts
git commit -m "feat(atlas-one): tokens (N, PRESETS, INDUSTRY_TYPE_TO_PRESET)"
```

---

## Task 3: utils.ts (currency helpers)

**Files:**
- Create: `frontend/src/components/atlas-one/utils.ts`

- [ ] **Step 1: Create `frontend/src/components/atlas-one/utils.ts`**

```typescript
/**
 * Atlas One formatting helpers
 * Source: C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\system.jsx (lines 602-608)
 */

export function mxn(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function mxnInt(n: number): string {
  return '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/atlas-one/utils.ts
git commit -m "feat(atlas-one): currency formatting helpers"
```

---

## Task 4: Reconcile preset accent colors in index.css

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Locate the `[data-preset="ATLAS_ONE_*"]` blocks**

Open `frontend/src/index.css`. Find each `:root[data-preset="ATLAS_ONE_..."]` selector (approx lines 95-189). For each preset, the `--p-accent` value needs to match `PRESETS[key].accent` from `tokens.ts`.

- [ ] **Step 2: Update each `--p-accent` value**

Apply these exact replacements:

| Selector | Current `--p-accent` | New `--p-accent` |
|---|---|---|
| `:root[data-preset="ATLAS_POS"]` | (whatever exists) | `#2563EB` |
| `:root[data-preset="ATLAS_ONE_RETAIL"]` | `#2563eb` (or similar) | `#0B3A8F` |
| `:root[data-preset="ATLAS_ONE_BARBER"]` | `#0891b2` | `#0F766E` |
| `:root[data-preset="ATLAS_ONE_BEAUTY_WELLNESS"]` | `#ec4899` | `#B16E78` |
| `:root[data-preset="ATLAS_ONE_HEALTH"]` | `#06b6d4` | `#0E9F9C` |
| `:root[data-preset="ATLAS_ONE_RESTAURANT"]` | `#f97316` | `#E2531B` |
| `:root[data-preset="ATLAS_ONE_CAFE"]` | `#d97706` | `#8B4A2B` |
| `:root[data-preset="ATLAS_ONE_BAR"]` | `#7c3aed` | `#7C3AED` (no change, normalize case) |
| `:root[data-preset="ATLAS_ONE_SERVICES"]` | `#10b981` | `#0E7C5C` |
| `:root[data-preset="ATLAS_ONE_ENTERPRISE"]` | `#a855f7` | `#6D28D9` |
| `:root[data-preset="CUSTOM"]` | (default) | `#0A0A0A` |
| Legacy `ATLAS_ONE_BEAUTY` (if present) | — | `#B16E78` |
| Legacy `ATLAS_ONE_GASTRO` (if present) | — | `#E2531B` |

If the file declares `--p-accent-hover`, `--p-accent-soft`, `--p-accent-line` derived from `--p-accent`, leave those formulas intact — they'll inherit the new accent automatically. If they're hardcoded hex, leave them as-is for now (a future polish task can re-derive them from the new accent).

- [ ] **Step 3: Run build to verify CSS parses**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Smoke check**

Start dev server: `cd frontend && npm run dev`
Open `localhost:5173`, log in as any preset-aware demo org, navigate to a preset-aware page (e.g., `/home`). Verify the accent color reflects the new value (Barber should now look teal, not cyan; Beauty should look dusty rose, not bright pink; etc.).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(atlas-one): reconcile preset accent hex with sandbox truth"
```

---

## Task 5: Icon library (52 icons in one file)

**Files:**
- Create: `frontend/src/components/atlas-one/icons/iconLib.tsx`

- [ ] **Step 1: Create `frontend/src/components/atlas-one/icons/iconLib.tsx`**

Port literal from sandbox `system.jsx` lines 159-218. Convert JS factory to typed React components.

```typescript
import React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/**
 * Internal factory for stroke icons (lucide-style, 1.6 stroke, 24×24 viewBox).
 * Source: C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\system.jsx (lines 159-163)
 */
const I = (path: React.ReactNode, vb = 24) =>
  ({ size = 18, color = 'currentColor', strokeWidth = 1.6, style = {} }: IconProps = {}) => (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vb} ${vb}`}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      {path}
    </svg>
  );

export const Icon = {
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

export type IconKey = keyof typeof Icon;
export type IconComponent = (props?: IconProps) => JSX.Element;
```

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/atlas-one/icons/iconLib.tsx
git commit -m "feat(atlas-one): 52 lucide-style icons in iconLib"
```

---

## Task 6: AtlasMark + Wordmark

**Files:**
- Create: `frontend/src/components/atlas-one/AtlasMark.tsx`
- Create: `frontend/src/components/atlas-one/Wordmark.tsx`

- [ ] **Step 1: Create `AtlasMark.tsx`**

Port from sandbox `system.jsx` lines 222-229.

```typescript
import React from 'react';

interface AtlasMarkProps {
  size?: number;
  color?: string;
  accent?: string | null;
}

export function AtlasMark({ size = 22, color = 'currentColor', accent = null }: AtlasMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke={color} strokeWidth="1.6"/>
      <rect x="8" y="8" width="11.5" height="11.5" rx="2" fill={accent || color}/>
    </svg>
  );
}
```

- [ ] **Step 2: Create `Wordmark.tsx`**

Port from sandbox `system.jsx` lines 231-247. The Wordmark = AtlasMark + name + optional subtitle/tagline.

```typescript
import React from 'react';
import { AtlasMark } from './AtlasMark';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';

interface WordmarkProps {
  color?: string;
  accent?: string | null;
  size?: number;
  sub?: string | null;
  mono?: boolean;
}

export function Wordmark({ color = N.ink, accent = null, size = 16, sub = null, mono = false }: WordmarkProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <AtlasMark size={size * 1.3} color={color} accent={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontFamily: mono ? ATLAS_MONO : ATLAS_FONT,
          fontSize: size,
          fontWeight: 600,
          color,
          letterSpacing: -0.2,
        }}>Atlas One</span>
        {sub && (
          <span style={{
            fontFamily: ATLAS_MONO,
            fontSize: size * 0.65,
            color: accent || color,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginTop: 3,
            opacity: 0.85,
          }}>{sub}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/AtlasMark.tsx frontend/src/components/atlas-one/Wordmark.tsx
git commit -m "feat(atlas-one): AtlasMark + Wordmark"
```

---

## Task 7: Card + SectionTitle

**Files:**
- Create: `frontend/src/components/atlas-one/Card.tsx`
- Create: `frontend/src/components/atlas-one/SectionTitle.tsx`

- [ ] **Step 1: Create `Card.tsx`**

Port from sandbox `system.jsx` lines 369-379.

```typescript
import React from 'react';
import { ATLAS_FONT, N } from './tokens';

interface CardProps {
  children: React.ReactNode;
  pad?: number;
  style?: React.CSSProperties;
  accent?: boolean;
}

export function Card({ children, pad = 18, style = {}, accent = false }: CardProps) {
  return (
    <div style={{
      background: N.card,
      border: `1px solid ${N.line}`,
      borderRadius: 12,
      padding: pad,
      fontFamily: ATLAS_FONT,
      boxShadow: '0 1px 0 rgba(15,15,15,0.02)',
      ...(accent ? { borderColor: 'transparent', boxShadow: `0 0 0 1px ${N.line}` } : {}),
      ...style,
    }}>{children}</div>
  );
}
```

- [ ] **Step 2: Create `SectionTitle.tsx`**

Port from sandbox `system.jsx` lines 381-388.

```typescript
import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';

interface SectionTitleProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionTitle({ children, action }: SectionTitleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{children}</div>
      {action && <div style={{ fontSize: 12, color: N.muted, fontFamily: ATLAS_FONT, cursor: 'pointer' }}>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/Card.tsx frontend/src/components/atlas-one/SectionTitle.tsx
git commit -m "feat(atlas-one): Card + SectionTitle"
```

---

## Task 8: Badge + Avatar

**Files:**
- Create: `frontend/src/components/atlas-one/Badge.tsx`
- Create: `frontend/src/components/atlas-one/Avatar.tsx`

- [ ] **Step 1: Create `Badge.tsx`**

Port from sandbox `system.jsx` lines 504-516.

```typescript
import React from 'react';
import { ATLAS_MONO, N } from './tokens';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  soft?: string;
  dot?: boolean;
}

export function Badge({ children, color, soft, dot = false }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontFamily: ATLAS_MONO,
      fontWeight: 500,
      letterSpacing: 0.2,
      background: soft || 'rgba(0,0,0,0.04)',
      color: color || N.body,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: color || N.body }} />}
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Create `Avatar.tsx`**

Port from sandbox `system.jsx` lines 518-527.

```typescript
import React from 'react';
import { ATLAS_FONT, N } from './tokens';

interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
}

export function Avatar({ name, size = 28, color = '#E8E5DD' }: AvatarProps) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      color: N.ink,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.36,
      fontWeight: 600,
      fontFamily: ATLAS_FONT,
      flexShrink: 0,
    }}>{initials}</div>
  );
}
```

- [ ] **Step 3: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/Badge.tsx frontend/src/components/atlas-one/Avatar.tsx
git commit -m "feat(atlas-one): Badge + Avatar"
```

---

## Task 9: Button + SearchInput

**Files:**
- Create: `frontend/src/components/atlas-one/Button.tsx`
- Create: `frontend/src/components/atlas-one/SearchInput.tsx`

- [ ] **Step 1: Create `Button.tsx`**

Port from sandbox `system.jsx` lines 348-366.

```typescript
import React from 'react';
import { ATLAS_FONT, N, PresetConfig } from './tokens';
import type { IconComponent } from './icons/iconLib';

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'accent';
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  label: string;
  kind?: ButtonKind;
  preset?: PresetConfig;
  icon?: IconComponent;
  size?: ButtonSize;
  onClick?: () => void;
}

export function Button({ label, kind = 'primary', preset, icon: IconCmp, size = 'md', onClick }: ButtonProps) {
  const accent = preset?.accent || N.ink;
  const styles: Record<ButtonKind, React.CSSProperties> = {
    primary:   { background: accent, color: '#fff', border: 'none' },
    secondary: { background: N.card, color: N.ink, border: `1px solid ${N.line2}` },
    ghost:     { background: 'transparent', color: N.ink, border: 'none' },
    accent:    { background: preset?.accentSoft || N.chip, color: preset?.accentInk || N.ink, border: 'none' },
  };
  const sizing: React.CSSProperties = size === 'sm'
    ? { padding: '5px 10px', fontSize: 12 }
    : { padding: '8px 14px', fontSize: 13 };
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        ...styles[kind],
        ...sizing,
        borderRadius: 7,
        fontFamily: ATLAS_FONT,
        fontWeight: 500,
        lineHeight: 1,
        cursor: 'pointer',
      }}>
      {IconCmp && <IconCmp size={14} color="currentColor" />}
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Create `SearchInput.tsx`**

Port from sandbox `system.jsx` lines 333-346.

```typescript
import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';
import { Icon } from './icons/iconLib';

interface SearchInputProps {
  placeholder?: string;
  width?: number;
}

export function SearchInput({
  placeholder = 'Buscar productos, clientes, tickets…',
  width = 320,
}: SearchInputProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width,
      padding: '7px 12px',
      border: `1px solid ${N.line}`,
      borderRadius: 8,
      background: N.page,
      color: N.muted,
      fontSize: 13,
      fontFamily: ATLAS_FONT,
    }}>
      <Icon.search size={15} color={N.muted} />
      <span style={{ flex: 1, color: N.muted }}>{placeholder}</span>
      <span style={{
        fontFamily: ATLAS_MONO,
        fontSize: 10.5,
        color: N.faint,
        padding: '1px 5px',
        border: `1px solid ${N.line2}`,
        borderRadius: 4,
      }}>⌘ K</span>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/Button.tsx frontend/src/components/atlas-one/SearchInput.tsx
git commit -m "feat(atlas-one): Button + SearchInput"
```

---

## Task 10: Topbar

**Files:**
- Create: `frontend/src/components/atlas-one/Topbar.tsx`

- [ ] **Step 1: Create `Topbar.tsx`**

Port from sandbox `system.jsx` lines 316-331.

```typescript
import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';

interface TopbarProps {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

export function Topbar({ title, sub, right, children }: TopbarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '18px 28px 16px',
      borderBottom: `1px solid ${N.line}`,
      background: N.card,
      fontFamily: ATLAS_FONT,
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
```

- [ ] **Step 2: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/Topbar.tsx
git commit -m "feat(atlas-one): Topbar"
```

---

## Task 11: SidebarUser + Sidebar

**Files:**
- Create: `frontend/src/components/atlas-one/SidebarUser.tsx`
- Create: `frontend/src/components/atlas-one/Sidebar.tsx`

- [ ] **Step 1: Create `SidebarUser.tsx`**

Port from sandbox `system.jsx` lines 295-314.

```typescript
import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, PresetConfig } from './tokens';
import { Icon } from './icons/iconLib';

interface SidebarUserProps {
  preset: PresetConfig;
  name: string;
  role: string;
  branch: string;
}

export function SidebarUser({ preset, name, role, branch }: SidebarUserProps) {
  const sb = preset.sidebar;
  return (
    <div style={{
      marginTop: 12,
      padding: '10px 10px',
      borderTop: `1px solid ${sb.activeBg}`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: ATLAS_FONT,
    }}>
      <div style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        background: sb.accent,
        color: sb.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: 12,
      }}>{name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: sb.fg,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{name}</div>
        <div style={{ fontSize: 10.5, color: sb.mute, fontFamily: ATLAS_MONO, letterSpacing: 0.3 }}>{role} · {branch}</div>
      </div>
      <Icon.cog size={14} color={sb.mute} />
    </div>
  );
}
```

- [ ] **Step 2: Create `Sidebar.tsx`**

Port from sandbox `system.jsx` lines 248-293.

```typescript
import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, PresetConfig } from './tokens';
import { Wordmark } from './Wordmark';
import type { IconComponent } from './icons/iconLib';

export type SidebarItem =
  | { header: string }
  | { icon?: IconComponent; label: string; badge?: string | number };

interface SidebarProps {
  preset: PresetConfig;
  active?: string;
  items: SidebarItem[];
  footer?: React.ReactNode;
  width?: number;
}

export function Sidebar({ preset, active, items, footer, width = 232 }: SidebarProps) {
  const sb = preset.sidebar;
  return (
    <aside style={{
      width,
      flexShrink: 0,
      background: sb.bg,
      color: sb.fg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: ATLAS_FONT,
      padding: '20px 14px 16px',
    }}>
      <div style={{ padding: '4px 6px 22px' }}>
        <Wordmark color={sb.fg} accent={sb.accent} size={15} sub={preset.tagline} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map((it, i) => {
          if ('header' in it) {
            return (
              <div key={i} style={{
                fontFamily: ATLAS_MONO,
                fontSize: 10,
                color: sb.mute,
                padding: '14px 10px 6px',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>{it.header}</div>
            );
          }
          const isActive = it.label === active;
          const IconCmp = it.icon;
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 7,
              background: isActive ? sb.activeBg : 'transparent',
              color: isActive ? sb.fg : sb.mute,
              fontSize: 13.5,
              fontWeight: isActive ? 500 : 400,
              position: 'relative',
            }}>
              {isActive && <span style={{
                position: 'absolute',
                left: -14,
                top: 8,
                bottom: 8,
                width: 2,
                borderRadius: 2,
                background: sb.accent,
              }} />}
              {IconCmp && <IconCmp size={16} color={isActive ? sb.accent : sb.mute} />}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge != null && (
                <span style={{
                  fontFamily: ATLAS_MONO,
                  fontSize: 10,
                  fontWeight: 500,
                  background: isActive ? sb.accent : 'rgba(255,255,255,0.08)',
                  color: isActive ? sb.bg : sb.mute,
                  padding: '2px 6px',
                  borderRadius: 999,
                  minWidth: 18,
                  textAlign: 'center',
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
```

- [ ] **Step 3: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/SidebarUser.tsx frontend/src/components/atlas-one/Sidebar.tsx
git commit -m "feat(atlas-one): Sidebar + SidebarUser (dark rail per-preset)"
```

---

## Task 12: Sparkline + Kpi

**Files:**
- Create: `frontend/src/components/atlas-one/charts/Sparkline.tsx`
- Create: `frontend/src/components/atlas-one/Kpi.tsx`

- [ ] **Step 1: Create `charts/Sparkline.tsx`**

Port from sandbox `system.jsx` lines 419-434.

```typescript
import React from 'react';

interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

export function Sparkline({ values, color = '#0B0B0B', width = 120, height = 32, fill = false }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dFill = `${d} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {fill && <path d={dFill} fill={color} opacity={0.12} />}
      <path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Create `Kpi.tsx`**

Port from sandbox `system.jsx` lines 391-416.

```typescript
import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';
import { Card } from './Card';
import { Sparkline } from './charts/Sparkline';
import { Icon } from './icons/iconLib';

interface KpiProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  trend?: number[];
  accent?: string;
  sub?: string;
}

export function Kpi({ label, value, unit, delta, trend = [], accent, sub }: KpiProps) {
  const positive = !!delta && delta.startsWith('+');
  return (
    <Card pad={18} style={{ minHeight: 132, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontSize: 11.5,
        fontFamily: ATLAS_MONO,
        letterSpacing: 0.8,
        color: N.muted,
        textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{
          fontSize: 28,
          fontWeight: 600,
          color: N.ink,
          letterSpacing: -0.8,
          fontFeatureSettings: '"tnum"',
        }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: N.muted, fontFamily: ATLAS_MONO }}>{unit}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        {sub ? (
          <div style={{ fontSize: 11.5, color: N.muted, fontFamily: ATLAS_MONO }}>{sub}</div>
        ) : (
          delta && <div style={{
            fontSize: 12,
            fontFamily: ATLAS_MONO,
            color: positive ? '#0E8A4E' : '#B43E2E',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}>
            {positive ? <Icon.arrowUp size={11} color="currentColor" /> : <Icon.arrowDown size={11} color="currentColor" />}
            {delta}
          </div>
        )}
        {trend.length > 0 && <Sparkline values={trend} color={accent || N.body} width={70} height={22} />}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/charts/Sparkline.tsx frontend/src/components/atlas-one/Kpi.tsx
git commit -m "feat(atlas-one): Sparkline + Kpi"
```

---

## Task 13: BarChart + LineChart + Donut

**Files:**
- Create: `frontend/src/components/atlas-one/charts/BarChart.tsx`
- Create: `frontend/src/components/atlas-one/charts/LineChart.tsx`
- Create: `frontend/src/components/atlas-one/charts/Donut.tsx`

- [ ] **Step 1: Create `BarChart.tsx`**

Port from sandbox `system.jsx` lines 436-454.

```typescript
import React from 'react';
import { ATLAS_MONO, N } from '../tokens';

interface BarDatum {
  label: string;
  value: number;
  highlight?: boolean;
}

interface BarChartProps {
  data: BarDatum[];
  width?: number;
  height?: number;
  color?: string;
  soft?: string;
}

export function BarChart({ data, width = 480, height = 180, color = '#0B0B0B', soft = '#E8E5DD' }: BarChartProps) {
  if (!data.length) return null;
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
            <text
              x={x + barW / 2}
              y={height - 6}
              fontSize={10}
              fontFamily={ATLAS_MONO}
              fill={N.muted}
              textAnchor="middle"
            >{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Create `LineChart.tsx`**

Port from sandbox `system.jsx` lines 456-483.

```typescript
import React from 'react';
import { ATLAS_MONO, N } from '../tokens';

interface LineSeries {
  values: number[];
}

interface LineChartProps {
  series: LineSeries[];
  width?: number;
  height?: number;
  color?: string;
  color2?: string;
  labels?: string[];
}

export function LineChart({
  series,
  width = 520,
  height = 200,
  color = '#0B0B0B',
  color2 = '#9C9B95',
  labels = [],
}: LineChartProps) {
  if (!series.length || !series[0].values.length) return null;
  const all = series.flatMap(s => s.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = (max - min) || 1;
  const px = (i: number, n: number) => 30 + (i / (n - 1)) * (width - 50);
  const py = (v: number) => (height - 30) - ((v - min) / span) * (height - 50);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line
          key={i}
          x1={30}
          x2={width - 10}
          y1={height - 30 - t * (height - 50)}
          y2={height - 30 - t * (height - 50)}
          stroke={N.line}
          strokeDasharray="2 3"
        />
      ))}
      {series.map((s, si) => {
        const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i, s.values.length)},${py(v)}`).join(' ');
        const dFill = `${d} L${px(s.values.length - 1, s.values.length)},${height - 30} L${px(0, s.values.length)},${height - 30} Z`;
        const c = si === 0 ? color : color2;
        return (
          <g key={si}>
            {si === 0 && <path d={dFill} fill={c} opacity={0.08} />}
            <path d={d} stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text
          key={i}
          x={px(i, labels.length)}
          y={height - 10}
          fontSize={10}
          fontFamily={ATLAS_MONO}
          fill={N.muted}
          textAnchor="middle"
        >{l}</text>
      ))}
    </svg>
  );
}
```

- [ ] **Step 3: Create `Donut.tsx`**

Port from sandbox `system.jsx` lines 485-501.

```typescript
import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from '../tokens';

interface DonutProps {
  value?: number;
  label?: string;
  size?: number;
  color?: string;
  track?: string;
}

export function Donut({ value = 0.72, label, size = 110, color = '#0B0B0B', track = '#EEEAE0' }: DonutProps) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const dash = value * c;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={7} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 22,
          fontWeight: 600,
          fontFamily: ATLAS_FONT,
          color: N.ink,
          fontFeatureSettings: '"tnum"',
        }}>
          {Math.round(value * 100)}
          <span style={{ fontSize: 11, color: N.muted, fontFamily: ATLAS_MONO }}>%</span>
        </div>
        {label && <div style={{
          fontSize: 10,
          color: N.muted,
          fontFamily: ATLAS_MONO,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>{label}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/charts/
git commit -m "feat(atlas-one): BarChart + LineChart + Donut"
```

---

## Task 14: Device frames (Laptop + Tablet + Phone)

**Files:**
- Create: `frontend/src/components/atlas-one/frames/LaptopFrame.tsx`
- Create: `frontend/src/components/atlas-one/frames/TabletFrame.tsx`
- Create: `frontend/src/components/atlas-one/frames/PhoneFrame.tsx`

- [ ] **Step 1: Create `LaptopFrame.tsx`**

Port from sandbox `system.jsx` lines 531-555.

```typescript
import React from 'react';

interface LaptopFrameProps {
  children: React.ReactNode;
  width?: number;
}

export function LaptopFrame({ children, width = 720 }: LaptopFrameProps) {
  const h = width * 0.62;
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: '100%',
        background: '#1c1b18',
        borderRadius: '14px 14px 4px 4px',
        padding: '10px 10px 12px',
        position: 'relative',
      }}>
        <div style={{
          background: '#0a0a09',
          borderRadius: 4,
          overflow: 'hidden',
          width: '100%',
          height: h - 22,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 4,
            transform: 'translateX(-50%)',
            width: 6,
            height: 6,
            borderRadius: 999,
            background: '#000',
            border: '1px solid #2a2a28',
            zIndex: 2,
          }} />
          <div style={{
            position: 'absolute',
            inset: '12px 6px 6px',
            background: '#fff',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            {children}
          </div>
        </div>
      </div>
      <div style={{
        width: '108%',
        height: 9,
        background: 'linear-gradient(180deg, #c5c2bb 0%, #8e8b84 100%)',
        borderRadius: '0 0 9px 9px',
      }} />
      <div style={{
        width: 60,
        height: 4,
        background: '#5a5751',
        borderRadius: '0 0 4px 4px',
        marginTop: -1,
      }} />
    </div>
  );
}
```

- [ ] **Step 2: Create `TabletFrame.tsx`**

Port from sandbox `system.jsx` lines 557-573.

```typescript
import React from 'react';

interface TabletFrameProps {
  children: React.ReactNode;
  width?: number;
  vertical?: boolean;
}

export function TabletFrame({ children, width = 580, vertical = false }: TabletFrameProps) {
  const ratio = vertical ? (4 / 3) : (3 / 4);
  const h = width * ratio;
  return (
    <div style={{
      width,
      height: h,
      background: '#15140f',
      borderRadius: 22,
      padding: 11,
      position: 'relative',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}>
        {children}
      </div>
      {!vertical && <div style={{
        position: 'absolute',
        left: 5,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 5,
        height: 5,
        borderRadius: 999,
        background: '#3a3933',
      }} />}
    </div>
  );
}
```

- [ ] **Step 3: Create `PhoneFrame.tsx`**

Port from sandbox `system.jsx` lines 575-599.

```typescript
import React from 'react';
import { ATLAS_FONT, N } from '../tokens';

interface PhoneFrameProps {
  children: React.ReactNode;
  width?: number;
}

export function PhoneFrame({ children, width = 280 }: PhoneFrameProps) {
  const h = width * (844 / 390);
  return (
    <div style={{
      width,
      height: h,
      background: '#0e0d0a',
      borderRadius: 34,
      padding: 8,
      position: 'relative',
      boxShadow: 'inset 0 0 0 1px #2a2925',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 28,
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 6,
          transform: 'translateX(-50%)',
          width: 78,
          height: 20,
          borderRadius: 999,
          background: '#0e0d0a',
          zIndex: 5,
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 32,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 22px 0',
          fontSize: 11,
          fontFamily: ATLAS_FONT,
          fontWeight: 600,
          color: N.ink,
          zIndex: 4,
        }}>
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center', opacity: 0.9 }}>
            <svg width={14} height={9} viewBox="0 0 14 9">
              <path d="M1 7l2-2 2 2 3-4 5 4" stroke="currentColor" strokeWidth={1.4} fill="none" strokeLinecap="round" />
            </svg>
            <span style={{
              width: 18,
              height: 9,
              border: '1px solid currentColor',
              borderRadius: 2,
              position: 'relative',
              display: 'inline-block',
            }}>
              <span style={{
                position: 'absolute',
                inset: 1,
                width: '70%',
                background: 'currentColor',
                borderRadius: 1,
              }} />
            </span>
          </span>
        </div>
        <div style={{ paddingTop: 32, height: '100%' }}>{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/frames/
git commit -m "feat(atlas-one): device frames (Laptop, Tablet, Phone)"
```

---

## Task 15: Barrel export

**Files:**
- Create: `frontend/src/components/atlas-one/index.ts`

- [ ] **Step 1: Create `index.ts`**

```typescript
export * from './tokens';
export * from './utils';
export { Icon } from './icons/iconLib';
export type { IconKey, IconComponent, IconProps } from './icons/iconLib';
export { AtlasMark } from './AtlasMark';
export { Wordmark } from './Wordmark';
export { Card } from './Card';
export { SectionTitle } from './SectionTitle';
export { Badge } from './Badge';
export { Avatar } from './Avatar';
export { Button } from './Button';
export { SearchInput } from './SearchInput';
export { Topbar } from './Topbar';
export { Sidebar } from './Sidebar';
export type { SidebarItem } from './Sidebar';
export { SidebarUser } from './SidebarUser';
export { Kpi } from './Kpi';
export { Sparkline } from './charts/Sparkline';
export { BarChart } from './charts/BarChart';
export { LineChart } from './charts/LineChart';
export { Donut } from './charts/Donut';
export { LaptopFrame } from './frames/LaptopFrame';
export { TabletFrame } from './frames/TabletFrame';
export { PhoneFrame } from './frames/PhoneFrame';
```

- [ ] **Step 2: TypeScript check + Commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/atlas-one/index.ts
git commit -m "feat(atlas-one): barrel export"
```

---

## Task 16: Apply IBM Plex globally in body

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Locate the body font-family declaration**

Open `frontend/src/index.css`. Search for the `body` selector. It currently declares `font-family: 'Montserrat', system-ui, sans-serif;` (or similar Tailwind defaults).

- [ ] **Step 2: Update body to use IBM Plex first**

Replace the body font-family line with:

```css
body {
  font-family: var(--ao-font-sans);
  /* ... keep all other body properties unchanged */
}
```

`--ao-font-sans` was defined in Task 1 as `'IBM Plex Sans', 'Montserrat', system-ui, -apple-system, sans-serif` — so Montserrat is the fallback.

- [ ] **Step 3: Build + dev smoke test**

```bash
cd frontend && npm run build
```
Expected: build succeeds.

```bash
cd frontend && npm run dev
```
Open browser to `localhost:5173`. Log in as any demo org. Navigate to:
- `/home` (preset home)
- `/pos`
- `/products`
- `/customers`
- `/hq/operations` (if accessible)
- `/platform/metrics` (if SUPERADMIN demo)

For each page, verify:
- Text now renders in IBM Plex Sans (more geometric, distinctive serifs absent).
- Layout is intact — no obvious overflow, no broken alignment, no clipped text.

If any page has visible regression (clipped text in a button, overflowing card, etc.), note it but DON'T revert. Take a screenshot and document. Decision on Plan B (`.atlas-one-scope` only) is deferred to Task 19 verification.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(atlas-one): apply IBM Plex globally with Montserrat fallback"
```

---

## Task 17: Dev preview page

**Files:**
- Create: `frontend/src/pages/__dev__/AtlasOnePreview.tsx`

- [ ] **Step 1: Create the preview page**

```typescript
/**
 * Dev-only preview of the Atlas One Design System.
 * Equivalent to system-overview.jsx artboard from the sandbox.
 * Renders ALL primitives + iterates through all 11 presets.
 *
 * Accessible only in development via /__dev__/atlas-one-preview.
 */

import React, { useState } from 'react';
import {
  ATLAS_FONT, ATLAS_MONO, ATLAS_SERIF, N, PRESETS, PresetKey,
  Icon, AtlasMark, Wordmark,
  Card, SectionTitle, Badge, Avatar, Button, SearchInput,
  Topbar, Sidebar, SidebarUser, Kpi,
  Sparkline, BarChart, LineChart, Donut,
  LaptopFrame, TabletFrame, PhoneFrame,
  mxn, mxnInt,
} from '../../components/atlas-one';

export default function AtlasOnePreview() {
  const [presetKey, setPresetKey] = useState<PresetKey>('pos');
  const preset = PRESETS[presetKey];

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: N.canvas,
      fontFamily: ATLAS_FONT,
      color: N.ink,
      padding: 32,
    }}>
      {/* Preset picker */}
      <div style={{ marginBottom: 32, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <div style={{
          fontFamily: ATLAS_MONO,
          fontSize: 11,
          color: N.muted,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          width: '100%',
          marginBottom: 8,
        }}>Preset · click to swap</div>
        {Object.entries(PRESETS).map(([k, p]) => (
          <button
            key={k}
            onClick={() => setPresetKey(k as PresetKey)}
            style={{
              padding: '6px 12px',
              borderRadius: 7,
              border: `1px solid ${k === presetKey ? p.accent : N.line}`,
              background: k === presetKey ? p.accentSoft : N.card,
              color: N.ink,
              fontFamily: ATLAS_MONO,
              fontSize: 11,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.accent }} />
            {p.name}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Wordmark color={N.ink} accent={preset.accent} size={20} sub="Sistema visual v1 · dev preview" />
          <h1 style={{
            fontFamily: ATLAS_SERIF,
            fontSize: 42,
            fontWeight: 500,
            letterSpacing: -1,
            marginTop: 18,
            marginBottom: 0,
          }}>Un solo software. Once configuraciones.</h1>
        </div>
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.6 }}>
          v 1.0 · ATLAS-ONE · DEV ONLY
        </div>
      </div>

      {/* Sidebar + content side-by-side */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
        <Sidebar
          preset={preset}
          active="Punto de venta"
          width={232}
          items={[
            { header: 'Operación' },
            { icon: Icon.cart, label: 'Punto de venta' },
            { icon: Icon.receipt, label: 'Caja', badge: 3 },
            { icon: Icon.pkg, label: 'Productos' },
            { icon: Icon.users, label: 'Clientes' },
            { header: 'Analítica' },
            { icon: Icon.chart, label: 'Reportes' },
            { icon: Icon.branch, label: 'Sucursales' },
          ]}
          footer={<SidebarUser preset={preset} name="Ana Lozano" role="Cajera" branch="MX-01" />}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Topbar
            title="Panel de operación"
            sub={`${preset.name.toUpperCase()} · ${preset.tagline.toUpperCase()}`}
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SearchInput width={280} />
                <Icon.bell size={18} color={N.muted} />
                <Button label="Nueva venta" kind="primary" preset={preset} icon={Icon.plus} />
              </div>
            }
          />

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <Kpi label="Ventas de hoy" value={mxnInt(48230)} delta="+12.4%" trend={[3,4,5,4,6,7,8,7,9,11,10,12]} accent={preset.accent} />
            <Kpi label="Tickets" value={143} delta="+8.1%" trend={[2,3,4,4,5,6,7,6,8,9,10,11]} accent={preset.accent} />
            <Kpi label="Ticket promedio" value={mxn(186.50)} delta="+3.2%" sub="Sin propina" />
            <Kpi label="Productos vendidos" value="412" sub="3 abiertos · 2 cerrados" />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
            <Card>
              <SectionTitle>Ventas por hora</SectionTitle>
              <BarChart
                color={preset.accent}
                data={[
                  { label: 'L', value: 4 }, { label: 'M', value: 6 }, { label: 'M', value: 5 },
                  { label: 'J', value: 8 }, { label: 'V', value: 11, highlight: true },
                  { label: 'S', value: 14, highlight: true }, { label: 'D', value: 7 },
                ]}
                width={360} height={140}
              />
            </Card>
            <Card>
              <SectionTitle>Capacidad</SectionTitle>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
                <Donut value={0.78} label="Capacidad" color={preset.accent} />
              </div>
            </Card>
          </div>

          {/* Buttons + Badges */}
          <Card>
            <SectionTitle>Botones · estilos</SectionTitle>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <Button label="Cobrar $1,240" kind="primary" preset={preset} icon={Icon.arrowRight} />
              <Button label="Cancelar" kind="secondary" />
              <Button label="+ Nuevo" kind="accent" preset={preset} />
              <Button label="Editar" kind="ghost" size="sm" icon={Icon.cog} />
            </div>
            <SectionTitle>Badges</SectionTitle>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge color="#0E8A4E" soft="#E3F4EA" dot>Caja abierta</Badge>
              <Badge color="#B43E2E" soft="#FBE7E1" dot>Stock crítico</Badge>
              <Badge color="#9A6610" soft="#FBEFD7" dot>Pendiente</Badge>
              <Badge color="#1F4FC8" soft="#E5ECFB" dot>En cocina</Badge>
              <Badge color="#6B6B66" soft={N.chip}>SKU-7821</Badge>
            </div>
          </Card>

          {/* Avatars */}
          <Card>
            <SectionTitle>Avatares</SectionTitle>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Avatar name="Ana Lozano" />
              <Avatar name="Pedro Martinez" color={preset.accentSoft} />
              <Avatar name="Lourdes Toledo" size={40} color={preset.accent2} />
              <Avatar name="Saúl Mendoza" size={52} color={preset.accent} />
            </div>
          </Card>

          {/* Icon grid */}
          <Card>
            <SectionTitle>Iconografía · stroke 1.6 · 24×24</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 6 }}>
              {Object.entries(Icon).map(([k, IconCmp]) => (
                <div key={k} title={k} style={{
                  aspectRatio: '1',
                  border: `1px solid ${N.line}`,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: N.body,
                }}>
                  <IconCmp size={18} />
                </div>
              ))}
            </div>
          </Card>

          {/* LineChart */}
          <Card>
            <SectionTitle>Tendencia · doble serie</SectionTitle>
            <LineChart
              series={[
                { values: [3,5,4,7,8,10,9,12,14,13,15,18,17,20,22] },
                { values: [2,3,3,5,6,7,7,9,10,10,12,14,13,16,18] },
              ]}
              color={preset.accent}
              color2={preset.accent2}
              labels={['07','','09','','11','','13','','15','','17','','19','','21']}
              width={620} height={180}
            />
          </Card>

          {/* Sparklines */}
          <Card>
            <SectionTitle>Sparklines (inline en KPI)</SectionTitle>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <Sparkline values={[3,4,5,4,6,7,8,7,9,11,10,12,14,13]} color={preset.accent} width={140} height={36} />
              <Sparkline values={[3,4,5,4,6,7,8,7,9,11,10,12,14,13]} color={preset.accent} width={140} height={36} fill />
              <Sparkline values={[12,11,10,11,9,8,9,8,7,6,7,5,4,3]} color="#B43E2E" width={140} height={36} />
            </div>
          </Card>

          {/* Device frames */}
          <Card>
            <SectionTitle>Device frames · marketing artboards</SectionTitle>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
              <LaptopFrame width={320}>
                <div style={{ width: '100%', height: '100%', background: preset.tint, padding: 16, fontFamily: ATLAS_FONT, fontSize: 11 }}>
                  <Wordmark color={preset.accentInk} accent={preset.accent} size={11} sub={preset.tagline} />
                  <div style={{ marginTop: 18, fontFamily: ATLAS_SERIF, fontSize: 18, color: preset.accentInk, letterSpacing: -0.3 }}>
                    Dashboard {preset.name}
                  </div>
                </div>
              </LaptopFrame>
              <TabletFrame width={220}>
                <div style={{ width: '100%', height: '100%', background: preset.accentSoft, padding: 14, fontFamily: ATLAS_FONT }}>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 9, color: preset.accentInk, letterSpacing: 0.8, textTransform: 'uppercase' }}>{preset.name}</div>
                  <div style={{ fontFamily: ATLAS_SERIF, fontSize: 14, color: preset.accentInk, marginTop: 6, letterSpacing: -0.2 }}>Touch / Mostrador</div>
                </div>
              </TabletFrame>
              <PhoneFrame width={140}>
                <div style={{ width: '100%', height: '100%', background: preset.tint, padding: 14, fontFamily: ATLAS_FONT, fontSize: 10 }}>
                  <div style={{ color: preset.accentInk }}>Hola, Ana</div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 8, color: N.muted, marginTop: 4 }}>{preset.name.toUpperCase()}</div>
                </div>
              </PhoneFrame>
            </div>
          </Card>

          {/* Typography */}
          <Card>
            <SectionTitle>Tipografía · IBM Plex</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontFamily: ATLAS_SERIF, fontSize: 36, fontWeight: 500, letterSpacing: -0.8 }}>Plex Serif · headlines</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 4 }}>SERIF 500 · 32 / 38 / 44 · LETTER -0.8</div>
              </div>
              <div>
                <div style={{ fontFamily: ATLAS_FONT, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Plex Sans · section titles</div>
                <div style={{ fontFamily: ATLAS_FONT, fontSize: 14, color: N.body, marginTop: 4, lineHeight: 1.5 }}>Plex Sans 400 · body text.</div>
              </div>
              <div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 500, color: N.ink, letterSpacing: 0.4 }}>PLEX MONO · MÉTRICAS Y CÓDIGOS</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: N.body, marginTop: 4 }}>$ 12,480.50 · SKU-7821 · 09:41</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/__dev__/AtlasOnePreview.tsx
git commit -m "feat(atlas-one): dev preview page showcasing all primitives"
```

---

## Task 18: Add dev-only route to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Locate the route declarations in App.tsx**

Open `frontend/src/App.tsx`. Find the `<Routes>` block (likely inside a `<BrowserRouter>` or similar). Identify where public routes (e.g., `/login`) are declared — the dev preview should be a public, non-authenticated route.

- [ ] **Step 2: Add lazy import + dev-only route**

Near the top imports section, add a lazy import (so the page is code-split and not bundled in production builds):

```typescript
import { lazy, Suspense } from 'react';

const AtlasOnePreview = lazy(() => import('./pages/__dev__/AtlasOnePreview'));
```

Then in the `<Routes>` block, add this route. Place it next to `/login` or at the top of the routes list:

```tsx
{import.meta.env.DEV && (
  <Route
    path="/__dev__/atlas-one-preview"
    element={
      <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
        <AtlasOnePreview />
      </Suspense>
    }
  />
)}
```

The `import.meta.env.DEV` gate ensures the route doesn't exist in production builds.

- [ ] **Step 3: Verify route works**

```bash
cd frontend && npm run dev
```
Open `http://localhost:5173/__dev__/atlas-one-preview` (no login required, since it's outside the `<Layout>` auth gate).

Expected:
- Page renders without errors.
- Header shows "Un solo software. Once configuraciones."
- 11 preset chips at the top — click each one and verify Sidebar, Kpis, charts, buttons all update with the new preset accent color.
- All 52 icons render in the icon grid.
- BarChart, LineChart, Donut, Sparklines all visible.
- LaptopFrame, TabletFrame, PhoneFrame each render with placeholder content.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(atlas-one): mount dev preview route gated by import.meta.env.DEV"
```

---

## Task 19: Regression smoke + final verification

**No file changes — pure verification task.**

- [ ] **Step 1: Run production build**

```bash
cd frontend && npm run build
```
Expected: build succeeds with no new errors or warnings. Take note of bundle size delta vs main — IBM Plex adds ~80-120KB of font payload (loaded async from Google Fonts CDN, so it's not in the JS bundle).

- [ ] **Step 2: TypeScript strict check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Regression smoke on existing pages**

Start dev server: `cd frontend && npm run dev`

Visit each page and verify NO visual regression (layout intact, text not clipped, cards not overflowing):

| Path | Expected |
|---|---|
| `/login` | Login form renders correctly |
| `/home` | Preset home renders with new accent color |
| `/pos` | POS UI intact |
| `/atlas-pos` | Atlas POS UI intact |
| `/products` | Product list intact |
| `/customers` | Customer list intact |
| `/sales` | Sales history intact |
| `/cash-history` | Cash history intact |
| `/hq/operations` | HQ ops dashboard intact |
| `/platform/metrics` | Platform metrics (SUPERADMIN) intact |
| `/platform/organizations` | Org list intact |

For each, the test is: does it look the same as before, just with IBM Plex instead of Montserrat? IBM Plex is slightly more geometric and the metric tabular numbers (tnum) look cleaner. Layout shifts should be negligible (<5px on any axis).

If a page has a serious regression (clipped button, broken layout in a card), document it in a comment in the verification commit message. Decision on whether to apply Plan B (scope-restrict Plex to `.atlas-one-scope`) is a follow-up.

- [ ] **Step 4: Dev preview final check**

Visit `/__dev__/atlas-one-preview`. Click through ALL 11 preset chips. For each preset, verify:
- Sidebar bg/fg/accent colors match the sandbox `system.jsx` (compare side-by-side with `Atlas One UI Presets.html` open in another browser tab).
- KPIs show sparklines in the preset accent color.
- BarChart and LineChart use the preset accent.
- Buttons (primary/accent kinds) use the preset accent.

- [ ] **Step 5: Commit verification log**

If everything looks good:

```bash
git commit --allow-empty -m "test(atlas-one): SP-0 verification passed

- tsc --noEmit: 0 errors
- npm run build: succeeded
- regression smoke on 11 routes: no breakage
- dev preview /__dev__/atlas-one-preview: all 11 presets render correctly
"
```

If some pages have regression, document them:

```bash
git commit --allow-empty -m "test(atlas-one): SP-0 verification — N regressions logged

- tsc --noEmit: 0 errors
- npm run build: succeeded
- regression: [page1] clipped button at [location], [page2] overflowing card
- Decision deferred: apply .atlas-one-scope plan B in follow-up
"
```

---

## Task 20: Update memory + close SP-0

**No file changes — memory + project tracking.**

- [ ] **Step 1: Update auto-memory**

Add the completion to `~/.claude/projects/-mnt-c-Users-ecamp-Devs-atlas-bos/memory/project_11_presets_mvp_plan.md`. Add a line like:

```markdown
**SP-0 status (2026-MM-DD)**: ✅ Done. Atlas One Design System ported to `frontend/src/components/atlas-one/`. IBM Plex global. Dev preview at `/__dev__/atlas-one-preview`. N regressions logged (or zero).
```

(Use TaskUpdate via the harness or manually edit the file.)

- [ ] **Step 2: Confirm SP-1 unblocked**

SP-0 is the prerequisite for SP-1 (Wave 1 frontend). With SP-0 complete:
- `import { Kpi, BarChart, Sidebar, ... } from '@/components/atlas-one'` works.
- IBM Plex is the global font.
- All 11 preset accents are reconciled.
- The dev preview is the visual smoke for any future preset homes.

SP-1 can now start. Its spec should be written next in `docs/superpowers/specs/2026-MM-DD-preset-wave1-rich-homes-design.md`.

---

## Self-Review Notes

**Spec coverage**:
- §3.1 In-scope items: tokens.ts ✓ (Task 2), atlas-one.css ✓ (Task 1), IBM Plex global ✓ (Task 16), dev preview ✓ (Task 17), reconcile index.css ✓ (Task 4). All covered.
- §4.1 File structure: every file listed has a task. ✓
- §5 Tokens: covered in Task 2. ✓
- §6 Component specs: each primitive has its own task (6-14). ✓
- §7 Tipografía: Task 1 (CSS) + Task 16 (apply to body). ✓
- §8 Dev preview route: Task 17-18. ✓
- §9 Acceptance criteria: every checklist item maps to a task step. ✓
- §11 Verification: Task 19. ✓

**Placeholder scan**: no TBD, TODO, "implement later", or vague instructions. Every code block is complete.

**Type consistency**: `PresetConfig`, `PresetKey`, `SidebarItem`, `IconComponent`, `IconKey`, `IconProps` are defined in Task 2/5 and used consistently in Tasks 9 (Button), 11 (Sidebar), 17 (preview). Function signatures match across files.

**Order dependency check**:
- Task 1 (CSS+fonts) before Task 16 (apply font globally) ✓
- Task 2 (tokens) before everything that imports it ✓
- Task 5 (iconLib) before Task 6 (Wordmark uses AtlasMark not Icon, but ok), Task 9 (Button uses IconComponent), Task 10 (Topbar — doesn't use Icon), Task 11 (Sidebar uses IconComponent), Task 11 SidebarUser (uses Icon.cog), Task 12 (Kpi uses Icon.arrowUp/Down) ✓
- Task 6 (Wordmark) before Task 11 (Sidebar imports Wordmark) ✓
- Task 7 (Card) before Task 12 (Kpi uses Card) ✓
- Task 12 (Sparkline) before Task 12 Kpi (Kpi uses Sparkline) — same task, Sparkline declared first ✓
- Task 15 (barrel) after all primitive tasks ✓
- Task 17 (preview) after Task 15 (uses barrel) ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-atlas-one-design-system.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
