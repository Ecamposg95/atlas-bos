# Fase 2 — Modularización del Backend

> **Directriz fuente**: `context/ATLAS_ONE_BOS_CONTEXT_PACK.md` §8, §10, §17, §20.
> **Estado**: Fase 1 (rename) ✅ completada. Esta es la siguiente fase.
> **Fecha de plan**: 2026-05-08

---

## 1. Objetivo

Transformar `app/` de su estructura actual **por capas (routers/models/schemas/services planos)** a la estructura **modular** que define el pack §8:

```
backend/app/
├── core/              # config, db, security, tenancy, audit, exceptions
├── modules/           # un dominio por carpeta, autocontenido
│   ├── auth/
│   ├── tenants/
│   ├── branches/
│   ├── users/
│   ├── customers/
│   ├── products/
│   ├── inventory/
│   ├── sales/
│   ├── payments/
│   ├── cash/
│   ├── purchasing/
│   ├── crm/
│   ├── quotes/
│   ├── reports/
│   ├── hr/
│   └── printing/
├── presets/           # atlas_pos.py + futuros verticales
└── main.py
```

**No-objetivo**: cambiar comportamiento, romper rutas existentes, ni reescribir lógica. Esta fase es 90% movimiento de archivos + adecuación de imports + tests verdes.

---

## 2. Estado actual (auditoría 2026-05-08)

| Capa | Cantidad | Notas |
|---|---|---|
| `app/routers/*.py` | 21 | Duplicado `branch.py` + `branches.py` — investigar y consolidar antes de migrar |
| `app/models/*.py` | 18 | Naming heterogéneo (`abasto.py` = compras, `crm.py`, `finance.py`) |
| `app/schemas/*.py` | 20 | Aproximadamente 1:1 con models, con extras (`auth`, `branch_dashboard`, `presets`, `capabilities`) |
| `app/services/*.py` | 6 | Capa muy delgada — la mayoría de la lógica está en routers |
| `app/core/*.py` | 2 | Solo `events.py`, `role_permissions.py`. **Core casi inexistente.** |
| `app/security/*.py` | 3 | `__init__.py`, `api_keys.py`, `require_module.py` — buen punto de partida para `core/security/` |
| `app/templates/` | 1 | Solo `print/ticket.html` — Jinja prácticamente extinto |
| `app/` raíz | 7 | `database.py`, `dependencies.py`, `init_db.py`, `init_users.py`, `pos_printer.py`, `reset_db.py`, `main.py` |
| `alembic/` | ❌ | **No existe** — bloqueante para mover modelos sin perder histórico de schema |

---

## 3. Decisiones bloqueantes (resolver antes de mover código)

Tomadas del Pack §22 + descubiertas en la auditoría:

| # | Decisión | Recomendación | Por qué bloquea |
|---|---|---|---|
| D1 | **¿Adoptar Alembic ya?** | **Sí**, en Sprint 0 de Fase 2 | Mover `app/models/*` a `app/modules/<x>/models.py` cambia paths de import; sin Alembic no hay forma reproducible de actualizar `prod` |
| D2 | **¿Desmontar `app/templates/print/ticket.html`?** | **No** — único template vivo, usado por el printer agent. Mover a `app/modules/printing/templates/` | Define alcance de Fase 3 frontend. Aquí solo decidimos su nuevo home. |
| D3 | **`branch.py` vs `branches.py` (routers)** | Auditar y consolidar en `branches.py` antes de migrar a `modules/branches/` | Duplicación es bug de Fase 1. Migrar dos archivos como uno solo es confuso. |
| D4 | **¿Cuándo descontar inventario? (Pack §22.8)** | Confirmar al cobro (estado `PAID`), no al `DRAFT` | Afecta el contrato del módulo `inventory` — define si el ledger se actualiza desde `sales` o `payments` |
| D5 | **¿Inventario básico vs avanzado en módulos distintos? (§22.9)** | **Un solo módulo `inventory`** con feature flag `inventory.advanced` | Evita fragmentación; el preset Atlas POS solo activa el básico via flag |
| D6 | **¿`services/` se mantiene como capa transversal o se distribuye en cada módulo?** | Distribuir — cada módulo tiene su `services.py` interno; los services cross-module van a `app/core/services/` | Define la forma final de cada módulo |
| D7 | **`scripts/init_users.py`, `init_db.py`, `reset_db.py` → ¿quedan en `scripts/` o se borran?** | Mover los `init_*.py` de `app/` raíz a `scripts/` (ya algunos viven ahí). `reset_db.py` solo si es necesario en QA | Limpieza de raíz. |

**Acción**: el usuario revisa y confirma D1–D7 antes de empezar Sprint 0.

---

## 4. Mapeo router → módulo objetivo

| Router actual | Módulo destino | Notas |
|---|---|---|
| `auth.py` | `modules/auth/` | + reset password, sessions |
| `users.py` | `modules/users/` | |
| `organization.py` | `modules/tenants/` | "Organization" = tenant en el pack |
| `branches.py` (+ `branch.py` consolidado) | `modules/branches/` | Resolver duplicado D3 |
| `customers.py` | `modules/customers/` | |
| `products.py` (+ brands, departments) | `modules/products/` | Brands/departments como sub-paths del módulo |
| `inventory.py` | `modules/inventory/` | + `app/services/feature_flags.py` para flag advanced |
| `transfers.py`, `logistics.py` | `modules/inventory/` | Sub-area "movements" — son StockMovement |
| `sales.py` | `modules/sales/` | |
| `quotes.py` | `modules/sales/` | Cotización = sale en estado DRAFT/QUOTE |
| `returns.py` | `modules/sales/` | Devoluciones son sale negativa |
| `cash.py` | `modules/cash/` | + `cash_audit`, `cash_reconciliation` services |
| `purchases.py` (+ models/abasto.py) | `modules/purchasing/` | Renombrar `abasto` → `purchasing` |
| `expenses.py` | `modules/finance/` | Pequeño, junto con futuro accounting básico |
| `reports.py` | `modules/reports/` | |
| `hr.py` | `modules/hr/` | |
| `portal.py` | `modules/portal/` | Portal cliente — preserve as-is |
| `printer.py` (+ pos_printer.py + print_job model + ticket.html) | `modules/printing/` | |
| `setup.py` | `modules/onboarding/` o queda en `core/` | Decisión menor |
| Platform router (refs en main.py — confirmar archivo) | `modules/platform/` | SUPERADMIN console; mantenerlo aislado |

**No se mueven en Fase 2** (quedan en `core/` o no se tocan):
- `app/database.py` → `app/core/database.py`
- `app/dependencies.py` → repartir entre `app/core/` (tenant context, current_user) y módulos correspondientes
- `app/security/` → `app/core/security/`
- `app/core/events.py` → se queda
- `app/core/role_permissions.py` → `app/core/permissions.py` (se queda en core, es transversal)
- `app/main.py` → se queda en raíz, solo cambian imports

---

## 5. Estrategia de migración: incremental, no-breaking

### Principio rector

> **Cada PR deja el sistema arrancando, todos los tests verdes, todas las rutas existentes respondiendo igual.**

Esto se logra con dos técnicas:

1. **Re-exports puente**: cuando movemos `app/models/products.py` → `app/modules/products/models.py`, dejamos un shim:
   ```python
   # app/models/products.py (puente temporal)
   from app.modules.products.models import *  # noqa
   ```
   Permite que código no migrado siga importando `from app.models.products import Product`. Los shims se borran al final, en un PR de cleanup.

2. **Un módulo por PR**: cada PR migra UN módulo y solo ese. Tamaño manejable, fácil de revertir.

### Sprints propuestos

| Sprint | Alcance | Resultado esperado |
|---|---|---|
| **S0 — Foundation** | Alembic init + baseline migration. Crear `app/core/` real (mover `database.py`, `dependencies.py` parcial, `security/`). Crear `app/modules/` vacío. | Estructura objetivo creada, modelos sin moverse. App arranca igual. |
| **S1 — Tenants & Identity** | Migrar `auth`, `users`, `tenants` (organization), `branches`. Resolver duplicado `branch.py`/`branches.py`. | 4 módulos migrados. Es la base de tenancy — todo lo demás depende. |
| **S2 — Catalog** | Migrar `products` (con brands, departments), `customers`. | Catálogo modularizado. |
| **S3 — Inventory** | Migrar `inventory`, `transfers`, `logistics`. Aplicar D5 (un solo módulo con flag). Empezar a definir la abstracción `StockMovement` que pide pack §14 (esto se profundiza en Fase 4, aquí solo dejamos la forma). | Inventory está listo para evolucionar a ledger en Fase 4. |
| **S4 — Sales chain** | Migrar `sales`, `quotes`, `returns`, `cash`. | El flujo central del POS modularizado. |
| **S5 — Operations** | Migrar `purchases` (renombrar abasto), `expenses`, `reports`, `hr`, `portal`, `printing`. | Restantes. |
| **S6 — Platform & cleanup** | Migrar `platform` router. Borrar shims puente. Audit final de imports. Documentar nueva estructura en `docs/architecture/`. | Fase 2 cerrada. |

7 sprints estimados — granularidad ajustable si algún módulo es más grande.

---

## 6. Recipe por módulo

Para cada módulo `<name>`:

```
1. Crear app/modules/<name>/{__init__.py, router.py, models.py, schemas.py, services.py}
2. Mover code:
   - app/routers/<name>.py        → app/modules/<name>/router.py
   - app/models/<name>.py         → app/modules/<name>/models.py
   - app/schemas/<name>.py        → app/modules/<name>/schemas.py
   - (si aplica) app/services/<x>.py → app/modules/<name>/services.py
3. Actualizar imports DENTRO del módulo a paths absolutos nuevos.
4. Crear shims en ubicaciones viejas (re-export *).
5. Actualizar app/main.py para importar el router desde la nueva ubicación.
6. Generar migración Alembic vacía (sentinel) para marcar el cambio de path —
   Alembic detecta el path por __tablename__, no por path Python, así que en
   teoría no hace falta migración real, pero el sentinel sirve de checkpoint.
7. Correr `pytest -x` (cuando exista; ver §9).
8. Smoke: levantar app, hacer GET /api/<endpoint> de cada router migrado.
9. Commit con mensaje "refactor(modules/<name>): extract from layered structure".
10. PR a main, review, merge.
```

Al final del Sprint 6: borrar shims en un único PR de cleanup.

---

## 7. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Imports circulares cuando módulos referencian models de otros | Alta | Medio | Cada módulo expone solo `services.py` y `schemas.py` como API pública. Models internos no se importan cross-módulo. |
| FK SQLAlchemy entre tablas de módulos distintos rompen al mover | Media | Alto | SQLAlchemy resuelve por `__tablename__`, no por path Python. Shims aseguran imports legacy hasta cleanup. Probar tras cada migración. |
| Falta de tests existentes hace difícil validar no-breaking | Alta | Alto | Ver §9 — escribir smoke tests mínimos antes de S1 |
| `branch.py` vs `branches.py` esconde código activo en uno de los dos | Media | Medio | D3 — auditar primero, consolidar antes de migrar |
| Modelo SQLAlchemy `Base` único compartido | N/A | N/A | Mantener `app/core/database.py` con Base centralizado y que cada módulo lo importe |
| Migrate-and-rename simultáneo (ej. `abasto` → `purchasing`) | Media | Medio | Renombrar en paso separado al cambio de path. Dos PRs: rename, después move. |
| Pre-existing inconsistencia rol/permission (ya documentada en AGENTS.md) | Confirmada | Bajo | Fuera de alcance Fase 2; se sigue trabajando con `role_permissions.py` como verdad |
| Producción rompe entre PRs si no hay rollback claro | Media | Alto | Cada PR es self-contained. Railway rollback a commit anterior es la red. |

---

## 8. Out of scope (NO hacer aquí)

- Reescribir lógica de negocio.
- Cambios de API contract (paths, payloads, response shapes).
- Migrar frontend (Fase 3).
- Implementar StockMovement ledger completo (Fase 4 — aquí solo lo dejamos preparado).
- Crear los archivos de presets (`presets/atlas_pos.py`) — Fase 5.
- Resolver el RBAC dual `role_permissions.py` legacy — operación independiente.
- Borrar `app/templates/print/ticket.html` — sigue activo.

---

## 9. Verificación / definición de "hecho"

Cada sprint cumple:

```bash
# 1. App arranca limpio
uvicorn app.main:app --port 8000  # debe levantar sin errores

# 2. Health endpoint responde
curl localhost:8000/health  # 200 OK

# 3. Smoke endpoints respondiendo
curl -H "Authorization: Bearer $TOKEN" localhost:8000/api/auth/me      # 200
curl -H "Authorization: Bearer $TOKEN" localhost:8000/api/products      # 200
# (hacer un endpoint por módulo migrado en el sprint)

# 4. Frontend SPA carga
curl localhost:8000/  # debe servir index.html

# 5. No hay imports rotos
python -c "from app.main import app; print('ok')"

# 6. Tests verdes (cuando existan)
pytest -x
```

**Sprint 0 además debe entregar**:
- `alembic upgrade head` ejecuta sin error contra una DB vacía.
- `alembic current` reporta la baseline migration.

---

## 10. Recursos / archivos a crear durante Fase 2

| Path | Cuándo | Propósito |
|---|---|---|
| `alembic/` (env.py, versions/) | S0 | Migraciones |
| `alembic.ini` | S0 | Config Alembic |
| `app/core/__init__.py` | S0 | Marker |
| `app/core/database.py` | S0 | Migrado de `app/database.py` |
| `app/core/security/` | S0 | Migrado de `app/security/` |
| `app/core/permissions.py` | S0 | Migrado de `app/core/role_permissions.py` |
| `app/core/tenant_context.py` | S0 | Extraído de `app/dependencies.py` |
| `app/core/audit.py` | S0 | Migrado de `app/services/audit_service.py` (pasa a core porque es transversal) |
| `app/modules/__init__.py` | S0 | Marker |
| `app/modules/<name>/` × 16 | S1–S6 | Un módulo por sprint task |
| `docs/decisions/PHASE_2_*.md` | Cada sprint | ADR de decisiones tomadas |
| `docs/architecture/MODULES.md` | S6 | Documentación final |

---

## 11. Preguntas abiertas para el usuario

Antes de arrancar S0, se necesita decisión explícita sobre:

1. **D1 — Alembic ya**: confirmo que iniciamos con Alembic, capturando schema actual como baseline. ¿OK?
2. **D3 — Duplicado branch/branches**: ¿auditamos juntos antes de S0, o lo asumo como tarea de S0 cerrada por mí?
3. **D4 — Inventario al cobro**: ¿confirmas descontar al estado `PAID`, no `DRAFT`?
4. **D5 — Inventory un solo módulo con flag**: ¿OK, o prefieres `inventory_basic` + `inventory_advanced` separados?
5. **D7 — `init_*.py` en raíz de `app/`**: ¿los movemos a `scripts/` ahora o en sprint posterior?
6. **Pace**: ¿prefieres sprints chicos (1 PR cada 1-2 días) o lotes grandes (Sprint S1 completo en 1 PR)?
7. **Tests**: ¿bloqueante para S1 escribir smoke tests primero, o seguimos manualmente?

---

## 12. Próximo paso concreto

Si todo lo anterior se aprueba:

1. Resolver D1–D7 con el usuario.
2. **PR S0.1**: bootstrap de Alembic + baseline migration.
3. **PR S0.2**: crear `app/core/` y mover `database.py`, `dependencies.py` (tenant ctx), `security/`.
4. **PR S0.3**: crear `app/modules/` vacío + smoke tests mínimos.
5. **Inicio S1** con `tenants` (`organization.py`).

---

## 13. Anclajes al pack maestro

- **Pack §1 naming**: este plan respeta Atlas BOS (técnico) en código y `atlas_pos` en presets.
- **Pack §5**: nada de duplicar repos por vertical — todo va en `app/modules/`.
- **Pack §8 estructura**: replicada exactamente.
- **Pack §10 módulos**: 19 módulos del pack mapeados a 16 carpetas (consolidando algunos).
- **Pack §13 multi-tenant**: `tenant_id` y reglas se preservan; `app/core/tenant_context.py` centraliza.
- **Pack §14 inventario ledger**: preparado, no implementado (Fase 4).
- **Pack §17 Fase 2**: este es el plan completo de esa fase.
- **Pack §20 task pack inicial**: tareas 3, 4, 5 cubiertas; tareas 1, 2 son S0; resto en sprints siguientes.

---

**Última actualización**: 2026-05-08
**Autor**: Claude Opus 4.7 (asistido por Ecamposg95)
**Estado del plan**: Borrador — pendiente aprobación de decisiones D1–D7
