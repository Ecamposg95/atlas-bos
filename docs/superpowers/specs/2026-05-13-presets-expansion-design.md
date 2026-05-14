# Atlas One Presets Expansion — Design

**Date:** 2026-05-13
**Status:** Approved (pending user review of this spec)
**Owner:** Backend platform
**Related context:** `context/ATLAS_ONE_BOS_CONTEXT_PACK.md` §10 (módulos), §12 (presets verticales)

---

## 1. Goal

Alinear la tabla `industry_presets` con la jerarquía comercial de Atlas One definida en el Context Pack. Hoy producción solo tiene `ATLAS_POS` sembrado; el seed `scripts/init_presets_v2.py` define 8 presets de la "Wave 2" (sub-verticales granulares) que no se reflejan en la visión del Pack.

Después de este cambio, el catálogo de presets queda:

- Atlas POS (entrada ligera)
- Atlas One Retail
- Atlas One Beauty
- Atlas One Gastro
- Atlas One Services
- Atlas One Enterprise
- Custom

Esto reemplaza, **a nivel de definición del seed**, el set anterior de sub-presets (DISTRIBUTOR_POS, RETAIL_CHAIN, RESTAURANT_QSR, RESTAURANT_FULL, CAFE_BAKERY, AUTO_REPAIR_SHOP) — el seed ya no los upsert. **A nivel de runtime/BD** las filas viejas no se borran automáticamente; quedan disponibles hasta que se ejecute el cleanup manual del §9.

## 2. Out of scope

- No se construyen los módulos nuevos (`purchasing`, `appointments`, `commissions`, `memberships`, `recipes`, `ai`) — solo se registran en el catálogo de `modules` para que aparezcan habilitables.
- No se migran orgs que ya estén usando los `industry_type` viejos. Si quedan huérfanas, se documenta el cleanup como follow-up.
- No se construye `Atlas One CRM` ni `Atlas One Stock` ni `Atlas One AI` como presets — el Pack §2 los lista pero son productos comerciales que se consumen activando módulos puntuales, no presets verticales independientes.
- No se borra ningún value del enum `IndustryType`: se aditiva, no se rompe compat.

## 3. Module catalog changes

Agregar al seed `scripts/init_presets_v2.py` (lista `modules_catalog`):

| key | name | scope | status | rationale |
|---|---|---|---|---|
| `purchasing` | Compras | GLOBAL | STABLE | OC, proveedores, recepciones — Retail, Gastro avanzado |
| `appointments` | Agenda | BRANCH | BETA | Disponibilidad por profesional/sucursal — Beauty, Services |
| `commissions` | Comisiones | GLOBAL | BETA | Comisiones por servicio o venta — Beauty, Services |
| `memberships` | Membresías | GLOBAL | BETA | Paquetes, créditos, suscripciones — Beauty |
| `recipes` | Recetas / BOM | GLOBAL | BETA | Recetas + costeo por platillo — Gastro |
| `ai` | Inteligencia Artificial | GLOBAL | BETA | Copilotos, predicciones, automatizaciones — Enterprise |

**Nota de status**: solo `purchasing` se considera STABLE porque la operativa de compras tiene contraparte conceptual en módulos existentes (`finance`). Los otros 5 se marcan BETA hasta que tengan implementación real — esto hace que aparezcan con badge BETA en la UI de presets y de organizations.

`customers` **no se agrega** (decisión del usuario): se mantiene todo dentro del módulo `crm` existente.

## 4. Preset composition

### 4.1 ATLAS_POS — Atlas POS (refinado)

```python
{
    "id": "ATLAS_POS",
    "name": "Atlas POS",
    "desc": "Punto de venta ligero: ventas, caja, catálogo, inventario básico, clientes y reportes.",
    "mods": [
        "core",
        "pos",
        "cash_management",
        "catalog",
        "inventory",
        "branch_catalog_enablement",
        "returns",
        "pricing",
        "payments",
        "crm",
        "reports",
    ],
}
```

Cambio vs versión actual del seed: se quita `promotions` (queda solo en Retail) y se mantiene el resto. Atlas POS sigue siendo el preset más ligero.

### 4.2 ATLAS_ONE_RETAIL — Atlas One Retail (nuevo)

```python
{
    "id": "ATLAS_ONE_RETAIL",
    "name": "Atlas One Retail",
    "desc": "Retail multi-sucursal: ferreterías, abarrotes, farmacias, papelerías, refaccionarias.",
    "mods": ATLAS_POS_mods + ["purchasing", "promotions", "quotes"],
}
```

### 4.3 ATLAS_ONE_BEAUTY — Atlas One Beauty (nuevo)

```python
{
    "id": "ATLAS_ONE_BEAUTY",
    "name": "Atlas One Beauty",
    "desc": "Barberías, estéticas, spas, estudios de uñas y wellness con agenda, servicios y comisiones.",
    "mods": [
        "core", "users", "catalog", "inventory", "payments",
        "cash_management", "crm", "pos",
        "appointments", "commissions", "memberships",
        "reports",
    ],
}
```

### 4.4 ATLAS_ONE_GASTRO — Atlas One Gastro (nuevo)

```python
{
    "id": "ATLAS_ONE_GASTRO",
    "name": "Atlas One Gastro",
    "desc": "Cafés, restaurantes pequeños, taquerías, food trucks y dark kitchens con KDS, mesas y recetas.",
    "mods": [
        "core", "users", "catalog", "inventory", "payments",
        "cash_management", "crm", "pos",
        "kitchen", "tables", "recipes",
        "reports",
    ],
}
```

### 4.5 ATLAS_ONE_SERVICES — Atlas One Services (nuevo)

```python
{
    "id": "ATLAS_ONE_SERVICES",
    "name": "Atlas One Services",
    "desc": "Talleres, consultorios, mantenimiento, soporte y operaciones con órdenes de trabajo.",
    "mods": [
        "core", "users", "catalog", "payments", "crm",
        "workshops", "appointments", "quotes", "commissions",
        "reports",
    ],
}
```

### 4.6 ATLAS_ONE_ENTERPRISE — Atlas One Enterprise (nuevo)

```python
{
    "id": "ATLAS_ONE_ENTERPRISE",
    "name": "Atlas One Enterprise",
    "desc": "Implementación completa: multi-sucursal avanzado, IA, integraciones y todos los módulos.",
    "mods": <todos los keys de modules_catalog>,  # incluye BETA
}
```

Se calcula dinámicamente como `[k for k, *_ in modules_catalog]` para que se mantenga sincronizado con el catálogo conforme crezca.

### 4.7 CUSTOM (refinado)

```python
{
    "id": "CUSTOM",
    "name": "Personalizado",
    "desc": "Configuración manual desde cero. Solo módulos base.",
    "mods": ["core", "users"],
}
```

## 5. Enum IndustryType changes

Archivo: `app/modules/tenants/models.py:39` (clase `IndustryType`).

Agregar 5 nuevos values:

```python
ATLAS_ONE_RETAIL = "ATLAS_ONE_RETAIL"
ATLAS_ONE_BEAUTY = "ATLAS_ONE_BEAUTY"
ATLAS_ONE_GASTRO = "ATLAS_ONE_GASTRO"
ATLAS_ONE_SERVICES = "ATLAS_ONE_SERVICES"
ATLAS_ONE_ENTERPRISE = "ATLAS_ONE_ENTERPRISE"
```

**Mantener** todos los values existentes (incluyendo SALON, CLINIC, DENTAL, ECOMMERCE, WHOLESALE_B2B, FLEET_SERVICE, WAREHOUSE_LOGISTICS, MANUFACTURING_LIGHT, PROFESSIONAL_SERVICES, SALES_DISTRIBUTION, B2B_ENTERPRISE, RESTAURANT_QSR, RESTAURANT_FULL, CAFE_BAKERY, AUTO_REPAIR_SHOP, DISTRIBUTOR_POS, RETAIL_CHAIN). Razones:

1. Postgres rechaza un INSERT/UPDATE con value de enum que no existe en el tipo. Si quitamos values y alguna org en cualquier ambiente los tiene, las queries que tocan esa fila explotan.
2. `app/modules/tenants/router.py:172-180` hace branching por `IndustryType.RESTAURANT_QSR`, etc. — código vivo.
3. Agregar values a un enum Postgres es seguro (`ALTER TYPE ... ADD VALUE`). Quitarlos no lo es.

**Migración Alembic**: crear una migración separada `add_atlas_one_industry_types` que ejecuta:

```python
op.execute("ALTER TYPE industrytype ADD VALUE IF NOT EXISTS 'ATLAS_ONE_RETAIL'")
op.execute("ALTER TYPE industrytype ADD VALUE IF NOT EXISTS 'ATLAS_ONE_BEAUTY'")
op.execute("ALTER TYPE industrytype ADD VALUE IF NOT EXISTS 'ATLAS_ONE_GASTRO'")
op.execute("ALTER TYPE industrytype ADD VALUE IF NOT EXISTS 'ATLAS_ONE_SERVICES'")
op.execute("ALTER TYPE industrytype ADD VALUE IF NOT EXISTS 'ATLAS_ONE_ENTERPRISE'")
```

`downgrade` queda como no-op con comentario explicando que Postgres no permite remover values de enum sin recrear el tipo.

## 6. Seed behavior

`scripts/init_presets_v2.py` mantiene su patrón actual:

1. Upsert modules (crea o actualiza por `key`).
2. Upsert presets (crea o actualiza por `industry_type`).

**Importante**: el seed NO elimina los presets viejos (DISTRIBUTOR_POS, RETAIL_CHAIN, RESTAURANT_QSR, RESTAURANT_FULL, CAFE_BAKERY, AUTO_REPAIR_SHOP). Quedan en la tabla con su contenido actual. Si el usuario quiere consolidarlos, se ejecuta un script separado de cleanup (ver §9).

Esto es por seguridad: si alguna org tiene `industry_type='RESTAURANT_QSR'`, borrar el preset deja la org sin definición pero no afecta sus `organization_modules` ya habilitados.

## 7. Application order

### 7.1 Local (SQLite)

```bash
# 1. Aplicar migración Alembic para los nuevos enum values
alembic upgrade head

# 2. Sembrar módulos y presets
python scripts/init_presets_v2.py
```

(En SQLite el enum se traduce a CHECK constraint o columna libre; la migración de `ALTER TYPE` se vuelve no-op condicionado al dialect — ver §8.)

### 7.2 Railway (Postgres)

```bash
export DATABASE_URL="postgresql://...railway..."
alembic upgrade head
python scripts/init_presets_v2.py
```

El seed es idempotente, así que correrlo varias veces no causa daño.

### 7.3 Verificación

- Abrir `/platform/presets` en la UI: deben aparecer 7 cards mínimo (ATLAS_POS + 5 nuevos + CUSTOM, más los 6 viejos si no se hizo cleanup).
- En PlatformOrganizations crear/editar una org y verificar que el dropdown de presets carga los nuevos.

## 8. Cross-dialect safety

La migración Alembic debe detectar el dialect:

```python
def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for v in ATLAS_ONE_VALUES:
            op.execute(f"ALTER TYPE industrytype ADD VALUE IF NOT EXISTS '{v}'")
    # SQLite usa CHECK o columna texto — el value se acepta sin DDL.
```

## 9. Cleanup follow-up (opcional, no en este spec)

Para consolidar los presets viejos sin tocar orgs existentes:

```sql
-- Audit primero: ¿qué orgs usan los presets viejos?
SELECT industry_type, COUNT(*) FROM organization
WHERE industry_type IN (
  'DISTRIBUTOR_POS', 'RETAIL_CHAIN', 'RESTAURANT_QSR', 'RESTAURANT_FULL',
  'CAFE_BAKERY', 'AUTO_REPAIR_SHOP'
) GROUP BY industry_type;

-- Si la cuenta es 0 o se reasignan: borrar los presets huérfanos
DELETE FROM industry_presets WHERE industry_type IN (
  'DISTRIBUTOR_POS', 'RETAIL_CHAIN', 'RESTAURANT_QSR', 'RESTAURANT_FULL',
  'CAFE_BAKERY', 'AUTO_REPAIR_SHOP'
);
```

Esto se ejecuta manualmente cuando el operador decida. No es parte del seed.

## 10. Risks

| Riesgo | Mitigación |
|---|---|
| Orgs con `industry_type` viejo siguen funcionando pero su preset se ve "deprecated" en UI | Documentar follow-up de migración. La UI ya muestra todos los presets registrados — no rompe. |
| El módulo `ai` aparece BETA pero no tiene endpoints reales | Es esperado. El badge BETA en la UI ya comunica esto. La habilitación en una org es no-op hasta que existan endpoints. |
| Migración Alembic falla en SQLite local | El branching por `dialect.name` evita el `ALTER TYPE` en SQLite. |
| `ALTER TYPE ... ADD VALUE` en Postgres no funciona dentro de transacción en algunas versiones | Alembic configura `transaction_per_migration = False` para esta migración si es necesario. Probar antes en QA. |

## 11. Files touched

```
app/modules/tenants/models.py        — +5 enum values
alembic/versions/<new>_atlas_one_*.py — nueva migración
scripts/init_presets_v2.py           — +6 módulos, set de presets reemplazado
```

No se tocan: router de presets (CRUD ya genérico), schema, UI (consume del API).

## 12. Test plan

- Local SQLite: correr seed dos veces, verificar idempotencia (sin duplicados).
- Local SQLite: abrir UI `/platform/presets`, verificar 7+ cards.
- Local SQLite: crear org con `industry_type=ATLAS_ONE_BEAUTY`, verificar que aplica preset (`POST /platform/organizations/{id}/apply-preset`).
- Railway QA (si existe ambiente separado): repetir lo mismo. Confirmar que las orgs existentes no rompen al cargar.
- Smoke test del backend completo: `pytest tests/` debe pasar verde (los tests existentes no dependen de los presets eliminados, pero conviene confirmar).
