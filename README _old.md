<div align="center">

# Atlas POS
### Punto de Venta multi-sucursal · DataXPOS

**POS multi-sucursal con gestión completa de inventario, caja, devoluciones, catálogo y operación HQ.**
Multi-tenant SaaS sobre el shell `/platform/*`. Preset de referencia y único en producción: **DataXPOS (DAXPOS)**.

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.127-009688?logo=fastapi)](#)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](#)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway)](#)
[![PWA](https://img.shields.io/badge/PWA-Instalable-5A0FC8?logo=pwa)](#)
[![Status](https://img.shields.io/badge/Status-Active%20Production-green)](#)

</div>

---

## Preset Activo: DataXPOS

**DataXPOS (DAXPOS)** es el preset de referencia — retail/POS multi-sucursal con inventario, crédito a clientes, cotizaciones y centro de control HQ. Es propiedad intelectual del proyecto y el único preset actualmente en producción.

### Módulos HQ (ADMINISTRADOR / DUEÑO)
| Módulo | Ruta | Descripción |
|---|---|---|
| Operaciones | `/hq/operations` | KPIs en vivo, auto-refresh 60s, estado de sucursales |
| Reportes | `/hq/reports-hub` | Analytics, tendencias, comparativa por sucursal |
| Control HQ | `/hq/control` | Panel de control, sesiones activas, discrepancias de caja |
| Catálogo Admin | `/admin/catalog` | Paginación server-side, búsqueda debounced, importar Excel |
| Marcas & Empaques | `/brands` | Marcas y unidades de empaque |
| Departamentos | `/departments` | Árbol de departamentos |
| Inventario Global | `/inventory` | Kardex + ajustes de stock |
| Inventario HQ | `/hq/inventory` | Stock consolidado multi-sucursal |
| Logística | `/logistics` | Transferencias entre sucursales |
| Cajas/Contenedores | `/boxes` | Tipos de caja y contenedor para envíos |
| Ventas HQ | `/hq/sales` | Log de ventas consolidado |
| Devoluciones HQ | `/hq/returns` | Devoluciones globales |
| Cotizaciones | `/quotes` | Lista + QuoteMaker |
| Pedidos | `/seguimiento` | Seguimiento de pedidos abiertos |
| Clientes / CRM | `/customers` | Gestión de clientes, estado de cuenta, abonos |
| Recursos Humanos | `/hr` | RRHH y expedientes |
| Compras | `/purchases` | Órdenes de compra |
| Gastos | `/expenses` | Registro de gastos |
| Usuarios | `/users` | Gestión de usuarios y roles |
| Organización | `/organization` | Datos de empresa y sucursales |
| Sucursales | `/hq/branches` | Vista de sucursales con métricas |

### Módulos Branch (CAJERO / GERENTE)
| Módulo | Ruta | Descripción |
|---|---|---|
| Dashboard | `/dataxpos` | KPIs + Quick launcher |
| Terminal POS | `/pos` | Punto de venta |
| Historial Ventas | `/sales` | Ventas de la sucursal |
| Cortes de Caja | `/cash-history` | Sesiones de caja |
| Devoluciones | `/returns` | Devoluciones en sucursal |
| Reportes | `/reports` | Dashboard de sucursal con Chart.js |
| Consulta Productos | `/products` | Catálogo local de sucursal |
| Config. Impresora | `/printer-settings` | Configuración impresora térmica |

### Módulos Mobile (VENDEDOR / SOPORTE)
| Módulo | Ruta | Descripción |
|---|---|---|
| Dashboard | `/mobile/dashboard` | KPIs móviles |
| Consulta | `/mobile/query` | Búsqueda de productos |
| Venta | `/mobile/sales` | Cotización móvil |
| Perfil | `/mobile/profile` | Expediente del empleado |

### Portal (CLIENTE)
| Módulo | Ruta | Descripción |
|---|---|---|
| Mi Portal | `/portal` | Balance, movimientos y cotizaciones |

---

## Inicio Rápido

```bash
# 1. Entorno Python
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. Entorno React (desarrollo)
cd frontend && npm install && cd ..

# Requiere .env con DATABASE_URL=postgresql://user:pass@host:5432/db

# 3. Inicializar DB (primera vez — destructivo)
python scripts/reset_db.py           # escribe: yes
python scripts/init_presets_v2.py    # carga DataXPOS y presets
python scripts/init_sa.py            # crea superadmin (anota la contraseña)

# Alternativa QA: superadmin/admin123 + org "QA"
python scripts/init_users.py

# 4. Servidores en desarrollo
uvicorn app.main:app --reload        # backend → http://localhost:8000
cd frontend && npm run dev           # frontend → http://localhost:5173 (proxy a :8000)
```

### Docker (stack local)

El `docker-compose.yml` levanta **Postgres 17** + **FastAPI** y está alineado con Railway QA.

```bash
# 1. Levantar servicios
docker compose up -d --build

# 2. (Primera vez) Instalar cliente Postgres 17 en host — requerido para el sync
sudo bash scripts/install_pg_client.sh

# 3. Sincronizar datos desde Railway QA
export RAILWAY_QA_DATABASE_URL="postgresql://postgres:PASS@host.railway.app:PORT/railway"
bash scripts/db-sync-from-qa.sh   # pide confirmación interactiva
unset RAILWAY_QA_DATABASE_URL

# → Swagger: http://localhost:8000/docs
# → pgAdmin: localhost:5432  (db=railway, user=postgres, pass=toor)
```

**Detener stack:**
```bash
docker compose down          # preserva datos
docker compose down -v       # ⚠ borra el volumen (pierdes la BD local)
```

**Notas:**
- El backend usa bind-mount (`.:/app`) con `--reload` — cambios en `app/` se reflejan sin rebuild.
- `dumps/` (gitignored) guarda cada snapshot QA con timestamp.
- Railway corre Postgres 17.9 — si ves `server version mismatch` es que el host tiene `psql` viejo; reinstala con `scripts/install_pg_client.sh`.

---

## Stack

| Capa | Tecnología |
|---|---|
| **Backend** | Python 3.11, FastAPI 0.127, SQLAlchemy 2.0 |
| **Base de datos** | PostgreSQL |
| **Frontend** | React 18 + TypeScript + Vite 5 + Tailwind CSS + Zustand + React Router 6 |
| **Charts** | Chart.js 4 |
| **Autenticación** | JWT (Bearer en React) + bcrypt, RBAC por rol |
| **Build** | Nixpacks — `phases.build` compila React, `start` lanza uvicorn |
| **Deploy** | Railway — monorepo single service |
| **Imágenes** | URLs externas / Cloudinary widget |
| **PWA** | manifest.json + Service Worker — instalable en PC, iPad y móvil |
| **Dev local** | docker-compose.yml |

---

## Arquitectura

```
Presets (DataXPOS · CRM · Taller)
        ↑ orquestan
Engines (Resource · Transaction · Inventory · Relationship · HR/Finance)
        ↑ sobre
Nucleus (Org · Auth/JWT · RBAC · DB)
```

### Frontend — React SPA

La interfaz de usuario es una **Single Page Application** servida por el backend FastAPI:

```
GET /api/*         → FastAPI routers (JSON)
GET /assets/*      → React build assets (JS/CSS)
GET /{cualquier}   → frontend/dist/index.html  ← catch-all → React Router
```

El frontend React maneja toda la navegación client-side. El servidor solo emite HTML SSR para `print/ticket.html` (impresión térmica vía `sales.py`). El resto de la app es React puro — `/login`, onboarding y todas las páginas viven en `frontend/src/pages/`.

**Auth React:** JWT almacenado en `localStorage`, enviado como `Authorization: Bearer <token>` en cada request a `/api/*`.

```
frontend/
├── src/
│   ├── api/          # Axios clients (auth, products, sales, cash, reports, ...)
│   ├── components/   # Layout, UI (DaxCard, Badge, Spinner), POS, pos components
│   ├── pages/        # 25+ páginas por rol (hq/, pos/, crm/, finance/, hr/, ...)
│   ├── store/        # Zustand (authStore, posStore)
│   ├── types/        # TypeScript types (auth, products, sales, cash)
│   ├── App.tsx       # React Router con lazy loading por página
│   └── main.tsx      # Entry point
├── dist/             # Build de producción (generado por nixpacks)
├── vite.config.ts    # Proxy /api → localhost:8000 en dev
└── tailwind.config.js
```

### Backend — FastAPI

```
app/
├── main.py                  # Bootstrap + /api routers + catch-all → index.html
├── core/
│   ├── role_permissions.py  # RBAC activo — DATAXPOS_ROLE_VIEWS
│   └── role_matrix.py       # Legacy — ignorar
├── dependencies.py          # get_current_user, org context
├── database.py              # Engine SQLAlchemy + SessionLocal
├── models/                  # ORM models
├── routers/                 # API endpoints (products, sales, reports, ...)
├── schemas/                 # Pydantic DTOs
├── services/                # Business logic
└── templates/               # Jinja2 (solo print/ticket.html — impresión térmica)
scripts/
├── railway_init.py          # Init Railway: create_all + migraciones + seed
├── reset_db.py              # Drop & recreate (dev only)
├── init_presets_v2.py       # Carga presets de industria
└── init_sa.py               # Crea superadmin
context/                     # Documentación de arquitectura
docker-compose.yml           # Entorno local con Postgres + backend
```

---

## Multi-Tenancy — Regla de Oro

```python
# Toda query sobre datos de negocio:
query = db.query(Model).filter(Model.organization_id == current_user.organization_id)
if current_user.branch_id:
    query = query.filter(Model.branch_id == current_user.branch_id)
```

`branch_id = None` = usuario HQ con visibilidad global de la organización.

---

## RBAC

7 roles: `ADMINISTRADOR · DUEÑO · GERENTE · CAJERO · VENDEDOR · SOPORTE_OPERATIVO · CLIENTE`

| Rol | Contexto | Login redirige a |
|---|---|---|
| `ADMINISTRADOR` | HQ | `/hq/operations` |
| `DUEÑO` | HQ | `/hq/operations` |
| `GERENTE` | BRANCH | `/dataxpos` |
| `CAJERO` | BRANCH | `/dataxpos` |
| `VENDEDOR` | MOBILE | `/mobile/dashboard` |
| `SOPORTE_OPERATIVO` | MOBILE | `/mobile/dashboard` |
| `CLIENTE` | PORTAL | `/portal` |

Permisos por rol en `frontend/src/components/layout/Sidebar.tsx` (ROLE_ROUTES) — espeja `app/core/role_permissions.py` (DATAXPOS_ROLE_VIEWS).

---

## API — Notas Importantes

### `GET /api/products/`

Retorna `ProductListResponse` (no un array plano):
```json
{ "items": [...], "total": 450 }
```

Parámetros: `skip`, `limit`, `search`, `department_id`, `approval_status`, `active_only`.

### Excel Import/Export (`/api/products/export-template`, `/api/products/upload`)

Usa **openpyxl** directamente (pandas fue eliminado). Soporta `.xlsx` y `.csv`.

---

## Deploy

```bash
# Push a main (auto-build en Railway si está configurado)
git push origin main

# Promover a producción
git push origin main:production
```

**Build en Railway (Nixpacks):**
1. `phases.install` — instala dependencias Python en `/opt/venv`
2. `phases.build` — `cd frontend && npm ci && npm run build`
3. `start` — `railway_init.py` + `uvicorn app.main:app`

`railway_init.py` ejecuta al inicio: `create_all` + migraciones idempotentes + seed.

---

## Principios de Desarrollo

1. **No romper DataXPOS** — preset en producción con clientes reales
2. **`organization_id` en toda query** — multi-tenancy es no negociable
3. **Extender engines, no crear tablas por industria**
4. **Migraciones idempotentes** — verificar antes de `ALTER TABLE`, integrar en `railway_init.py`
5. **React es el frontend** — las páginas nuevas van en `frontend/src/pages/`, no en Jinja2
6. **`SECRET_KEY` vía env var** — nunca hardcodeado

---

## PWA — Instalación como App

**PC (Chrome / Edge):** Ícono ⊕ en la barra de direcciones → "Instalar DataXPOS"

**iPad / iPhone (Safari):** Compartir (□↑) → "Agregar a pantalla de inicio"

---

## Documentación

- `context/ARCHITECTURE.md` — Arquitectura en capas (BOS)
- `context/DATAXPOS_PRESET_SYSTEM.md` — Sistema de presets, módulos y arquitectura DataXPOS
- `context/ROLES_Y_MODULOS.md` — Roles y matriz de acceso
- `context/UI_PATTERNS.md` — Design system (dax-card, colores, componentes)
- `CLAUDE.md` — Instrucciones para Claude Code

---

<div align="center">

**Atlas POS — el motor de venta multi-sucursal.**

</div>
