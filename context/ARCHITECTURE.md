# ARCHITECTURE.md — Atlas ERP/POS

## 1) Visión General

Atlas es una **API REST + SPA**. El backend (FastAPI) expone toda la lógica de negocio bajo `/api/*`. El frontend (React 18 SPA) consume esa API. No es un BOS SSR — los templates Jinja2 en `app/templates/` son legacy.

```
┌──────────────────────────────────────────────┐
│  React 18 SPA  (frontend/)                   │
│  React Router · Zustand · Axios · Tailwind   │
└──────────────────┬───────────────────────────┘
                   │ /api/*  (JWT Bearer)
┌──────────────────▼───────────────────────────┐
│  FastAPI REST API  (app/)                    │
│  Routers · Schemas (Pydantic v2) · Services  │
└──────────────────┬───────────────────────────┘
                   │ SQLAlchemy 2.0 ORM
┌──────────────────▼───────────────────────────┐
│  PostgreSQL  (multi-tenant, org-scoped)       │
└──────────────────────────────────────────────┘
```

FastAPI sirve el SPA via catch-all → `frontend/dist/index.html`. React Router maneja toda la navegación interna.

---

## 2) Capas del Backend

### Nucleus
Tenancy, Auth, RBAC, DB, Event Bus.

- `app/security/` — JWT HS256, bcrypt, `get_current_user`
- `app/dependencies.py` — `get_current_active_organization`, `check_view_permission` (legacy SSR)
- `app/security/require_module.py` — feature flags por org
- `app/core/events.py` — pub/sub síncrono
- `app/database.py` — SQLAlchemy engine, `get_db()`

### Engines (Dominios de Negocio)

Los motores son **transversales** — no hardcodear lógica de industria específica dentro del motor.

| Engine | Routers | Responsabilidad |
|---|---|---|
| **Resource (Catálogo)** | `products.py`, `brands.py`, `departments.py`, `commercial.py` | Productos, variantes, marcas, departamentos, habilitación comercial |
| **Transaction (Ventas)** | `sales.py`, `quotes.py`, `returns.py`, `cash.py`, `printer.py` | Documentos de venta, cotizaciones, devoluciones, caja, impresión |
| **Inventory** | `inventory.py`, `transfers.py`, `logistics.py`, `purchases.py` | Stock, movimientos, transferencias, entradas, compras |
| **Relationship (CRM/HR)** | `customers.py`, `hr.py`, `portal.py` | Clientes, ledger, empleados, asistencia, portal cliente |
| **Finance** | `expenses.py`, `reports.py` | Gastos, KPIs, reportes de auditoría |
| **Platform (SaaS)** | `platform.py`, `org_capabilities.py` | Multi-org management, módulos, presets, audit log |
| **Identity** | `auth.py`, `users.py`, `organization.py`, `branches.py` | Auth, usuarios, orgs, sucursales |

### Presets (Configuración por Industria)

Un preset activa un conjunto de módulos para una org. Administrado en:
- `app/services/capabilities_service.py` — `INDUSTRY_PRESETS`, `apply_industry_preset()`
- `app/models/modules.py` — `Module`, `OrganizationModule`, `IndustryPreset`
- `scripts/init_presets_v2.py` — seed inicial

**Atlas POS** es el preset de referencia. Todo cambio debe dejarlo funcional.

---

## 3) Multi-Tenancy

**Regla de oro:** toda query en datos de negocio debe filtrar por `organization_id`.

Modelos sin `organization_id` directo (CashSession, Employee) se filtran via Branch:
```python
branch_ids = [r[0] for r in db.query(Branch.id).filter(Branch.organization_id == org_id).all()]
```

Mixins ORM (`app/models/mixins.py`):
- `TenantMixin` — columna `organization_id` FK
- `AuditMixin` — `created_at`, `updated_at`, `deleted_at`
- `UUIDMixin` — PK UUID (uso selectivo; mayoría usa int PK)

---

## 4) Regla de Serialización API

**Nunca retornar ORM objects crudos.** Siempre validar con el schema Pydantic:

```python
# Objeto individual:
return SchemaRead.model_validate(orm_obj)

# Lista:
return [SchemaRead.model_validate(x) for x in orm_list]

# Paginado:
return {"items": [SchemaRead.model_validate(x) for x in items], "total": total}
```

Si un endpoint puede retornar lista O dict paginado, **no usar `response_model=List[X]`** — quitar el response_model y retornar el tipo correcto explícitamente.

---

## 5) Módulos (Feature Flags)

- `Module` — catálogo global (seed en startup)
- `OrganizationModule` — habilitación por org
- `require_module(key)` — dependency de FastAPI que bloquea si el módulo no está activo

---

## 6) Futuro (Moonshot)

- **AI Layer:** self-healing, optimización de inventario, generación de módulos
- **Blockchain Layer:** trazabilidad inmutable, hash de cierres de caja, contratos de comisiones
