# Atlas One Presets Expansion + Module Upsell System — Design

**Date:** 2026-05-13
**Status:** Approved (pending user review of this spec)
**Owner:** Backend platform
**Related context:** `context/ATLAS_ONE_BOS_CONTEXT_PACK.md` §10 (módulos), §11 (Atlas POS), §12 (presets verticales), §16 (flujo comercial de expansión)

---

## 1. Goal

Tres objetivos coordinados:

1. **Alinear presets con la jerarquía Atlas One.** Hoy producción solo tiene `ATLAS_POS`; el seed define 8 sub-verticales que ya no aplican a la visión. Después del cambio el catálogo queda con: Atlas POS, Atlas One Retail, Atlas One Beauty, Atlas One Gastro, Atlas One Services, Atlas One Enterprise, Custom.
2. **Aligerar Atlas POS** como preset de entrada — quitar módulos administrativos (`crm`, `branch_catalog_enablement`) que un POS de entrada no necesita. El admin los activa después via toggle existente.
3. **Construir el sistema de upsell de módulos** — metadata por módulo + endpoint + UI que muestra al admin qué módulos puede activar y qué le aporta cada uno, agrupados por preset destino. Implementa la "ruta de upsell natural" del Pack §16.

## 2. Out of scope

- No se construyen los módulos nuevos (`purchasing`, `appointments`, `commissions`, `memberships`, `recipes`, `ai`) — solo se registran en el catálogo para que aparezcan habilitables.
- No se migran orgs con `industry_type` viejo. Cleanup manual documentado como follow-up.
- No se borra ningún value del enum `IndustryType` — aditivo.
- **Atlas POS tiers** (límites de usuarios/sucursales/cuentas por nivel de POS) — se difiere a un spec posterior; ver §10.
- **Self-service upsell** (el admin de la org se activa solo módulos) — este spec deja la activación como acción del platform admin. La UI muestra recomendaciones pero el botón "Activar" sigue requiriendo `require_platform_admin`.
- **Pricing/facturación** del upsell — fuera de scope.

## 3. Module catalog changes

### 3.1 Nuevos módulos

Agregar al seed `scripts/init_presets_v2.py` (lista `modules_catalog`):

| key | name | scope | status | rationale |
|---|---|---|---|---|
| `purchasing` | Compras | GLOBAL | STABLE | OC, proveedores, recepciones — Retail, Gastro avanzado |
| `appointments` | Agenda | BRANCH | BETA | Disponibilidad por profesional/sucursal — Beauty, Services |
| `commissions` | Comisiones | GLOBAL | BETA | Comisiones por servicio o venta — Beauty, Services |
| `memberships` | Membresías | GLOBAL | BETA | Paquetes, créditos, suscripciones — Beauty |
| `recipes` | Recetas / BOM | GLOBAL | BETA | Recetas + costeo por platillo — Gastro |
| `ai` | Inteligencia Artificial | GLOBAL | BETA | Copilotos, predicciones, automatizaciones — Enterprise |

Solo `purchasing` es STABLE (tiene contraparte conceptual en `finance`). Los otros 5 quedan BETA hasta tener implementación real — la UI ya muestra badge BETA en `/platform/presets` y `/platform/modules`.

`customers` no se agrega (decisión previa): clientes siguen viviendo dentro de `crm`.

### 3.2 Nuevo campo en `modules`: `upsell_metadata`

Columna JSON nullable. Estructura:

```json
{
  "category": "vertical",
  "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_ENTERPRISE"],
  "value_props": [
    "Listas de precio por cliente",
    "Descuentos por volumen"
  ],
  "upgrade_prompt": "Activa este módulo para gestionar precios avanzados por cliente.",
  "icon": "fa-tags",
  "sort_hint": 20
}
```

Campos:
- `category` (string, enum `base|advanced|vertical`): clasificación para agrupación.
- `recommended_presets` (array de industry_type): en qué presets este módulo aporta más valor.
- `value_props` (array de string): bullets cortos para la UI de upsell.
- `upgrade_prompt` (string): mensaje único, una frase, en español.
- `icon` (string): FontAwesome class.
- `sort_hint` (int): orden ascendente dentro de su grupo.

Todos los campos opcionales — un módulo sin `upsell_metadata` no aparece en recomendaciones (queda invisible para el upsell, lo cual es válido para `core` y `users`).

## 4. Preset composition

### 4.1 ATLAS_POS — Atlas POS (aligerado)

```python
{
    "id": "ATLAS_POS",
    "name": "Atlas POS",
    "desc": "Punto de venta de entrada: ventas, caja, catálogo, inventario, precios, devoluciones y reportes.",
    "mods": [
        "core",
        "pos",
        "cash_management",
        "catalog",
        "inventory",
        "returns",
        "pricing",
        "payments",
        "reports",
    ],
}
```

**Quitados vs versión anterior del seed**: `crm` y `branch_catalog_enablement`. Mantenidos: `returns` y `pricing` (decisión del usuario — son útiles entry-level).

Razón: el preset de entrada no incluye clientes (módulo `crm`) ni habilitación granular de catálogo por sucursal. Ambos son upsell vía sistema del §11.

### 4.2 ATLAS_ONE_RETAIL — Atlas One Retail

```python
{
    "id": "ATLAS_ONE_RETAIL",
    "name": "Atlas One Retail",
    "desc": "Retail multi-sucursal: ferreterías, abarrotes, farmacias, papelerías, refaccionarias.",
    "mods": [
        "core", "pos", "cash_management", "catalog", "inventory",
        "returns", "pricing", "payments", "reports",
        "crm", "branch_catalog_enablement",
        "purchasing", "promotions", "quotes",
    ],
}
```

(Atlas POS + clientes + multi-sucursal + compras + promociones + cotizaciones.)

### 4.3 ATLAS_ONE_BEAUTY — Atlas One Beauty

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

### 4.4 ATLAS_ONE_GASTRO — Atlas One Gastro

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

### 4.5 ATLAS_ONE_SERVICES — Atlas One Services

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

### 4.6 ATLAS_ONE_ENTERPRISE — Atlas One Enterprise

```python
{
    "id": "ATLAS_ONE_ENTERPRISE",
    "name": "Atlas One Enterprise",
    "desc": "Implementación completa: multi-sucursal avanzado, IA, integraciones y todos los módulos.",
    "mods": [k for k, *_ in modules_catalog],  # todos, incluye BETA
}
```

### 4.7 CUSTOM

```python
{
    "id": "CUSTOM",
    "name": "Personalizado",
    "desc": "Configuración manual desde cero. Solo módulos base.",
    "mods": ["core", "users"],
}
```

## 5. Enum IndustryType changes

Archivo: `app/modules/tenants/models.py:39`.

Agregar values: `ATLAS_ONE_RETAIL`, `ATLAS_ONE_BEAUTY`, `ATLAS_ONE_GASTRO`, `ATLAS_ONE_SERVICES`, `ATLAS_ONE_ENTERPRISE`. Mantener todos los existentes (no romper compat — ver razones en versión anterior del spec, persistidas en §8).

Migración Alembic con dialect branching para Postgres `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

## 6. Seed behavior

`scripts/init_presets_v2.py`:

1. Upsert modules (crea o actualiza por `key`) — ahora también escribe `upsell_metadata`.
2. Upsert presets (crea o actualiza por `industry_type`) — solo los 7 nuevos definidos en §4.
3. **No elimina** presets viejos en BD; quedan disponibles hasta cleanup manual (§9).

Idempotente: re-ejecuciones no duplican ni rompen.

## 7. Application order

### 7.1 Local (SQLite)

```bash
alembic upgrade head        # crea columna upsell_metadata + agrega enum values
python scripts/init_presets_v2.py
```

### 7.2 Railway (Postgres)

```bash
export DATABASE_URL="postgresql://...railway..."
alembic upgrade head
python scripts/init_presets_v2.py
```

### 7.3 Verificación

- `/platform/presets`: 7 cards mínimo.
- `/platform/modules`: ver los 6 módulos nuevos con sus metadata.
- `/platform/orgs/{id}`: pestaña/sección de "Módulos disponibles" muestra recomendaciones según el preset activo.

## 8. Cross-dialect safety

La migración Alembic detecta dialect:

```python
def upgrade():
    bind = op.get_bind()

    op.add_column("modules", sa.Column("upsell_metadata", sa.JSON, nullable=True))

    if bind.dialect.name == "postgresql":
        for v in ATLAS_ONE_VALUES:
            op.execute(f"ALTER TYPE industrytype ADD VALUE IF NOT EXISTS '{v}'")
    # SQLite: enum se traduce a texto, no requiere DDL extra.
```

`downgrade`: drop column `upsell_metadata`. El `ALTER TYPE` no se revierte (limitación Postgres) — se documenta en comentario.

## 9. Cleanup follow-up de presets viejos (opcional)

```sql
SELECT industry_type, COUNT(*) FROM organization
WHERE industry_type IN (
  'DISTRIBUTOR_POS', 'RETAIL_CHAIN', 'RESTAURANT_QSR', 'RESTAURANT_FULL',
  'CAFE_BAKERY', 'AUTO_REPAIR_SHOP'
) GROUP BY industry_type;

DELETE FROM industry_presets WHERE industry_type IN (
  'DISTRIBUTOR_POS', 'RETAIL_CHAIN', 'RESTAURANT_QSR', 'RESTAURANT_FULL',
  'CAFE_BAKERY', 'AUTO_REPAIR_SHOP'
);
```

Ejecutar manualmente cuando el operador confirme.

## 10. Atlas POS tiers (follow-up — NO en este spec)

Tier system para limitar usuarios/sucursales/cuentas según el plan del POS. Esquema preliminar:

```
ATLAS_POS_LITE      → 1 sucursal,  3 usuarios
ATLAS_POS_STANDARD  → 3 sucursales, 10 usuarios
ATLAS_POS_PRO       → ilimitado
```

Implementación pendiente. Requiere:
- Columna `plan_tier` en `organization` o tabla `organization_plan`.
- Enforcement en endpoints de creación de users/branches.
- UI en PlatformOrgDetail para asignar tier.

Se documenta en spec separado cuando el usuario decida diseñarlo. Este spec no lo bloquea — la columna y el enforcement se pueden agregar después sin tocar lo de presets.

## 11. Module upsell system

### 11.1 Modelo de datos

Reutiliza la tabla `modules` con la columna nueva `upsell_metadata` (§3.2). No se crea tabla nueva — la metadata es por módulo, no por (módulo, preset, org).

La relación preset ↔ módulo ya existe en `industry_presets.modules`. Lo que el upsell aporta es **metadata descriptiva** que el frontend usa para presentar el módulo de manera atractiva.

### 11.2 Seed de metadata

`scripts/init_presets_v2.py` mantiene un dict `MODULE_UPSELL` (en el mismo archivo) con la metadata por module_key. Ejemplo:

```python
MODULE_UPSELL = {
    "crm": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_BEAUTY", "ATLAS_ONE_SERVICES"],
        "value_props": [
            "Base de datos de clientes",
            "Historial de compras por cliente",
            "Crédito y fidelización",
        ],
        "upgrade_prompt": "Activa CRM para conocer y fidelizar a tus clientes.",
        "icon": "fa-users",
        "sort_hint": 10,
    },
    "purchasing": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_GASTRO"],
        "value_props": [
            "Órdenes de compra a proveedores",
            "Recepciones e ingresos a inventario",
            "Cuentas por pagar",
        ],
        "upgrade_prompt": "Controla tus compras y proveedores desde Atlas One.",
        "icon": "fa-truck",
        "sort_hint": 20,
    },
    "appointments": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_BEAUTY", "ATLAS_ONE_SERVICES"],
        "value_props": [
            "Calendario por profesional o cabina",
            "Recordatorios automáticos",
            "Bloqueos y disponibilidad",
        ],
        "upgrade_prompt": "Agenda servicios y citas con tus clientes.",
        "icon": "fa-calendar",
        "sort_hint": 30,
    },
    # ... resto de módulos relevantes
}
```

El seed inyecta `MODULE_UPSELL[k]` en `Module.upsell_metadata` al crear/actualizar. Cobertura mínima: los 6 módulos nuevos + `crm`, `kitchen`, `tables`, `workshops`, `promotions`, `quotes`, `branch_catalog_enablement`, `logistics`, `manufacturing`, `hr`. `core`, `users`, `pos`, `cash_management`, `catalog`, `inventory`, `payments`, `reports`, `pricing`, `returns` no necesitan metadata (siempre vienen en presets).

### 11.3 Endpoint

`GET /platform/organizations/{org_id}/upsell-recommendations`

Response:

```json
{
  "org_id": 42,
  "active_preset": "ATLAS_POS",
  "active_modules": ["core", "pos", "cash_management", "catalog", "inventory", "returns", "pricing", "payments", "reports"],
  "recommendations": [
    {
      "module_key": "crm",
      "module_name": "CRM / Clientes",
      "category": "advanced",
      "status": "STABLE",
      "in_recommended_preset": true,
      "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_BEAUTY"],
      "value_props": [...],
      "upgrade_prompt": "Activa CRM para...",
      "icon": "fa-users",
      "sort_hint": 10
    }
  ],
  "grouped_by_preset": {
    "ATLAS_ONE_RETAIL": ["crm", "purchasing", "promotions", "quotes", "branch_catalog_enablement"],
    "ATLAS_ONE_BEAUTY": ["crm", "appointments", "commissions", "memberships"]
  }
}
```

Lógica:
1. Lee `organization.industry_type` para saber `active_preset`.
2. Lee `OrganizationModule.is_enabled=true` para saber `active_modules`.
3. Itera `Module` con `upsell_metadata != null` y `key not in active_modules`. Cada uno se vuelve recommendation.
4. `in_recommended_preset = active_preset in module.upsell_metadata['recommended_presets']` (hint para resaltar en UI).
5. `grouped_by_preset` se calcula del lado servidor para evitar lógica en el cliente.

Schema en `app/schemas/modules.py` agrega `UpsellRecommendation` y `UpsellResponse`.

### 11.4 UI

Pestaña/sección en `frontend/src/pages/platform/PlatformOrgDetail.tsx` titulada **"Módulos disponibles"**:

- Header con métricas: "Tu organización tiene N módulos activos. Hay M módulos disponibles para activar."
- Toggle de agrupación: **Por preset destino** | **Por categoría** (base/advanced/vertical).
- Cards por módulo:
  - Icon + nombre + badge STABLE/BETA
  - Value props como bullets
  - Botón **"Activar"** (llama al `PATCH /platform/organizations/{id}/modules/{key}?enable=true` existente)
  - Si `in_recommended_preset`: badge "Recomendado para tu plan"
- Después de activar: refresh de la lista (el módulo desaparece de recomendaciones).

API client: `frontend/src/api/platform.ts` agrega `getUpsellRecommendations(orgId)`.

### 11.5 Out of scope del upsell (futuras iteraciones)

- Workflow de aprobación (admin de org solicita → platform admin aprueba).
- Pricing diferencial por módulo.
- Pruebas gratis temporales con expiración.
- Notificaciones automáticas (email/in-app) cuando hay nuevos módulos disponibles.
- Bundles de upsell (activar varios módulos de un clic).

## 12. Risks

| Riesgo | Mitigación |
|---|---|
| Orgs con `industry_type` viejo siguen funcionando pero su preset se ve "deprecated" | Documentar follow-up. La UI muestra todos los presets registrados — no rompe. |
| Módulos BETA aparecen en upsell con expectativa de funcionalidad real | El badge BETA en la card comunica que es experimental. La activación es no-op hasta que existan endpoints. |
| Migración Alembic falla en SQLite | El branching por `dialect.name` evita `ALTER TYPE` en SQLite. |
| `ALTER TYPE ADD VALUE` en Postgres no funciona dentro de transacción | Configurar `transaction_per_migration = False` para esta migración si Postgres versión <12. |
| Columna JSON `upsell_metadata` queda desactualizada respecto al seed | El seed siempre re-escribe `upsell_metadata` en cada corrida → fuente de verdad sigue siendo el script Python. |
| El endpoint de upsell devuelve módulos `BETA` que la org no debería ver | Filtrar opcionalmente por `status='STABLE'` con query param `?include_beta=true|false` (default `false`). |

## 13. Files touched

```
app/models/modules.py                — +column upsell_metadata
app/modules/tenants/models.py        — +5 enum values
app/schemas/modules.py               — +UpsellRecommendation, UpsellResponse
app/routers/platform/organizations.py — +endpoint upsell-recommendations
alembic/versions/<new>_atlas_one_*.py — nueva migración (column + enum values)
scripts/init_presets_v2.py           — +6 módulos, set de presets reemplazado, +MODULE_UPSELL dict
frontend/src/api/platform.ts         — +getUpsellRecommendations + types
frontend/src/pages/platform/PlatformOrgDetail.tsx — +sección "Módulos disponibles"
```

No se tocan: router de presets (CRUD ya genérico), UI de `/platform/presets` (consume del API actual).

## 14. Test plan

**Backend**:
- `pytest tests/` debe pasar verde sin nuevos fallos.
- Test unit del endpoint `upsell-recommendations` con fixtures:
  - Org sin preset → recomienda todos los módulos con metadata.
  - Org con `ATLAS_POS` → recomienda `crm`, `purchasing`, etc.
  - Org con `ATLAS_ONE_ENTERPRISE` → recomienda ninguno.
- Test del seed: correr dos veces, verificar idempotencia y que `upsell_metadata` queda poblado.

**Local SQLite manual**:
- Aplicar Alembic.
- Correr seed.
- Abrir `/platform/presets`: 7+ cards.
- Crear org con `industry_type=ATLAS_POS`.
- Abrir `/platform/orgs/{id}`: ver sección "Módulos disponibles" con recomendaciones para Retail/Beauty.
- Activar `crm` desde una card → desaparece de la lista.

**Railway**:
- Mismo flujo. Verificar que las orgs existentes con `industry_type` viejo no rompen el endpoint (lógica usa `if active_preset in recommended_presets`, así que valores no listados se ignoran).
