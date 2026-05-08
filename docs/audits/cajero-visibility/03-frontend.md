# Auditoría frontend (A3) — visibilidad de productos CAJERO/GERENTE

**Fecha:** 2026-04-17
**Alcance:** `frontend/src/**` — 10 componentes + API client + auth store.
**Policy:** `docs/audits/cajero-visibility/00-policy.md` (comando: "adelante").

---

## 1. Resumen ejecutivo

- **El frontend se comporta como UX y delega la autoridad al backend.** No hay filtrado client-side "post-fetch" que oculte productos prohibidos: lo que backend devuelve, frontend lo muestra. Esto es correcto en diseño pero **amplifica cualquier leak del backend al 100 % de visibilidad al usuario**, no solo a devtools.
- **`client.ts` inyecta siempre `Authorization: Bearer …` + `X-Organization-ID`** (leídos de `localStorage`), pero **nunca envía `branch_id`** automáticamente. El backend debe derivar la sucursal del JWT, no confiar en el header/query.
- **`Products.tsx` es el único componente que envía `branch_id` y `active_in_branch` del usuario al backend** (líneas 592–595). Esto es una **posible vía de bypass**: el backend **debe ignorar cualquier `branch_id` recibido cuando el rol es CAJERO/GERENTE y forzarlo desde `current_user.branch_id`** (ver cross-ref A1).
- **`AdminCatalog.tsx` es un redirect puro** (`<Navigate to="/inventory/products" replace />`), sin lógica ni guard. La protección depende 100 % del backend (`/admin/catalog` Jinja — RBAC en `role_permissions.py`) y del router de React, que actualmente **no gatea la ruta** (`App.tsx:174` expone `/admin/catalog` sin `<RequireRole>`). **RIESGO MEDIO**: un CAJERO puede navegar a `/admin/catalog` en el SPA y terminar en `/inventory/products`, que a su vez depende del backend para filtrarle.
- **`QuoteMaker.tsx` (L33) y `MobileSales.tsx` (L35) hacen filtrado client-side `items.filter(p => p.is_active)`**. Es defensivo pero **no sustituye filtrado backend**: si el backend devolviera inactivos, tras el filter el usuario vería la lista "limpia" en pantalla, pero **los datos inactivos siguen presentes en el response** y se recuperan con devtools. No es un leak grande pero rompe el "single source of truth".

---

## 2. Tabla por componente

| Componente | Archivo | F1 | F2 | F3 | F4 | F5 | F6 | F7 | Severidad | Hallazgo |
|---|---|---|---|---|---|---|---|---|---|---|
| **Products** | `pages/inventory/Products.tsx` | Sí (`productsApi.list`) | No | **Sí — envía `branch_id=user.branch_id` (L594)** | Sí — muestra `{total}` (L652) pero `total` viene del backend paginado, no agregado global | N/A | N/A | Sí — envía `active_in_branch=true` + `branch_id` para CAJERO | **ALTA** | El `total` contado por el backend debe respetar el mismo filtro. **Si backend ignora `branch_id` del query y filtra por JWT, no hay leak**; pero el que el frontend **envíe** el `branch_id` invita a un backend descuidado a confiar en él. Documentar que backend debe forzar desde JWT. |
| **ProductSearch (POS)** | `components/pos/ProductSearch.tsx` | Sí (`productsApi.posSearch`) | No | No | No — solo renderiza lo recibido | N/A | N/A | No | **BAJA** | Delega 100 % al backend. El endpoint `/products/pos/search` es el más crítico (cross-ref A1:R-pos). |
| **QuoteMaker** | `pages/sales/QuoteMaker.tsx` | Sí (`productsApi.search`) | **Sí — `.filter(p => p.is_active)` L33** | No | No | N/A | N/A | No | **MEDIA** | Filter defensivo sobre `is_active` pero los inactivos siguen llegando en el response. Si el backend filtra correctamente, es redundante; si no, el filter lo oculta en UI pero no en devtools. Quitar el filter y fiarse del backend. |
| **CartPanel** | `components/pos/CartPanel.tsx` | Sí (`productsApi.getById` L159) | No | No | No | N/A | **Sí — riesgo IDOR: llama `getById(product_id)` con el ID que vive en el carrito local, no valida sucursal** | No | **ALTA (depende de backend)** | Si el backend `/products/{id}` no filtra por `branch_id` del CAJERO, un cart_key copiado de otra sesión o manipulado en zustand expone detalle de producto de otra sucursal. **Cross-ref obligatorio con A1:R5**. |
| **Inventory** | `pages/inventory/Inventory.tsx` | Sí (`productsApi.search` L32 + `inventoryApi.getKardex`) | No | No | No | N/A | Kardex usa `variantId(p)` — idéntico IDOR si backend no filtra | No | **ALTA (depende de backend)** | El modal de ajuste permite elegir `adjBranch` de la lista `branches` (L166-169). Si `organizationApi.getBranches()` devuelve todas las sucursales de la org al CAJERO, podría emitir ajustes contra sucursales ajenas. Cross-ref con el endpoint `/branches/` (fuera de scope A3) y con `inventoryApi.createAdjustment`. |
| **Logistics** | `pages/inventory/Logistics.tsx` | Sí (`productsApi.search` L201 + `/transfers/`) | No | No | No | N/A | N/A | No | **MEDIA** | Igual que Inventory: expone selector `requesting_branch_id` a partir de `organizationApi.getBranches()`. Si backend no filtra branches por rol, un CAJERO podría crear transfers a nombre de otra sucursal. |
| **HQInventory** | `pages/hq/HQInventory.tsx` | Sí (`productsApi.search`) | No | No | Sí — sin filtro branch | N/A | N/A | No | **N/A** (admin-only) | Componente pensado para HQ. Confirmar que React router gatea la ruta con `RequireRole` admin. No lo hace por lo que vi en Products — revisar `App.tsx`. |
| **MobileQuery** | `pages/mobile/MobileQuery.tsx` | Sí (`productsApi.search`) | No | No | No | N/A | N/A | No | **BAJA** | Ninguna lógica client-side. Delega al backend. |
| **MobileSales** | `pages/mobile/MobileSales.tsx` | Sí (`productsApi.search`) | **Sí — `.filter(p => p.is_active)` L35** | No | No | N/A | N/A | No | **MEDIA** | Igual observación que QuoteMaker. |
| **AdminCatalog** | `pages/core/AdminCatalog.tsx` | N/A (redirect puro) | N/A | N/A | N/A | **OK — es un `<Navigate to="/inventory/products" replace />` y nada más** (6 líneas) | N/A | N/A | **BAJA** | El archivo cumple. Riesgo separado: `App.tsx:174` monta `/admin/catalog` sin `<RequireRole>` — un CAJERO puede llegar a la ruta del SPA y ser redirigido a `/inventory/products` sin que el backend se entere (no hay request a `/admin/catalog` Jinja). No es un leak pero rompe expectativa de RBAC (cross-ref policy T12). |
| **`api/products.ts`** | `frontend/src/api/products.ts` | N/A (cliente axios) | **No hace filtrado** | `list()` acepta cualquier param, incluido `branch_id` arbitrario (L36) | N/A | N/A | N/A | `uploadProducts()` acepta `target_branch_ids` arbitrario (L123) | **MEDIA** | El cliente es "dumb pipe" — no valida. Cualquier caller puede pasar `branch_id` o `target_branch_ids` distintos del propio. El backend debe validar que esos params coincidan con `current_user.branch_id` cuando el rol es CAJERO/GERENTE. |
| **`authStore.ts`** | `frontend/src/store/authStore.ts` | N/A | N/A | Guarda `branch_id` del user (vía `Branch`) en localStorage. No lo envía en headers. El backend resuelve sucursal del JWT (correcto) | N/A | N/A | N/A | **No envía `X-Branch-ID` ni similar**; solo `X-Organization-ID` (client.ts L17) | **BAJA** | Diseño correcto: la sucursal vive en el JWT, no en un header manipulable. `BranchSwitcher.tsx:50` llama `/auth/context/switch?branch_id=…`, ese endpoint **debe** validar que el user pueda cambiar a esa sucursal (cross-ref A1, fuera de scope del CAJERO: un cajero no debería tener capacidad de switch). |

**Leyenda F1-F7:** F1=consume endpoint protegido, F2=filtra productos client-side, F3=usa `branch_id` de URL/query, F4=muestra agregados globales, F5=AdminCatalog es redirect-only, F6=IDOR en `getById`, F7=envía headers/params que permitan filtrar correctamente.

---

## 3. Patrones de consumo (cross-ref A1/A2)

| Endpoint backend | Consumers frontend | Params enviados |
|---|---|---|
| `GET /api/products/` (alias `list`, `search`) | `Products.tsx` (list), `QuoteMaker.tsx`, `Inventory.tsx`, `HQInventory.tsx`, `MobileQuery.tsx`, `MobileSales.tsx`, `Logistics.tsx` | `search`, `skip`, `limit`, `department_id`, `active_only`, `active_in_branch`, `branch_id` (solo desde Products.tsx para CAJERO) |
| `GET /api/products/pos/search` | `ProductSearch.tsx` (POS), `productsApi.posSearch` | `q` |
| `GET /api/products/{id}` | `CartPanel.tsx:159` (detalle en POS), `Products.tsx:625` (abrir modal edición) | solo `id` |
| `GET /api/products/export/excel` | `Products.tsx:87` (`productsApi.downloadTemplate`) | ninguno |
| `POST /api/products/upload` | `Products.tsx` (ImportModal) | `file`, `scope`, `target_branch_ids` (!) |
| `POST /api/products/` / `PUT /api/products/{id}` | `Products.tsx` ProductModal (CRUD) | payload completo |
| `GET /api/brands/`, `/api/departments/` | `Products.tsx`, `Brands.tsx`, `Departments.tsx` | ninguno |

**Observación clave:** `productsApi.search` es un wrapper sobre `GET /api/products/` (L21–29); es decir **los 6 componentes que "buscan" productos usan el mismo endpoint de lista**. Cualquier fix en `query_visible_products` cubrirá los 6 de golpe.

---

## 4. Riesgo de UX vs seguridad

| Escenario | Cómo se vería el leak |
|---|---|
| Backend devuelve productos de **otra sucursal** en `/api/products/` | Aparecen **directamente en la tabla** de `Products.tsx`, el catálogo de POS (`ProductSearch.tsx`) y las búsquedas móviles. **Leak visible, no requiere devtools.** Un cajero los vería al instante. |
| Backend devuelve productos **inactivos en su sucursal** | `QuoteMaker.tsx` y `MobileSales.tsx` los ocultan con `.filter(is_active)` → **leak solo visible en devtools** (Network tab). `Products.tsx` y POS los muestran → **leak en UI**. |
| Backend permite IDOR en `/api/products/{id}` | Se necesita un `product_id` de otra sucursal. Vectores: (a) cart_key persistido en zustand de otra sesión; (b) URL compartida; (c) devtools inspeccionando la respuesta de una lista no filtrada. **Leak moderado**, requiere intención. |
| Backend ignora `branch_id` del query en `/api/products/` | Products.tsx envía `branch_id=user.branch_id` — si backend lo sobre-confía, un cajero que manipule el request con devtools podría enviar otro `branch_id` y ver el catálogo ajeno. **Leak alto, requiere devtools + curl.** |
| `AdminCatalog` accesible en SPA sin guard | Un CAJERO que escribe `/admin/catalog` en la URL llega al redirect y termina en `/inventory/products`. **No hay leak** porque el backend filtra la lista igualmente; pero es **UX confusa** y señala RBAC incompleto en React Router. |

**Recomendaciones accionables para Agente D (implementación):**

1. **Eliminar** de `Products.tsx:592–595` el envío de `branch_id` y `active_in_branch` — dejar que el backend lo derive del JWT. Si backend necesita la señal, que sea el propio backend quien decida.
2. **Eliminar** los `.filter(p => p.is_active)` de `QuoteMaker.tsx:33` y `MobileSales.tsx:35` — deben ser redundantes con el filtro backend.
3. **Agregar** un `<RequireRole roles={['ADMINISTRADOR','DUEÑO']}>` wrapper en `App.tsx` para la ruta `/admin/catalog` y `/hq/*` si aún no existe (revisar alcance fuera de A3).
4. **Documentar** en el header del `api/products.ts` que `branch_id` y `target_branch_ids` son **hints opcionales para admin**; el backend debe ignorarlos para CAJERO/GERENTE.

---

**Fin — Agente A3.**
