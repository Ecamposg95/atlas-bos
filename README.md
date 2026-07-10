<div align="center">

# Atlas One
### The all-in-one business suite for physical businesses in LatAm

**A modular suite powered by Atlas BOS to operate, sell, control, and scale your business.**

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)](#)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql)](#)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway)](#)
[![PWA](https://img.shields.io/badge/PWA-Instalable-5A0FC8?logo=pwa)](#)

</div>

---

Atlas One es una suite modular todo-en-uno para negocios físicos en México y Latinoamérica. El cliente arranca con **Atlas POS** (preset ligero) y activa progresivamente módulos avanzados: inventario, compras, CRM, citas, operación de restaurante (mesas/cocina/recetas/bar), reportes, IA y enterprise.

> **📚 ¿Buscas documentación técnica?** Empieza por **[`docs/README.md`](docs/README.md)** — el índice de toda la documentación (arquitectura, referencia de API, modelo de datos, RBAC, guías de módulos).

---

## ⚙️ Powered by Atlas BOS

**Atlas BOS** (*Business Operating System*) es el core técnico detrás de Atlas One: una arquitectura **API-first, multi-tenant y modular** en FastAPI + SQLAlchemy + PostgreSQL en el backend, y React + Vite + TypeScript en el frontend (SPA/PWA).

Una sola base de código sirve a todos los verticales. Un **preset de industria** decide qué módulos se activan para cada organización; el mismo motor opera un abarrotes, un restaurante o un salón de belleza.

---

## 🏗️ Arquitectura de producto

| Capa | Rol | Descripción |
|---|---|---|
| **Atlas One** | Marca comercial | La suite todo-en-uno que ve el cliente. |
| **Atlas BOS** | Core técnico | Motor: API, multi-tenant, RBAC, catálogo de módulos, eventos. |
| **Atlas POS** | Preset ligero | Punto de venta de entrada: ventas, pagos, productos, inventario básico, caja, tickets, reportes. |
| **Presets verticales** | Configuraciones | Retail, Gastro (Restaurant/Café/Bar), Beauty/Services (citas), Enterprise… — cada uno activa un set de módulos. |

**Módulos del catálogo** (tabla `modules`, ~21): `core`, `pos`, `reports`, `inventory`, `catalog`, `branch_catalog_enablement`, `pricing`, `promotions`, `payments`, `cash_management`, `invoicing`, `returns`, `quotes`, `warehouse`, `crm`, `customer_portal`, `appointments`, `work_orders`, `kds`, `tables`, `menu`. Los módulos gastro reales entregados: **`tables`** (mesas), **`kitchen`/`kds`** (cocina), **`recipes`** (recetas/BOM), **`bar`** (inventario líquido). Beta/stub: `commissions`, `memberships`, `ai`, `purchasing`.

---

## 🚀 Inicio rápido (desarrollo local)

Requiere **Python 3.11**, **Node 20**, y Postgres (o el `docker-compose` incluido).

```bash
# 1. Backend (venv + deps)
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # necesita libcairo2-dev pkg-config libpq-dev (xhtml2pdf → pycairo)

# 2. Variables de entorno (.env)
#    DATABASE_URL=postgresql://user:pass@host:5432/db   (o se usa sqlite:///./sql_app.db por defecto)
#    SECRET_KEY=<algo-seguro>   ← IMPORTANTE: sin esto usa un fallback inseguro

# 3. Inicializar/migrar la DB (idempotente): crea tablas + enums + seeds de presets/módulos
python scripts/railway_init.py

# 4. Frontend
cd frontend && npm ci && npm run dev      # Vite en :5173

# 5. Backend en dev
uvicorn app.main:app --reload             # API en :8000  ·  Swagger en /docs
```

**Tests** (SQLite en memoria, ~30s):
```bash
.venv/bin/python -m pytest -q
```
> Nota: `tests/test_cash_complete.py` es un script de integración que hace `sys.exit(1)` al importar sin un servidor vivo; ignóralo con `--ignore=tests/test_cash_complete.py` al correr la suite completa.

### Docker (stack local)
```bash
docker compose up -d          # backend + postgres (+ pgAdmin en :5432)
# Swagger: http://localhost:8000/docs
```

---

## 🧱 Estructura del repositorio

```
app/
  main.py              # FastAPI app: monta routers, startup (subscribers + outbox worker + seeds)
  core/                # database, security (JWT/auth), permissions, tenant_query/context, events, outbox
  routers/             # routers CORE (sales, cash, inventory, reports, hr, quotes, returns…) + routers/platform/*
  modules/             # arquitectura modular (destino canónico): auth, users, tenants, products, customers,
                       #   appointments, tables, kitchen, recipes, bar, commissions, memberships, ai, purchasing, platform
  models/              # modelos SQLAlchemy (73 tablas); varios son shims que re-exportan desde modules/
  schemas/             # Pydantic (request/response)
  services/            # lógica transversal (capabilities, feature_flags, cash_reconciliation, audit…)
  subscribers/         # handlers de eventos de dominio (recipes, tables, abasto)
scripts/
  railway_init.py      # migraciones idempotentes (create_all + ALTERs + enums) + seeds — corre en cada deploy
  init_presets_v2.py   # seed del catálogo de módulos y presets por industria
frontend/              # React + Vite + TS (SPA/PWA); sirve desde app/main.py en prod
docs/                  # documentación técnica — ver docs/README.md
tests/                 # pytest (SQLite en memoria)
```

> **Migración Phase 2 en curso:** `app/modules/<x>/` es el destino canónico; varios `app/routers/<x>.py` y `app/models/<x>.py` son *reverse-shims* que re-exportan desde los módulos. Ver [`docs/modules/MODULE_GUIDE.md`](docs/modules/MODULE_GUIDE.md).

---

## 🔐 Multi-tenancy y RBAC (resumen)

- **Aislamiento por organización:** toda query de negocio filtra `organization_id`. Helpers en `app/core/tenant_query.py` (`get_tenant_scoped`, `scoped_query`). La org activa se resuelve por header `X-Organization-ID` / cookie de soporte / primera membresía (`app/core/tenant_context.py`).
- **Roles de tenant:** `ADMINISTRADOR`, `DUEÑO` (HQ), `GERENTE`, `CAJERO` (sucursal), `VENDEDOR`, `SOPORTE_OPERATIVO` (móvil), `CLIENTE` (portal).
- **Roles de plataforma:** `SUPERADMIN`, `SUPPORT` (staff SaaS) — todo `/api/platform/*` los exige.
- **Gating por módulo:** `require_module(...)` bloquea features no activadas en el preset de la org (ADMIN/DUEÑO hacen bypass).

Referencia completa (matriz rol→acceso, flujo de auth/JWT, huecos de seguridad conocidos): **[`docs/RBAC.md`](docs/RBAC.md)**.

---

## 🍽️ Gastro — Mesas, Cocina, Recetas y Bar

El preset gastro (`ATLAS_ONE_RESTAURANT` / `_CAFE` / `_BAR`) opera un negocio de alimentos de punta a punta:

- **Mesas** (`/tables`) — plano del salón con estado por mesa; la "cuenta abierta" de una mesa **es** un `ParkedTicket` (mismo buffer del POS), así el cajero cobra sin recapturar. Máquina de estados de mesa + liberación que cierra la cuenta y cancela comandas.
- **Comanda** (`/mobile/comanda`) — el mesero levanta la orden y la **envía a cocina (KDS)**; se acumula en la cuenta.
- **Cocina/KDS** (`/kitchen`) — tablero de comandas por estación con avance por ítem/estación.
- **Recetas** (`/recipes`) — costeo de platillos y **descuento automático de insumos** al vender (vía evento).
- **Bar** (`/bar/bottles`) — inventario líquido por ml con **ledger** de servidas/merma y corte de turno con varianza.

Al cobrar, un evento libera la mesa y descuenta insumos automáticamente (ver arquitectura de eventos). Detalle: [`docs/modules/GASTRO_MESAS_COMANDAS.md`](docs/modules/GASTRO_MESAS_COMANDAS.md).

---

## 🚢 Deploy

- **Entornos Railway:** la rama **`staging`** despliega al entorno de staging (su propia DB Postgres); **`main`** es producción (clientes vivos — no tocar sin confirmar).
- **Flujo:** trabajar en `staging` (o `feat/*` → `staging`), validar, y promover a `main` con PR/merge.
- **Migraciones:** el `startCommand` corre `python scripts/railway_init.py` antes de uvicorn → crea tablas/columnas/enums nuevos de forma idempotente y siembra presets. Cambios de esquema se agregan ahí.
- **CI** (`.github/workflows/ci.yml`): Python **3.11**, Node 20 — pytest + `tsc` + `vite build`. Corre en push y en PR a `main`.
- **Frontend:** nixpacks reconstruye `frontend/` en cada deploy (`npm ci && npm run build`); el backend sirve la SPA desde `frontend/dist`.

Detalle: [`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md) · [`docs/branching-strategy.md`](docs/branching-strategy.md).

---

<div align="center">

**Atlas One — the ultimate operating system for physical business.**

</div>
