# 01 — Auditoría `app/routers/products.py` + `/admin/catalog` (Agente A1)

**Fecha:** 2026-04-17
**Policy canónica:** `docs/audits/cajero-visibility/00-policy.md`
**Alcance:** `app/routers/products.py` (2577 LOC), `app/routers/daxpos.py` (`/admin/catalog`), `app/core/role_permissions.py`.
**Modo:** read-only. Sin escritura en código ni tests.

---

## 1. Resumen ejecutivo

- **ATS-11 anulada por policy pero aún implementada en 2 endpoints críticos** (`GET /`, `GET /pos/search`) vía patrón `or_(PBS.id == None, PBS.is_active_pos == True)`. Viola directamente la política nueva: "sin PBS = OCULTO". Severidad CRIT.
- **`GET /search` y `GET /variants/search` no filtran por sucursal en absoluto** para CAJERO/GERENTE. Solo `organization_id`. Fuga horizontal de catálogo entre sucursales. Severidad CRIT.
- **`GET /{product_id}` no previene IDOR:** un CAJERO puede solicitar cualquier `product_id` de su org y recibir detalle completo aunque no haya PBS para su sucursal. Severidad HIGH.
- **`GET /export/excel` permite a CAJERO/GERENTE exportar TODO el catálogo** de la organización sin filtro de sucursal. Exfiltración masiva. Severidad HIGH.
- **GERENTE tratado como admin en `GET /`** (línea 735: `is_admin = role in [ADMIN, GERENTE, DUEÑO]`) — contradice la decisión de sprint (GERENTE = CAJERO). Inconsistente con `pos/search` (línea 1427) que sí lo filtra.
- **`/admin/catalog` (Jinja) correcto** — RBAC solo permite ADMINISTRADOR y DUEÑO. CAJERO/GERENTE bloqueados. OK.

---

## 2. Tabla principal

| Endpoint | Archivo:línea | C1 | C2 | C3 | C4 | C5 | C6 | C7 | Severidad | Hallazgo | Fix 1-línea |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `GET /api/products/` | `products.py:674` | ✓ | ✓ parcial | ✗ (LEFT JOIN + ATS-11) | ✗ GERENTE=admin | ✗ | ✓ | N/A | **CRIT** | ATS-11 activo; GERENTE bypass | Quitar ATS-11 fallback y remover GERENTE de `is_admin` → usar `query_visible_products()` |
| `GET /api/products/search` | `products.py:355` | ✓ | ✗ | ✗ | N/A | ✗ | ✗ | N/A | **CRIT** | Sin filtro de sucursal; expone catálogo global | Agregar INNER JOIN PBS + `is_active_pos=True` si rol branch |
| `GET /api/products/variants/search` | `products.py:306` | ✓ | ✗ | ✗ | N/A | ✗ (comentado) | ✗ | N/A | **CRIT** | Solo filtra `org_id`. Autocomplete expone SKUs de otras sucursales | INNER JOIN PBS + `is_active_pos=True` para CAJERO/GERENTE |
| `GET /api/products/pos/search` | `products.py:1386` | ✓ | ✓ parcial | ✗ (LEFT + ATS-11) | ✓ (ADMIN/DUEÑO exento; GERENTE filtrado) | ✓ (`is_active=True`) | ✗ | N/A | **CRIT** | ATS-11 activo vía `or_(PBS.id==None, is_active_pos==True)` | Cambiar a INNER JOIN + `is_active_pos=True` |
| `GET /api/products/{product_id}` | `products.py:1138` | ✓ | ✗ | ✗ | N/A | ✗ | ✗ | ✗ | **HIGH** | IDOR: devuelve cualquier producto de la org por ID | Check post-query: si rol branch y no hay PBS activo → 404 |
| `GET /api/products/hq-inventory` | `products.py:518` | ✓ | N/A | N/A | ✓ (HQ-only de facto) | N/A | N/A | N/A | **LOW** | Sin check explícito de rol ADMIN/DUEÑO | Agregar `if role not in [ADMIN,DUEÑO]: raise 403` |
| `GET /api/products/boxes-inventory` | `products.py:822` | ✓ parcial (acepta `org=None`) | ✓ filtra `user.branch_id` | ✗ (no usa PBS) | ✓ | ✗ | ✗ | N/A | **MED** | Sin JOIN a PBS; CAJERO ve empaques no habilitados | Agregar INNER JOIN PBS si rol branch |
| `GET /api/products/export/excel` | `products.py:1515` | ✓ | ✗ | ✗ | N/A | ✗ | ✗ | N/A | **HIGH** | Exporta todos los productos sin filtro de sucursal | Aplicar mismo filtro PBS para CAJERO/GERENTE |
| `GET /api/products/stats/branch-kpis` | `products.py:56` | ✓ | ✓ (usa `branch_id` param) | ✓ (`is_active_pos=True`) | ✓ | N/A | ✗ | N/A | **MED** | No valida que `user.branch_id == branch_id` para no-admin | `if user.branch_id and user.branch_id != branch_id and role not in [ADMIN,DUEÑO]: 403` |
| `POST /api/products/batch-action` | `products.py:1474` | ✓ | N/A | N/A | ✓ (`_MANAGER_ROLES`) | N/A | N/A | N/A | **LOW** | GERENTE puede actuar sobre IDs de cualquier sucursal | Restringir GERENTE a IDs de su branch vía PBS |
| `GET /admin/catalog` (Jinja) | `daxpos.py:54` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **OK** | `check_view_permission("admin_catalog.html")` bloquea CAJERO/GERENTE | — |
| RBAC `admin_catalog.html` | `role_permissions.py:16,55` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | **OK** | Solo ADMINISTRADOR y DUEÑO en `DATAXPOS_ROLE_VIEWS` | — |

Leyenda severidad: **CRIT**=fuga activa entre sucursales, **HIGH**=exfiltración o IDOR, **MED**=visibilidad lateral o check faltante, **LOW**=endurecer defensa.

---

## 3. Hallazgos detallados (MED+)

### 3.1 `GET /api/products/` (l.674) — CRIT

Actual (l.735, 753-765):
```python
is_admin = current_user.role in ["ADMINISTRADOR", "GERENTE", "DUEÑO"]  # GERENTE indebido
...
# Catalog Mode: outerjoin para no excluir productos sin registro de sucursal
query = query.outerjoin(ProductBranchStatus, and_(
    ProductBranchStatus.variant_id == ProductVariant.id,
    ProductBranchStatus.branch_id == target_branch_id
))
if not is_admin:
    # ATS-11: productos sin ProductBranchStatus (id == None) son visibles por defecto.
    query = query.filter(
        or_(ProductBranchStatus.id == None, ProductBranchStatus.is_active_pos == True)
    )
```
Propuesto (conceptual):
```python
is_admin = current_user.role in ["ADMINISTRADOR", "DUEÑO"]  # GERENTE fuera
...
if not is_admin and current_user.branch_id:
    query = query.join(ProductBranchStatus, and_(
        ProductBranchStatus.variant_id == ProductVariant.id,
        ProductBranchStatus.branch_id == current_user.branch_id,
        ProductBranchStatus.is_active_pos == True,
    ))
```

### 3.2 `GET /api/products/search` (l.355) — CRIT

Actual (l.371-388): solo filtra por `organization_id` + texto. No toca `ProductBranchStatus`. Un CAJERO de sucursal 1 ve productos activos solo en sucursal 2.

Propuesto: rama condicional para `role ∈ {CAJERO, GERENTE, VENDEDOR, SOPORTE_OPERATIVO}` con INNER JOIN a PBS por `branch_id=user.branch_id` y `is_active_pos=True`. Consumidor directo de `query_visible_products()`.

### 3.3 `GET /api/products/variants/search` (l.306) — CRIT

Actual (l.319-336): el bloque de filtro por `approval_status` está **comentado** ("RELAXED — User requested visibility for imports"). Cualquier rol autenticado obtiene autocomplete de todas las variantes de la org.

Propuesto: restaurar filtro de `approval_status` y añadir INNER JOIN a PBS si rol branch. El autocomplete es vector de descubrimiento de SKUs de otras sucursales.

### 3.4 `GET /api/products/pos/search` (l.1386) — CRIT

Actual (l.1427-1437):
```python
if current_user.branch_id and current_user.role not in ("ADMINISTRADOR", "DUEÑO"):
    query = (
        query
        .outerjoin(ProductBranchStatus, and_(
            ProductBranchStatus.variant_id == ProductVariant.id,
            ProductBranchStatus.branch_id == current_user.branch_id
        ))
        .filter(
            or_(ProductBranchStatus.id == None, ProductBranchStatus.is_active_pos == True)
        )
    )
```
Propuesto: reemplazar `outerjoin` por `join` y eliminar `or_(PBS.id == None, ...)`. GERENTE queda correctamente incluido (no está en exención).

### 3.5 `GET /api/products/{product_id}` (l.1138) — HIGH (IDOR)

Actual (l.1154-1172): query filtra por `Product.id == product_id` + `organization_id`. No valida PBS. Además `_compute_product_read` (l.256-258) devuelve `branch_statuses` de TODAS las sucursales.

Propuesto: después de cargar `product`, si `role ∈ branch_roles` y `user.branch_id`, verificar que exista `ProductBranchStatus(variant_id ∈ product.variants, branch_id=user.branch_id, is_active_pos=True)`. Si no → 404. Adicionalmente filtrar `branch_statuses` en la respuesta para no fugar el mapa comercial.

### 3.6 `GET /api/products/export/excel` (l.1515) — HIGH

Actual (l.1529-1536):
```python
query = db.query(Product).filter(
    Product.organization_id == org_id,
    Product.deleted_at == None
).options(...).all()
```
Sin filtro de sucursal. CAJERO obtiene Excel con TODOS los productos de la org (SKUs, costos, precios de otras sucursales).

Propuesto: aplicar INNER JOIN de `query_visible_products()` antes de `.all()`. Si `branch_id` viene como parámetro y el user es branch: forzar `branch_id == user.branch_id` o rechazar.

### 3.7 `GET /api/products/boxes-inventory` (l.822) — MED

Actual (l.834-864): join a PackagingUnit + Product, filtra `organization_id`; outerjoin a StockOnHand por `user.branch_id`. No hay JOIN a `ProductBranchStatus`. CAJERO ve empaques de productos no habilitados en su sucursal (stock 0 pero SKU + precio visibles).

Propuesto: INNER JOIN a PBS por `user.branch_id` + `is_active_pos=True` para CAJERO/GERENTE.

### 3.8 `GET /api/products/stats/branch-kpis` (l.56) — MED

Actual (l.66-112): `branch_id` es parámetro. Valida que pertenezca a la org (l.110), pero NO valida que corresponda al `branch_id` del user cuando es branch-scoped. CAJERO de branch 1 puede pedir `?branch_id=2`.

Propuesto: si `role not in [ADMIN, DUEÑO]` y `user.branch_id`, forzar `branch_id = user.branch_id` o 403 si difieren.

---

## 4. RBAC matrix para `/admin/catalog`

Verificación en `app/core/role_permissions.py` (`DATAXPOS_ROLE_VIEWS`):

| Rol | Línea | Incluye `admin_catalog.html` | Estado |
|---|---|---|---|
| ADMINISTRADOR | 16 | Sí | OK (esperado) |
| DUEÑO | 55 | Sí | OK (esperado) |
| GERENTE | 77-89 | **No** | OK (bloqueado) |
| CAJERO | 91-103 | **No** | OK (bloqueado) |
| VENDEDOR | 105-115 | **No** | OK |
| SOPORTE_OPERATIVO | 117-126 | **No** | OK |
| CLIENTE | 128-132 | **No** | OK |

`TEMPLATE_METADATA` (l.196) y `_NAV_GROUP` (l.153) mapean `admin_catalog.html` al grupo "Catálogo" con URL `/admin/catalog`. `get_dataxpos_nav()` solo lo entrega si está en la lista del rol → CAJERO/GERENTE no lo ven en sidebar.

**Conclusión:** sin regresión RBAC. El gate de `/admin/catalog` (Jinja) descansa íntegramente en `check_view_permission("admin_catalog.html")` (`daxpos.py:55`).

---

## 5. Hot spots para helper `query_visible_products(db, user, org_id)`

Endpoints que consumirán el helper tras F3-C0 (ordenados por impacto):

1. **`GET /api/products/`** (l.674) — reemplaza bloque 731-772 completo.
2. **`GET /api/products/pos/search`** (l.1386) — reemplaza bloque 1427-1437.
3. **`GET /api/products/search`** (l.355) — envolver query base.
4. **`GET /api/products/variants/search`** (l.306) — envolver `join(Product)`.
5. **`GET /api/products/export/excel`** (l.1515) — reemplaza `db.query(Product).filter(...)` inicial.
6. **`GET /api/products/boxes-inventory`** (l.822) — subquery de variantes visibles.
7. **`GET /api/products/{product_id}`** (l.1138) — post-check usando el mismo predicado para validar pertenencia.

Total: **7 endpoints**. Cumple requisito de aceptación (≥6). `hq-inventory`, `stats/branch-kpis` y `batch-action` no aplican (son admin-only o requieren lógica distinta).

**Firma sugerida:**
```python
def query_visible_products(db: Session, user: User, org_id: int) -> Query[Product]:
    """
    Query base de Product filtrada por la política de visibilidad del sprint:
    - Filtra por organization_id.
    - Si user es branch (CAJERO, GERENTE, VENDEDOR, SOPORTE_OPERATIVO) con branch_id:
      INNER JOIN ProductBranchStatus por (variant_id, branch_id, is_active_pos=True),
      y Product.is_active=True.
    - Si user es ADMIN/DUEÑO o branch_id is None: solo org (+ is_active según param).
    - Respeta Branch.can_sell: si False → query vacía.
    """
```
