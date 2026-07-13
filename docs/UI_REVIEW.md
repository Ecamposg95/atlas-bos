# Revisión de interfaz + Plan de ejecución (Fase 5) · Atlas One

Revisión de las **76 vistas** del frontend (7 agentes en paralelo, julio 2026) contra los objetivos:
**dark + tema claro sólidos, paleta restringida (sin arcoíris), consistencia y pulido fino.**
Es el backlog accionable para ejecutar página por página.

> Referencia estructural: [`FRONTEND_VIEWS.md`](FRONTEND_VIEWS.md). Regla de trabajo: una pantalla, preview, OK, subir.

---

## 1. Diagnóstico sistémico (lo que mueve la aguja)

Ordenado por apalancamiento. Estos son globales — arreglarlos toca muchas vistas a la vez.

1. **Dos sistemas de tokens, uno dark-only.** La app usa `--dax-*` (con modo claro real). El **panel Platform usa `--p-*`**, definido una sola vez en valores oscuros **sin override de tema → DARK-ONLY**. Al alternar el tema global, todo `/platform/*` sigue negro. Decisión pendiente: (A) documentarlo como consola de ops dark-only, o (B) duplicar los ~12 tokens de superficie bajo `html.light .pv2`.
2. **Bug de identidad: `--p-teal/-cyan/-magenta/-purple` se re-sobrescriben por vertical de negocio** (`index.css:104-146`). Como varias vistas platform (tenant-agnósticas) los usan, **el color del super-admin cambia según qué preset esté activo.** Colapsar a `--p-accent` + semánticos.
3. **Un solo acento = indigo/violet** (`--dax-accent`). Hay acentos "fantasma" que lo contradicen y hay que matar: **purple** (POS spinner/tab, MobileOwnerDashboard hero), **violet** de marca (HQReportsHub), **fuchsia/cyan** (AdminCatalog), **teal/cyan/magenta** (todo el panel v1).
4. **El shim `html.light` NO rescata** hex inline ni tonos decorativos/semánticos `text-{emerald,amber,indigo,sky,violet,rose,orange}-300/400`. Rinden el mismo hex en ambos temas → `amber-400`/`emerald-400` quedan **bajo contraste sobre el lienzo claro**. Es el vector real de "rompe en claro". Fix: tokenizar esos tonos o extender el shim para mapearlos a `-600/-700` en `html.light`.
5. **Charts hardcodeados a oscuro.** chart.js en HQ (tooltip/grid/ticks/datasets) y `METHOD_COLORS`/`PAYMENT_COLORS` como literales — además **duplicados y divergentes** (CARD `#0ea5e9` en HQOperations vs `#6366f1` en HQReportsHub vs otro en PlatformMetrics). Un solo `chartTheme.ts` theme-aware + un único mapa de colores de método de pago.
6. **`alert()`/`confirm()`/`window.prompt()` crudos** por todos lados (16+ solo en finanzas/core; más en POS, inventario, gastro) **pese a que ya existen `useConfirm` + `Toast`** sin usar.
7. **Bugs de token:** `--dax-surface-raised` **no está definida en ningún tema** (usada en `ProductImageUploader` → fondo transparente); `PlatformCashAudit` usa fallback `#fbbf24` que **no coincide** con `--p-warning` real (`#F59E0B`).
8. **a11y transversal:** botones icono-solo sin `aria-label` (±, ✕, ojo, refresh), sin `focus-visible`; indicadores solo-color sin label textual.

---

## 2. La regla de color (spec del sistema restringido)

Una idea, aplicada en todas las vistas:

- **Neutro por defecto** — todo lo estructural vía token (`--dax-text/-muted/-faint`, `--dax-surface`, `--dax-border`, `.dax-card`).
- **1 acento = indigo/violet** (`--dax-accent`) — botón primario, estado activo, y **un** highlight por pantalla. Matar purple/violet/fuchsia/cyan/teal/magenta.
- **3 semánticos** — verde = éxito/dinero/libre · ámbar = atención/pendiente · rojo = peligro/merma/error. Nada más.
- **Regla de oro por tarjeta:** máx 1 acento + 1 semántico visible. Iconos de header neutros; KPIs en tinta, solo el KPI con estado se colorea (mata el arcoíris de KPIs por-métrica).
- **Excepciones documentadas (no tocar):** `Login` (full-screen animado, `login.css`), `Startup` (onboarding inmersivo), `__dev__/AtlasOnePreview` (artboard dev). Y decisión pendiente sobre Platform (dark-only).

---

## 3. Componentes compartidos a construir (fundación de Fase 5)

Extraídos por **frecuencia medida** en la revisión. Construirlos primero desbloquea el reskin de casi todas las vistas.

| Componente | Reemplaza / mata | Aparece en |
|---|---|---|
| **`<PageHeader icon title badge? actions>`** | ~3 patrones de header reescritos a mano | prácticamente todas (10 HQ, 8 POS, 9 inv, 10 core, 5 móvil) |
| **`<KpiGrid>` + `<KpiCard>`** (set fijo de acentos) | el KPI arcoíris por-métrica | HQ, POS, finanzas, móvil, gastro |
| **`<Modal>`** accesible (role=dialog, focus-trap, ESC) | ~11 shells de modal inline no accesibles | CashHistory×2, Expenses, Purchases×2, Customers×2, HR, Users, Organization, gastro |
| **`<DetailModal>` / `<LineItemsTable>`** | el modal de detalle de documento duplicado | SalesHistory, Quotes, Returns, Seguimiento, HQSalesLog |
| **`<SegmentedTabs>` / `<FilterPills>`** | 4+ variantes de chip/tab seleccionable | Purchases, Reports, Portal, Organization, Boxes, gastro, POS |
| **`<StatusBadge>`** (sobre `dax-badge-*`) | `ApprovalBadge`/`BranchBadge`/`roleVariant`/`QUOTE_STATUS`/`STATUS_CLASS` inline | AdminCatalog, Users, Portal, Logistics, Products |
| **`<EmptyState icon text>`** | `p-12 text-center text-slate-600` con/sin icono | todas |
| **`chartTheme.ts` / `useChartTheme()` + `paymentColor()` único** | chart.js hardcodeado + 3 `PAYMENT_COLORS` divergentes | HQOperations, HQReportsHub, Reports, PlatformMetrics |
| **`useConfirm` + `Toast`** (¡ya existen!) | los 16+ `alert()`/`confirm()`/`prompt()` | transversal |
| **`<ProductForm variant>`** único | los **5 formularios de producto** (ProductModal, MiniModal, AdminProductCreate, AdminCatalog delega) | dominio productos |
| **`<QtyStepper>` + `<CustomerAutocomplete>` + `<ProductResultRow>`** | steppers/autocompletes reinventados (posible reuso móvil↔desktop) | QuoteMaker, MobileSales, MobileQuery |

**Fixes de token de una vez:** definir `--dax-surface-raised`; colapsar `--p-teal/cyan/magenta/purple`→`--p-accent`; añadir `--p-{accent,success,warning,danger}-soft` y una escala `--p-danger-1..3` para los tints inline del panel.

---

## 4. Backlog por dominio (severidad de "rompe en claro" + top fix)

| Dominio | Peor(es) vista(s) | Rompe claro | Ruido color | Top fix |
|---|---|---|---|---|
| **HQ** | HQOperations (grave) | charts oscuros + textShadow glows | 7-8 hues, violet vs indigo | chartTheme compartido; consolidar 3 dashboards duplicados; acento único indigo |
| **POS/Ventas** | PrinterSettings, POS | 8+ hex inline (rompe claro **y dark**) | purple vs indigo | hex→tokens semánticos; matar purple; toast local→store |
| **Inventario/Prod** | AdminCatalog | badges `-300`+fuchsia/cyan; inputs/tablas hand-rolled | 7+ hues (peor) | migrar a `.dax-input`/`.dax-table`/`dax-badge`; colapsar 5 forms de producto |
| **Finanzas/CRM/HR/Core** | Portal, Users | (sin hex inline ✔) amber/emerald-400 bajo contraste | roleVariant + QUOTE_STATUS arcoíris | erradicar 16 alert/confirm; podar 4º/5º hue; StatusBadge |
| **Móvil** | MobileOwnerDashboard | dark-only-intencional (riesgo latente) | **purple** (único en la app) | matar purple; cards→DaxCard; aria en ±/✕; alert→inline |
| **Platform (todos)** | OrgDetail, Presets | **DARK-ONLY** (arquitectural) | teal/cyan/magenta/purple que **mutan por vertical** | soporte tema claro `.pv2` (decisión); colapsar off-palette a accent; v1→v2; spinner→SkeletonState |
| **Gastro** | FloorPlan, Botellas, MenuVisual | MenuVisual chip `#cbd5e1` invisible en claro | FloorPlan 6 hues KPI | Botellas: prompt→modal + `<Button>` + accent dinámico; FloorPlan podar arcoíris; RecipeForm→`.dax-input` |

### Modelos a imitar (ya buenos)
- **HQReturns** — 2 hues, `Badge`, tokens en inline styles (oro de HQ).
- **AtlasPOS / Seguimiento** — `DaxCard`/`dax-table`/`Badge`, paleta limpia.
- **Inventory** — patrón correcto de tokens.
- **Reports** — único que adapta el chart al tema (`useTheme`).
- **HRMe** — set completo de estados (loading + error + success banner auto-dismiss).
- **HR** — la paleta más disciplinada (1 hue + Badge).
- **PlatformFlags / PlatformHealth** — v2 ejemplar (DataTable + KPICardV2 + SkeletonState).
- **MobileOwnerDashboard** — único móvil con dual-theme correcto (pero mata el purple).

---

## 5. Plan de ejecución (Fase 5)

**Orden recomendado** — fundación global primero (bajo riesgo visual, alto apalancamiento), luego reskin página por página con preview.

1. **Fundación de tokens/CSS** (invisible, global):
   - Definir `--dax-surface-raised`; extender el shim `html.light` para mapear los tonos decorativos `-300/-400` a variantes con contraste (o migrarlos a tokens semánticos `--dax-{ok,warn,risk}`).
   - Un solo `chartTheme.ts` theme-aware + `paymentColor()` único.
   - Decidir tema del panel Platform: documentar dark-only **o** añadir `html.light .pv2` con los 12 tokens claros. Colapsar `--p-teal/cyan/magenta/purple`→`--p-accent` (mata el bug de vertical).
2. **Componentes compartidos** (§3): `PageHeader`, `KpiGrid/KpiCard`, `Modal` accesible, `DetailModal`, `SegmentedTabs`, `StatusBadge`, `EmptyState`. Cablear `useConfirm`+`Toast`.
3. **Reskin página por página** (una, preview, OK, subir) en este orden de impacto:
   - **Gastro primero** (petición original): Botellas → Recetas/RecipeForm → MenuVisual → FloorPlan → KDS → Home del día → Comanda.
   - Luego los peores focos: AdminCatalog, HQOperations, PrinterSettings, POS, Portal.
   - Barrido de los demás (mayoría ya sólidos, solo tokenizar tonos + `alert`→toast + `aria-label`).
4. **Unificaciones estructurales** (una vez limpias las bases): colapsar los 5 forms de producto en `ProductForm`; consolidar los 3 dashboards HQ; migrar Platform v1→v2.
5. **a11y sweep**: `aria-label` en botones icono-solo, `focus-visible`, labels textuales en indicadores solo-color.

> Esfuerzo: la fundación (pasos 1-2) es 1-2 días y desbloquea todo. Cada reskin de pantalla es incremental y validable por separado.
