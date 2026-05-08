# Design Pack — Platform Metrics (Dashboard principal SUPERADMIN)

**Ruta:** `/platform/metrics` (landing por defecto de `/platform`)
**Archivo:** `frontend/src/pages/platform/PlatformMetrics.tsx`
**Audiencia:** SUPERADMIN único (panel SaaS cross-tenant, no operativo de día a día)
**Contexto visual:** Tema dark profundo, mono-acento azul. **NO** es el POS de un tenant — es la consola interna de la plataforma.

---

## 1. Objetivo de la pantalla

Vista global (cross-tenant) del estado de la plataforma Atlas:
- ¿Cuántas orgs hay y cómo crecen?
- ¿Cuánto se vende en total hoy / mes / últimos 30 días?
- ¿Qué industrias dominan?
- ¿Qué orgs son las más activas?
- ¿Quién se registró recientemente?

Debe responder esas 5 preguntas **en un solo scroll**, sin clicks.

---

## 2. Estructura actual (top → bottom)

```
PlatformPageShell
├── breadcrumb: "Platform / Metrics"
├── title: "Métricas globales"
├── kpis row (5 KPICard horizontales)
│   ├── Total Orgs           (+N vs hace 30 días, accent teal)
│   ├── Total Usuarios       (accent cyan)
│   ├── Ventas hoy           (Δ vs ayer, accent purple)
│   ├── Orgs nuevas (mes)    (accent magenta)
│   └── Tasa de actividad %  (accent warning)
│
├── Card: "Ventas cross-tenant — últimos 30 días"
│   └── AreaChart (height 320)
│       ├── Area: ventas diarias (teal, gradiente)
│       └── Line: promedio móvil 7d (cyan, dashed)
│
├── Grid 2 columnas (minmax 360px)
│   ├── Card: "Orgs por industria"
│   │   └── BarChart vertical (height 280)
│   │       • X = industria (DATAXPOS, RETAIL, CLINIC, ...)
│   │       • Y = count de orgs
│   │       • colores rotativos CHART_COLORS
│   │
│   └── Card: "Top 5 orgs por volumen"
│       └── Tabla: Nombre | Industry | Ventas mes | Ticket prom.
│           (row clickeable → /platform/organizations/:id)
│
└── Card: "Últimas 5 orgs creadas"
    └── Lista vertical de 5 items:
        [icono industria] Nombre · industry · fecha relativa · [StatusBadge]
        (row clickeable → detalle)
```

---

## 3. Datos que consume (ya existentes — no modificar backend)

| Fuente | Endpoint | Shape clave |
|---|---|---|
| `platformApi.globalStats()` | `/api/platform/stats` | `{ organizations: { total, delta_30d, new_this_month }, users, sales: { today, today_delta }, activity_rate }` |
| `platformApi.industryDistribution()` | `/api/platform/industry-distribution` | `[{ industry, count }]` |
| `platformApi.topTenants(5)` | `/api/platform/top-tenants` | `[{ id, name, industry_type, revenue, transactions }]` |
| `platformApi.trends()` | `/api/platform/trends` | `{ revenue_trend: [{ date, revenue }] }` |
| `platformApi.getOrgs()` | `/api/platform/organizations` | `[{ id, name, industry_type, created_at, is_active, status }]` |

Todas se llaman en paralelo dentro de un único `useEffect`.

---

## 4. Design tokens disponibles (usar SOLO estos)

```css
/* Fondos */
--p-bg:        #0A0A0F   /* lienzo página */
--p-surface:   #15151B   /* cards */
--p-surface-2: #1F1F26   /* hover, inputs */
--p-sidebar:   #08080C

/* Bordes + texto */
--p-border:    #26262E
--p-text:      #E8E8EA
--p-muted:     #6B6B78
--p-hint:      #44444E

/* Accent ÚNICO — azul (mono-acento, no violar) */
--p-accent:       #3B82F6
--p-accent-hover: #2563EB
--p-accent-soft:  rgba(59,130,246,0.12)

/* Semánticos (solo estado, NO decorativos) */
--p-success: #22C55E
--p-warning: #F59E0B
--p-danger:  #EF4444
--p-info:    #3B82F6

/* Reservados puntuales */
--p-magenta: #C026D3   /* badge SUPERADMIN únicamente */
--p-purple:  #7B2FBE

/* DEPRECATED (mantenidos para no romper) — NO usar */
--p-teal:    alias a accent
--p-cyan:    alias a accent
```

**Regla dura:** Esta v2 ya eliminó morado/magenta como primarios. El acento es **un solo azul**. Si el diseño propone 5 colores distintos en KPIs (como ahora), eso es deuda visual — considerar unificar.

---

## 5. Componentes primitivos reutilizables (ya existen)

Ubicación: `frontend/src/components/platform/`

| Componente | Uso |
|---|---|
| `PlatformPageShell` | Shell de página: breadcrumb + título + KPI row + children |
| `KPICard` | Tarjeta KPI con label, valor, delta opcional, accent, icono FA |
| `StatusBadge` | Badge de estado: `active` / `archived` / `inactive` |
| `DataTable` | Tabla estándar de plataforma (no usado aquí todavía) |
| `SideDrawer` | Panel lateral (no usado aquí) |
| `GradientAccent` | Acento decorativo |
| `ConfirmModal` | Confirmación destructiva |
| `chartTheme.ts` | `CHART_COLORS`, `chartAxisProps`, `chartGridProps`, `chartTooltipStyle`, `chartLegendProps` — **usar en todo Recharts** |

**Iconos:** Font Awesome (`fa-solid fa-<name>`). El map `INDUSTRY_ICON` está inline en el archivo — considerar extraer si se reusa.

---

## 6. Primitivas locales (dentro del archivo, candidatas a extraer)

- `Card({ title, children })` — contenedor genérico con título uppercase muted
- `EmptyState({ message })` — fallback centrado cuando no hay datos
- `Th`, `Td` — celdas de tabla con estilo consistente
- `ddmm()`, `buildTrendSeries()`, `chartCurrency()`, `deltaText()` — helpers de formato

Si el rediseño las unifica con `DataTable` / algún `Panel` compartido, mejor.

---

## 7. Comportamientos / interacciones

- **Loading state:** Spinner centrado a pantalla completa (sobre `--p-bg`).
- **Error:** Toast (`toast.error`). La pantalla queda vacía, no hay retry visible.
- **Hover en rows:** Background → `--p-surface-2`, border transparente → `--p-border` (sólo en la lista de "Últimas 5"; en la tabla de top 5 solo cambia background).
- **Click en row:** Navega a `/platform/organizations/:id`.
- **Responsive:** Grid industria + top-5 usa `repeat(auto-fit, minmax(360px, 1fr))` — colapsa a 1 columna en viewports estrechos. **No hay breakpoints mobile-first explícitos.** Los KPIs en fila pueden apretar mucho en <900px.
- **Gaps conocidos:** Algunas orgs no tienen `created_at` → se muestra "— sin fecha" y un disclaimer al pie.

---

## 8. Problemas detectados en la UI actual (feedback para el rediseño)

1. **5 KPIs con 5 accents distintos** (teal/cyan/purple/magenta/warning) — contradice la regla mono-acento azul de v2. Los accents `teal`/`cyan` son aliases al azul ahora, pero `purple`/`magenta` siguen siendo colores reales → rompen la paleta.
2. **Inline styles dominantes** — difícil de mantener y no aprovecha Tailwind (el resto del proyecto sí lo usa).
3. **Card local duplicada** — existe una `Card` en este archivo y otra en `components/ui/DaxCard`. Unificar.
4. **Sin skeleton loaders** — salto visual brusco entre spinner fullscreen y grid poblado.
5. **Sin delta en "Total Usuarios"** ni en "Orgs nuevas" ni en "Tasa de actividad" — inconsistente con los otros dos KPIs que sí tienen delta.
6. **Tabla Top-5 es muy densa** — sin breathing room, sin avatar/icono de industria que sí está en la lista de "Últimas 5".
7. **Leyenda del AreaChart** ocupa espacio pero solo tiene 2 entries — puede ir inline como sub-label.
8. **BarChart de industrias** con labels rotados -20° se ve incómodo; considerar horizontal.

---

## 9. Qué se espera del rediseño

- Respetar tokens `--p-*` (v2 azul).
- Mantener la misma densidad informativa (no quitar datos).
- Reducir colores decorativos — que el azul sea el héroe, semánticos solo para estado.
- Añadir skeletons.
- Proponer layout con jerarquía clara: **KPIs → tendencia → distribuciones → actividad reciente**.
- Mobile/tablet debe funcionar (hoy se rompe a ≤900px).
- Charts siguen siendo Recharts (no cambiar librería).
- Iconos siguen siendo FA (no cambiar).
- Mantener clickeabilidad: toda org listada lleva a `/platform/organizations/:id`.

---

## 10. Archivos a tocar si el rediseño se aplica

| Archivo | Rol |
|---|---|
| `frontend/src/pages/platform/PlatformMetrics.tsx` | Página — reescritura principal |
| `frontend/src/components/platform/KPICard.tsx` | Ajustes si cambia contrato de KPI |
| `frontend/src/components/platform/PlatformPageShell.tsx` | Ajustes si cambia el shell |
| `frontend/src/components/platform/chartTheme.ts` | Tokens de chart si cambian |
| `frontend/src/index.css` (líneas 41-70) | NO tocar (tokens v2 ya estables) |

**No tocar:** `frontend/src/api/platform.ts` (shape de datos ya definido), backend `app/routers/platform.py` (contratos estables).

---

## 11. Cómo iterar aisladamente

Dos opciones:

**A. Reescribir directo** — editar `PlatformMetrics.tsx`, ver en `/platform/metrics` logueado como SUPERADMIN.

**B. Sandbox route** — crear `frontend/src/pages/platform/PlatformMetricsV2.tsx` y añadir temporalmente ruta `/platform/metrics-v2` en `App.tsx`. Cuando esté validado, swap y borrar V1.
