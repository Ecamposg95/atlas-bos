# Armazón responsivo y panel del día en móvil — Plan de implementación

> **Para agentes ejecutores:** SUB-HABILIDAD REQUERIDA: usa
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans` para implementar tarea por tarea. Los pasos usan
> casillas (`- [ ]`) para seguimiento.

**Objetivo:** que Jesús pueda ver y operar su negocio desde el teléfono, con un
armazón que no le robe dos tercios de la pantalla y un panel que le diga cómo va
el día.

**Arquitectura:** el sidebar de 244px se envuelve —sin reescribir sus 710 líneas
de estilos en línea— en un contenedor que por debajo de 768px se comporta como
cajón deslizante. La lógica que hoy vive dentro de componentes (a qué ruta va
cada rol, cómo se arman las barras por hora, cómo se lee el estado del corte) se
extrae a funciones puras en `utils/`, que es lo único que `vitest` puede probar
en este proyecto. El panel se alimenta de tres endpoints que ya existen.

**Stack:** React 18 + TypeScript + Vite + Tailwind en el frontend; FastAPI +
SQLAlchemy en el backend. Pruebas: `pytest` (SQLite en memoria) y `vitest`.

**Especificación:** `docs/superpowers/specs/2026-09-04-panel-movil-armazon-responsivo-design.md`

## Restricciones globales

- El punto de quiebre móvil es **768px**, el de `hooks/useIsMobile.ts`. No
  introducir un segundo umbral: crearía dos definiciones de "móvil".
- `vitest.config.ts` declara `environment: 'node'` e `include: ['src/**/*.test.ts']`.
  **Solo se pueden probar archivos `.ts`, no `.tsx`.** Toda lógica que deba
  probarse va extraída a una función pura en `src/utils/`.
- Toda consulta de negocio filtra `organization_id` (la columna se llama así,
  nunca `org_id`).
- La suite de backend corre en SQLite; producción es PostgreSQL 18.
- `frontend/src/pages/pos/POS.tsx` y `frontend/src/pages/pos/AtlasPOS.tsx` están
  en el camino del cobro real. Los cambios ahí se verifican a mano en escritorio
  antes de fusionar.
- Comentarios y textos de interfaz en español, siguiendo el código circundante.
- El CI corre `pytest`, `tsc` y `vite build`. Los tres deben pasar.

---

### Tarea 1: `daily-summary` deja de forzar la sucursal del usuario

**Archivos:**
- Modificar: `app/routers/reports.py:45-124` (`get_daily_summary`)
- Prueba: `tests/test_reports_daily_summary.py` (ya existe, 4 pruebas)

**Interfaces:**
- Produce: `GET /api/reports/daily-summary?target_date=&branch_id=` — `branch_id`
  opcional; `0` significa toda la organización; solo lo honra un rol de oficina
  central (`ADMINISTRADOR`, `GERENTE`, `DUEÑO`).

- [ ] **Paso 1: escribir las pruebas que fallan**

Añadir al final de `tests/test_reports_daily_summary.py`:

```python
def test_rol_de_oficina_ve_toda_la_organizacion_con_branch_cero(
    client, db, org, branch_a, branch_b, admin_user, auth_admin, products_setup
):
    """`branch_id=0` es la convención que ya usa sales-by-hour: toda la org."""
    _venta(db, org, branch_a, admin_user, _v(products_setup), "R-1", "100", DocumentStatus.PAID)
    _venta(db, org, branch_b, admin_user, _v(products_setup), "R-9", "700", DocumentStatus.PAID)

    data = client.get("/api/reports/daily-summary?branch_id=0", headers=auth_admin).json()

    assert data["total_revenue"] == 800.0
    assert data["transactions_count"] == 2


def test_rol_de_oficina_puede_pedir_otra_sucursal(
    client, db, org, branch_a, branch_b, admin_user, auth_admin, products_setup
):
    _venta(db, org, branch_a, admin_user, _v(products_setup), "R-1", "100", DocumentStatus.PAID)
    _venta(db, org, branch_b, admin_user, _v(products_setup), "R-9", "700", DocumentStatus.PAID)

    data = client.get(
        f"/api/reports/daily-summary?branch_id={branch_b.id}", headers=auth_admin
    ).json()

    assert data["total_revenue"] == 700.0


def test_un_cajero_no_puede_mirar_otra_sucursal(
    client, db, org, branch_a, branch_b, cajero_a, auth_cajero_a, products_setup
):
    """Aunque mande el branch_id de otra sucursal, sigue viendo la suya."""
    _venta(db, org, branch_a, cajero_a, _v(products_setup), "R-1", "100", DocumentStatus.PAID)
    _venta(db, org, branch_b, cajero_a, _v(products_setup), "R-9", "700", DocumentStatus.PAID)

    data = client.get(
        f"/api/reports/daily-summary?branch_id={branch_b.id}", headers=auth_cajero_a
    ).json()

    assert data["total_revenue"] == 100.0


def test_sin_parametro_el_comportamiento_no_cambia(
    client, db, org, branch_a, branch_b, cajero_a, auth_cajero_a, products_setup
):
    _venta(db, org, branch_a, cajero_a, _v(products_setup), "R-1", "100", DocumentStatus.PAID)
    _venta(db, org, branch_b, cajero_a, _v(products_setup), "R-9", "700", DocumentStatus.PAID)

    data = client.get("/api/reports/daily-summary", headers=auth_cajero_a).json()

    assert data["total_revenue"] == 100.0
```

- [ ] **Paso 2: correr y verificar el rojo**

Ejecutar: `python3 -m pytest tests/test_reports_daily_summary.py -q -p no:warnings`
Esperado: FALLAN las tres primeras (`800.0 != 100.0`, `700.0 != 100.0`, y la del
cajero pasa por accidente porque hoy siempre se fuerza su sucursal).

- [ ] **Paso 3: implementar**

En `app/routers/reports.py`, añadir el parámetro a la firma de
`get_daily_summary` (después de `target_date`):

```python
    branch_id: int = None,
```

Justo después de resolver `target_date`, insertar la resolución de sucursal —
copiada de `get_sales_by_hour` en este mismo archivo, para no crear una segunda
convención:

```python
    # Resolución de sucursal: calcada de get_sales_by_hour (mismo archivo).
    # branch_id=0 significa "toda la organización" y solo lo honra un rol de
    # oficina central; para cualquier otro rol el parámetro se ignora y se
    # queda en su propia sucursal.
    is_hq_user = current_user.role in ["ADMINISTRADOR", "GERENTE", "DUEÑO"]
    target_branch_id = current_user.branch_id
    if is_hq_user:
        if branch_id == 0:
            target_branch_id = None
        elif branch_id:
            target_branch_id = branch_id
```

En las **cinco** consultas de la función (total, pagos, top de productos, vuelto
del día y utilidad), reemplazar la línea

```python
        SalesDocument.branch_id == current_user.branch_id,
```

por nada, y añadir el filtro condicional antes de cada `.first()`, `.all()` o
`.scalar()`. Para evitar repetir el condicional cinco veces, construir una lista
de filtros comunes justo después del bloque anterior:

```python
    filtros_sucursal = (
        [SalesDocument.branch_id == target_branch_id] if target_branch_id else []
    )
```

y desplegarla en cada consulta con `*filtros_sucursal`.

- [ ] **Paso 4: correr y verificar el verde**

Ejecutar: `python3 -m pytest tests/test_reports_daily_summary.py -q -p no:warnings`
Esperado: 8 passed.

Después: `python3 -m pytest -q -p no:warnings`
Esperado: sin regresiones (referencia en `main`: 352 passed, 2 skipped, 3 xfailed).

- [ ] **Paso 5: commit**

```bash
git add app/routers/reports.py tests/test_reports_daily_summary.py
git commit -m "feat(reportes): daily-summary acepta sucursal, como sales-by-hour"
```

---

### Tarea 2: el tipo `DailySummary` deja de mentir

**Archivos:**
- Modificar: `frontend/src/api/reports.ts:83-90` (interfaz) y `:129-134` (cliente)
- Modificar: `frontend/src/pages/mobile/MobileDashboard.tsx:58-90`
- Crear: `frontend/src/utils/panelDia.ts`
- Crear: `frontend/src/utils/panelDia.test.ts`

**Contexto — esto es un defecto real, no una limpieza.** El backend devuelve
`{date, transactions_count, total_revenue, gross_profit, payments, top_selling_items}`
(ver `app/routers/reports.py`, el `return` de `get_daily_summary`). La interfaz
del frontend declara `{date, total_sales, transaction_count, by_method,
top_5_products, gross_profit}`. **Ningún nombre coincide salvo `date` y
`gross_profit`.** `MobileDashboard.tsx:66` hace `summary.by_method.length`, que
sobre la respuesta real lanza `TypeError: Cannot read properties of undefined`.
`tsc` no lo detecta porque la respuesta se castea con un genérico.

**Interfaces:**
- Produce: `DailySummary` con los nombres reales del backend;
  `reportsApi.dailySummary(targetDate?, branchId?)`;
  `resumirDia(s: DailySummary): ResumenDia` en `utils/panelDia.ts`.

- [ ] **Paso 1: escribir la prueba que falla**

Crear `frontend/src/utils/panelDia.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resumirDia } from './panelDia'

const respuestaReal = {
  date: '2026-09-03',
  transactions_count: 19,
  total_revenue: 992.78,
  gross_profit: 448.48,
  payments: { CASH: 992.78 },
  top_selling_items: [{ name: 'folder tamaño carta', quantity: 14 }],
}

describe('resumirDia', () => {
  it('lee los nombres que el backend manda de verdad', () => {
    const r = resumirDia(respuestaReal)
    expect(r.venta).toBe(992.78)
    expect(r.tickets).toBe(19)
    expect(r.utilidad).toBe(448.48)
  })

  it('calcula el ticket promedio', () => {
    expect(resumirDia(respuestaReal).ticketPromedio).toBeCloseTo(52.25, 2)
  })

  it('no divide entre cero cuando no hubo ventas', () => {
    const r = resumirDia({ ...respuestaReal, transactions_count: 0, total_revenue: 0 })
    expect(r.ticketPromedio).toBe(0)
  })

  it('convierte el objeto de pagos en una lista ordenada de mayor a menor', () => {
    const r = resumirDia({ ...respuestaReal, payments: { CARD: 100, CASH: 500 } })
    expect(r.pagos).toEqual([
      { metodo: 'CASH', total: 500 },
      { metodo: 'CARD', total: 100 },
    ])
  })

  it('tolera que falten pagos o productos', () => {
    const r = resumirDia({ ...respuestaReal, payments: undefined, top_selling_items: undefined } as never)
    expect(r.pagos).toEqual([])
    expect(r.masVendidos).toEqual([])
  })
})
```

- [ ] **Paso 2: correr y verificar el rojo**

Ejecutar: `cd frontend && npx vitest run src/utils/panelDia.test.ts`
Esperado: FALLA al no poder resolver el módulo `./panelDia`.

- [ ] **Paso 3: implementar**

Crear `frontend/src/utils/panelDia.ts`:

```ts
import type { DailySummary } from '../api/reports'

export interface ResumenDia {
  venta: number
  tickets: number
  utilidad: number
  ticketPromedio: number
  pagos: { metodo: string; total: number }[]
  masVendidos: { nombre: string; piezas: number }[]
}

/** Traduce la respuesta cruda de `daily-summary` a lo que el panel dibuja. */
export function resumirDia(s: DailySummary): ResumenDia {
  const tickets = s.transactions_count ?? 0
  const venta = s.total_revenue ?? 0
  return {
    venta,
    tickets,
    utilidad: s.gross_profit ?? 0,
    ticketPromedio: tickets > 0 ? venta / tickets : 0,
    pagos: Object.entries(s.payments ?? {})
      .map(([metodo, total]) => ({ metodo, total }))
      .sort((a, b) => b.total - a.total),
    masVendidos: (s.top_selling_items ?? []).map((p) => ({
      nombre: p.name,
      piezas: p.quantity,
    })),
  }
}
```

Corregir la interfaz en `frontend/src/api/reports.ts` (reemplaza el bloque de
`export interface DailySummary`):

```ts
export interface DailySummary {
  date: string
  transactions_count: number
  total_revenue: number
  gross_profit: number
  payments: Record<string, number>
  top_selling_items: { name: string; quantity: number }[]
}
```

Y el cliente, para que acepte sucursal (consume la Tarea 1):

```ts
  dailySummary: async (targetDate?: string, branchId?: number): Promise<DailySummary> => {
    const params: Record<string, string | number> = {}
    if (targetDate) params.target_date = targetDate
    if (branchId !== undefined) params.branch_id = branchId
    const { data } = await client.get<DailySummary>('/reports/daily-summary', {
      params: Object.keys(params).length ? params : undefined,
    })
    return data
  },
```

En `frontend/src/pages/mobile/MobileDashboard.tsx`, reemplazar los usos rotos
por el resumen. Sustituir `summary.total_sales` por `resumen.venta`,
`summary.transaction_count` por `resumen.tickets`, el bloque de
`summary.by_method` por `resumen.pagos` (con `m.metodo` y `m.total`) y el de
`summary.top_5_products` por `resumen.masVendidos` (con `p.nombre` y `p.piezas`),
calculando `const resumen = summary ? resumirDia(summary) : null` junto al estado.

- [ ] **Paso 4: correr y verificar el verde**

Ejecutar: `cd frontend && npx vitest run && npx tsc --noEmit && npm run build`
Esperado: 18 pruebas pasan (13 previas + 5 nuevas); `tsc` y el build sin errores.

- [ ] **Paso 5: commit**

```bash
git add frontend/src/utils/panelDia.ts frontend/src/utils/panelDia.test.ts \
        frontend/src/api/reports.ts frontend/src/pages/mobile/MobileDashboard.tsx
git commit -m "fix(movil): el tipo DailySummary no coincidia con el backend

MobileDashboard hacia summary.by_method.length sobre un campo que el backend
nunca manda (manda payments, un objeto), asi que la pantalla reventaba con
TypeError. Ningun nombre de la interfaz coincidia salvo date y gross_profit;
tsc no lo veia porque la respuesta se castea con un generico."
```

---

### Tarea 3: `homePathForRole` extraído y Jesús llega a su panel

**Archivos:**
- Crear: `frontend/src/utils/rutaInicio.ts`
- Crear: `frontend/src/utils/rutaInicio.test.ts`
- Modificar: `frontend/src/App.tsx:160-169`

**Interfaces:**
- Produce: `rutaInicioPorRol(rol?: string | null, esMovil?: boolean, preset?: string | null): string`

- [ ] **Paso 1: escribir la prueba que falla**

Crear `frontend/src/utils/rutaInicio.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rutaInicioPorRol } from './rutaInicio'

describe('rutaInicioPorRol', () => {
  it('manda al ADMINISTRADOR en movil a su panel', () => {
    // Regresion: la condicion solo contemplaba DUEÑO, asi que Jesus
    // —ADMINISTRADOR— aterrizaba en el armazon de escritorio.
    expect(rutaInicioPorRol('ADMINISTRADOR', true, 'ATLAS_POS')).toBe('/mobile/owner')
  })

  it('manda al DUEÑO en movil a su panel', () => {
    expect(rutaInicioPorRol('DUEÑO', true, 'ATLAS_POS')).toBe('/mobile/owner')
  })

  it('en escritorio el ADMINISTRADOR no cambia de destino', () => {
    expect(rutaInicioPorRol('ADMINISTRADOR', false, 'ATLAS_POS')).toBe('/hq/operations')
    expect(rutaInicioPorRol('ADMINISTRADOR', false, 'ATLAS_ONE_RETAIL')).toBe('/home')
  })

  it('los demas roles no cambian', () => {
    expect(rutaInicioPorRol('VENDEDOR', true)).toBe('/mobile/dashboard')
    expect(rutaInicioPorRol('SOPORTE_OPERATIVO', false)).toBe('/mobile/dashboard')
    expect(rutaInicioPorRol('CLIENTE', true)).toBe('/portal')
    expect(rutaInicioPorRol('CAJERO', true)).toBe('/atlas-pos')
    expect(rutaInicioPorRol(undefined, false)).toBe('/atlas-pos')
  })
})
```

- [ ] **Paso 2: correr y verificar el rojo**

Ejecutar: `cd frontend && npx vitest run src/utils/rutaInicio.test.ts`
Esperado: FALLA al no poder resolver el módulo `./rutaInicio`.

- [ ] **Paso 3: implementar**

Crear `frontend/src/utils/rutaInicio.ts` con el cuerpo movido desde
`App.tsx:160-169`, con la condición ampliada:

```ts
/**
 * A dónde va cada rol al entrar. Vive fuera de App.tsx para poder probarse:
 * vitest está configurado con `include: ['src/**\/*.test.ts']`, solo .ts.
 */
export function rutaInicioPorRol(
  rol?: string | null,
  esMovil = false,
  preset?: string | null,
): string {
  const esOficina = rol === 'ADMINISTRADOR' || rol === 'DUEÑO'
  if (esOficina && esMovil) return '/mobile/owner'
  if (esOficina) {
    if (preset && preset.startsWith('ATLAS_ONE_')) return '/home'
    return '/hq/operations'
  }
  if (rol === 'VENDEDOR' || rol === 'SOPORTE_OPERATIVO') return '/mobile/dashboard'
  if (rol === 'CLIENTE') return '/portal'
  return '/atlas-pos'
}
```

En `App.tsx`, borrar la función `homePathForRole` completa (líneas 160-169),
importar la nueva y cambiar la única llamada en `RoleHomeRedirect`:

```ts
import { rutaInicioPorRol } from './utils/rutaInicio'
// ...
  return <Navigate to={rutaInicioPorRol(user?.role, isMobile, preset)} replace />
```

- [ ] **Paso 4: correr y verificar el verde**

Ejecutar: `cd frontend && npx vitest run && npx tsc --noEmit`
Esperado: 22 pruebas pasan (13 previas + 5 de la Tarea 2 + 4 nuevas); `tsc` sin
errores y sin `homePathForRole` huérfano.

- [ ] **Paso 5: commit**

```bash
git add frontend/src/utils/rutaInicio.ts frontend/src/utils/rutaInicio.test.ts frontend/src/App.tsx
git commit -m "fix(movil): el ADMINISTRADOR tambien llega al panel movil

La condicion solo contemplaba DUEÑO, asi que un ADMINISTRADOR en telefono
aterrizaba en el armazon de escritorio con el sidebar de 244px fijos. La ruta
/mobile/owner ya lo admitia y la navegacion inferior ya le dibujaba el boton."
```

---

### Tarea 4: el sidebar se vuelve cajón en móvil

**Archivos:**
- Modificar: `frontend/src/components/layout/Layout.tsx:86-110`
- Crear: `frontend/src/utils/cajonLateral.ts`
- Crear: `frontend/src/utils/cajonLateral.test.ts`

**Interfaces:**
- Consume: `useIsMobile()` de `hooks/useIsMobile.ts` (punto de quiebre 768px).
- Produce: `estiloCajon(esMovil: boolean, abierto: boolean): CSSProperties`

`components/layout/Sidebar.tsx` **no se toca**: sus 710 líneas de estilos en
línea se quedan como están. Con `collapsed=true` ya renderiza un riel de iconos
(`Sidebar.tsx:708`); ese comportamiento de escritorio no cambia.

- [ ] **Paso 1: escribir la prueba que falla**

Crear `frontend/src/utils/cajonLateral.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { estiloCajon } from './cajonLateral'

describe('estiloCajon', () => {
  it('en escritorio no posiciona nada: el sidebar es un hermano en el flujo', () => {
    const e = estiloCajon(false, false)
    expect(e.position).toBeUndefined()
    expect(e.transform).toBeUndefined()
  })

  it('en movil cerrado saca el cajon de la pantalla', () => {
    const e = estiloCajon(true, false)
    expect(e.position).toBe('fixed')
    expect(e.transform).toBe('translateX(-100%)')
  })

  it('en movil abierto lo trae a la pantalla', () => {
    expect(estiloCajon(true, true).transform).toBe('translateX(0)')
  })

  it('en movil siempre queda por encima del contenido', () => {
    expect(Number(estiloCajon(true, false).zIndex)).toBeGreaterThan(0)
    expect(Number(estiloCajon(true, true).zIndex)).toBeGreaterThan(0)
  })
})
```

- [ ] **Paso 2: correr y verificar el rojo**

Ejecutar: `cd frontend && npx vitest run src/utils/cajonLateral.test.ts`
Esperado: FALLA al no poder resolver el módulo `./cajonLateral`.

- [ ] **Paso 3: implementar la función pura**

Crear `frontend/src/utils/cajonLateral.ts`:

```ts
import type { CSSProperties } from 'react'

/**
 * Cómo se posiciona el sidebar según el ancho. En escritorio no se toca: sigue
 * siendo un hermano en el flujo con sus 244px. Por debajo de 768px se sale de
 * la pantalla y vuelve al abrirse.
 */
export function estiloCajon(esMovil: boolean, abierto: boolean): CSSProperties {
  if (!esMovil) return {}
  return {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    zIndex: 50,
    transform: abierto ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 200ms ease',
  }
}
```

- [ ] **Paso 4: cablearlo en el armazón**

En `frontend/src/components/layout/Layout.tsx`:

Importar arriba:

```ts
import { useIsMobile } from '../../hooks/useIsMobile'
import { estiloCajon } from '../../utils/cajonLateral'
```

Junto al estado que ya existe, añadir:

```ts
  const esMovil = useIsMobile()
  const [cajonAbierto, setCajonAbierto] = useState(false)

  // El cajón se cierra al navegar. Sin esto queda abierto sobre la pantalla
  // nueva y se siente roto.
  useEffect(() => { setCajonAbierto(false) }, [location.pathname])

  // ...y con Escape, como cualquier diálogo.
  useEffect(() => {
    if (!cajonAbierto) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setCajonAbierto(false) }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [cajonAbierto])
```

Reemplazar `<Sidebar collapsed={collapsed} />` (línea 87) por:

```tsx
      <div
        style={estiloCajon(esMovil, cajonAbierto)}
        role={esMovil ? 'dialog' : undefined}
        aria-modal={esMovil && cajonAbierto ? true : undefined}
        aria-label={esMovil ? 'Menú principal' : undefined}
        id="cajon-lateral"
      >
        <Sidebar collapsed={!esMovil && collapsed} />
      </div>

      {esMovil && cajonAbierto && (
        <div
          onClick={() => setCajonAbierto(false)}
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
      )}
```

En el botón de la cabecera (líneas 102-113), cambiar el manejador para que en
móvil abra el cajón y en escritorio siga colapsando:

```tsx
              onClick={() => (esMovil ? setCajonAbierto(a => !a) : setCollapsed(c => !c))}
              aria-expanded={esMovil ? cajonAbierto : undefined}
              aria-controls={esMovil ? 'cajon-lateral' : undefined}
              title={esMovil ? 'Abrir menú' : 'Contraer menú'}
```

Añadir al final de `frontend/src/index.css` el respeto al movimiento reducido:

```css
@media (prefers-reduced-motion: reduce) {
  #cajon-lateral { transition: none !important; }
}
```

- [ ] **Paso 5: correr y verificar el verde**

Ejecutar: `cd frontend && npx vitest run && npx tsc --noEmit && npm run build`
Esperado: 26 pruebas pasan (22 previas + 4 nuevas); `tsc` y build sin errores.

- [ ] **Paso 6: commit**

```bash
git add frontend/src/utils/cajonLateral.ts frontend/src/utils/cajonLateral.test.ts \
        frontend/src/components/layout/Layout.tsx frontend/src/index.css
git commit -m "feat(armazon): el sidebar se vuelve cajon por debajo de 768px

Media 244px fijos sin ninguna regla responsiva, asi que en una pantalla de
360px se llevaba el 68% y dejaba el contenido en 116px. Sidebar.tsx no se
toca: se envuelve. El cajon cierra al tocar el fondo, con Escape y al navegar."
```

---

### Tarea 5: las tablas dejan de desbordar la página

**Archivos:**
- Crear: `frontend/src/components/ui/TablaDesplazable.tsx`
- Modificar: los 10 archivos listados abajo

**Interfaces:**
- Produce: `<TablaDesplazable>{children}</TablaDesplazable>`

Esta tarea es un lote de ediciones de la misma forma: envolver cada `<table>`
en el componente nuevo. No lleva prueba de `vitest` porque son `.tsx` y la
configuración solo incluye `.ts`; se verifica con `tsc`, el build y la
inspección visual del Paso 4.

- [ ] **Paso 1: crear el envoltorio**

Crear `frontend/src/components/ui/TablaDesplazable.tsx`:

```tsx
/**
 * Contenedor de una tabla ancha. El scroll horizontal vive aquí para que el
 * cuerpo de la página nunca se desplace de lado en un teléfono.
 */
export function TablaDesplazable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">{children}</div>
}
```

- [ ] **Paso 2: envolver las 10 tablas**

En cada archivo, importar el componente y envolver el elemento `<table>` de
nivel superior. Si el `<table>` ya está dentro de un `<div>` que solo le da
borde o fondo, envolver por dentro de ese `div`, no por fuera.

- `frontend/src/pages/platform/PlatformMetrics.tsx`
- `frontend/src/pages/platform/PlatformOrgDetail.tsx`
- `frontend/src/pages/platform/PlatformReports.tsx`
- `frontend/src/pages/pos/AtlasPOS.tsx`
- `frontend/src/components/branch/ProductsBranchView.tsx`
- `frontend/src/components/catalog/ProductBranchMatrix.tsx`
- `frontend/src/components/platform/DataTable.tsx`
- `frontend/src/components/platform/v2/CohortTable.tsx`
- `frontend/src/components/platform/v2/Leaderboard.tsx`
- `frontend/src/components/platform/v2/TopOrgsTable.tsx`

- [ ] **Paso 3: verificar que no queda ninguna**

Ejecutar desde `frontend/src`:

```bash
python3 - <<'PY'
import pathlib
faltan = [f for f in list(pathlib.Path('.').glob('pages/**/*.tsx')) + list(pathlib.Path('.').glob('components/**/*.tsx'))
          if '<table' in f.read_text() and 'overflow-x' not in f.read_text()
          and 'overflowX' not in f.read_text() and 'TablaDesplazable' not in f.read_text()]
print('sin scroll:', [str(f) for f in faltan] or 'ninguna')
PY
```

Esperado: `sin scroll: ninguna`.

- [ ] **Paso 4: verificar compilación y aspecto**

Ejecutar: `cd frontend && npx tsc --noEmit && npm run build`
Esperado: sin errores.

**Verificación manual obligatoria:** `AtlasPOS.tsx` está en el camino del cobro.
Abrirlo en escritorio y confirmar que la tabla se ve igual que antes.

- [ ] **Paso 5: commit**

```bash
git add frontend/src/components/ui/TablaDesplazable.tsx frontend/src/pages frontend/src/components
git commit -m "feat(armazon): las tablas anchas se desplazan dentro de su caja

Diez tablas empujaban el cuerpo de la pagina de lado en telefono. El scroll
vive en un envoltorio comun en vez de diez parches distintos."
```

---

### Tarea 6: los anchos fijos pasan a máximos

**Archivos:**
- Modificar: `frontend/src/pages/platform/PlatformAlerts.tsx` (900px)
- Modificar: `frontend/src/pages/platform/PlatformAuditLog.tsx` (900px)
- Modificar: `frontend/src/components/pos/modals/CashPaymentModal.tsx` (560px)
- Modificar: `frontend/src/pages/pos/POS.tsx` (420px)
- Modificar: `frontend/src/components/catalog/ProductAuditDrawer.tsx` (420px)
- Modificar: `frontend/src/components/catalog/ProductBranchMatrix.tsx` (420px)

Lote de ediciones de la misma forma. En cada archivo, cada declaración de
`width: 'Npx'` o `minWidth: 'Npx'` **con N ≥ 400** pasa a `maxWidth: 'Npx'` más
`width: '100%'`. En escritorio no cambia nada; en teléfono deja de desbordar.

No tocar anchos menores a 400px: son iconos, avatares y columnas, y cambiarlos
rompería composiciones que hoy funcionan.

- [ ] **Paso 1: aplicar las ediciones**

Ejemplo de la transformación, sobre `PlatformAlerts.tsx`:

```tsx
// antes
style={{ width: '900px' }}
// después
style={{ maxWidth: '900px', width: '100%' }}
```

- [ ] **Paso 2: verificar que no queda ninguno**

Ejecutar desde `frontend/src`:

```bash
python3 - <<'PY'
import re, pathlib
patron = re.compile(r'(?:^|[^x])(?:width|minWidth)\s*:\s*[\'"](\d{3,4})px')
malos = []
for f in list(pathlib.Path('.').glob('pages/**/*.tsx')) + list(pathlib.Path('.').glob('components/**/*.tsx')):
    for n in patron.findall(f.read_text()):
        if int(n) >= 400: malos.append(f'{f}: {n}px')
print('anchos fijos >=400px:', malos or 'ninguno')
PY
```

Esperado: `anchos fijos >=400px: ninguno`.

- [ ] **Paso 3: verificar compilación**

Ejecutar: `cd frontend && npx tsc --noEmit && npm run build`
Esperado: sin errores.

**Verificación manual obligatoria:** `POS.tsx` y `CashPaymentModal.tsx` están en
el camino del cobro real. Abrir el punto de venta en escritorio, agregar un
producto, abrir el modal de pago en efectivo y confirmar que se ve y se comporta
igual que antes.

- [ ] **Paso 4: commit**

```bash
git add frontend/src/pages frontend/src/components
git commit -m "feat(armazon): los anchos fijos grandes pasan a maximos

Seis archivos declaraban de 400 a 900px fijos, que desbordan cualquier
telefono. maxWidth mas width 100% no cambia nada en escritorio."
```

---

### Tarea 7: el panel del día

**Archivos:**
- Modificar: `frontend/src/pages/mobile/MobileOwnerDashboard.tsx` (reescritura)
- Modificar: `frontend/src/utils/panelDia.ts` (añadir dos funciones)
- Modificar: `frontend/src/utils/panelDia.test.ts` (añadir pruebas)

**Interfaces:**
- Consume: `resumirDia(s: DailySummary): ResumenDia` (Tarea 2);
  `reportsApi.dailySummary(targetDate?, branchId?)` (Tarea 2);
  `reportsApi.salesByHour({ date, branch_id? }): SalesByHourResponse`;
  `cashApi.getStatus(): Promise<CashSession | null>`.
- Produce: `barrasPorHora(r: SalesByHourResponse): BarraHora[]`;
  `estadoDelCorte(s: CashSession | null, efectivoDelDia: number): EstadoCorte`.

- [ ] **Paso 1: escribir las pruebas que fallan**

Añadir a `frontend/src/utils/panelDia.test.ts`:

```ts
import { barrasPorHora, estadoDelCorte } from './panelDia'

describe('barrasPorHora', () => {
  it('escala cada barra contra la franja mas alta', () => {
    const b = barrasPorHora({
      date: '2026-09-03', current_hour: 19, current_hour_amount: 0, current_hour_tickets: 0,
      hourly: [{ hour: 17, amount: 446, tickets: 8 }, { hour: 18, amount: 223, tickets: 7 }],
    })
    expect(b[0].porcentaje).toBe(100)
    expect(b[1].porcentaje).toBe(50)
  })

  it('descarta las franjas sin ventas', () => {
    const b = barrasPorHora({
      date: '2026-09-03', current_hour: 19, current_hour_amount: 0, current_hour_tickets: 0,
      hourly: [{ hour: 9, amount: 0, tickets: 0 }, { hour: 17, amount: 100, tickets: 1 }],
    })
    expect(b).toHaveLength(1)
    expect(b[0].hora).toBe(17)
  })

  it('no divide entre cero en un dia sin ventas', () => {
    expect(barrasPorHora({
      date: '2026-09-03', current_hour: 9, current_hour_amount: 0, current_hour_tickets: 0, hourly: [],
    })).toEqual([])
  })
})

describe('estadoDelCorte', () => {
  it('sin caja abierta lo dice, sin inventar cifras', () => {
    expect(estadoDelCorte(null, 992.78).situacion).toBe('SIN_CAJA')
  })

  it('con la caja abierta calcula cuanto deberia haber', () => {
    const e = estadoDelCorte(
      { id: 97, status: 'OPEN', opening_balance: 0.01, closing_balance: null } as never, 992.78)
    expect(e.situacion).toBe('ABIERTA')
    expect(e.deberiaHaber).toBeCloseTo(992.79, 2)
  })

  it('cerrada reporta el contado y la diferencia tal como quedaron', () => {
    const e = estadoDelCorte(
      { id: 97, status: 'CLOSED', opening_balance: 0.01, closing_balance: 1020, difference: 27.21 } as never, 992.78)
    expect(e.situacion).toBe('CERRADA')
    expect(e.contado).toBe(1020)
    expect(e.diferencia).toBeCloseTo(27.21, 2)
  })
})
```

- [ ] **Paso 2: correr y verificar el rojo**

Ejecutar: `cd frontend && npx vitest run src/utils/panelDia.test.ts`
Esperado: FALLA porque `barrasPorHora` y `estadoDelCorte` no existen.

- [ ] **Paso 3: implementar las funciones puras**

Añadir a `frontend/src/utils/panelDia.ts`:

```ts
import type { SalesByHourResponse } from '../api/reports'
import type { CashSession } from '../types/cash'

export interface BarraHora {
  hora: number
  importe: number
  tickets: number
  porcentaje: number
}

/** Franjas con venta, escaladas contra la más alta del día. */
export function barrasPorHora(r: SalesByHourResponse): BarraHora[] {
  const conVenta = (r.hourly ?? []).filter((h) => h.amount > 0)
  if (conVenta.length === 0) return []
  const tope = Math.max(...conVenta.map((h) => h.amount))
  return conVenta.map((h) => ({
    hora: h.hour,
    importe: h.amount,
    tickets: h.tickets,
    porcentaje: (h.amount / tope) * 100,
  }))
}

export interface EstadoCorte {
  situacion: 'SIN_CAJA' | 'ABIERTA' | 'CERRADA'
  fondo?: number
  deberiaHaber?: number
  contado?: number
  diferencia?: number
}

/**
 * Estado del corte para el panel. Con la caja abierta, lo que debería haber es
 * el fondo declarado más el efectivo neto del día — el mismo criterio del corte
 * (`net_cash`, ya sin el vuelto). Con la caja cerrada se reporta lo que quedó.
 */
export function estadoDelCorte(s: CashSession | null, efectivoDelDia: number): EstadoCorte {
  if (!s) return { situacion: 'SIN_CAJA' }
  const fondo = Number(s.opening_balance ?? 0)
  if (s.status === 'CLOSED') {
    return {
      situacion: 'CERRADA',
      fondo,
      contado: Number(s.closing_balance ?? 0),
      diferencia: Number(s.difference ?? 0),
    }
  }
  return { situacion: 'ABIERTA', fondo, deberiaHaber: fondo + efectivoDelDia }
}
```

- [ ] **Paso 4: correr y verificar el verde de las funciones**

Ejecutar: `cd frontend && npx vitest run src/utils/panelDia.test.ts`
Esperado: 11 pruebas pasan en ese archivo (5 de la Tarea 2 + 6 nuevas).

- [ ] **Paso 5: reescribir el panel**

Reescribir `frontend/src/pages/mobile/MobileOwnerDashboard.tsx` para que cargue
las tres fuentes en paralelo y dibuje los cuatro bloques en este orden: cómo va
el día, ritmo por hora, más vendidos, estado del corte.

La carga, con tolerancia a fallo parcial — si una fuente falla, las demás se
muestran igual y el bloque afectado dice qué no pudo cargar:

```tsx
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [barras, setBarras] = useState<BarraHora[] | null>(null)
  const [corte, setCorte] = useState<EstadoCorte | null>(null)
  const [fallas, setFallas] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    setFallas([])
    const hoy = todayStr()
    const [rs, rh, rc] = await Promise.allSettled([
      reportsApi.dailySummary(hoy),
      reportsApi.salesByHour({ date: hoy }),
      cashApi.getStatus(),
    ])

    const fallidas: string[] = []
    if (rs.status === 'fulfilled') setResumen(resumirDia(rs.value))
    else fallidas.push('la venta del día')
    if (rh.status === 'fulfilled') setBarras(barrasPorHora(rh.value))
    else fallidas.push('el ritmo por hora')

    const efectivo = rs.status === 'fulfilled' ? (rs.value.payments?.CASH ?? 0) : 0
    if (rc.status === 'fulfilled') setCorte(estadoDelCorte(rc.value, efectivo))
    else fallidas.push('el corte de caja')

    setFallas(fallidas)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
```

Cada bloque sigue este patrón, que es el del bloque de ritmo por hora:

```tsx
{barras && barras.length > 0 && (
  <section className="px-4 py-3">
    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
      Ritmo del día
    </h2>
    <div className="flex flex-col gap-2">
      {barras.map((b) => (
        <div key={b.hora} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3">
          <span className="text-xs tabular-nums text-slate-400">{b.hora}h</span>
          <div className="h-5 rounded bg-slate-700/40 overflow-hidden">
            <div className="h-full rounded bg-emerald-500" style={{ width: `${b.porcentaje}%` }} />
          </div>
          <span className="text-xs tabular-nums text-slate-300">
            {formatCurrency(b.importe)} · {b.tickets}
          </span>
        </div>
      ))}
    </div>
  </section>
)}
```

Los cuatro bloques usan las clases de Tailwind del proyecto y `formatCurrency`
de `utils/currency`. El bloque de más vendidos muestra nombre y piezas de
`resumen.masVendidos`. El de ritmo dibuja una barra por elemento de `barras`,
con `width: ${b.porcentaje}%`. El del corte se ramifica sobre
`corte.situacion` y muestra: en `SIN_CAJA`, "No hay caja abierta"; en `ABIERTA`,
fondo y `deberiaHaber`; en `CERRADA`, contado, fondo y `diferencia`, marcando en
color de atención cuando la diferencia no es cero.

Si `fallas` no está vacío, se muestra arriba una franja que las enumera. El
botón de recargar llama a `cargar()`.

- [ ] **Paso 6: verificar todo**

Ejecutar: `cd frontend && npx vitest run && npx tsc --noEmit && npm run build`
Esperado: 32 pruebas pasan (26 previas + 6 nuevas); `tsc` y build sin errores.

**Verificación visual obligatoria:** abrir el panel a 360px de ancho —el
teléfono real de Jesús— y confirmar los cuatro bloques, que nada se desborda de
lado, y que el cajón lateral abre y cierra sobre él.

- [ ] **Paso 7: commit**

```bash
git add frontend/src/pages/mobile/MobileOwnerDashboard.tsx \
        frontend/src/utils/panelDia.ts frontend/src/utils/panelDia.test.ts
git commit -m "feat(movil): panel del dia para el dueno

Venta, tickets, utilidad y ticket promedio; ritmo por hora; mas vendidos; y el
estado del corte. Tres endpoints existentes en paralelo con Promise.allSettled:
si uno falla los demas se muestran igual, porque un panel que se cae entero
porque el corte no respondio es peor que uno incompleto."
```

---

## Verificación final antes de fusionar

- [ ] `python3 -m pytest -q -p no:warnings` — sin regresiones contra `main`
- [ ] `cd frontend && npx vitest run && npx tsc --noEmit && npm run build`
- [ ] A 360px: el panel completo, y tres vistas de escritorio con el cajón
      abierto y cerrado
- [ ] En escritorio: punto de venta con un cobro en efectivo de principio a fin,
      que es lo que las Tareas 5 y 6 podrían romper
