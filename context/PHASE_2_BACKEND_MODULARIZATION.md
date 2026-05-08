# Fase 2 — Modularización del Backend (v2)

> **Directriz fuente**: `context/ATLAS_ONE_BOS_CONTEXT_PACK.md` §8, §10, §17, §20.
> **Estado**: Fase 1 (rename) ✅ completada. Esta es la Fase 2.
> **Versión**: 2 (post-auditoría con subagentes — 2026-05-08)

---

## 1. Objetivo

Transformar `app/` de su estructura **layered** (routers/models/schemas planos) a la estructura **modular** del pack §8:

```
backend/app/
├── core/              # config, db, security, tenant_context, audit, exceptions, permissions
├── modules/           # un dominio por carpeta
│   ├── auth/  tenants/  branches/  users/
│   ├── customers/  products/  inventory/
│   ├── sales/  cash/  payments/
│   ├── purchasing/  hr/  reports/
│   ├── crm/  quotes/  printing/
│   ├── portal/  platform/   # platform es sub-package con 17 sub-routers
│   └── ...
├── presets/           # atlas_pos.py + verticales (Fase 5)
└── main.py
```

**No-objetivo**: cambiar comportamiento, romper rutas, reescribir lógica. Esta fase es 90% movimiento + adecuación de imports + tests verdes.

---

## 2. Estado actual (auditoría 2026-05-08)

| Capa | Cantidad | Notas |
|---|---|---|
| `app/routers/*.py` | 21 archivos + 1 sub-paquete | `platform/` es **sub-paquete** con 17 sub-módulos. `branch.py` (dashboard) y `branches.py` (CRUD) NO son duplicados — verificado |
| `app/models/*.py` | 18 | Naming heterogéneo (`abasto.py` = compras) |
| `app/schemas/*.py` | 20 | ~1:1 con models |
| `app/services/*.py` | 6 | Capa delgada |
| `app/core/*.py` | 2 | Solo `events.py`, `role_permissions.py`. **Core casi inexistente.** |
| `app/security/*.py` | 4 | `__init__.py`, `api_keys.py`, `require_module.py` — base para `core/security/` |
| `app/templates/` | 1 | Solo `print/ticket.html` — Jinja prácticamente extinto |
| `tests/` | **146 tests / 17 archivos / 3281 LOC** | pytest + SQLite in-memory + fixtures en `conftest.py`. Cubren cash, catalog, products bien |
| `alembic/` | ❌ | **No existe**. Schema con `Base.metadata.create_all` en `init_db.py`. Solo 1 SQL manual en `migrations/` |

---

## 3. Decisiones bloqueantes

| # | Decisión | Estado | Resolución/Recomendación |
|---|---|---|---|
| **D1** | Adoptar Alembic | 🔴 Bloqueante | **Sí, en S0.0**. Capturar schema actual como baseline migration. Sin esto, mover modelos = ruleta rusa en prod. |
| **D2** | Desmontar `templates/print/ticket.html` | 🟢 Diferido | Mover a `app/modules/printing/templates/` en S5; no borrar (lo usa el printer agent activo) |
| **D3** | `branch.py` vs `branches.py` | ✅ Resuelta | NO son duplicados. `branch.py` = `/api/branch/dashboard` (contextual). `branches.py` = `/api/branches` (CRUD + logos). Mantener ambos como sub-archivos de `modules/branches/` |
| **D4** | Cuándo descontar inventario | 🔴 NUEVA decisión | **Hallazgo**: el código actual descuenta stock al CREAR la venta, NO al `PAID`. Sin `SELECT FOR UPDATE`. Devoluciones asimétricas (salen al create, entran al approved). Opciones: (a) documentar status quo y migrar a `PAID + lock` en Fase 4 cuando implementemos StockMovement ledger correcto; (b) corregir ahora junto con la modularización. **Recomendación: (a)** — Fase 2 es solo movimiento, no cambio semántico |
| **D5** | Inventory uno solo o dos módulos | 🟡 | **Un solo `modules/inventory/`** con feature flag `inventory.advanced`. Atlas POS solo activa el básico |
| **D6** | `services/` distribuido o transversal | 🟢 Resuelta por agente 5 | Cada módulo tiene su `services.py` interno; los cross-module van a `app/core/services/` |
| **D7** | `init_*.py`, `reset_db.py` en `app/` raíz | 🟢 Resuelta | Mover `app/init_db.py` y `app/init_users.py` a `scripts/`. `reset_db.py` queda como tool QA |

---

## 4. Mapeo router → módulo objetivo (revisado)

| Router actual | Módulo destino | Notas |
|---|---|---|
| `auth.py` | `modules/auth/router.py` | + reset password, sessions |
| `users.py` | `modules/users/router.py` | |
| `organization.py` | `modules/tenants/router.py` | "Organization" = tenant en el pack |
| `branch.py` + `branches.py` | `modules/branches/{dashboard,router}.py` | Ambos archivos coexisten dentro del módulo |
| `customers.py` | `modules/customers/router.py` | |
| `products.py` (+ brands, departments) | `modules/products/router.py` | Brands/departments como sub-archivos |
| `inventory.py` | `modules/inventory/router.py` | + flag `inventory.advanced` |
| `transfers.py`, `logistics.py` | `modules/inventory/{transfers,logistics}.py` | StockMovements |
| `sales.py` | `modules/sales/router.py` | |
| `quotes.py` | `modules/sales/quotes.py` | Cotización = sale en estado QUOTE |
| `returns.py` | `modules/sales/returns.py` | |
| `cash.py` | `modules/cash/router.py` | + `cash_audit`, `cash_reconciliation` services |
| `purchases.py` (+ models/abasto.py) | `modules/purchasing/router.py` | Renombrar `abasto` → `purchasing` |
| `expenses.py` | `modules/finance/expenses.py` | |
| `reports.py` | `modules/reports/router.py` | |
| `hr.py` | `modules/hr/router.py` | |
| `portal.py` | `modules/portal/router.py` | |
| `printer.py` (+ pos_printer.py + print_job model + ticket.html) | `modules/printing/` | |
| `setup.py` | `modules/onboarding/router.py` | |
| `routers/platform/` | `modules/platform/` | Mantiene 17 sub-archivos internos |

**No se mueven en Fase 2** (van a `app/core/` o quedan):
- `app/database.py` → `app/core/database.py`
- `app/dependencies.py` → split (ver §6 abajo)
- `app/security/` → `app/core/security/{config,passwords,jwt,auth,guards}.py`
- `app/core/role_permissions.py` → `app/core/permissions.py`
- `app/main.py` → solo cambian imports

---

## 5. Estrategia: incremental, no-breaking

### Principio rector

> **Cada PR deja el sistema arrancando, los 146 tests verdes, todas las rutas existentes respondiendo igual.**

Técnicas:

1. **Re-export shims**: cuando movemos `X` de `A` a `B`, dejamos `A` re-exportando desde `B`. Permite que código no migrado siga importando de la ubicación vieja. Los shims se borran al final.
2. **Un módulo por PR**.
3. **Tests existentes son la red de seguridad**: correr `pytest tests/` después de cada PR. Para validación con Postgres real (FK constraints que SQLite no valida), correr smoke contra DB local de Postgres.

### Sprints (orden corregido — products antes que branches)

| Sprint | Alcance | Razón del orden |
|---|---|---|
| **S0** | Foundation: Alembic + `app/core/` scaffold + decomposition de `dependencies.py`/`security/` | Bloqueante para todo lo demás |
| **S1** | `auth`, `users`, `tenants` (organization) | Base de identity. Sin deps salientes complicadas. |
| **S2** | `products` (+brands+departments), `customers` | **Antes que branches**: `branches.py` importa `ProductVariant`, `ProductBranchStatus` |
| **S3** | `branches` | Ahora products ya está disponible |
| **S4** | `inventory`, `transfers`, `logistics` | Depende de products (S2) ✓ |
| **S5** | `sales`, `quotes`, `returns`, `cash` | Depende de inventory (S4) ✓ |
| **S6** | `purchasing`, `expenses`, `reports`, `hr`, `portal`, `printing`, `onboarding` | Refactor pequeño en S6: extraer `_assert_sale_branch_access` de `sales.py` a util compartido para que `printer.py` no dependa de sales |
| **S7** | `platform` (sub-paquete completo) + cleanup de shims + docs `/docs/architecture/` | Cierre de Fase 2 |

8 sprints — granularidad ajustable.

---

## 6. Decomposition de `app/dependencies.py` y `app/security/` (S0)

Mapeo concreto (de auditoría agente 5, callers verificados):

### Eliminar (dead code SSR legacy, 0 callers)

- `dependencies.py::check_view_permission` → DELETE (Jinja2 nav guard, sin uso)
- `dependencies.py::require_platform_admin_html` → DELETE (cookie HTML guard, sin uso)
- `security/__init__.py::get_current_user_from_cookie`, `get_optional_user_from_cookie` → DELETE (ambos solo se usan en los 2 anteriores)

### Mover a `app/core/`

| Símbolo | Origen | Destino | Callers |
|---|---|---|---|
| `get_db` | `app/database.py` | `app/core/database.py` | Todos |
| `get_current_active_organization` | `app/dependencies.py` | `app/core/tenant_context.py` | **31 routers** |
| `get_current_user` | `app/security/__init__.py` | `app/core/security/auth.py` | **34 routers** |
| `verify_pin`, `get_password_hash` | `app/security/__init__.py` | `app/core/security/passwords.py` | 5+ archivos |
| `create_access_token` | `app/security/__init__.py` | `app/core/security/jwt.py` | `auth.py` |
| `SECRET_KEY`, JWT config, `oauth2_scheme` | `app/security/__init__.py` | `app/core/security/config.py` | Internal |
| `require_admin_or_owner` | `app/security/__init__.py` | `app/core/security/guards.py` | `branches.py` |
| `require_module` | `app/security/require_module.py` | `app/core/permissions.py` | `logistics`, `quotes`, `sales` |

### Mover a módulo específico

| Símbolo | Destino | Razón |
|---|---|---|
| `require_platform_admin` | `app/modules/platform/dependencies.py` | 19 callers, todos en `routers/platform/*` |
| `require_superadmin` | `app/modules/platform/dependencies.py` | 7 callers, todos platform |
| `app/security/api_keys.py` | `app/modules/platform/api_keys.py` | Single caller `platform/api_keys.py` |

### Sub-pasos S0

```
S0.0  · alembic init + baseline migration capturando schema actual
S0.1  · scaffold app/core/{database,tenant_context,permissions,security/} con SHIMS
        re-exportando desde ubicaciones viejas (no rompe nada)
S0.2  · mover bodies de dependencies.py y security/* a sus nuevos archivos en core/.
        Dejar app/dependencies.py y app/security/__init__.py como shims que re-exportan.
        Romper circular import en require_module.py (apuntar a app.core.tenant_context).
S0.3  · crear app/modules/platform/{dependencies,api_keys}.py.
        Update los 19+7+1 imports de routers/platform/* para apuntar al nuevo lugar.
S0.4  · rewrite mecánico de los 31+34+3 call sites a los nuevos paths
        (one commit per group: tenant_context, security, permissions).
S0.5  · DELETE legacy SSR helpers + delete shim files una vez todo compila y tests verdes.
```

### Riesgos S0

- **Circular import en `require_module.py`**: ya importa `get_current_active_organization` dentro de la función — ya huele. S0.2 lo arregla apuntando a `core/tenant_context`.
- **`oauth2_scheme` es singleton**: una sola instancia debe sobrevivir el split. Re-export, no duplicar.
- **`main.py` aliases `_gcao_for_alias` y `_gcu_for_alias`**: verificar que sigan funcionando tras rename.
- **`request.state.nav_items` / `user_json`**: side effect de `check_view_permission`. Verificar que no haya HTML route que lo consuma antes de eliminar.

---

## 7. Recipe estándar por módulo (S1-S6)

Para cada módulo `<name>`:

```
1. Crear app/modules/<name>/{__init__.py, router.py, models.py, schemas.py, services.py}
2. Mover archivos:
   - app/routers/<name>.py     → app/modules/<name>/router.py
   - app/models/<name>.py      → app/modules/<name>/models.py
   - app/schemas/<name>.py     → app/modules/<name>/schemas.py
   - app/services/<x>.py       → app/modules/<name>/services.py (si aplica)
3. Actualizar imports relativos DENTRO del módulo.
4. Crear shims en ubicaciones viejas (re-export *).
5. Actualizar app/main.py.
6. pytest tests/ → verde.
7. Smoke con uvicorn + curl a endpoint del módulo.
8. Commit "refactor(modules/<name>): extract from layered structure".
9. PR a main, review, merge.
```

S7: borrar shims en un único PR de cleanup.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Imports circulares cross-módulo | Alta | Medio | Cada módulo expone solo `services.py` y `schemas.py`. Models internos no se importan cross-módulo. |
| FK SQLAlchemy entre tablas de módulos distintos | Media | Alto | SQLAlchemy resuelve por `__tablename__`. Shims aseguran imports legacy hasta cleanup. |
| SQLite tests pasan, Postgres prod rompe | Alta | Alto | Correr `pytest` adicional contra Postgres local antes de PR (FK constraints). |
| `branches.py` importa de products antes de S2 | Confirmada | Alto | **Resuelto**: orden corregido — products en S2, branches en S3. |
| `printer.py` importa de `sales.py` | Confirmada | Bajo | S6: extraer `_assert_sale_branch_access` a `app/modules/sales/utils.py` o `app/core/utils.py` antes de mover printer. |
| Inventario asimétrico (descuenta al CREATE, devuelve al APPROVED) | Confirmada | Medio | **Out of scope Fase 2**. Se documenta como behavior actual, se corrige en Fase 4 con StockMovement ledger. |
| Modelo SQLAlchemy `Base` único | N/A | N/A | `app/core/database.py` con Base centralizado. |
| Producción rompe entre PRs | Media | Alto | Cada PR self-contained. Railway rollback es la red. |

---

## 9. Out of scope (Fase 2)

- Reescribir lógica de negocio.
- Cambios de API contract.
- Migrar frontend (Fase 3).
- Implementar StockMovement ledger correcto (Fase 4).
- Corregir el descuento de inventario al PAID + locks (Fase 4 junto con ledger).
- Crear archivos de presets (Fase 5).
- Resolver RBAC dual `role_permissions.py` legacy.
- Borrar `app/templates/print/ticket.html`.

---

## 10. Definición de "hecho" por sprint

```bash
# 1. App arranca
uvicorn app.main:app --port 8000  # sin errores

# 2. Health
curl localhost:8000/health  # 200

# 3. 146 tests verdes
pytest tests/ -x

# 4. Smoke endpoints del módulo migrado
curl -H "Authorization: Bearer $TOKEN" localhost:8000/api/<endpoints-del-módulo>

# 5. Imports compilan
python -c "from app.main import app; print('ok')"
```

S0.0 además: `alembic upgrade head` ejecuta limpio, `alembic current` reporta baseline.

---

## 11. Open questions para el usuario (mínimas)

Las restantes después de la auditoría:

1. **D4 (inventory deduction)**: ¿confirmas opción (a) — documentar status quo en Fase 2 y migrar a PAID+lock+ledger en Fase 4?
2. **Pace**: ¿sprints chicos (1 PR cada 1-2 días) o lotes grandes (un sprint completo en un PR)?
3. **Postgres testing**: ¿levantamos Postgres local con docker-compose para validar FKs antes de cada PR, o confiamos en SQLite para Fase 2 y solo en S7 hacemos validación full?
4. **D2 templates**: ¿borramos `app/templates/print/ticket.html` cuando el módulo `printing` migre, o lo conservamos eternamente como fallback?

---

## 12. Estado de ejecución

| Sub-paso | Estado | Commit |
|---|---|---|
| **S0.0** Alembic + baseline migration | 🔴 Pendiente | — |
| **S0.1** Scaffold `app/core/` + `app/modules/` con shims | ✅ Done | `be6e89e` |
| **S0.2** Mover bodies (database, security primitives, tenant_context, permissions) | ✅ Done | `de63fa5` |
| **S0.3** Mover platform-only deps (require_platform_admin, require_superadmin, api_keys) | ✅ Done | `de63fa5` |
| **S0.4** Rewrite mecánico de los call sites (112 archivos) | ✅ Done | `375afdc` |
| **S0.5** Borrar shims legacy (`app/database.py`, `app/dependencies.py`, `app/security/*`) | ✅ Done | (este commit) |
| **S0.5b** Limpieza incidental: `request.state.nav_items/user_json`, `check_view_permission`, `require_platform_admin_html`, `get_*_user_from_cookie` (SSR muerto) | ✅ Done | `de63fa5` |

**Próximos pasos concretos:**

1. **S0.0 (Alembic)** — bloqueante para S1+ porque S1 mueve modelos. Requiere: instalar `alembic`, `alembic init`, configurar `env.py` para apuntar a `app.core.database.Base`, generar baseline migration capturando schema actual, validar `alembic upgrade head` contra DB vacía.
2. **S1** — primer módulo: `auth`, `users`, `tenants` (organization). Usar el recipe de §7.
3. **Hygiene paralela** (cualquier momento): crear `.gitignore` y `git rm -r --cached app/**/__pycache__` para retirar las 124 entradas de bytecode tracked. Aislado de la modularización.

---

## 13. Anclajes al pack maestro

- **§1 naming**: respetado (Atlas BOS técnico, atlas_pos preset).
- **§5**: monorepo, sin clones por vertical.
- **§8 estructura**: replicada.
- **§10 módulos**: 19 mapeados a 17 carpetas (consolidando algunos).
- **§13 multi-tenant**: `app/core/tenant_context.py` centraliza.
- **§14 inventario ledger**: preparado en Fase 2, implementado en Fase 4.
- **§17 Fase 2**: este plan.
- **§20 task pack inicial**: tareas 3-5 = S0; resto en S1-S7.

---

**Actualizado**: 2026-05-08 (v2 post-auditoría con subagentes)
**Estado**: aprobado para iniciar S0.1
