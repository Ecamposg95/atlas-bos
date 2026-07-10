# Arquitectura · Atlas BOS

Motor técnico detrás de Atlas One. API-first, multi-tenant, modular. Backend FastAPI + SQLAlchemy + PostgreSQL; frontend React + Vite + TS (SPA/PWA servida desde el backend en prod).

> Auditoría profunda: julio 2026. Verifica `file:line` contra el código.

## 1. Capas

```
Cliente (SPA/PWA React)
      │  JWT (cookie httponly o Bearer)  ·  X-Organization-ID / X-Branch-ID
      ▼
FastAPI (app/main.py)
  ├─ Routers CORE        app/routers/*            (sales, cash, inventory, reports, hr, quotes, returns, …)
  ├─ Routers PLATFORM    app/routers/platform/*   (gated SUPERADMIN/SUPPORT)
  ├─ Módulos             app/modules/*/router.py  (auth, users, tenants, products, customers, appointments,
  │                                                 tables, kitchen, recipes, bar, …)
  ├─ core/               security (JWT), permissions (module gating), tenant_query/context (aislamiento),
  │                      events + outbox (comunicación entre módulos)
  ├─ services/           capabilities, feature_flags, cash_reconciliation, audit, …
  └─ subscribers/        handlers de eventos de dominio
      ▼
PostgreSQL (73 tablas)  ·  create_all + migraciones idempotentes en scripts/railway_init.py
```

**Arranque** (`app/main.py` startup): registra subscribers de eventos, arranca el **worker del outbox** (solo Postgres, no SQLite), y siembra el catálogo de módulos (`seed_global_modules`).

## 2. Arquitectura modular (migración Phase 2)

Dos capas conviven durante la migración:
- **`app/modules/<x>/`** — destino canónico. Cada módulo: `models.py`, `router.py`, `schemas.py`, `services.py` (+ `portal_router.py` si aplica), y un `__init__.py` con docstring que lo documenta.
- **`app/routers/<x>.py` y `app/models/<x>.py`** — muchos son *reverse-shims* de pocas líneas que re-exportan desde `app/modules`. Ej.: `app/routers/organization.py → app.modules.tenants.router`; `app/models/users.py → app.modules.users.models`.

El **catálogo de módulos** (tabla `modules`) es la fuente de verdad de qué features existen. Un **preset de industria** (`industry_presets`) mapea `industry_type → [module_keys]`; aplicarlo a una org escribe filas en `organization_modules` (`is_enabled=True`). Ver `app/services/capabilities_service.py::apply_industry_preset`. Guía: [`modules/MODULE_GUIDE.md`](modules/MODULE_GUIDE.md).

Módulos gastro entregados (REALES): `tables`, `kitchen`, `recipes`, `bar`. Stubs/beta (solo `/health`): `commissions`, `memberships`, `ai`, `purchasing`.

## 3. Comunicación entre módulos — Eventos + Outbox transaccional

El desacople entre módulos es por **eventos**, no por llamadas directas. Infra: `app/core/events.py`, `app/core/outbox.py`, `app/models/event_outbox.py`, `app/subscribers/*`.

### EventBus (`app/core/events.py`)
Bus síncrono in-process. `EVENT_REGISTRY` mapea nombre→clase para rehidratar eventos persistidos.
- `EventBus.subscribe(EventType, handler)` — registra un handler (en el startup).
- `EventBus.enqueue(db, event) -> id` — **persiste el evento en el outbox usando la sesión del caller** (no hace commit). Preferido.
- `EventBus.dispatch(event) -> [errores]` — corre todos los handlers aislados; devuelve la lista de errores (vacía = éxito).
- `EventBus.publish(event)` — legacy best-effort (dispatch sin durabilidad).

### Outbox transaccional (`app/core/outbox.py` + tabla `event_outbox`)
Patrón outbox: el evento se escribe **en la misma transacción** que el cambio de negocio (p.ej. la venta), así **persiste si y solo si** el cambio persiste — un side-effect no se pierde en silencio si un handler falla o el proceso muere tras el commit.

```
create_sale (app/routers/sales.py):
   ... construye la venta ...
   EventBus.enqueue(db, SalesDocumentCreated(...))   # fila PENDING en event_outbox, MISMA txn
   db.commit()                                       # venta + evento, atómico
   drain_now([outbox_id])                            # entrega inmediata best-effort (baja latencia)
        │
        ▼  (o el worker de fondo, cada ~2s)
process_outbox_once(db):
   claim fila PENDING vencida  (SELECT … FOR UPDATE SKIP LOCKED en Postgres; no-op en SQLite)
   EventBus.dispatch(event)  →  corre subscribers
   éxito → PROCESSED  ·  fallo → attempts++, backoff; tras MAX_ATTEMPTS(5) → FAILED (dead-letter)
```

- **Worker de fondo**: arranca en el startup (`start_outbox_worker`), reintenta lo pendiente. **Gateado off en SQLite** (tests/dev local no despachan solos).
- **Idempotencia**: los subscribers deben ser idempotentes (un handler puede re-ejecutarse tras un fallo parcial).
- **Concurrencia multi-réplica**: `FOR UPDATE SKIP LOCKED` evita doble-despacho entre instancias.

### Eventos y subscribers actuales
| Evento | Publicado por | Subscribers (`app/subscribers/`) | Efecto |
|---|---|---|---|
| `SalesDocumentCreated` | `sales.py::create_sale` (vía outbox) | `recipes.py::consume_ingredients_on_sale` | Descuenta insumos de recetas (idempotente por `reference == sale.id`). |
| | | `tables.py::free_table_on_sale` | Libera la mesa cuyo `ParkedTicket` se convirtió en venta. |
| | | `abasto.py::check_reorder_levels` | Genera recomendaciones de reorden por bajo stock. |

> Gotcha resuelto: el payload del evento se arma con `_safe_sale_items` (defensivo contra líneas con `variant` nulo); antes un `l.variant.sku` que lanzaba se tragaba con `except: pass` y **ni descontaba insumos ni liberaba la mesa**.

> Pendiente: el módulo **`bar` no tiene subscriber de ventas** — el campo `reference` del ledger de botellas existe pero no se descuenta por venta (el bar no está integrado al checkout aún).

## 4. Multi-tenancy y aislamiento

### Resolución de la organización activa (`app/core/tenant_context.py`)
Precedencia: (1) header `X-Organization-ID` o cookie `support_org_id` → (2) primera membresía `UserOrganization` activa → (3) fallback single-org. **SUPERADMIN** puede fijar cualquier org por header **sin verificar membresía** (por diseño); un no-superadmin requiere membresía activa o 403.

### Filtrado por organización (`app/core/tenant_query.py`)
- `_resolve_org_id(user)` — org efectiva del usuario.
- `get_tenant_scoped(db, Model, id, user)` — SELECT por PK **con filtro obligatorio** `organization_id == org`; 404 si no pertenece; ValueError si el modelo no tiene columna de tenant.
- `scoped_query(db, Model, user)` — query pre-filtrado por org.

**Cobertura:** solo ~6 módulos usan estos helpers de forma sistemática (tables, kitchen, recipes, bar, appointments); el resto filtra `organization_id` a mano por endpoint. `TenantMixin.organization_id` es **nullable**.

### Aislamiento por sucursal (`branch_id`) — ⚠️ NO enforced a nivel framework
El token lleva `ctx_id`/`ctx_type` (sucursal activa) pero **nada lo aplica a las queries**. El scoping por sucursal es ad-hoc por router (unas veces `current_user.branch_id`, otras un query param `branch_id`). Riesgo de fuga cross-sucursal dentro de la misma org en endpoints que confían en un `branch_id` de parámetro. Ver [`RBAC.md`](RBAC.md) §huecos.

## 5. Persistencia y migraciones

- **Schema**: se crea con `Base.metadata.create_all` (todas las tablas registradas en `app/models/__init__.py`, que importa también los módulos). Las tablas nuevas se crean solas al registrar su modelo.
- **Migraciones**: `scripts/railway_init.py::run_migrations()` — ALTERs idempotentes de columnas y `ALTER TYPE … ADD VALUE IF NOT EXISTS` (enums, en AUTOCOMMIT). Corre en cada deploy antes de uvicorn. **Alembic está de reserva** (versions/ vacío).
- **Convención de PK**: dos patrones conviven — catálogo/ventas usan `id UUID String(36)` (vía `UUIDMixin`); tenancy/usuarios/caja/gastro usan `id Integer`. **Las FKs a IDs UUID deben declararse `String(36)`.** Ver [`DATA_MODEL.md`](DATA_MODEL.md) §gotchas.
- **Columnas raw**: algunas columnas viven solo en `railway_init.py` (no en el ORM) y se leen defensivamente: `parked_tickets.status`/`converted_to_sale_id`, `sales_documents.global_discount_pct`.

## 6. Concurrencia

Patrón consistente de locks Postgres, **todos no-op en SQLite**:
- `with_for_update()` en: abrir mesa (anti doble-apertura), descuento de stock de recetas (anti lost-update), pour de botella, avance de comanda KDS, ajuste de inventario.
- `pg_advisory_xact_lock(professional_id)` en appointments (anti double-booking).

## 7. Seguridad — resumen

JWT HS256 (12h), cookie httponly o Bearer. Ver [`RBAC.md`](RBAC.md) para el flujo completo y los **10 huecos de seguridad conocidos** (SECRET_KEY con fallback hardcodeado, branch scoping no enforced, impersonación stub, `set-support-context` sin guard, cobertura baja de helpers de tenancy, etc.).
