# 00 — Hallazgos consolidados — Sprint CAJERO/GERENTE visibility

**Fecha:** 2026-04-17
**Agente:** D (sintetizador)
**Inputs:** `00-policy.md`, `01-products-router.md`, `02-secondary-routers.md`, `03-frontend.md`, `04-data-model.md`
**Output:** mapa único de fixes para F3. Gate: aprobación humana antes de implementar.
**Instrucción verbatim del usuario:** "adelante"

---

## 1. Resumen ejecutivo

**Total de hallazgos: 47** (CRIT=8, HIGH=9, MED=19, LOW=9, OK=2). Distribución por fuente: A1=11, A2=25, A3=11, A4=0 (spec). F1 está cerrada.

**Los 5 más críticos:**

1. **A2-03/04/05/06 — `quotes.py`: IDOR cross-tenant masivo.** Seis endpoints (`get`, `update`, `delete`, `convert-to-sale`, `pdf`, `create`) resuelven `SalesDocument` y `ProductVariant` sin filtrar `organization_id`. Exfiltración y edición cruzada entre tenants.
2. **A2-01 — `sales.py::create_sale`: permite vender SKU no habilitado en branch.** Tenant OK pero sin validar `ProductBranchStatus`. Anti-ATS-11 efectivo sólo cuando hay stock=0.
3. **A1-01 — `GET /api/products/`: ATS-11 vivo + GERENTE bypass.** `or_(PBS.id==None, is_active_pos==True)` + `is_admin` incluye GERENTE. Contradice policy directa.
4. **A1-02/03/04 — `search`, `variants/search`, `pos/search`: sin JOIN a PBS.** El autocomplete y la búsqueda exponen catálogo cross-branch.
5. **A2-10 — `inventory.py::create_adjustment`: CAJERO ajusta stock de sucursal ajena.** `branch_id` del payload sin validar + variant sin tenant filter.

**Estado de la policy:** implementada al ~30%. El núcleo (PBS INNER JOIN + `is_active_pos`) no existe en ningún endpoint; todos usan `outerjoin` + ATS-11 o no filtran en absoluto. El helper `query_visible_products` no existe. El patrón `role in [<strings>]` vs enum rompe además múltiples bypasses de admin (inventory kardex, commercial) como bug silencioso.

**Recomendación:** **proceder a F3 con el plan C0-C9 ampliado**. No hay blockers arquitectónicos — el diseño del helper (A4) cubre 7+ consumidores y los fixes secundarios son correcciones puntuales. Las 4 IDOR CRIT de `quotes.py` se absorben aquí (son parte de la misma cirugía de resolución de variants). El bug de enum-vs-string se arregla inline en cada sitio afectado usando `_role_str(user)` del helper A4.

---

## 2. Tabla maestra de hallazgos

| ID | Fuente | Severidad | Superficie | Regla violada | Fix asignado | Commit |
|---|---|---|---|---|---|---|
| A2-03 | `quotes.py:127` | **CRIT** | `GET /api/quotes/{id}` | C1 (tenant) | Filtrar `organization_id` en query | C3 |
| A2-04 | `quotes.py:200` | **CRIT** | `DELETE /api/quotes/{id}` | C1 | Inyectar `org_id` dep + filtrar; añadir `current_user` | C3 |
| A2-05 | `quotes.py:235,253` | **CRIT** | `PUT /api/quotes/{id}` | C1, C2, C3 | `get_variant_if_visible` + tenant filter en doc | C3 |
| A2-02 | `quotes.py:44,51-54` | **CRIT** | `POST /api/quotes/` | C1, C8 (tenant variant) | `get_variant_if_visible(sku=..., user=...)` | C3 |
| A2-01 | `sales.py:278-303` | **CRIT** | `POST /api/sales/` loop | C2, C3, C8 | `get_variant_if_visible` con `require_pos_active=True` | C4 |
| A2-10 | `inventory.py:29,34` | **CRIT** | `POST /api/inventory/adjust` | C1, C2, C8, C9 (branch auth) | Forzar `branch_id=user.branch_id` no-admin + tenant variant | C5 |
| A1-01 | `products.py:674` | **CRIT** | `GET /api/products/` | C3, C4 (GERENTE) | Reemplazar bloque 731-772 por `query_visible_products()` | C1 |
| A1-02 | `products.py:355` | **CRIT** | `GET /api/products/search` | C2, C3 | `query_visible_products(search=...)` | C1 |
| A1-03 | `products.py:306` | **CRIT** | `GET /api/products/variants/search` | C2, C3, C5 (`approval_status` comentado) | Wrapper variants sobre `query_visible_products` + restaurar `approval_status='APPROVED'` | C1 |
| A1-04 | `products.py:1386` | **CRIT** | `GET /api/products/pos/search` | C3 (ATS-11) | Sustituir `outerjoin+or_` por `query_visible_products` | C1 |
| A1-05 | `products.py:1138` | **HIGH** | `GET /api/products/{id}` | C2, C3, C7 (IDOR) | `get_product_if_visible` + filtrar `branch_statuses` en respuesta | C2 |
| A1-08 | `products.py:1515` | **HIGH** | `GET /api/products/export/excel` | C2, C3 | `query_visible_products` antes de `.all()` | C2 |
| A2-11 | `inventory.py:110,115` | **HIGH** | `POST /api/inventory/transfer` | C1, C8, C9 | Validar branches del org + permiso user + tenant variant | C5 |
| A2-07 | `quotes.py:284` | **HIGH** | `GET /api/quotes/{id}/pdf` | C1 | Filtrar `organization_id` | C3 |
| A2-20 | `logistics.py:326-342` | **HIGH** | `POST /api/logistics/.../receive` | C1 (escritura) | Añadir `organization_id` en filter y constructors | C6 |
| A2-24 | `services/reception.py:15-19` | HIGH (dormido) | `validate_incoming_item` | C1, C8 | Cambiar firma a `(db, org_id, sku, barcode)` + filtrar | C6 o skip |
| A3-04 | `CartPanel.tsx:159` | HIGH (depende backend) | `productsApi.getById` | F6 (IDOR) | Cubierto por fix A1-05 | C2 |
| A3-05 | `Inventory.tsx` | HIGH (depende backend) | `inventoryApi.createAdjustment` | F3, F7 | Cubierto por fix A2-10; revisar selector `adjBranch` en UI | C5, C7 |
| A3-01 | `Products.tsx:592-595` | HIGH | Envía `branch_id` + `active_in_branch` del cliente | F3, F7 | Eliminar envío; backend deriva del JWT | C7 |
| A1-07 | `products.py:1138` `_compute_product_read` | MED | Leak de `branch_statuses` de todas sucursales | C7 | Filtrar branch_statuses en response por user.branch_id | C2 |
| A1-06 | `products.py:822` | MED | `GET /api/products/boxes-inventory` | C3 | Subquery de variantes visibles | C2 |
| A1-09 | `products.py:56` | MED | `GET /api/products/stats/branch-kpis` | C4 (auth branch) | `if user.branch_id != branch_id and not admin: 403` | C2 |
| A2-12 | `inventory.py:195` | MED | `get_kardex` enum-vs-string | C4 (bypass roto) | `_role_str(user)` del helper | C5 |
| A2-13 | `purchases.py:227` | MED | `create_purchase_order` | C1 | Validar variant tenant (defense in depth) | C6 |
| A2-15 | `reports.py:582` | MED | `product/{id}` | C2, C3 | Si user.branch_id: gatear por PBS | C6 |
| A2-16 | `reports.py:520-532` | MED | `command-center` low_stock | C2 | Filtrar `StockOnHand.branch_id` si no-HQ | C6 |
| A2-17 | `reports.py:308-318` | MED | `daily-summary` low_stock | C2 | Ídem | C6 |
| A2-18 | `transfers.py:38-45` | MED | `POST /api/transfers/` | C1, C8, C9 | Validar variants tenant + branch del org | C6 |
| A2-19 | `transfers.py:114-117,170-183` | MED | `ship`/`receive` fulfillment | C1 | Añadir `organization_id` en filters | C6 |
| A2-21 | `commercial.py:37-94` | MED | `PUT /branch-status` (product) | C4, C8 | `_role_str` + quitar GERENTE + `PBS.organization_id` filter | C6 |
| A2-22 | `commercial.py:100-156` | MED | `PUT /branch-status/{variant_id}` | C4, C8 | Ídem + validar variant tenant | C6 |
| A2-23 | `commercial.py:158-213` | MED | `PUT /branch-status/bulk` | C4, C8 | Ídem | C6 |
| A2-14 | `sales.py:583-586` | LOW | `DELETE /api/sales/{id}` revert | — | Uniformar con `get_variant_if_visible` (opcional) | C4 |
| A2-08 | `quotes.py:305-308` | MED | `convert-to-sale` | C1 | Filtrar `SalesDocument.organization_id` | C3 |
| A3-02 | `QuoteMaker.tsx:33` | MED | `.filter(is_active)` client-side | F2 | Eliminar filter; confiar en backend | C7 |
| A3-03 | `MobileSales.tsx:35` | MED | `.filter(is_active)` | F2 | Ídem | C7 |
| A3-06 | `Logistics.tsx` | MED | Selector `requesting_branch_id` | F3 | Restringir branches del selector a branch del user (no-admin) | C7 |
| A3-09 | `api/products.ts:36,123` | MED | Cliente acepta `branch_id`/`target_branch_ids` arbitrarios | F7 | Documentar + backend los ignora para no-admin | C7 |
| A3-10 | `App.tsx:174` / `AdminCatalog` | MED | Ruta SPA sin `<RequireRole>` | F5 | Agregar wrapper de rol ADMINISTRADOR/DUEÑO | C7 |
| A1-10 | `products.py:518` | LOW | `hq-inventory` sin check rol | C4 | `if role not in [ADMIN,DUEÑO]: 403` | C2 |
| A1-11 | `products.py:1474` | LOW | `batch-action` GERENTE sin branch filter | C4 | Restringir GERENTE a IDs de su branch vía PBS | C2 |
| A2-09 | `purchases.py:341` | LOW | `receive_purchase_order` | — | OK, sin acción | — |
| A2-25 | `brands.py:*` | LOW | Correcto | — | Sin acción | — |
| A3-07 | `HQInventory.tsx` | N/A (admin) | — | — | Verificar `<RequireRole>` en `App.tsx` | C7 |
| A3-08 | `ProductSearch.tsx`, `MobileQuery.tsx` | LOW | Delega al backend | — | Sin acción | — |
| A3-11 | `authStore.ts` | LOW | Diseño correcto (sucursal en JWT) | — | Sin acción | — |
| A1-P | `role_permissions.py:admin_catalog` | OK | RBAC Jinja | — | Sin acción (regresión T11/T12) | C8 |

---

## 3. Helper consolidado (contrato para F3)

### `query_visible_products(db, user, org_id, *, include_inactive=False, search=None, branch_id_override=None, eager_variants=True) -> Query[Product]`

Implementación y docstring íntegros en **A4 §4**. Reglas:

- ADMIN/DUEÑO: sólo tenant; `include_inactive` respetado; `branch_id_override` opcional para simular vista de sucursal.
- CAJERO/GERENTE/VENDEDOR/SOPORTE: INNER JOIN `ProductVariant` + `ProductBranchStatus(branch=user.branch_id, is_active_pos=True)`, `Product.is_active=True`, `approval_status='APPROVED'`.
- `Branch.can_sell=False` → query vacío (short-circuit).
- Host: `app/crud/products.py` (hoy stub, sin colisión).

### Helpers complementarios

1. **`get_product_if_visible(db, user, org_id, product_id)`** — wrapper del helper para detalle. Consumidores: A1-05, A3-04.
2. **`get_variant_if_visible(db, *, user, org_id, sku=None, variant_id=None, require_pos_active=True, require_branch_scope=True)`** — resolución puntual de variant. Consumidores: A2-01 (sales), A2-02/05 (quotes), A2-10/11 (inventory), A2-13 (purchases), A2-18 (transfers), A2-24 (reception).
3. **`assert_product_visible(db, user, org_id, product_id)`** — wrapper que eleva 404. Útil en updates/detalle.
4. **`_role_str(user) -> str`** — normaliza enum/string. Consumidores secundarios: A2-12 (kardex), A2-21/22/23 (commercial), cualquier sitio que compare `role in [<strings>]`.

### Consumidores mapeados

| Helper | Hallazgos que lo consumen |
|---|---|
| `query_visible_products` (lista) | A1-01, A1-02, A1-03, A1-04, A1-08, A1-06 (subquery) |
| `get_product_if_visible` | A1-05, A1-11, A3-04 |
| `get_variant_if_visible` | A2-01, A2-02, A2-05, A2-10, A2-11, A2-13, A2-18, A2-24 |
| `_role_str` | A1-01 (is_admin), A2-12, A2-21, A2-22, A2-23 |

Total consumidores directos: **19 hallazgos** cubiertos por los 4 helpers.

---

## 4. Plan de commits F3 (ajustado)

Ajuste respecto al plan original C0-C8: se extiende a **C0-C9** para incorporar el bloque de IDOR en `quotes.py` (4 CRIT) y separar correctamente el trabajo secundario.

| Commit | Alcance | Hallazgos cerrados |
|---|---|---|
| **C0** | Helpers en `app/crud/products.py` (`query_visible_products`, `get_product_if_visible`, `get_variant_if_visible`, `assert_product_visible`, `_role_str`) + migración con `ix_pbs_branch_active` (partial) + `ix_products_org_active` | — (infraestructura) |
| **C1** | **products.py CRIT:** refactor `GET /`, `/search`, `/variants/search`, `/pos/search` a `query_visible_products`; remover GERENTE de `is_admin`; restaurar `approval_status='APPROVED'` | A1-01, A1-02, A1-03, A1-04 |
| **C2** | **products.py HIGH/MED:** `GET /{id}` con `get_product_if_visible` + filtro de branch_statuses en response; `export/excel`; `boxes-inventory`; `stats/branch-kpis` auth-check; `hq-inventory` check rol; `batch-action` restricción GERENTE | A1-05, A1-06, A1-07, A1-08, A1-09, A1-10, A1-11 |
| **C3** | **quotes.py IDOR cross-tenant:** filtrar `organization_id` en 6 endpoints + `get_variant_if_visible` en `create`/`update`/`convert` | A2-02, A2-03, A2-04, A2-05, A2-07, A2-08 |
| **C4** | **sales.py:** `create_sale` resuelve variants con `get_variant_if_visible`; uniformar `cancel_sale` revert | A2-01, A2-14 |
| **C5** | **inventory.py:** `create_adjustment` fuerza branch=user.branch si no-admin; `transfer_stock` valida branches+permisos; fix `get_kardex` enum-vs-string | A2-10, A2-11, A2-12 |
| **C6** | **Secundarios:** `commercial.py` (3 endpoints) normaliza role y quita GERENTE; `reports.py` (3 endpoints) gatea por branch; `transfers.py` (3 endpoints) tenant+branch; `logistics.receive` organization_id; `purchases.create_purchase_order` tenant variant; `reception.py` (decidir skip vs fix) | A2-13, A2-15, A2-16, A2-17, A2-18, A2-19, A2-20, A2-21, A2-22, A2-23, A2-24 |
| **C7** | **Frontend:** eliminar `branch_id`/`active_in_branch` de `Products.tsx`; quitar `.filter(is_active)` de `QuoteMaker` y `MobileSales`; restringir selector branches en `Inventory`/`Logistics` para no-admin; comentar `api/products.ts`; `<RequireRole>` en `/admin/catalog` y `/hq/*` en `App.tsx` | A3-01, A3-02, A3-03, A3-05, A3-06, A3-07, A3-09, A3-10 |
| **C8** | **Tests T1-T12** en `tests/test_cajero_product_visibility.py` (incluye T11/T12 para `/admin/catalog`) | — (aceptación) |
| **C9** | **Hardening opcional:** sub-index `ix_pbs_variant_branch_active`, pg_trgm si aplica, cleanup `services/reception.py` si se decide borrar | A2-24 (si skip en C6) |

**Orden de merge:** C0 → C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8. C9 aplazable.

---

## 5. Riesgos de implementación

1. **Regresión ADMIN (T7, T11).** El refactor debe preservar `branch_id=None` = visibilidad global. El short-circuit por `can_sell=False` sólo aplica cuando hay `effective_branch_id`. Test T7 explícito en C8.
2. **Rompimiento de reportes cross-branch.** `command-center` y `daily-summary` hoy agregan stock global. Al filtrar por `user.branch_id`, un ADMIN que opere con un JWT "híbrido" (futuro) podría perder visibilidad. Mitigación: `if role in ADMIN_ROLES: no filtrar`.
3. **Performance del INNER JOIN con PBS.** Sin el índice parcial de C0, la query de `/api/products/` con org de 50k productos × 10 sucursales sube de ms a cientos de ms. El índice es **blocker de merge de C1** — no mergear C1 sin C0 aplicado.
4. **`.distinct()` duplicaba productos.** El helper lo incluye; verificar con tests de productos multi-variante.
5. **Dependencias entre commits:**
   - C5 depende de `_role_str` de C0 (bug enum-vs-string).
   - C6 depende también de `_role_str` (commercial.py).
   - C2 depende de C1 (reusa el helper introducido en C1).
   - C3 se puede paralelizar con C1/C2 (resuelve variants pero no productos listados).
   - C7 depende de C1 (backend debe filtrar antes de quitar el filter client-side de QuoteMaker).
6. **`_compute_product_read` leaks `branch_statuses`.** Fix A1-07 debe filtrar el array en response para CAJERO/GERENTE — no basta con fix de query.

---

## 6. Preguntas abiertas para Emmanuel (gate)

1. **Bug enum-vs-string (`role in [<strings>]`).** Afecta `inventory.py:195`, `commercial.py:49/113/165` y posiblemente más. ¿Lo arreglamos inline en este sprint (C5+C6) o separamos a un sprint propio de "normalización de role" que cubra todo el código?
2. **4 IDOR CRIT en `quotes.py` (A2-02/03/04/05/07/08).** Son tenant leaks reales, no parte del sprint original de "visibilidad CAJERO". ¿Entran aquí (C3) o hotfix separado con fast-track?
3. **Índice parcial `ix_pbs_branch_active` en PBS.** ¿Migración Alembic versionada o script ad-hoc en `scripts/`? Atlas históricamente usa scripts (ver `migrate_add_brand_logo.py`); Alembic no está configurado.
4. **`services/reception.py` (A2-24).** Dead code actualmente. ¿Fix defensivo en C6 o borrar y dejar anotado en tech debt?
5. **GERENTE en `commercial.py` whitelist.** Al removerlo (policy "super-cajero"), GERENTE pierde la capacidad de editar PBS. ¿Correcto o se quiere mantener como admin parcial sólo aquí?
6. **`<RequireRole>` en SPA.** No existe hoy. ¿Implementarlo desde cero en C7 o aplazar a un sprint de frontend RBAC?

---

## 7. Criterios de aceptación finales

Re-confirmados del `00-policy.md`, ajustados al volumen:

1. `docs/audits/cajero-visibility/00-findings.md` existe y cubre **47 hallazgos** (13 endpoints de `products.py` + 14 endpoints secundarios + 10 componentes frontend + `api/products.ts` + `authStore.ts` + `/admin/catalog` + tests T11/T12).
2. `app/crud/products.py::query_visible_products` existe, con docstring en español, y es usado por **≥ 6 endpoints** de `products.py` (cumplido con A1-01, A1-02, A1-03, A1-04, A1-06, A1-08).
3. `app/crud/products.py::get_variant_if_visible` existe y es usado por **≥ 5 endpoints** (sales, quotes×2, inventory×2, transfers, purchases).
4. `tests/test_cajero_product_visibility.py` con 12 tests T1-T12 en verde.
5. `GET /api/products/search`, `/variants/search`, `/export/excel`, `/{product_id}` respetan la policy (sin ATS-11).
6. GERENTE y CAJERO retornan el mismo conjunto en `search` y `read_products`.
7. `quotes.py` no expone cross-tenant: añadir test específico de IDOR en C8.
8. Suite existente sin regresión (`pytest` verde). Smoke manual CAJERO org A branch 1.
9. `/admin/catalog` (Jinja) sigue 200 para ADMIN + DUEÑO (T11) y bloqueado para CAJERO (T12).
10. Índice `ix_pbs_branch_active` creado y verificado con `EXPLAIN` antes de merge de C1.
11. PR único contra `refactor/frontend-v2` con commits C0-C8 atómicos.

---

**Fin — Agente D. Esperando "adelante" para ejecutar F3.**
