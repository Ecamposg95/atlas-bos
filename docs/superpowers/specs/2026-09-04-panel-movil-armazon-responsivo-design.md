# Armazón responsivo y panel del día en móvil

**Fecha:** 2026-09-04
**Estado:** aprobado en conversación, pendiente de plan de implementación

## Problema

Jesús es dueño de Novedades Ginebra y abre Atlas ONE casi siempre desde el
teléfono. Hoy no puede trabajar ahí, por dos causas encadenadas.

**La primera es una condición de una línea.** En `frontend/src/App.tsx:161`,
`homePathForRole` manda al panel móvil solo cuando el rol es `DUEÑO`:

```ts
if (role === 'DUEÑO' && isMobile) return '/mobile/owner'
```

Jesús es `ADMINISTRADOR`. La ruta `/mobile/owner` sí lo admite —está protegida
con `RequireRole roles={['DUEÑO', 'ADMINISTRADOR']}` (`App.tsx:381`)— y la
navegación inferior móvil ya le dibuja un botón "Resumen" hacia ella
(`components/layout/MobileLayout.tsx:45`). Todo el andamiaje existe; nada lo
lleva ahí.

**La segunda es el armazón de escritorio, donde sí aterriza.** El `Sidebar`
declara `width: '244px', minWidth: '244px'` en estilo en línea
(`components/layout/Sidebar.tsx:328`) sin ninguna regla responsiva: ni oculto,
ni cajón, ni media query. En una pantalla de 360px se lleva el 68% y deja el
contenido en 116px.

### Medición del estado actual

Auditoría mecánica sobre `frontend/src` (77 vistas en `pages/`, 105 componentes):

| Medida | Valor |
|---|---|
| Vistas sin ningún punto de quiebre de Tailwind | 52 de 77 |
| Puntos de quiebre en uso en todo el proyecto | `lg` 63, `sm` 46, `md` 24, `xl` 4 |
| Archivos con `<table>` sin contenedor de scroll horizontal | 10 |
| Archivos con anchos fijos ≥ 400px | 6 |
| Vistas que usan `style={{ }}` en línea | 37 de 77 |

Los estilos en línea son la razón de fondo por la que esto no se arregla solo:
`style={{ width: '244px' }}` no admite punto de quiebre. Con clases de Tailwind
sería una línea; en estilo en línea hay que intervenir el componente.

## Alcance

Esta especificación cubre **la pieza 1 de cuatro**. El trabajo completo se
descompuso así, y cada pieza tiene su propio ciclo de especificación, plan e
implementación:

1. **Armazón responsivo + panel del día** ← esta especificación
2. Lector de códigos con la cámara, incluido el flujo que siembra los códigos
   faltantes (solo 3 de los 102 productos de Ginebra tienen código cargado)
3. Edición rápida de precio y existencia desde el móvil
4. Alta de productos en móvil

La pieza 1 junta armazón y panel porque separados no sirven: el armazón sin
panel no le resuelve nada a Jesús, y el panel sin armazón nace dentro de una
franja de 116px. Las piezas 3 y 4 van al final a propósito — son las que más
trabajo cuestan y las que menos duelen hoy.

### Fuera de alcance, deliberadamente

- **No** se corrigen las 52 vistas sin puntos de quiebre una por una. El arreglo
  del armazón las vuelve usables; dejarlas bien compuestas es un proyecto aparte.
- **No** se migran los 37 archivos con estilos en línea a Tailwind. Sería
  reescribir media aplicación sin que el usuario note diferencia.
- **No** se retira el árbol de rutas `/mobile`. Convive con el escritorio.

## Diseño

### 1. El sidebar se vuelve cajón por debajo de 768px

`components/layout/Sidebar.tsx` conserva sus 710 líneas y sus estilos en línea
intactos. El cambio va en `components/layout/Layout.tsx:87`, donde hoy se monta
`<Sidebar collapsed={collapsed} />` como hermano rígido de la columna de
contenido.

Se envuelve en un contenedor posicionado que decide su comportamiento según el
ancho, usando el hook `useIsMobile` que ya existe (`hooks/useIsMobile.ts`, punto
de quiebre 768px, que es `md` de Tailwind):

- **≥768px** — comportamiento actual, sin cambio visible: el sidebar es un
  hermano en el flujo y ocupa sus 244px.
- **<768px** — el contenedor pasa a `position: fixed`, ancho 244px,
  `transform: translateX(-100%)`, `z-index` por encima del contenido. Se abre
  con `translateX(0)`. Detrás aparece un fondo oscuro que cierra al tocarlo.

El estado de apertura vive en `Layout.tsx` junto al `collapsed` que ya maneja.
El cajón se cierra en tres situaciones: al tocar el fondo, al pulsar `Escape`, y
al cambiar de ruta —esta última es la que más se olvida y la que hace que el
cajón se sienta roto.

**Accesibilidad y movimiento:** el contenedor lleva `role="dialog"` y
`aria-modal="true"` cuando está abierto; el botón que lo abre lleva
`aria-expanded` y `aria-controls`. La transición respeta
`prefers-reduced-motion: reduce`, sin desplazamiento animado para quien lo pidió.

El botón de menú se agrega en la cabecera de `Layout.tsx`, visible solo por
debajo de 768px (clase `md:hidden`, que la cabecera ya usa en otros elementos —
ver `Layout.tsx:115,156,165`).

### 2. Las tablas ganan scroll horizontal

Se crea `components/ui/TablaDesplazable.tsx`: un envoltorio de una sola
responsabilidad que aplica `overflow-x: auto` y un borde redondeado consistente,
para que el cuerpo de la página nunca se desplace de lado.

```tsx
export function TablaDesplazable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">{children}</div>
}
```

Se aplica a los 10 archivos que hoy tienen `<table>` sin contenedor de scroll:

- `pages/platform/PlatformMetrics.tsx`
- `pages/platform/PlatformOrgDetail.tsx`
- `pages/platform/PlatformReports.tsx`
- `pages/pos/AtlasPOS.tsx`
- `components/branch/ProductsBranchView.tsx`
- `components/catalog/ProductBranchMatrix.tsx`
- `components/platform/DataTable.tsx`
- `components/platform/v2/CohortTable.tsx`
- `components/platform/v2/Leaderboard.tsx`
- `components/platform/v2/TopOrgsTable.tsx`

### 3. Los anchos fijos pasan a máximos

Seis archivos declaran anchos fijos de 400px o más. Cada `width: Npx` y
`minWidth: Npx` de ese conjunto pasa a `maxWidth: Npx` más `width: '100%'`, que
no cambia nada en escritorio y deja de desbordar en teléfono:

| Archivo | Anchos |
|---|---|
| `pages/platform/PlatformAlerts.tsx` | 900 |
| `pages/platform/PlatformAuditLog.tsx` | 900 |
| `components/pos/modals/CashPaymentModal.tsx` | 560 |
| `pages/pos/POS.tsx` | 420 |
| `components/catalog/ProductAuditDrawer.tsx` | 420 |
| `components/catalog/ProductBranchMatrix.tsx` | 420 |

### 4. Jesús llega a su panel

En `frontend/src/App.tsx:161`, la condición se amplía para incluir al rol
`ADMINISTRADOR`:

```ts
if ((role === 'DUEÑO' || role === 'ADMINISTRADOR') && isMobile) return '/mobile/owner'
```

Va **antes** de la rama que hoy resuelve a `/home` o `/hq/operations` para esos
mismos roles (`App.tsx:162-165`), de modo que en móvil gana el panel y en
escritorio no cambia nada.

### 5. El panel del día

Se reconstruye `pages/mobile/MobileOwnerDashboard.tsx` (hoy 178 líneas, hoy
alimentado solo por `reportsApi.dashboard`). El panel muestra cuatro bloques, en
este orden, que es el orden en que el dueño se pregunta las cosas:

**Cómo va el día.** Venta, tickets, utilidad y ticket promedio. En vivo durante
la jornada, no solo al cierre.

**Ritmo por hora.** Barras por franja horaria con importe y número de tickets.
Este bloque es el que hace visible un patrón que hoy no se ve: el 3 de
septiembre, ocho tickets se cobraron entre las 17:54 y las 17:59, y no hubo nada
registrado entre las 10:08 y las 17:54.

**Más vendidos.** Los productos del día con piezas e importe, y la proporción de
utilidad contra costo en cada uno. Es lo que deja ver que la lapicera de licencia
se vende en $94 con $83 de costo.

**Estado del corte.** Si la caja está abierta: fondo declarado y cuánto debería
haber en el cajón. Si ya cerró: contado, esperado y la diferencia.

#### De dónde salen los datos

Tres peticiones en paralelo contra endpoints que **ya existen**. No se agrega
superficie nueva al backend salvo el parámetro descrito en la sección 6:

| Bloque | Endpoint |
|---|---|
| Cómo va el día · Más vendidos | `GET /api/reports/daily-summary` |
| Ritmo por hora | `GET /api/reports/sales-by-hour` |
| Estado del corte | `GET /api/cash/status` |

Se resuelven con `Promise.all`. Si una falla, las otras se muestran igual y el
bloque afectado dice qué no pudo cargar — un panel que se cae entero porque el
corte no respondió es peor que uno incompleto.

### 6. `daily-summary` deja de forzar la sucursal del usuario

Hoy `app/routers/reports.py::get_daily_summary` filtra siempre por
`SalesDocument.branch_id == current_user.branch_id`, sin alternativa. Para un
dueño con varias sucursales eso no es visibilidad completa: es visibilidad de
una sola, sin decirlo.

Se le agrega un parámetro opcional `branch_id`, replicando **exactamente** la
convención que ya usa `get_sales_by_hour` en el mismo archivo
(`app/routers/reports.py:517`), para no introducir una segunda forma de decir lo
mismo:

```python
is_hq_user = current_user.role in ["ADMINISTRADOR", "GERENTE", "DUEÑO"]
target_branch_id = current_user.branch_id
if is_hq_user:
    if branch_id == 0:
        target_branch_id = None      # 0 = toda la organización
    elif branch_id:
        target_branch_id = branch_id
```

El filtro por sucursal se aplica solo cuando `target_branch_id` no es nulo, y
las cuatro consultas de la función lo usan de forma uniforme. Hoy las cuatro ya
filtran por `current_user.branch_id` —quedó así en `137e06e`, del 2026-09-03—;
lo que cambia es de dónde sale ese valor, no cuántas consultas lo aplican.

**Un rol sin oficina central nunca puede ver otra sucursal:** para un `CAJERO`,
`is_hq_user` es falso y `target_branch_id` se queda en su propia sucursal sin
importar qué mande en el parámetro. Esto es una prueba, no una nota.

Ginebra tiene una sola sucursal hoy. El cambio importa porque la base de datos
del VPS aloja a varios clientes y algunos sí tienen más de una.

## Pruebas

**Backend** (`pytest`, SQLite en memoria). Se extiende
`tests/test_reports_daily_summary.py`, que ya existe con cuatro pruebas:

- Un `ADMINISTRADOR` con `branch_id=0` ve el total de las dos sucursales.
- Un `ADMINISTRADOR` con `branch_id` de otra sucursal ve esa y no la suya.
- Un `CAJERO` que manda el `branch_id` de otra sucursal sigue viendo la suya.
- Sin parámetro, el comportamiento es idéntico al actual.

**Frontend** (`vitest`, ya configurado con 13 pruebas). La lógica se extrae a
funciones puras para poder probarla sin montar componentes:

- `homePathForRole`: cada rol por cada valor de `isMobile`, incluida la
  regresión concreta de que `ADMINISTRADOR` en móvil resuelve a `/mobile/owner`.
- La reducción de la respuesta de `sales-by-hour` a las barras del panel,
  incluidos el caso de cero ventas y el de una sola franja.

**Verificación de tipos y compilación:** `tsc` y `vite build`, que es lo que
corre el CI.

**Verificación visual:** capturas a 360px de ancho —el teléfono real de Jesús—
del panel y de tres vistas de escritorio con el cajón abierto y cerrado.

## Riesgos

**El cajón puede tapar contenido en tablets.** El punto de quiebre de 768px es
el de `useIsMobile`, ya usado en el resto de la aplicación. Reusarlo es
deliberado: introducir un segundo umbral crearía dos definiciones de "móvil".

**`POS.tsx` y `AtlasPOS.tsx` son pantallas críticas de cobro.** El cambio de
`width` a `maxWidth` en `POS.tsx` y el envoltorio de tabla en `AtlasPOS.tsx`
tocan el camino del checkout. Se verifican a mano en escritorio antes de
fusionar: un cambio de composición que rompa el cobro es peor que un teléfono
incómodo.

**El panel muestra dinero.** Las cifras salen de `daily-summary`, que hasta el
2026-09-03 tenía dos defectos corregidos ese día: reventaba con 500 por un
miembro de enum inexistente, y contaba el vuelto como efectivo cobrado. El panel
hereda esa corrección; cualquier cifra que no cuadre contra el corte de caja es
un defecto, no una diferencia de criterio.
