# 04 — Modelo de datos y spec del helper `query_visible_products`

**Agente:** A4
**Date:** 2026-04-17
**Scope:** modelo de datos relevante para la política de visibilidad de productos (CAJERO/GERENTE) y diseño del helper canónico que centralizará el filtro.

---

## 1. Resumen ejecutivo

- **`ProductBranchStatus` (PBS) se ancla a `variant_id`**, no a `product_id`. Cualquier filtro por sucursal requiere JOIN `ProductVariant` → `ProductBranchStatus`.
- **`Branch.can_sell` existe** (`Column(Boolean, default=True)`), por lo tanto la regla C6 de la policy aplica tal cual: si `can_sell == False` para la sucursal del usuario no-admin, la lista es vacía.
- **`User.branch_id`** es `Integer FK nullable` a `branches.id`. `branch_id IS NULL` ⇒ usuario HQ/global. `User.role` es el enum `Role`. `User.platform_role` (SUPERADMIN/SUPPORT/NONE) no debe afectar la visibilidad de productos a nivel catálogo — SUPERADMIN opera con `X-Organization-ID` y ve el catálogo tal cual lo verían los admins de esa org.
- **`crud/products.py` es esencialmente un stub** (43 LOC, sólo `create_simple_product` y `get_product_by_sku`). No existe lógica previa de filtro por sucursal aquí — todas las queries viven inline en `routers/products.py`. Es host perfecto para `query_visible_products` sin colisiones.
- **Falta un índice compuesto `(branch_id, is_active_pos)` en `product_branch_status`**. Existen índices simples por columna, pero la query de CAJERO filtra siempre por ambos y se beneficiará de un covering index.

---

## 2. Campos relevantes

### `Product` (`app/models/products.py:35`)
| Campo | Tipo | Nullable | Uso en visibilidad |
|---|---|---|---|
| `id` | String(36) UUID | PK | Join target |
| `organization_id` | Integer FK | sí (mixin) | **Tenant filter obligatorio** |
| `is_active` | Boolean, default=True | no | Filtro `is_active == True` para CAJERO/GERENTE |
| `approval_status` | String | default='APPROVED' | Forzar `'APPROVED'` para no-admin (T10) |
| `has_variants` | Boolean | no | Informativo |
| `name`, `description`, `image_url` | String | varía | Search (ILIKE) |
| `brand_id`, `department_id` | FK | sí | Filtros opcionales |
| `deleted_at` | DateTime | sí (AuditMixin) | Soft-delete — excluir `deleted_at IS NULL` |

### `ProductVariant` (`app/models/products.py:60`)
| Campo | Tipo | Uso |
|---|---|---|
| `id` | String(36) UUID PK | Join target con PBS |
| `product_id` | FK → `products.id`, not null | Join hacia Product |
| `organization_id` | Integer FK (mixin) | Tenant redundante |
| `sku`, `barcode` | String indexed | Búsqueda |
| `price`, `cost` | Numeric | Presentación |

### `ProductBranchStatus` (`app/models/products.py:125`)
| Campo | Tipo | Uso |
|---|---|---|
| `id` | String(36) UUID PK | |
| `variant_id` | String(36) FK → `product_variants.id`, not null, indexed | **Anchor** |
| `branch_id` | Integer FK → `branches.id`, not null, indexed | Filtro |
| `is_active_pos` | Boolean, default=True | **Criterio principal** para CAJERO |
| `is_active_hq` | Boolean, default=False | Para HQ quotes (no usado en CAJERO) |
| `is_visible` | Boolean, default=True | Catálogo — revisar si se combina con `is_active_pos` |
| `price_override`, `min_stock_alert`, `max_stock_limit` | Numeric nullable | No afectan visibilidad |
| Unique | `(variant_id, branch_id)` | Garantiza 1 registro por par |

### `Branch` (`app/models/organization.py:55`)
| Campo | Tipo | Uso en visibilidad |
|---|---|---|
| `id` | Integer PK | |
| `organization_id` | Integer FK | Tenant |
| `branch_type` | Enum(HQ/STORE/WAREHOUSE/OFFICE) | Routing, no filtro directo |
| `is_active` | Boolean, default=True | Posible guard extra (no obligatorio por policy) |
| `can_sell` | Boolean, default=True | **Regla C6** — si False, lista vacía para no-admin |
| `is_headquarters` | Boolean | Duplicado legacy de `branch_type == HQ`; no usar para filtros |

### `User` (`app/models/users.py:30`)
| Campo | Tipo | Uso |
|---|---|---|
| `id` | Integer PK | |
| `role` | Enum(Role) | **Ramas:** ADMIN/DUEÑO vs CAJERO/GERENTE/VENDEDOR/SOPORTE |
| `branch_id` | Integer FK nullable | `None` ⇒ HQ/global; no-None ⇒ filtro C3 |
| `platform_role` | Enum(PlatformRole) | No afecta visibilidad de catálogo directamente |
| `is_active` | Boolean | Ortogonal |

---

## 3. Índices existentes vs recomendados

**Existentes** (derivados de `__table_args__` y `index=True` en columnas):
- `product_branch_status.variant_id` (simple index)
- `product_branch_status.branch_id` (simple index)
- `UNIQUE(variant_id, branch_id)` → `uq_variant_branch_status`
- `product_variants.sku` (simple), `product_variants.barcode` (simple)
- `products.name` (simple), `products.organization_id` (simple via TenantMixin)
- `branches.name` (simple), `branches.organization_id` (via TenantMixin)

**Recomendados** (para el fix del sprint):
1. **`CREATE INDEX ix_pbs_branch_active ON product_branch_status(branch_id, is_active_pos) WHERE is_active_pos = true;`** — partial covering index que reduce dramáticamente el costo del JOIN en CAJERO cuando `branch_id` está fijo. Con ~10k productos × 10 sucursales = 100k filas PBS, esto es la diferencia entre scan y index-only lookup.
2. **`CREATE INDEX ix_products_org_active ON products(organization_id, is_active) WHERE deleted_at IS NULL;`** — filtro tenant + activo es universal en todos los endpoints.
3. **(Opcional)** `CREATE INDEX ix_pbs_variant_branch_active ON product_branch_status(variant_id, branch_id, is_active_pos);` — si se prefiere un covering completo del JOIN; redundante con (1) en la mayoría de planes.

Crear en migración separada antes del merge del fix. No bloquea el helper.

---

## 4. Spec del helper `query_visible_products`

Ubicación propuesta: `app/crud/products.py` (archivo casi vacío, cero colisión).

```python
# app/crud/products.py

from __future__ import annotations
from typing import Optional
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, Query, selectinload

from app.models.users import User, Role
from app.models.organization import Branch
from app.models.products import Product, ProductVariant, ProductBranchStatus


_ADMIN_ROLES: set[str] = {"ADMINISTRADOR", "DUEÑO"}


def _role_str(user: User) -> str:
    """Normaliza user.role a string (enum o str)."""
    try:
        return user.role.value if hasattr(user.role, "value") else str(user.role)
    except Exception:
        return str(user.role)


def query_visible_products(
    db: Session,
    user: User,
    org_id: int,
    *,
    include_inactive: bool = False,
    search: Optional[str] = None,
    branch_id_override: Optional[int] = None,
    eager_variants: bool = True,
) -> "Query[Product]":
    """
    Devuelve un Query[Product] con la política de visibilidad canónica aplicada.

    Política (ver docs/audits/cajero-visibility/00-policy.md):

    - ADMINISTRADOR / DUEÑO (o `branch_id_override` explícito pasado por un admin):
      ven todo el catálogo de `org_id`. `include_inactive=False` oculta los
      `is_active == False`; con `True` se incluyen (para flujos de reactivación).
      Si el admin pasa `branch_id_override`, se aplica el mismo INNER JOIN con
      PBS que a un CAJERO para simular la vista de esa sucursal.

    - CAJERO / GERENTE / VENDEDOR / SOPORTE_OPERATIVO (roles con
      `branch_id != None`): se aplica INNER JOIN con `ProductBranchStatus` sobre
      `(variant_id, branch_id == user.branch_id)` y se exige
      `is_active_pos == True`. Si el `Branch` tiene `can_sell == False`,
      devuelve un query vacío (short-circuit). Sin registro PBS para esa
      sucursal ⇒ producto OCULTO (anula ATS-11).

    - `CLIENTE` (portal): este helper NO cubre el portal. Los endpoints de
      portal deben seguir su propia lógica.

    Parameters
    ----------
    db : Session
    user : User
        Usuario autenticado (ya resuelto por `get_current_user`).
    org_id : int
        Tenant activo (resuelto por `get_current_active_organization`).
    include_inactive : bool, default False
        Solo tiene efecto para ADMIN/DUEÑO. Si True, incluye productos con
        `is_active == False`. Para roles no-admin se ignora (siempre False).
    search : str | None
        Término libre; aplica ILIKE sobre `Product.name`, `ProductVariant.sku`
        y `ProductVariant.barcode`. El JOIN con `ProductVariant` es inherente
        a la query de CAJERO; para ADMIN se agrega sólo si hay `search`.
    branch_id_override : int | None
        Sólo respetado para ADMIN/DUEÑO. Fuerza el filtro por sucursal como
        si fuera un CAJERO de esa sucursal. Útil para el endpoint
        `/api/products?branch_id=X` usado por HQ.
    eager_variants : bool, default True
        Si True, adjunta `selectinload(Product.variants)` para evitar N+1 en
        el render.

    Returns
    -------
    Query[Product]
        Query compuesto listo para `.filter()/.order_by()/.offset()/.limit()`.
        Siempre incluye `.distinct()` al final para evitar duplicados cuando
        un producto tiene múltiples variantes con PBS.
    """
    role = _role_str(user)
    is_admin = role in _ADMIN_ROLES

    q: "Query[Product]" = db.query(Product).filter(
        Product.organization_id == org_id,
        Product.deleted_at.is_(None),
    )

    # --- Rama 1: roles no-admin o admin con override ---
    effective_branch_id: Optional[int] = None
    if not is_admin:
        effective_branch_id = user.branch_id
    elif branch_id_override is not None:
        effective_branch_id = branch_id_override

    if effective_branch_id is not None:
        # C6: sucursal con can_sell=False → lista vacía.
        branch = db.query(Branch).filter(
            Branch.id == effective_branch_id,
            Branch.organization_id == org_id,
        ).first()
        if branch is None or not branch.can_sell:
            return q.filter(Product.id.is_(None))  # query vacío seguro

        # C2 + C3: is_active + PBS activo en la sucursal.
        q = (
            q.filter(Product.is_active.is_(True))
             .filter(Product.approval_status == "APPROVED")
             .join(ProductVariant, ProductVariant.product_id == Product.id)
             .join(
                 ProductBranchStatus,
                 and_(
                     ProductBranchStatus.variant_id == ProductVariant.id,
                     ProductBranchStatus.branch_id == effective_branch_id,
                     ProductBranchStatus.is_active_pos.is_(True),
                 ),
             )
        )
    else:
        # ADMIN/DUEÑO sin override: sin filtro branch.
        if not include_inactive:
            q = q.filter(Product.is_active.is_(True))

    # --- Search (aplica a ambas ramas) ---
    if search:
        like = f"%{search.strip()}%"
        # Garantiza JOIN con ProductVariant para SKU/barcode (si no está ya).
        if is_admin and effective_branch_id is None:
            q = q.outerjoin(ProductVariant, ProductVariant.product_id == Product.id)
        q = q.filter(
            or_(
                Product.name.ilike(like),
                ProductVariant.sku.ilike(like),
                ProductVariant.barcode.ilike(like),
            )
        )

    if eager_variants:
        q = q.options(selectinload(Product.variants))

    return q.distinct()
```

Notas de uso:
- Para consumir como lista: `products = query_visible_products(db, user, org_id, search=q).offset(skip).limit(limit).all()`.
- Para `count`: usar `query_visible_products(...).with_entities(Product.id).distinct().count()` o un subquery. Evitar contar sobre el join raw (hinchazón por variantes).
- Para export Excel/POS/search/variants-search: todos los endpoints que hoy duplican lógica inline en `routers/products.py:355, 306, 674, 1386, 1515` pasan a una sola llamada al helper.

---

## 5. Helpers complementarios

### `get_product_if_visible`
```python
def get_product_if_visible(
    db: Session, user: User, org_id: int, product_id: str
) -> Product | None:
    """Devuelve el Product si es visible para `user` en `org_id`, o None.
    Uso principal: endpoint detalle `GET /api/products/{product_id}` —
    evita IDOR (R5). Respeta include_inactive=True sólo para admin."""
    return (
        query_visible_products(db, user, org_id, include_inactive=True)
        .filter(Product.id == product_id)
        .first()
    )
```

### `get_variant_if_visible`
```python
def get_variant_if_visible(
    db: Session, user: User, org_id: int, variant_id: str
) -> ProductVariant | None:
    """Resuelve una variante aplicando la misma política.
    Uso: `routers/sales.py:280-309, 582`, `routers/quotes.py:41-53, 253` —
    valida tenant + branch antes de aceptar la variante en una línea de venta
    o cotización. Para CAJERO/GERENTE/VENDEDOR exige PBS.is_active_pos=True en
    su branch_id. Para ADMIN sólo exige tenant match."""
```
Implementación: query sobre `ProductVariant` con el mismo JOIN condicional; reutiliza la misma rama `is_admin` / `effective_branch_id` / `can_sell`.

### `assert_product_visible`
```python
def assert_product_visible(
    db: Session, user: User, org_id: int, product_id: str
) -> Product:
    """Wrapper que levanta HTTPException(404) si el producto no es visible.
    Conveniente para endpoints de detalle/update donde se quiere un 404
    indistinguible (no filtrar información por 403)."""
```

Ambos reutilizan `query_visible_products` internamente — un solo punto de mantenimiento si la policy cambia.

---

## 6. Riesgos de performance

- **INNER JOIN Product → ProductVariant → PBS en CAJERO**: con el índice parcial recomendado `(branch_id, is_active_pos) WHERE is_active_pos=true`, el planner de Postgres filtra PBS primero (cardinalidad baja por sucursal) y luego hace nested-loop o hash-join contra variants. Para una organización con 50k productos × 200k variantes × 10 sucursales = 2M PBS, el índice mantiene el plan en el rango de ms.
- **`.distinct()` al final**: necesario porque un producto con múltiples variantes activas en PBS se duplica. Alternativa más rápida: subquery `EXISTS (SELECT 1 FROM product_variants v JOIN product_branch_status pbs ... WHERE v.product_id = products.id)` — evita DISTINCT, plan más estable. Dejar como optimización futura si se detecta regresión.
- **Search ILIKE sobre `products.name`, `variants.sku`, `variants.barcode`**: sin pg_trgm los `ILIKE '%x%'` son sequential. Si el catálogo crece >100k, considerar `CREATE EXTENSION pg_trgm; CREATE INDEX ix_products_name_trgm ON products USING gin(name gin_trgm_ops);`. No es blocker del sprint.
- **`eager_variants=True` por default** evita N+1 al renderizar lista — pero si el endpoint sólo necesita IDs (ej. export masivo) conviene desactivarlo.
- **`include_inactive` + ADMIN**: para un ADMIN con `branch_id_override` el parámetro se ignora (se fuerza `is_active=True`). Documentado en el docstring. Si el negocio quiere "admin ver inactivos en simulación de sucursal", agregar un flag separado luego.
- **`can_sell=False` short-circuit**: ejecuta 1 query extra para traer el branch. Caché a nivel de request no es necesario — es un lookup por PK indexado.

---

OK + spec del helper listo.
