# Auditoría CAJERO/GERENTE — Routers secundarios (Agente A2)

**Fecha:** 2026-04-17
**Scope:** consumidores de `Product` / `ProductVariant` / `ProductBranchStatus` fuera de `app/routers/products.py`.
**Policy:** `docs/audits/cajero-visibility/00-policy.md`.

---

## 1. Resumen ejecutivo

- **`sales.py::create_sale`**: valida **tenant** al resolver la variant por SKU (tolera `organization_id=None` vía `OR`), pero **no valida ProductBranchStatus** (C2/C3). Un CAJERO puede vender una variant cuyo producto no fue habilitado en su sucursal — solo lo detiene la falta de stock, no la policy. Anti-ATS-11 confirmado. **Severidad ALTA**.
- **`quotes.py`**: seis endpoints (`create_quote`, `update_quote`, `get_quote_detail`, `delete_quote`, `convert_quote_to_sale`, `get_quote_pdf_file`) resuelven variants y documents **sin filtro tenant** (`db.query(ProductVariant).filter(sku=...)`, `db.query(SalesDocument).get(quote_id)`). IDOR cross-tenant confirmado. **Severidad CRÍTICA**.
- **`inventory.py`**: `create_adjustment` y `transfer_stock` hacen `db.query(ProductVariant).get(variant_id)` sin tenant filter; aceptan `branch_id` / `from_branch_id` / `to_branch_id` del cliente sin validar que el usuario tenga permiso (defense in depth ausente). **Severidad CRÍTICA** para adjust, **ALTA** para transfer. `get_kardex` tiene el bypass admin roto por comparación enum-vs-string.
- **`commercial.py`**: queries a `ProductBranchStatus` y comparaciones `current_user.role not in [...]` contra strings (el modelo expone enum → bypass roto). Incluye GERENTE en el whitelist de admin de PBS — contradice la policy del sprint ("GERENTE = super-cajero"). **Severidad MEDIA**.
- **`reports.py` + `transfers.py` + `logistics.py` + `services/reception.py`**: varios leaks menores (low_stock sin filtro branch en dashboards, PBS sin org_id, fulfillment sin tenant check en variants, `logistics.receive` no propaga `organization_id`). `reception.py` es dead code pero peligroso si se reactiva.
- **`purchases.py`** (ADMIN-only): acepta `variant_id` del payload sin validar tenant en `create_purchase_order`; `receive_purchase_order` sí filtra correctamente. Bajo riesgo porque es admin, pero fix trivial.
- **`brands.py`**: correcto — siempre filtra `Product.organization_id == org_id`.

---

## 2. Tabla por endpoint

Convención: `OK` = cumple, `FAIL` = no cumple, `N/A` = no aplica al endpoint.

| Endpoint | Archivo:línea | C1 | C2 | C3 | C4 | C8 | C9 | Severidad | Hallazgo | Fix 1 línea |
|---|---|---|---|---|---|---|---|---|---|---|
| `POST /api/sales/` (items loop) | `sales.py:278-303` | OK* | FAIL | FAIL | N/A | FAIL | OK | **ALTA** | Variant resuelta por SKU con `OR org=None`. Sin JOIN a PBS. Permite vender SKU no habilitado en branch (anti-ATS-11). | Usar `get_variant_if_visible(sku=..., user=u)` helper que valide PBS(branch=user.branch, is_active_pos). |
| `DELETE /api/sales/{sale_id}` revert | `sales.py:583-586` | OK | N/A | N/A | N/A | OK | OK | BAJA | Usa `sale.branch_id` del doc ya persistido, filtra org. | — |
| `POST /api/quotes/` (create_quote) | `quotes.py:44,51-54` | **FAIL** | OK† | OK† | N/A | **FAIL** | OK | **CRÍTICA** | Variant por SKU sin filtro tenant. PBS consultada pero sin `PBS.organization_id`. | `.join(Product).filter(Product.organization_id == org_id)`. |
| `GET /api/quotes/{id}` | `quotes.py:127` | **FAIL** | N/A | N/A | N/A | FAIL | N/A | **CRÍTICA** | `db.query(SalesDocument).get(quote_id)` sin `organization_id`. IDOR. | `.filter(id=..., organization_id=org_id).first()`. |
| `DELETE /api/quotes/{id}` | `quotes.py:200` | **FAIL** | N/A | N/A | N/A | N/A | N/A | **CRÍTICA** | Mismo IDOR; además sin `current_user` dependency. | Inyectar `org_id` dep + filtrar. |
| `PUT /api/quotes/{id}` | `quotes.py:235,253` | **FAIL** | FAIL | FAIL | N/A | FAIL | OK | **CRÍTICA** | `.get(quote_id)` + `ProductVariant.filter(sku=...)` sin tenant ni PBS. | Helper variant visible + tenant filter. |
| `POST /api/quotes/{id}/convert-to-sale` | `quotes.py:305-308` | FAIL | N/A | N/A | N/A | N/A | OK | MED | Filtra `doc_type` pero no `org_id`. | Añadir `SalesDocument.organization_id == org_id`. |
| `GET /api/quotes/{id}/pdf` | `quotes.py:284` | **FAIL** | N/A | N/A | N/A | N/A | N/A | ALTA | `.get(quote_id)` sin tenant. Leak de PDF cross-tenant. | Filtrar org_id. |
| `POST /api/inventory/adjust` | `inventory.py:29,34` | **FAIL** | FAIL | N/A | N/A | **FAIL** | **FAIL** | **CRÍTICA** | `ProductVariant.get()` sin tenant; `adj.branch_id` del cliente (fallback a user.branch_id) — CAJERO puede pasar `branch_id` de otra sucursal del mismo tenant. | Forzar `target_branch_id = current_user.branch_id` si no es admin + validar variant tenant. |
| `POST /api/inventory/transfer` | `inventory.py:110,115-119` | **FAIL** | N/A | N/A | N/A | FAIL | **FAIL** | **ALTA** | Variant sin tenant; `from_branch_id`/`to_branch_id` del cliente sin autorización. | Validar branches del org y permiso del user. |
| `GET /api/inventory/kardex/{variant_id}` | `inventory.py:195` | OK | N/A | N/A | FAIL | FAIL | N/A | MED | `current_user.role in ["ADMINISTRADOR",...]` compara enum vs string → bypass admin **nunca** funciona. | Normalizar role a string (`role.value`). |
| `POST /api/purchases/` | `purchases.py:227` | **FAIL** | N/A | N/A | OK (admin) | FAIL | OK | MED | `variant_id` del payload guardado sin validar tenant. | Validar `ProductVariant.filter(id=..., organization_id=org_id)`. |
| `POST /api/purchases/{po_id}/receive` | `purchases.py:341-344` | OK | N/A | N/A | OK | OK | OK | BAJA | Correcto — filtra variant por org_id. | — |
| `GET /api/reports/product/{id}` | `reports.py:582` | OK | FAIL | N/A | N/A | OK | N/A | MED | Filtra tenant pero no rol→branch. CAJERO ve analytics de cualquier producto del tenant. | Si `user.branch_id`: gatear por PBS(branch=user.branch, is_active_pos). |
| `GET /api/reports/command-center` low_stock | `reports.py:520-532` | OK | FAIL | N/A | N/A | N/A | N/A | MED | Leak de stock crítico cross-branch en dashboards de GERENTE/CAJERO. | `if not is_hq_user: .filter(StockOnHand.branch_id == user.branch_id)`. |
| `GET /api/reports/daily-summary` low_stock | `reports.py:308-318` | OK | FAIL | N/A | N/A | N/A | N/A | MED | Ídem. | Ídem. |
| `POST /api/transfers/` | `transfers.py:38-45` | FAIL | N/A | N/A | N/A | **FAIL** | FAIL | MED | `line.variant_id` del cliente sin validar tenant; `requesting_branch_id` del cliente. | Validar variants del tenant + branch del org. |
| `POST /api/transfers/{id}/fulfill` | `transfers.py:72` | OK (order) | N/A | N/A | N/A | N/A | FAIL | BAJA | `source_branch_id` del payload sin validar. | Validar que source branch pertenezca al org. |
| `POST /api/transfers/fulfillment/{id}/ship` | `transfers.py:114-117` | FAIL | N/A | N/A | N/A | N/A | N/A | MED | `StockOnHand` query sin `organization_id`. | Añadir `StockOnHand.organization_id == org_id` en filter. |
| `POST /api/transfers/fulfillment/{id}/receive` | `transfers.py:170-183` | FAIL | N/A | N/A | N/A | N/A | N/A | MED | Ídem + crea `StockOnHand` con `organization_id=org_id` OK (ver L178). | Ídem filter. |
| `POST /api/logistics/.../receive` | `logistics.py:326-342` | **FAIL** | N/A | N/A | N/A | N/A | FAIL | ALTA | Stock y movimientos sin `organization_id` en filter **ni en create**. | Añadir `organization_id=org_id` en ambos lugares. |
| `PUT /api/commercial/{product_id}/branch-status` | `commercial.py:37-94` | OK (product) | N/A | N/A | FAIL | FAIL | OK | MED | `role not in [...]` string vs enum; GERENTE en whitelist contradice policy; PBS existente no filtra `organization_id`. | Normalizar `role.value`; remover GERENTE; añadir `PBS.organization_id == org_id`. |
| `PUT /api/commercial/branch-status/{variant_id}` | `commercial.py:100-156` | Partial | N/A | N/A | FAIL | FAIL | OK | MED | Ídem; `variant_id` del path sin validar tenant. | Ídem + validar variant del tenant. |
| `PUT /api/commercial/branch-status/bulk` | `commercial.py:158-213` | Partial | N/A | N/A | FAIL | FAIL | OK | MED | Ídem. | Ídem. |
| `services/reception.py::validate_incoming_item` | `reception.py:15-19` | **FAIL** | N/A | N/A | N/A | **FAIL** | N/A | ALTA (dormido) | Busca variant por SKU / barcode sin tenant. Dead code actualmente. | Cambiar firma a `(db, org_id, sku, barcode)` y filtrar. |
| `brands.py` (todos) | `brands.py:*` | OK | N/A | N/A | N/A | N/A | OK | — | Correcto. | — |

\*sales.py C1: filtra por `Product.organization_id` pero acepta `organization_id=None` (productos globales de seed) — revisitar si esos existen en prod.
†quotes.py C2/C3: usa `is_active_hq` en vez de `is_active_pos`, semántica intencional para flujo HQ. El bug principal es tenant.

---

## 3. Hallazgos críticos detallados

### H1 — `quotes.py`: IDOR masivo cross-tenant

Todos los endpoints de cotización excepto `create_quote` usan `db.query(SalesDocument).get(quote_id)` **sin filtrar por `organization_id`**. Un usuario de la org A puede leer, editar, imprimir PDF y eliminar cotizaciones de la org B si conoce el UUID.

```python
# quotes.py:127  (get_quote_detail)
quote = db.query(SalesDocument).get(quote_id)           # ← BUG
# quotes.py:200  (delete_quote) — además falta current_user
quote = db.query(SalesDocument).get(quote_id)
# quotes.py:284  (get_quote_pdf_file)
quote = db.query(SalesDocument).get(quote_id)
```

**Fix:** reemplazar por `db.query(SalesDocument).filter(SalesDocument.id == quote_id, SalesDocument.organization_id == org_id).first()`. Inyectar `org_id: int = Depends(get_current_active_organization)` en cada endpoint.

Además `create_quote`/`update_quote` buscan variant por SKU sin tenant:

```python
# quotes.py:44
variant = db.query(ProductVariant).filter(ProductVariant.sku == item.sku).first()
```

Aquí conviene usar el helper `get_variant_if_visible(db, sku=..., user=current_user)` propuesto en §4.

---

### H2 — `sales.py`: venta de SKU no habilitado en branch (anti-ATS-11)

`create_sale` resuelve la variant por SKU con filtro tenant, pero **nunca verifica `ProductBranchStatus(branch=user.branch, is_active_pos=True)`**. Solo consulta PBS para `price_override` (línea 307).

```python
# sales.py:282-288 — tenant OK, PBS ausente
variant = db.query(ProductVariant).options(...).join(Product).filter(
    ProductVariant.sku == item.sku,
    or_(Product.organization_id == org_id, Product.organization_id == None)
).first()
```

**Vector práctico:** un CAJERO de la sucursal 1 podría escanear/tipear el SKU de un producto habilitado solo en sucursal 2 (siempre que exista stock en su branch — por transfer manual, seed viejo o bug de inventario). Completa la venta sin bloqueo.

**Fix:** introducir `get_variant_if_visible(db, sku=..., user=current_user)` que encapsule tenant + PBS + `is_active_pos`, y usarlo en lugar de la query inline.

---

### H3 — `inventory.py::create_adjustment`: CAJERO ajusta cualquier sucursal del tenant

```python
# inventory.py:29-40
variant = db.query(ProductVariant).get(adj.variant_id)           # ← sin tenant
target_branch_id = adj.branch_id if adj.branch_id else current_user.branch_id  # ← confía en cliente
stock_record = db.query(StockOnHand).filter_by(
    branch_id=target_branch_id, variant_id=adj.variant_id, organization_id=org_id
).with_for_update().first()
```

Un CAJERO de branch 1 puede enviar `adj.branch_id = 2` y manipular el stock de la sucursal 2 (mismo tenant). Abusos posibles: inflar mermas, ocultar robos, desbalancear inventario ajeno.

**Fix propuesto:**

```python
role_str = str(current_user.role.value) if hasattr(current_user.role, "value") else str(current_user.role)
is_admin = role_str in ("ADMINISTRADOR", "DUEÑO")
if not is_admin and adj.branch_id and adj.branch_id != current_user.branch_id:
    raise HTTPException(403, "No puedes ajustar stock de otra sucursal.")
target_branch_id = adj.branch_id if (is_admin and adj.branch_id) else current_user.branch_id
variant = db.query(ProductVariant).join(Product).filter(
    ProductVariant.id == adj.variant_id, Product.organization_id == org_id
).first()
```

---

### H4 — `inventory.py::get_kardex`: bypass admin inoperante por enum-vs-string

```python
# inventory.py:195
if current_user.role in ["ADMINISTRADOR", "GERENTE", "DUEÑO"] and branch_id:
    target_branch_id = branch_id
```

`current_user.role` es enum `Role`, no string. La comparación depende de que el enum implemente `__eq__` contra strings (no lo hace por defecto). Resultado: el bypass admin **nunca funciona**; cualquier usuario ve solo su propia sucursal (o ninguna si `branch_id=None`). Fallo silencioso.

**Fix:** normalizar `role_str = str(current_user.role.value) if hasattr(current_user.role,'value') else str(current_user.role)` y comparar contra el string.

Mismo patrón en `commercial.py:49, 113, 165`.

---

### H5 — `logistics.py::receive`: escritura sin `organization_id`

```python
# logistics.py:326-342
stock = db.query(StockOnHand).filter(
    StockOnHand.variant_id == item.variant_id,
    StockOnHand.branch_id == target_branch_id
).first()  # ← sin organization_id
...
stock = StockOnHand(branch_id=..., variant_id=..., qty_on_hand=qty_to_add)  # ← sin organization_id
mv = InventoryMovement(branch_id=..., variant_id=..., ...)                  # ← sin organization_id
```

El `StockOnHand` y el `InventoryMovement` recién creados no reciben `organization_id`. Dado que `TenantMixin.organization_id` es `nullable=True` (known debt en CLAUDE.md), el registro queda huérfano y puede colisionar entre tenants.

**Fix:** setear `organization_id=org_id` en `filter` y en los constructores.

---

### H6 — `commercial.py`: GERENTE en whitelist admin contradice la policy

```python
# commercial.py:49
if current_user.role not in ["ADMINISTRADOR", "GERENTE", "DUEÑO"]:
    raise HTTPException(status_code=403, detail="No autorizado")
```

Dos problemas:
(a) enum-vs-string: la verificación típicamente evalúa siempre a `True` (el enum no está en la lista de strings) → **el endpoint bloquea a todos, incluso ADMIN** salvo que exista un `__eq__` custom (no lo hay).
(b) Si se arregla (a), GERENTE podría editar habilitación comercial, contradiciendo "GERENTE = super-cajero" de la policy del sprint.

**Fix:** normalizar role a string vía `.value` y remover `"GERENTE"` del whitelist.

---

### H7 — `reports.py` command-center + daily-summary: stock crítico cross-branch

Los dashboards que un CAJERO/GERENTE abre muestran alertas de `StockOnHand.qty_on_hand <= N` **sin filtrar por branch**. Leak operativo: el cajero ve que "la sucursal 3 está sin pilas AAA". No es GDPR-grave pero rompe la policy.

**Fix:** en el mismo query:
```python
if not is_hq_user:
    query = query.filter(StockOnHand.branch_id == current_user.branch_id)
```

---

## 4. Dependencias con el helper

### Consumidores directos de `query_visible_products(db, user, org_id)` (listados)

Ninguno de los routers secundarios auditados hace listados genéricos de productos — las listas viven en `products.py` (scope del Agente A1). `reports.py` podría beneficiarse en 2-3 queries de inventario/low-stock, pero son agregaciones sobre `StockOnHand`, no listados de `Product`.

### Consumidores de un helper complementario `get_variant_if_visible(db, *, user, org_id, sku=None, variant_id=None, ...)`

Este helper se necesita para resolución puntual de una variant con validación completa (tenant + PBS + `is_active_pos`). Lista de consumidores:

| Router / función | Cómo lo invocaría | Reemplaza líneas |
|---|---|---|
| `sales.py::create_sale` loop items | `get_variant_if_visible(db, user=u, org_id=..., sku=item.sku)` | 282-288 |
| `sales.py::cancel_sale` revert loop | `get_variant_if_visible(db, user=u, org_id=..., variant_id=line.variant_id)` | 583-586 (hoy OK, uniformar) |
| `quotes.py::create_quote` | por SKU | 44 + 51-60 (validación PBS dentro del helper) |
| `quotes.py::update_quote` | por SKU | 253 |
| `quotes.py::convert_quote_to_sale` | por variant_id (lines persistidas) | 317-320 |
| `inventory.py::create_adjustment` | por variant_id | 29 |
| `inventory.py::transfer_stock` | por variant_id (dos branches) | 110 |
| `purchases.py::create_purchase_order` | por variant_id (opcional) | 227 |
| `transfers.py::create_transfer_request` line loop | por variant_id | 42 |
| `services/reception.py::validate_incoming_item` | por sku/barcode | 15-19 |

**Firma recomendada:**

```python
def get_variant_if_visible(
    db: Session,
    *,
    user: User,
    org_id: int,
    sku: str | None = None,
    variant_id: str | None = None,
    require_pos_active: bool = True,       # False para flujos HQ / compras
    require_branch_scope: bool = True,     # False para admins resolviendo cross-branch
) -> ProductVariant | None
```

Reglas:
- ADMIN/DUEÑO (`branch_id=None`) → bypass PBS, solo tenant.
- CAJERO/GERENTE/VENDEDOR → tenant + PBS(`branch=user.branch_id`, `is_active_pos=True`) + `Product.is_active`.
- `require_pos_active=False` permite cotizaciones HQ (usa `is_active_hq` en su lugar si se expone ese flag).

### Hosting

`app/crud/products.py` (44 LOC, contenido efectivamente muerto — `create_simple_product` y `get_product_by_sku` sin consumidores) es el candidato natural. No requiere refactor previo.

---

## 5. Notas finales

- La mayoría de bugs críticos de tenant en routers secundarios son **trivialmente explotables vía UUIDs** (quotes.py). Deben corregirse antes o junto con el helper, aunque no sean parte estricta del sprint de visibilidad.
- El patrón `role in [<strings>]` contra enum es un antipatrón repetido: `inventory.py:195`, `commercial.py:49/113/165`. Recomiendo centralizar un `is_hq_user(user) -> bool` en `app/core/role_permissions.py` y migrar todos los sitios.
- `services/reception.py` está dormido; cuando se reactive, debe recibir `org_id` obligatorio en la firma.
- `purchases.py::create_purchase_order` necesita validación tenant aunque sea ADMIN-only — defense in depth.
