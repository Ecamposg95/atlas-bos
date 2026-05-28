# Atlas One Design System — Spec (SP-0)

**Fecha**: 2026-05-28
**Sub-proyecto**: SP-0 (prerequisito del mega-plan 11 presets MVP)
**Plan maestro**: `/home/ecamposg/.claude/plans/bubbly-noodling-yeti.md`
**Estimación**: ~5 días de un dev frontend.

---

## 1. Goal

Portar el sistema de diseño de Atlas One (definido en el sandbox `C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\system.jsx`) a `atlas-bos` como una **capa nueva de primitivos** (`frontend/src/components/atlas-one/*`) que convive con los componentes existentes (DaxCard, KPICard v1/v2, Button) sin reemplazarlos.

El outcome es habilitar que las siguientes olas (SP-1, SP-3, SP-5) construyan los 11 preset homes ricos sin reinventar primitivos.

## 2. Context

### 2.1 Source of truth visual

El sandbox `C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\` contiene:
- **`system.jsx`** (630 LOC) — el design system con tokens (N, PRESETS), 47 iconos lucide-style, primitivos compartidos (Sidebar, Topbar, Button, Card, Kpi, Badge, BarChart, Donut), device frames, helpers de currency.
- **`system-overview.jsx`** (226 LOC) — artboard "00 · Tokens, tipografía, componentes base" que demuestra todos los primitivos juntos.
- 11 archivos preset (`pos.jsx`, `retail.jsx`, ..., `custom.jsx`) que importan los primitivos vía `window.{Sidebar, Topbar, Kpi, ...}`.

El stack del sandbox: React 18 + Babel standalone + IBM Plex (3 familias) + JSX inline (sin bundler).

### 2.2 Estado actual en atlas-bos

Existe theming preset-aware (`enabledModulesStore.applyPresetAttribute()` pone `data-preset` en `<html>`, `index.css` declara `--p-accent` por preset). Pero los componentes son Tailwind + DaxCard (warm-light DAX theme) con Montserrat — no IBM Plex, no warm canvas Atlas One, no Sidebar dark rail, no Kpi+sparkline estilo Atlas.

Los homes en `PresetHome.tsx` (~370 líneas, 9 vertical homes inline) son **grids livianos de CTAs**, no los dashboards ricos del sandbox.

### 2.3 Drift detectado

Los colores accent por preset están duplicados:
- **Sandbox `system.jsx`**: `barber.accent: '#0F766E'` (teal/acero), `beauty.accent: '#B16E78'` (dusty rose), `bar.accent: '#7C3AED'` (purple), etc.
- **atlas-bos `index.css`**: `ATLAS_ONE_BARBER: #0891b2` (cyan), `ATLAS_ONE_BEAUTY_WELLNESS: #ec4899` (pink), `ATLAS_ONE_BAR: #7c3aed`, etc.

Decisión: **el sandbox manda**. SP-0 reconcilia: actualiza `index.css` a los hex codes del sandbox.

## 3. Scope

### 3.1 In-scope

- Crear `frontend/src/components/atlas-one/` con los primitivos portados.
- Crear `frontend/src/styles/atlas-one.css` con tokens CSS (--ao-*) + import de IBM Plex.
- Aplicar `font-family: 'IBM Plex Sans'` global en `frontend/src/index.css`.
- Crear ruta dev `/__dev__/atlas-one-preview` que rinda system-overview portado.
- Reconciliar colores accent en `index.css` con los del sandbox.

### 3.2 Out-of-scope

- Reemplazar componentes existentes (DaxCard, KPICard v1/v2, layout/Sidebar) — quedan intactos.
- Migrar páginas existentes (`/pos`, `/hq/operations`, `/platform/*`) al nuevo design system.
- Touch artboards (TabletFrame) y Mobile artboards (PhoneFrame) — postergados.
- Hero artboards (marketing landing) — no entran al producto.
- Sidebar dark rail aplicado globalmente — vive como primitivo, no se enchufa al layout principal aún.

## 4. Arquitectura

### 4.1 Estructura de archivos

```
frontend/src/styles/
└── atlas-one.css                  ← tokens --ao-* + import Google Fonts IBM Plex

frontend/src/components/atlas-one/
├── tokens.ts                      ← N, PRESETS, INDUSTRY_TYPE_TO_PRESET map
├── Sidebar.tsx                    ← dark rail per-preset (no reemplaza layout/Sidebar)
├── Topbar.tsx                     ← title + sub + search + actions
├── Card.tsx                       ← surface blanca con border line
├── Kpi.tsx                        ← value + label + delta + sparkline
├── Badge.tsx                      ← pill con dot opcional
├── Button.tsx                     ← primary/secondary/accent/ghost + sizes
├── SearchInput.tsx                ← con ⌘K hint
├── SidebarUser.tsx                ← avatar + name + role + branch (footer del Sidebar)
├── charts/
│   ├── Sparkline.tsx
│   ├── BarChart.tsx
│   ├── LineChart.tsx
│   └── Donut.tsx
├── icons/
│   └── iconLib.tsx                ← export Icon = { home, cart, ... } (47 iconos en 1 archivo)
├── frames/
│   ├── LaptopFrame.tsx            ← 16:10 bezel para Hero artboards futuros
│   ├── TabletFrame.tsx            ← 4:3 / 3:4 para Touch artboards futuros
│   └── PhoneFrame.tsx             ← iPhone-style notch para Mobile artboards futuros
└── index.ts                       ← barrel export
```

### 4.2 Decisión: componente único vs split

Los 47 iconos se quedan en **un solo archivo** `iconLib.tsx` (como en el sandbox `system.jsx` que los declara con un factory `I(path, vb)`). Razón: en el sandbox son ~50 líneas total, no justifica 47 archivos. Tree-shaking de Vite los elimina cuando no se usan.

## 5. Design Tokens

### 5.1 Paleta neutra (`atlas-one.css`)

```css
:root {
  /* Warm canvas */
  --ao-canvas:   #F6F4EF;   /* app outer bg */
  --ao-page:     #FBFAF6;   /* page bg inside main */
  --ao-card:     #FFFFFF;   /* card surface */
  --ao-ink:      #0B0B0B;   /* primary text */
  --ao-body:     #2A2A28;   /* body text */
  --ao-muted:    #6B6B66;   /* secondary */
  --ao-faint:    #9C9B95;   /* tertiary */
  --ao-line:     #E8E5DD;   /* hairline */
  --ao-line2:    #D9D5CB;   /* stronger hairline */
  --ao-chip:     #F2EFE7;   /* chip / subtle fill */
  --ao-ink-dark: #0E0E10;   /* sidebar bg base */
  --ao-ink-soft: #19191C;

  /* Typography */
  --ao-font-sans:  'IBM Plex Sans', 'Montserrat', system-ui, sans-serif;
  --ao-font-mono:  'IBM Plex Mono', ui-monospace, monospace;
  --ao-font-serif: 'IBM Plex Serif', Georgia, serif;
}
```

### 5.2 PRESETS por industry (`tokens.ts`)

Port literal del sandbox. 11 entradas con accent/accent2/accentSoft/accentInk/tint/sidebar config.

Ejemplo:
```typescript
export const PRESETS = {
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
  // ... 10 más
} as const;

export type PresetKey = keyof typeof PRESETS;

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
  // legacy
  ATLAS_ONE_BEAUTY: 'beauty_wellness',
  ATLAS_ONE_GASTRO: 'restaurant',
};
```

### 5.3 Reconciliación con `index.css`

Tras crear `tokens.ts`, **actualizar** `frontend/src/index.css` para que los `--p-accent` por preset coincidan con `PRESETS[*].accent`:

| Preset | index.css actual | sandbox correcto | Acción |
|---|---|---|---|
| ATLAS_ONE_BARBER | #0891b2 | #0F766E | Update |
| ATLAS_ONE_BEAUTY_WELLNESS | #ec4899 | #B16E78 | Update |
| ATLAS_ONE_HEALTH | #06b6d4 | #0E9F9C | Update |
| ATLAS_ONE_RESTAURANT | #f97316 | #E2531B | Update |
| ATLAS_ONE_CAFE | #d97706 | #8B4A2B | Update |
| ATLAS_ONE_BAR | #7c3aed | #7C3AED | Match ✓ |
| ATLAS_ONE_RETAIL | #2563eb | #0B3A8F | Update |
| ATLAS_ONE_SERVICES | #10b981 | #0E7C5C | Update |
| ATLAS_ONE_ENTERPRISE | #a855f7 | #6D28D9 | Update |
| ATLAS_POS | #3b82f6 | #2563EB | Update |
| CUSTOM | (default) | #0A0A0A | Update |

## 6. Componentes — specs detallados

### 6.1 Sidebar

**Props**:
```typescript
interface SidebarProps {
  preset: PresetConfig;                              // preset.sidebar config
  active?: string;                                   // matching item.label
  items: (SidebarItem | { header: string })[];
  width?: number;                                    // default 224
  footer?: React.ReactNode;
}

interface SidebarItem {
  icon: IconKey;
  label: string;
  badge?: string | number;
}
```

**Render**:
- Container `bg: preset.sidebar.bg, color: preset.sidebar.fg, width, height: '100%'`.
- Top: padding 20px, logo + tagline opcional (puede omitirse en MVP).
- Items list: cada item con icon (size 18) + label, gap 12px.
- Active item: bar lateral de 3px `bg: preset.sidebar.accent`, item `bg: preset.sidebar.activeBg`.
- Headers: `font-family: var(--ao-font-mono), fontSize: 10px, color: preset.sidebar.mute, textTransform: uppercase, letterSpacing: 1.4px`.
- Badge: pill compacta a la derecha del item.
- Footer slot.

**NO reemplaza** `frontend/src/components/layout/Sidebar.tsx`. Coexiste; se usa solo en preset homes ricos cuando convenga.

### 6.2 Kpi

**Props**:
```typescript
interface KpiProps {
  label: string;
  value: string | number;
  delta?: string;        // "+12.4%" — color se infiere por signo
  trend?: number[];      // array para sparkline
  sub?: string;          // texto debajo del value
  accent?: string;       // color del sparkline (default: var(--p-accent))
}
```

**Layout**:
```
┌──────────────────────────┐
│ LABEL EN MONO UPPERCASE  │
│ $28,430                  │  ← value grande Sans 28-34px
│ ↗ +12.4%      ▁▂▃▅▇   ▁  │  ← delta + sparkline en row
└──────────────────────────┘
```

### 6.3 Charts (SVG puro)

**Sparkline**: polyline simple, width-derived viewbox, color = accent.
**BarChart**: array of bars con label opcional debajo, highlight (accent) vs soft (line).
**LineChart**: 1-2 series con grid horizontal opcional, x/y labels.
**Donut**: ring con percentage centrado, label debajo.

No usar Chart.js ni Recharts (ya existen en el repo pero el sandbox prefiere SVG inline puro stroke 2px).

### 6.4 Icons

47 iconos exportados como objeto:
```typescript
export const Icon = {
  home: ({ size = 18, color = 'currentColor', strokeWidth = 1.6 }) => <svg ...>...</svg>,
  cart: (...) => <svg ...>...</svg>,
  // ... 45 más
};
```

Path declarations son ports directos del sandbox `system.jsx` líneas 165-300+.

### 6.5 Helpers de formato

En `tokens.ts` (o `utils.ts`):
```typescript
export const mxn = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const mxnInt = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
```

## 7. Tipografía IBM Plex global

### 7.1 Estrategia

Importar IBM Plex (3 familias) en `frontend/src/styles/atlas-one.css` vía Google Fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Serif:wght@400;500;600;700&display=swap');
```

Y en `frontend/src/index.css` línea de body:

```css
body {
  font-family: 'IBM Plex Sans', 'Montserrat', system-ui, sans-serif;
  /* ... resto sin cambios */
}
```

### 7.2 Preconnect en `index.html`

Agregar a `frontend/index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

### 7.3 Riesgo + plan B

**Riesgo**: el cambio global puede causar reflow en cards estrechas (tablas POS, Platform admin). Plex es ligeramente más ancho que Montserrat.

**Plan B si rompe**: revertir a `font-family: 'Montserrat', ...` en `body`, y aplicar Plex SOLO en `.atlas-one-scope` (que envuelva los componentes nuevos). Decisión a tomar tras smoke test post-implementación.

## 8. Dev preview route

Crear `frontend/src/pages/__dev__/atlas-one-preview.tsx`:
- Ruta `/__dev__/atlas-one-preview` (no en sidebar, solo accesible por URL).
- Renderiza un layout que demuestra todos los primitivos: Sidebar (variando preset), Topbar, Kpi (4 ejemplos), Cards, Buttons, Badges, Charts (BarChart, LineChart, Donut, Sparkline), Icon grid completo, tabla de PRESETS con accent swatches.
- Equivale al `system-overview.jsx` portado.
- Permite QA visual y validar reconciliación con el sandbox.

Añadir ruta en `App.tsx` SOLO en development (gated por `import.meta.env.DEV`).

## 9. Acceptance criteria

- [ ] `frontend/src/components/atlas-one/` existe con todos los archivos listados en §4.1.
- [ ] `frontend/src/styles/atlas-one.css` importa IBM Plex y define `--ao-*` tokens.
- [ ] `tokens.ts` exporta `N`, `PRESETS` (11 entradas), `INDUSTRY_TYPE_TO_PRESET`.
- [ ] Los 47 iconos están en `iconLib.tsx` y son llamables como `<Icon.cart size={18} />`.
- [ ] Sparkline, BarChart, LineChart, Donut renderizan correctamente con sample data.
- [ ] Sidebar acepta props correctos y renderiza dark rail con accent por preset.
- [ ] Kpi muestra label + value + delta + sparkline alineados.
- [ ] Ruta `/__dev__/atlas-one-preview` carga sin errores y muestra todos los primitivos.
- [ ] `npm run build` pasa sin warnings.
- [ ] `tsc --noEmit` pasa sin errores.
- [ ] Páginas existentes (`/pos`, `/hq/operations`, `/platform/metrics`, `/products`, `/customers`) cargan sin regresiones visuales. Si Plex global rompe alguna, aplicar Plan B (§7.3).
- [ ] `index.css` accent colors reconciliados con `PRESETS[*].accent` del sandbox.

## 10. Out-of-scope (futuras olas)

- Aplicar primitivos a `PresetHome.tsx` — eso es SP-1.
- TabletFrame + PhoneFrame integradas en pages — son sub-proyectos Touch/Mobile futuros.
- Dark mode tokens (`--ao-bg-dark`, etc.) para Bar y Enterprise — entran en SP-5 cuando se necesiten.
- Migración global del Sidebar de layout — riesgo alto, no en MVP.

## 11. Verification

1. Manual visual: abrir `/__dev__/atlas-one-preview` en `localhost:5173` y comparar con `Atlas One UI Presets.html` del sandbox (`SystemOverview` artboard) abierto en otra pestaña.
2. Smoke de regresión: navegar `/pos`, `/products`, `/sales`, `/customers`, `/hq/operations`, `/platform/metrics`, `/platform/organizations` — verificar layout intacto.
3. TypeScript: `cd frontend && npx tsc --noEmit`.
4. Build: `cd frontend && npm run build`.

## 12. Siguiente paso

Una vez aprobado este spec, invocar `superpowers:writing-plans` para generar el plan de implementación paso-a-paso del SP-0.
