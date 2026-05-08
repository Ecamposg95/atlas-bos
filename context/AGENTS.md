# AGENTS.md — Contexto Operativo y Reglas de Juego

## 1) Misión Actual: Estabilización y Cimientos
La prioridad actual no es "agregar features por agregar", sino **estabilizar el MVP (Atlas POS)** y preparar los cimientos para los **Presets Críticos**.
*   Si encuentras código frágil en el core, **repararlo** es prioridad sobre la nueva feature.
*   El preset "Atlas POS – Alto Rendimiento" es la referencia de oro. No lo rompas.

---

## 2) Qué es Atlas ERP/POS (Nueva Visión)
Un **Business Operating System (BOS)** modular que usa "Presets" para adaptarse a industrias (Retail, Taller, Servicios).
Integrará IA y Blockchain como componentes nativos, no agregados.

---

## 3) Reglas de Oro para Agentes (Antigravity / Cursor / IDE)

### 🚨 Regla #1: No rompas el Multi-tenant
*   Siempre filtra por `organization_id`.
*   Siempre inyecta `organization_id` en creaciones.
*   Verifica que el usuario tenga acceso a la organización y sucursal.

### 🛡️ Regla #2: Estabilidad sobre Velocidad
*   Atlas maneja dinero y operaciones críticas. Un error en caja detiene un negocio.
*   Prueba los flujos de error (pagos fallidos, stock insuficiente).

### 🧩 Regla #3: Pensar en "Motores", no en Casos de Uso
*   ❌ Mal: Crear tabla `taller_ordenes`.
*   ✅ Bien: Usar o extender `sales_orders` con un `type="WORK_ORDER"` y atributos JSON.
*   Buscamos core agnóstico + configuración específica.

---

## 4) Stack & Estructura
*   **Backend**: FastAPI 0.127 + SQLAlchemy 2.0 + Pydantic v2.
*   **Frontend**: React 18 SPA + TypeScript + Vite + Tailwind CSS + Zustand. Estado global en stores (`authStore`, `posStore`). API calls via capa tipada en `frontend/src/api/` (18 archivos).
*   **DB**: PostgreSQL.

### Ubicación de Archivos

| Capa | Path | Contenido |
|------|------|-----------|
| Backend core | `app/core/` | Seguridad, Auth, Database, Role permissions |
| Backend routers | `app/routers/` | Endpoints API (`/api/*`) |
| Backend models | `app/models/` | Modelos SQLAlchemy ORM |
| Backend schemas | `app/schemas/` | DTOs Pydantic |
| Frontend pages | `frontend/src/pages/` | Componentes React por dominio |
| Frontend API | `frontend/src/api/` | Clientes Axios tipados (18 archivos) |
| Frontend stores | `frontend/src/store/` | Zustand: `authStore.ts`, `posStore.ts` |
| Frontend components | `frontend/src/components/` | Layout, POS, UI compartidos |

> **Nota sobre permisos duales:** El backend (`role_permissions.py`) aún usa nombres de template `.html` como identificadores abstractos de permisos. El frontend los mapea a rutas React via `ROLE_ROUTES` en `Sidebar.tsx`. Ambos deben mantenerse sincronizados.

---

## 5) Workflow de Desarrollo
1.  **Leer Contexto**: Revisa `README.md` y `ARCHITECTURE.md` antes de empezar.
2.  **Planear**: Define qué motores tocarás.
3.  **Ejecutar**: Cambios incrementales.
4.  **Verificar**: Asegura que Atlas POS siga funcionando.
