---
name: platform-admin-ui
description: >
  Aplicar el design system de Atlas POS nivel SUPERADMIN (/platform/*) a cualquier
  módulo React. Usar este skill cuando se trabaje en PlatformMetrics, PlatformOrganizations,
  PlatformOrgDetail, PlatformUsers, PlatformBranches, PlatformPresets, PlatformModules,
  PlatformAdmins o PlatformAuditLog. También usar cuando se creen nuevos componentes
  bajo /components/platform/. Siempre leer antes de escribir cualquier JSX o CSS
  de estos módulos.
---

# Atlas POS — Platform Admin UI Skill (v2 · Apr 2026)

> Nivel: SUPERADMIN / SUPPORT. Rutas: `/platform/*`
> Lenguaje visual: **mission-control sobrio, mono-acento azul**, dark casi-pitch.
> Inspiración: Taskplus, Lunor, Cypress (school), Over9k Kanban — dashboards
> pro-grade donde el dato manda y el cromatismo está al servicio de la jerarquía,
> no del estilo.

---

## v2 changelog (vs v1)

- **Acento principal cambia de teal/cyan a azul `#3B82F6`**.
- **Eliminados purple/magenta como acentos primarios**. Se mantienen como
  semánticos secundarios solo si el caso lo justifica explícitamente
  (badge SUPERADMIN, hero callout puntual). Nada de gradientes rainbow.
- **KPICard sin border-top de color por default** — el dato se valoriza por
  tipografía, no por decoración.
- **Bases más oscuras** (`#0A` en vez de `#14`).
- **Sidebar como tarjeta separada** opcional (estilo Taskplus) — bg más oscuro
  que el content well, separada por gap del lienzo.
- **Charts**: 1 color sólido + 1 variante punteada o hatched. Cero rainbow.
- **Status pills**: solid filled (no gradient ni glow).

---

## Principios de diseño

1. **El número manda.** En cualquier panel, el dato dominante (KPI, contador,
   métrica) ocupa la mayor jerarquía tipográfica. Decoración cero.
2. **Mono-acento azul.** Cualquier elemento interactivo primario, link activo
   o CTA usa `--p-accent` (azul). Verde/rojo/ámbar son **solo semánticos**
   (success/danger/warning), no decorativos.
3. **Dark base profunda.** Page bg `#0A0A0F`. Cards `#15151B`. Bordes apenas
   visibles `#26262E`. Cero gradientes en background.
4. **Densidad con respiración.** Tablas pueden ser densas (12px row padding
   ok), pero entre secciones siempre `gap: 1.25rem+`.
5. **CRUDs en SideDrawer**, nunca en página separada.
6. **Operaciones destructivas**: `ConfirmModal` con typed-name del recurso.
7. **Charts mínimos**: 1-2 series, paleta restringida, eje muted, sin grid
   recargado.

---

## Tokens CSS (v2)

```css
:root {
  /* Backgrounds — más oscuros */
  --p-bg:        #0A0A0F;   /* página, lienzo principal */
  --p-surface:   #15151B;   /* cards, panels, tabla rows */
  --p-surface-2: #1F1F26;   /* hover states, inputs, sub-panels */
  --p-sidebar:   #08080C;   /* sidebar — más oscuro que el lienzo */
  --p-border:    #26262E;   /* dividers, card borders sutiles */

  /* Texto */
  --p-text:      #E8E8EA;   /* primario */
  --p-muted:     #6B6B78;   /* secundario, labels, captions */
  --p-hint:      #44444E;   /* placeholder, disabled */

  /* Accento ÚNICO — azul */
  --p-accent:        #3B82F6;   /* CTA primario, links activos, focus */
  --p-accent-hover:  #2563EB;   /* hover */
  --p-accent-soft:   rgba(59,130,246,0.12);  /* bg de chips/badges activos */

  /* Semánticos (solo para estado, NO decorativos) */
  --p-success:   #22C55E;
  --p-warning:   #F59E0B;
  --p-danger:    #EF4444;
  --p-info:      #3B82F6;   /* alias de accent */

  /* Reservados — uso muy puntual (badge SUPERADMIN, no decorativo) */
  --p-magenta:   #C026D3;
  --p-purple:    #7B2FBE;
}
```

> **Tokens deprecated** (siguen para no romper builds, pero NO usar en código nuevo):
> `--p-teal`, `--p-cyan`, `--p-gradient`. Si los ves en el código existente,
> migrar a `--p-accent` o quitar.

---

## Tipografía

```css
font-family: 'Montserrat', sans-serif;
```

| Rol | Weight | Size |
|---|---|---|
| KPI número grande | 800 | 2rem–3rem (lineHeight 1) |
| Welcome / título de bienvenida | 600 | 1.5rem |
| Título de módulo | 700 | 1.25rem |
| Heading de sección | 600 | 0.85rem, **uppercase** o regular según contexto |
| Tabla header | 600 | 0.7rem, uppercase, letter-spacing 0.08em, color muted |
| Body / tabla cell | 400 | 0.875rem |
| Label / caption | 500 | 0.75rem, color muted |
| Badge/pill | 700 | 0.65rem, uppercase, letter-spacing 0.06em |

---

## Layout base de módulo `/platform/*`

```jsx
<div style={{ background: 'var(--p-bg)', minHeight: '100vh', padding: '2rem' }}>

  {/* Header — título grande "Welcome back" o nombre de módulo */}
  <div style={{ marginBottom: '1.5rem' }}>
    <p style={{ fontSize: '0.7rem', color: 'var(--p-muted)', textTransform: 'uppercase' }}>
      Platform / [Sección]
    </p>
    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--p-text)' }}>
      [Título]
    </h1>
  </div>

  {/* KPI strip — sin border-top de color */}
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
    {/* KPICard × N */}
  </div>

  {/* Contenido — grids de 2-3 columnas */}
  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginTop: '1rem' }}>
    {/* DataTable + side panel, etc. */}
  </div>

</div>
```

---

## Componentes

### KPICard (v2 — sin border-top color)

```jsx
<div style={{
  background: 'var(--p-surface)',
  border: '1px solid var(--p-border)',
  borderRadius: 8,
  padding: '1.25rem 1.5rem',
}}>
  <p style={{
    fontSize: '0.7rem', color: 'var(--p-muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    margin: '0 0 12px',
  }}>
    {label}
  </p>
  <p style={{
    fontSize: '2rem', fontWeight: 800,
    color: 'var(--p-text)', margin: 0, lineHeight: 1,
  }}>
    {value}
  </p>
  {delta && (
    <p style={{
      fontSize: '0.75rem', marginTop: '4px',
      color: deltaPositive ? 'var(--p-success)' : 'var(--p-danger)',
    }}>
      {deltaPositive ? '+' : ''}{delta} vs mes anterior
    </p>
  )}
</div>
```

**Regla:** el `accent` prop legacy (`teal`/`cyan`/`purple`/`magenta`) deja de
afectar el border-top. Si se pasa, lo ignoramos. Solo se usa `accent='danger'`
o `'warning'` para tintar el número (caso "Eventos críticos hoy") muy puntual.

### DataTable

Sin cambios estructurales vs v1. Estilos:

```jsx
const tableStyles = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  thead: { background: 'var(--p-surface-2)' },
  th: {
    padding: '10px 14px', textAlign: 'left', color: 'var(--p-muted)',
    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em',
    fontWeight: 600, cursor: 'pointer', userSelect: 'none',
    borderBottom: '1px solid var(--p-border)',
  },
  td: {
    padding: '12px 14px', borderBottom: '1px solid var(--p-border)',
    color: 'var(--p-text)', verticalAlign: 'middle',
  },
}
```

Toolbar: search input, CSV export. Activo state usa `var(--p-accent)`.

### StatusBadge (v2 — solid filled, paleta neutralizada)

```jsx
const statusConfig = {
  active:    { label: 'Activo',    bg: 'rgba(34,197,94,0.12)',  color: 'var(--p-success)' },
  inactive:  { label: 'Inactivo',  bg: 'rgba(107,107,120,0.18)', color: 'var(--p-muted)' },
  beta:      { label: 'BETA',      bg: 'rgba(245,158,11,0.15)', color: 'var(--p-warning)' },
  stable:    { label: 'Stable',    bg: 'rgba(59,130,246,0.12)', color: 'var(--p-accent)' },
  archived:  { label: 'Archivado', bg: 'rgba(239,68,68,0.12)',  color: 'var(--p-danger)' },
  superadmin:{ label: 'SUPERADMIN',bg: 'rgba(192,38,211,0.15)', color: 'var(--p-magenta)' },
  support:   { label: 'SUPPORT',   bg: 'rgba(59,130,246,0.15)', color: 'var(--p-info)' },
}
```

Solo `superadmin` mantiene magenta para diferenciar del rol SUPPORT (color
de cargo). Resto = neutralizado.

### SideDrawer

Sin cambios — 480px, ESC + overlay. CTA primario: `background: var(--p-accent)`,
color blanco (no negro como en v1).

### GradientAccent (DEPRECATED)

No usar en componentes nuevos. Si existe, removerlo. Si una hero card necesita
una línea decorativa, usar borde sólido azul:

```jsx
<div style={{ borderTop: '2px solid var(--p-accent)' }} />
```

### ConfirmModal

Sin cambios estructurales. Border accent: `var(--p-danger)` para destructive,
`var(--p-accent)` para confirmaciones positivas.

---

## Charts (Recharts)

Paleta restringida: 1-2 series. Variante: solid + dashed.

```jsx
const CHART_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#6B6B78']
// Solo 5 colores — uso semántico:
// blue = primary data
// green = positive trend
// amber = warning trend
// red = critical
// gray = secondary/comparison

// Defaults compartidos:
// CartesianGrid: strokeDasharray="3 3" stroke="#26262E"
// XAxis/YAxis: tick={{ fill: '#6B6B78', fontSize: 11 }}, axisLine={{ stroke: '#26262E' }}
// Tooltip: contentStyle={{ background: '#1F1F26', border: '1px solid #26262E', borderRadius: 4 }}
```

**Patrones por gráfica:**
- AreaChart: `fill="url(#blueGradient)" stroke="#3B82F6"` con linear gradient
  fade-out vertical.
- LineChart: 2 series — solid + dashed (si comparas hoy vs ayer/promedio).
- BarChart: barras de UN color sólido (`#3B82F6`), no rainbow. Si necesitas
  diferenciar categorías, usa la paleta de 5 colores semánticos en orden.
- PieChart: máx 5 slices con la paleta semántica.

---

## Sidebar

Dos variantes válidas:

**(A) Sidebar pegada al borde** (default):
- Width 244px expandido / 72px contraído.
- Bg `var(--p-sidebar)` (más oscuro que el content).
- Active item: bg `rgba(59,130,246,0.18)` + border-left 2px `var(--p-accent)`.

**(B) Sidebar como tarjeta** (Taskplus style):
- Sidebar dentro de un wrapper con `padding: 1rem` del page bg.
- La sidebar misma es una `<div>` con `border-radius: 12px` + `var(--p-sidebar)`.
- Separada del content por gap.
- Útil cuando se quiere look "premium SaaS".

Default = (A). Usar (B) solo si lo pide explícitamente el módulo.

---

## Hooks compartidos recomendados

```js
usePlatformData(endpoint, params)   // fetch con auth platform_role
usePlatformTable(data, columns)     // sort, filter, paginate
usePlatformDrawer()                 // open/close/mode del SideDrawer
usePlatformExport(data, filename)   // CSV export
```

---

## Patrones por módulo

### `/platform/metrics`
- Welcome header con saludo opcional.
- KPI strip: Total Orgs, Total Usuarios, Ventas Cross-Tenant hoy, Orgs nuevas,
  Tasa de actividad (con deltas en `--p-success`/`--p-danger` según signo).
- AreaChart de ventas 30d — 1 serie sólida azul + 1 dashed para promedio móvil.
- Grid 2 columnas: BarChart industria (solid blue por barra) + Top 5 orgs.
- Panel inferior: Últimas 5 orgs creadas.

### `/platform/organizations`
- KPI strip: Total, Activas, Archivadas, Nuevas este mes — todos sin border-top.
- DataTable: nombre, industry, módulos, usuarios, sucursales, status, acciones.
- Status pills solid: active=success, archived=danger.
- Filtros chip: industry multi-select, status, fecha rango.
- "Nueva organización" → SideDrawer con preset selector.
- Row actions: Detalle, Editar, Archivar, Eliminar (typed-name confirm).

### `/platform/organizations/:orgId`
- Header con breadcrumb. Industry badge solid + status badge.
- Sección Módulos: grid de toggles. Toggle activo = `var(--p-accent)`.
  BETA/STABLE badges del StatusBadge.
- Sección Preset: selector + preview. Apply con typed-name si desactiva
  módulos existentes.
- Tabs Sucursales / Usuarios.
- Danger Zone: bg `rgba(239,68,68,0.04)` + border `var(--p-danger)`.

### `/platform/users`
- KPI strip + DataTable cross-tenant.
- Reset password retorna temp pwd en modal con copy-to-clipboard (botón
  `var(--p-accent)`).
- Cambiar rol en mini drawer.
- SUPPORT enmascara emails (`u***@domain.com`).

### `/platform/branches`
- KPI strip: Total, Activas ahora, Promedio por org, Con alertas
  (count en `var(--p-danger)` si > 0).
- DataTable cross-org. Badge rojo en filas con alertas.
- Panel lateral on-row-click muestra alertas.

### `/platform/presets`
- Cards (no DataTable — visual richness). Cada card con header, industry chip,
  modules pills, orgs-using count, footer con Editar/Duplicar/Eliminar.
- System presets badge SUPERADMIN-style (magenta) + warning al editar.

### `/platform/modules`
- DataTable: key, nombre, scope, status (BETA/STABLE), presets count,
  orgs activas count.
- Cargar counts en UNA query agregada (`/platform/modules/counts`).
- Click en fila → SideDrawer dependencias completas.

### `/platform/admins`
- Solo SUPERADMIN — SUPPORT ve panel 403.
- DataTable + invite drawer + audit trail panel.
- Self-revoke deshabilitado (no puedes revocarte a ti mismo).

### `/platform/audit`
- KPI strip: Eventos hoy, Críticos 24h, Admins activos, Orgs afectadas hoy.
- DataTable con sort timestamp DESC default + filtros (date range, admin,
  action, org, result).
- LineChart 30d — 2 series (total azul + críticos rojo dashed).
- PieChart distribución por familia.
- Export CSV crítico.
- SUPPORT enmascara IPs (`***.***.*.*`) y emails.

---

## Reglas de implementación para Claude Code

1. **Leer este skill antes de tocar cualquier archivo bajo `/platform/` o
   `/components/platform/`.**
2. Usar tokens `var(--p-*)`. NO hex hardcoded excepto en la definición misma
   y en `chartTheme.ts` (recharts requiere strings).
3. KPI strip por módulo — mínimo 3 métricas relevantes.
4. CRUDs siempre en SideDrawer.
5. Tablas: search local + sort por header click + paginación 20 + CSV export.
6. SUPPORT vs SUPERADMIN: enmascarar datos sensibles (emails, IPs) y
   deshabilitar acciones destructivas en frontend; backend además debe
   `Depends(require_superadmin)` en los endpoints destructivos.
7. Confirm destructivas con typed-name del recurso.
8. Errores de API → toast no bloqueante. Nunca romper la UI completa.
9. **Sin morado/magenta como acento primario** (regla v2 dura). Solo se
   admite magenta para SUPERADMIN role badge y elementos puntuales. Cualquier
   accent visible debe ser azul `var(--p-accent)`.
10. **Sin gradientes rainbow.** Si hay un border decorativo, es sólido o
    deprecado.
