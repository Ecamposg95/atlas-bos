# Política de visibilidad de productos — CAJERO y GERENTE

**Status:** canónica para este sprint (re-abribible si GERENTE se redefine).
**Date:** 2026-04-17
**Scope:** todos los endpoints y componentes que consulten productos en Atlas-API.

---

## Reglas

### CAJERO y GERENTE (`branch_id != None`)

Un producto es **visible** para este rol si y solo si **todas** estas condiciones se cumplen:

1. `Product.organization_id == current_user.org_id` (tenant).
2. `Product.is_active == True`.
3. Existe un registro `ProductBranchStatus` con:
   - `variant_id` de alguna variante del producto
   - `branch_id == current_user.branch_id`
   - `is_active_pos == True`
4. Si el `Branch` tiene flag de venta (`can_sell == False`), la lista para ese usuario es vacía.

**Sin registro `ProductBranchStatus` para la sucursal del usuario → OCULTO.** Esto anula explícitamente la política antigua **ATS-11** ("sin PBS = visible por defecto"). Decisión tomada por Emmanuel 2026-04-17.

### ADMINISTRADOR y DUEÑO (`branch_id = None`)

Ven todo el catálogo de la organización **sin filtro de sucursal**:

1. `Product.organization_id == current_user.org_id`.
2. `Product.is_active` puede ser `True` o `False` según parámetros del endpoint (admins ven inactivos para reactivarlos).

### Otros roles

- **VENDEDOR** (`branch_id` puede existir, rol MOBILE): mismo filtro que CAJERO por ahora. Revisar si la app mobile requiere excepción.
- **SOPORTE_OPERATIVO**: idem VENDEDOR.
- **CLIENTE** (portal): solo ve productos vía endpoints del portal, que deben tener su propia lógica.

---

## GERENTE = super-cajero (decisión de producto pendiente)

El rol GERENTE actualmente tiene comportamiento **inconsistente** en el código:

- `app/routers/products.py:735` — `is_admin = role in [ADMIN, GERENTE, DUEÑO]` → GERENTE ve todo.
- `app/routers/products.py:1427` — `pos/search` excluye solo ADMIN/DUEÑO → GERENTE filtra como CAJERO.

**Decisión para este sprint:** GERENTE aplica el mismo filtro que CAJERO (filtrado por su `branch_id`). Es "super-cajero", no admin parcial. Si el negocio decide lo contrario después, cambiar en un solo lugar (el helper `query_visible_products`).

---

## Superficies a auditar

### Backend (endpoints)

| Superficie | Archivo / línea | Rol esperado | Filtro requerido |
|---|---|---|---|
| `GET /api/products/` | `routers/products.py:674` | Todos (ADMIN ve todo, CAJERO/GERENTE filtrado) | C1-C4 |
| `GET /api/products/search` | `routers/products.py:355` | Todos | C1-C4 — **R1 ALTO** actualmente sin filtro branch |
| `GET /api/products/variants/search` | `routers/products.py:306` | Todos | C1-C4 — **R2 ALTO** actualmente solo org |
| `GET /api/products/pos/search` | `routers/products.py:1386` | CAJERO/GERENTE principalmente | C1-C4 |
| `GET /api/products/{product_id}` | `routers/products.py:1138` | Todos | C1-C4 — **R5 BAJO** verificar IDOR |
| `GET /api/products/hq-inventory` | `routers/products.py:518` | HQ admin | ADMIN-only, sin filtro branch |
| `GET /api/products/boxes-inventory` | `routers/products.py:822` | HQ admin | ADMIN-only |
| `GET /api/products/export/excel` | `routers/products.py:1515` | Todos | C1-C4 — **R4 MEDIO** actualmente sin filtro branch |
| `GET /api/products/stats/branch-kpis` | `routers/products.py:56` | ADMIN | Sin filtro (agrega todas) |
| `POST /api/products/batch-action` | `routers/products.py:1474` | ADMIN | Lee antes de modificar — aplicar filtro igual |
| `GET /admin/catalog` (Jinja) | `routers/daxpos.py:54` | **ADMIN + DUEÑO only** (RBAC en `role_permissions.py`) | Sin filtro branch; confirmar que RBAC bloquea CAJERO |
| Resolución de `variant_id` en ventas | `routers/sales.py:280-309, 582` | CAJERO (POS) | Validar tenant + branch del variant |
| Resolución en cotizaciones | `routers/quotes.py:41-53, 253` | Todos | Validar tenant + branch |
| Resolución en compras | `routers/purchases.py:341` | ADMIN | Tenant OK; branch opcional |
| Reportes | `routers/reports.py:582` | ADMIN | Tenant |
| Reception service | `services/reception.py` | Warehouse | Tenant |
| CRUD helpers | `crud/products.py` | N/A | Candidato para host del nuevo helper `query_visible_products` |

### Frontend (componentes)

| Componente | Ruta archivo | Endpoint consumido | Riesgo |
|---|---|---|---|
| Products | `pages/inventory/Products.tsx` | `productsApi.list` | Si backend filtra, frontend OK |
| ProductSearch (POS) | `components/pos/ProductSearch.tsx` | `posSearch` | Backend debe filtrar |
| QuoteMaker | `pages/sales/QuoteMaker.tsx` | `search` | Backend debe filtrar |
| CartPanel | `components/pos/CartPanel.tsx` | `getById` | Verificar IDOR |
| Inventory | `pages/inventory/Inventory.tsx` | `search` | Idem |
| Logistics | `pages/inventory/Logistics.tsx` | `search` | Idem |
| HQInventory | `pages/hq/HQInventory.tsx` | ADMIN-only | Sin filtro branch |
| MobileQuery | `pages/mobile/MobileQuery.tsx` | `search` | Debe filtrar |
| MobileSales | `pages/mobile/MobileSales.tsx` | `posSearch` | Debe filtrar |
| AdminCatalog | `pages/core/AdminCatalog.tsx` | Redirect a `/inventory/products` | Confirmar que se preserva el redirect |
| `api/products.ts` | `frontend/src/api/products.ts` | Cliente Axios | Sin lógica de filtrado |

---

## Matriz de casos de prueba (T1–T12)

Se implementa como suite `tests/test_cajero_product_visibility.py`.

| ID | Rol | `branch_id` | Producto estado | Endpoint(s) testados | Resultado esperado |
|---|---|---|---|---|---|
| T1 | CAJERO | 1 | `PBS(b=1, is_active_pos=True)` + `is_active=True` | `/api/products/`, `/search`, `/variants/search`, `/pos/search`, `/{id}`, `/export/excel` | Visible |
| T2 | CAJERO | 1 | `PBS(b=1, is_active_pos=False)` | Mismos | Oculto |
| T3 | CAJERO | 1 | `PBS(b=2, is_active_pos=True)` (otra sucursal) | Mismos | Oculto |
| T4 | CAJERO | 1 | Sin `PBS` para ninguna sucursal | Mismos | Oculto (nueva política, anula ATS-11) |
| T5 | CAJERO | 1 | `Product.is_active=False` | Mismos | Oculto |
| T6 | CAJERO | 1 | `Branch(1).can_sell=False` | Mismos | Lista vacía completa |
| T7 | ADMINISTRADOR | `None` | Cualquier producto de la org | Mismos | Visible (regresión) |
| T8 | GERENTE | 1 | `PBS(b=2)` sin registro en b=1 | Mismos | Oculto (mismo filtro que CAJERO) |
| T9 | CAJERO org A | 1 | Producto de org B | Mismos | Oculto (tenant) |
| T10 | CAJERO | 1 | `Product.approval_status=PENDING` | Mismos | Oculto (forzar APPROVED) |
| T11 | ADMINISTRADOR | `None` | N/A — test de ruta | `GET /admin/catalog` | `200 OK` (regresión RBAC) |
| T12 | CAJERO | 1 | N/A — test de ruta | `GET /admin/catalog` | `403` o redirect a `/index?error=unauthorized` (regresión RBAC) |

---

## Criterios de aceptación observables

1. `docs/audits/cajero-visibility/00-findings.md` existe y cubre los 13 endpoints + 10 componentes + `/admin/catalog`.
2. `app/crud/products.py::query_visible_products(db, user, org_id)` existe, con docstring en español, y es usado por ≥ 6 endpoints.
3. `tests/test_cajero_product_visibility.py` con 12 tests T1–T12 en verde.
4. `GET /api/products/search`, `/variants/search`, `/export/excel`, `/{product_id}` respetan la política.
5. GERENTE y CAJERO retornan el mismo conjunto en `search` y `read_products`.
6. Suite existente sin regresión (`pytest` completo verde).
7. Smoke manual CAJERO (org A, branch 1) no ve productos de org B ni de branch 2.
8. PR abierto contra `refactor/frontend-v2` con body estructurado.
9. `/admin/catalog` (Jinja) sigue `200` para ADMIN + DUEÑO (T11) y bloqueado para CAJERO (T12) — sin regresión RBAC.

---

## Decisiones del sprint

1. **Branching:** rama compartida `fix/cajero-visibility-sprint`, 1 PR grande con commits atómicos.
2. **Helper-first:** commit C0 introduce `query_visible_products()` antes de los fixes.
3. **TDD:** tests T1–T12 se escriben después del helper y antes de C1-C8. Los endpoints se arreglan hasta que pasen.
4. **GERENTE = CAJERO** en este sprint. Re-abribible.
5. **ATS-11 anulada** para CAJERO/GERENTE (sin PBS = oculto).
