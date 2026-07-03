<div align="center">

# Atlas One
### The all-in-one business suite for physical businesses in LatAm

**A modular suite powered by Atlas BOS to operate, sell, control, and scale your business.**

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.127-009688?logo=fastapi)](#)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](#)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway)](#)
[![PWA](https://img.shields.io/badge/PWA-Instalable-5A0FC8?logo=pwa)](#)
[![Status](https://img.shields.io/badge/Status-Active%20Development-blue)](#)

</div>

---

Atlas One is a modular all-in-one business suite for physical businesses in Mexico and Latin America.

It allows businesses to start with **Atlas POS** and progressively activate advanced modules such as inventory, purchasing, CRM, appointments, kitchen operations, reports, AI and enterprise integrations.

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
| **Atlas One Gastro** | Preset Alimentos | Mesas, comandas, KDS, recetas, control de mermas y delivery. |
| **Atlas One Enterprise**| Preset Custom | Implementaciones a la medida, IA avanzada y dashboards ejecutivos. |

<br/>

---

## 🍽️ Gastro — Mesas & Comandas

El preset **Atlas One Gastro** (`ATLAS_ONE_RESTAURANT`) opera un restaurante de punta a punta:

- **Mesas premium** (`/tables`) — plano del salón con KPIs vivos (ocupadas/libres, cuentas abiertas, tiempo promedio) y cards por mesa con estado, mesero, tiempo abierta, total de cuenta y comandas en cocina.
- **Comanda móvil** (`/mobile/comanda`) — el mesero (rol `VENDEDOR`) abre la mesa, arma la comanda desde el menú y la **envía a cocina (KDS)**; los platillos se acumulan en la cuenta para que el cajero cobre sin recapturar.
- **KDS** (`/kitchen`) — display de cocina que recibe y despacha las comandas.

Flujo: abrir mesa → levantar comanda → a cocina + a la cuenta → cobrar en POS → la mesa se libera sola.

📄 Detalle técnico (rutas, endpoints, contrato, limitaciones): [`docs/modules/GASTRO_MESAS_COMANDAS.md`](docs/modules/GASTRO_MESAS_COMANDAS.md)

<div align="center">

**Atlas One — the ultimate operating system for physical business.**

</div>
