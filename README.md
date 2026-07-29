<div align="center">

# Atlas One
### The all-in-one business suite for physical businesses in LatAm

**A modular suite powered by Atlas BOS to operate, sell, control, and scale your business.**

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.127-009688?logo=fastapi)](#)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql)](#)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway)](#)
[![PWA](https://img.shields.io/badge/PWA-Instalable-5A0FC8?logo=pwa)](#)
[![Status](https://img.shields.io/badge/Status-Active%20Development-blue)](#)

</div>

---

Atlas One is a modular all-in-one business suite for physical businesses in Mexico and Latin America.

It allows businesses to start with **Atlas POS** and progressively activate advanced modules such as inventory, purchasing, CRM, appointments, kitchen operations, reports, AI and enterprise integrations.

---

## ⚠️ Antes de tocar `main`

**`main` es producción en vivo.** Railway la despliega automáticamente en cada
push y hay un negocio real cobrando ahí todos los días. No es una rama de
integración.

- Los PRs nuevos van a **`staging`**
- Cambios a `main`, fuera del horario de la tienda (opera hasta ~20:00 hora de México)
- El `Dockerfile` de la raíz **no debe llegar a `main`**: Railway lo prioriza sobre Railpack

Detalle completo en [`docs/infra/deployment-map.md`](docs/infra/deployment-map.md).

## 🌐 Dónde vive cada cosa

| Destino | Rama | Base de datos |
|---|---|---|
| `atlas-one.up.railway.app` | `main` | Postgres de Railway — **producción, cliente real** |
| `app.atlasone.com.mx` | `staging` | `atlas_one_beta` en el VPS — datos demo |
| `atlasone.com.mx` | — | Landing estática |

`staging` va ~95 commits adelante de `main` e incluye la Gastro Suite (mesas,
comandas, KDS, recetas) y el ledger de barra.

## 🛠️ Desarrollo local

```bash
docker compose up -d          # Postgres + backend en :8000 con recarga
cd frontend && npm ci && npm run dev   # Vite en :5173, proxy a /api
```

Sin Docker:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://postgres:toor@localhost:5432/railway
uvicorn app.main:app --reload
```

**`LOG_LEVEL` debe ir en MAYÚSCULAS.** `app/main.py` lo pasa directo a `logging`;
con `info` en minúscula uvicorn muere con `ValueError: Unknown level`.

> **Divergencia conocida:** `docker-compose.yml` usa `postgres:17-alpine` y
> producción corre **18.3**, así que un dump de producción no restaura en local.
> Al alinearlo hay que cambiar también el punto de montaje: Postgres 18 espera el
> volumen en `/var/lib/postgresql`, no en `/var/lib/postgresql/data`, o el
> contenedor entra en bucle de reinicio.

### Variables de entorno

| Variable | Efecto si falta |
|---|---|
| `DATABASE_URL` | Requerida |
| `SECRET_KEY` | Usa el default público del repositorio — **ver deuda de seguridad abajo** |
| `LOG_LEVEL` | `INFO` |
| `CLOUDINARY_URL` | Las imágenes van a disco local en `app/static/` |
| `SUPERADMIN_USER` / `SUPERADMIN_PASS` | `superadmin` / `admin123`, solo al crear el usuario |

`scripts/railway_init.py` corre en cada arranque, es idempotente y siembra 13
organizaciones demo con contraseña `demo1234`.

### Notas de la API

`POST /api/auth/login` es **form-encoded** (OAuth2PasswordRequestForm), no JSON.
Con JSON responde 422. El frontend usa `baseURL: '/api'` relativo, así que no
necesita variables `VITE_*` en build time.

## 🔓 Deuda de seguridad abierta

`app/core/security/config.py` usa
`_DEFAULT_SECRET = "atlas_erp_secret_key_change_me_in_prod"` como respaldo de
`SECRET_KEY`, y **Railway producción no define la variable**. Los JWT de un
negocio real se firman con un secreto que está en este repositorio: cualquiera
con acceso al código puede falsificar una sesión válida. Se corrige definiendo
`SECRET_KEY` en Railway.

---

## ⚙️ Powered by Atlas BOS

**Atlas BOS** stands for *Business Operating System*.

It is the technical core behind Atlas One: an API-first, multi-tenant and modular architecture built with FastAPI, SQLAlchemy, PostgreSQL, React, Vite and TypeScript.

---

## 🚀 First Preset: Atlas POS

**Atlas POS** is the lightweight entry-level preset of Atlas One. It includes sales, payments, products, basic inventory, cash sessions, tickets and basic reports.

---

## 🏗️ Product Architecture

| Producto / Capa | Rol | Descripción |
|---|---|---|
| **Atlas One** | Suite Comercial | La marca comercial todo-en-uno que el cliente utiliza. |
| **Atlas BOS** | Core Técnico | Motor técnico (API, Multi-tenant, RBAC, Módulos). |
| **Atlas POS** | Preset Ligero | Punto de venta ligero, rápido y el modelo de entrada base. |
| **Atlas One Retail** | Preset Avanzado | Inventario robusto, proveedores, stock min/max, compras. |
| **Atlas One Beauty** | Preset Servicios | Sistema de citas, servicios, comisiones y control de cabinas. |
| **Atlas One Gastro** | Preset Alimentos | KDS, recetas, comandas, control de mermas y delivery. |
| **Atlas One Enterprise**| Preset Custom | Implementaciones a la medida, IA avanzada y dashboards ejecutivos. |

## 📚 Documentación

| Documento | Contenido |
|---|---|
| [`docs/infra/deployment-map.md`](docs/infra/deployment-map.md) | Qué rama alimenta cada destino y el checklist del corte de producción |
| [`docs/infra/ionos-vps.md`](docs/infra/ionos-vps.md) | Runbook del VPS `atlas-prod-01` |
| [`docs/branching-strategy.md`](docs/branching-strategy.md) | Ramas, reglas y convenciones |
| [`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md) | Despliegue en Railway |

## 🖨️ Agente de impresión

`tools/print_agent/` contiene el agente local que habla con las impresoras
térmicas ESC/POS. Valida el origen de las peticiones con una lista más un regex
que acepta **cualquier** `*.up.railway.app` — pero **no** un dominio propio. Al
mover un punto de venta a su propio dominio hay que definir
`ATLAS_AGENT_ORIGINS` en la PC de la tienda y verificar una impresión real, o la
caja seguirá vendiendo sin imprimir tickets.

<br/>

<div align="center">

**Atlas One — the ultimate operating system for physical business.**

</div>
