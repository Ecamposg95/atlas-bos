# UI_PATTERNS.md — Frontend React/TypeScript

El frontend de Atlas es una **React 18 SPA** construida con Vite, TypeScript, Tailwind CSS y Zustand. Los templates Jinja2 en `app/templates/` son **legacy** — todo UI nuevo va en `frontend/src/`.

---

## Stack Frontend

| Herramienta | Uso |
|---|---|
| React 18 | Framework UI, lazy loading, Suspense |
| TypeScript | Tipado estático, interfaces en `frontend/src/types/` |
| Vite | Build tool, dev server con proxy a `/api` |
| React Router v6 | Client-side routing (`BrowserRouter`, `Routes`, `Route`) |
| Zustand | Estado global (`authStore`, `posStore`) |
| Axios | HTTP client, interceptores de auth y org |
| Tailwind CSS | Utilidades CSS, tema slate oscuro |

---

## Paleta de Colores (dark theme)

Basada en la escala `slate` de Tailwind:

| Elemento | Clase |
|---|---|
| Fondo de página | `bg-slate-950` |
| Fondo de card | `bg-slate-900` o `bg-slate-900/80` |
| Borde de card | `border-slate-700/50` |
| Texto primario | `text-slate-100` o `text-white` |
| Texto secundario | `text-slate-400` |
| Texto muted | `text-slate-500` |
| Acento primario | `sky-500` / `sky-600` |
| Acento éxito | `emerald-500` |
| Acento peligro | `red-500` |
| Acento advertencia | `amber-500` |

---

## Componentes UI (`frontend/src/components/ui/`)

### `<DaxCard>`
Card estándar del sistema. Usar para cualquier sección con contenido agrupado.
```tsx
<DaxCard title="Ventas del día" className="...">
  {/* contenido */}
</DaxCard>
```
Internamente: `bg-slate-900/80 border border-slate-700/50 backdrop-blur rounded-xl`.

### `<Button>`
```tsx
<Button variant="primary" size="md" onClick={...}>Guardar</Button>
// variants: primary | secondary | danger | ghost
// sizes: sm | md | lg
```

### `<Badge>`
```tsx
<Badge color="emerald">Activo</Badge>
<Badge color="red">Inactivo</Badge>
// colors: emerald | red | amber | sky | slate
```

### `<Spinner>`
```tsx
<Spinner size="md" text="Cargando..." />
// sizes: sm | md | lg
```

---

## Layout

`frontend/src/components/layout/Layout.tsx` — shell principal con Sidebar y `<Outlet />` de React Router.

`frontend/src/components/layout/Sidebar.tsx` — navegación lateral, construida a partir de `nav_items` que vienen del backend al hacer login (o calculados en el store).

---

## Estructura de Páginas

Todas las páginas son componentes React en `frontend/src/pages/`, organizadas por dominio. Se cargan lazy con `React.lazy()` + `<Suspense>`.

| Directorio | Páginas |
|---|---|
| `pages/hq/` | HQOperations, HQReportsHub, HQControl, HQSalesLog, HQReturns, HQInventory, HQBranches, HQBranchDetail |
| `pages/core/` | AdminCatalog, Departments, Brands, Users, Organization |
| `pages/pos/` | DataXPOS (dashboard), POS (caja), PrinterSettings |
| `pages/sales/` | SalesHistory, Quotes, QuoteMaker, Returns, Seguimiento |
| `pages/finance/` | Purchases, Expenses, Reports, CashHistory |
| `pages/inventory/` | Inventory, Logistics, Boxes, Products |
| `pages/crm/` | Customers |
| `pages/hr/` | HR, HRMe |
| `pages/mobile/` | MobileDashboard, MobileQuery, MobileSales, MobileProfile |
| `pages/portal/` | Portal (role=CLIENTE) |
| `pages/platform/` | PlatformLayout + 9 sub-páginas (SUPERADMIN) |

---

## Capa API (`frontend/src/api/`)

Un archivo por dominio. Todos importan el `client` de Axios desde `client.ts`.

### `client.ts`
- `baseURL` apunta a `/api` (relativo — funciona en dev con proxy y en producción)
- Interceptor de request: adjunta `Authorization: Bearer <token>` desde `localStorage`
- Interceptor de response: 401 → redirige a `/login`

### Patrón defensivo de respuesta

Los endpoints pueden retornar lista plana o paginado. Siempre guardar contra ambos:

```typescript
// Para endpoints que devuelven Brand[] o {items: Brand[]}:
const { data } = await client.get<Brand[]>('/brands')
return Array.isArray(data) ? data : (data as any)?.items ?? []

// Para endpoints paginados {items, total, page, pages}:
const { data } = await client.get<ProductsResponse>('/products', { params })
if (Array.isArray(data)) return { items: data, total: data.length, page: 0, pages: 1 }
return data
```

---

## Estado Global (`frontend/src/store/`)

### `authStore.ts` (Zustand)
```typescript
// Campos clave:
user: User | null
token: string | null
isAuthenticated: boolean
organizationId: number | null

// Acciones:
login(credentials) → POST /api/auth/login, guarda token + user
logout() → limpia estado + localStorage
hydrate() → restaura desde localStorage al montar App
```

### `posStore.ts` (Zustand)
Estado del carrito POS: items, cliente seleccionado, método de pago, descuentos.

---

## TypeScript Types (`frontend/src/types/`)

Interfaces que mapean 1:1 con los schemas Pydantic del backend. Al agregar campos al backend, actualizar el type correspondiente.

---

## Convenciones de Código Frontend

1. **Componentes:** PascalCase. Un componente por archivo.
2. **Exports:** nombrados preferidos sobre default export para páginas de dominio.
3. **Fetch:** `useEffect` + `useState`. No hay React Query instalado — no agregarlo sin discutir.
4. **Tailwind:** no crear CSS custom si Tailwind lo resuelve.
5. **No introducir nueva librería de estado** — Zustand es suficiente.
6. **Paginación:** siempre server-side. Nunca cargar todo al cliente y paginar en memoria.

---

## Patrones de Tabla Paginada

```tsx
const [items, setItems] = useState<T[]>([])
const [total, setTotal] = useState(0)
const [page, setPage] = useState(0)
const limit = 50

useEffect(() => {
  domainApi.list({ skip: page * limit, limit }).then(res => {
    setItems(res.items)
    setTotal(res.total)
  })
}, [page])
```

---

## Notas sobre Legacy

`app/templates/` contiene templates Jinja2 + Alpine.js del frontend original. **No desarrollar nuevas features en Jinja2.** Los archivos existen para referencia y porque `setup.router` / `daxpos.router` aún pueden servir algunas rutas SSR de bootstrap. Todo feature nuevo → `frontend/src/`.
