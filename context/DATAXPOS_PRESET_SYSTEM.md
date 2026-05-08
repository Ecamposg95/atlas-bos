# TASKPACK — DataXPOS Preset System

## 🎯 Objetivo del Sistema

**DataXPOS** es un preset de alto rendimiento para punto de venta (POS) dentro de Atlas ERP. Implementa:
- Sistema de permisos basado en roles (7 roles diferentes)
- Navegación dinámica según rol y contexto
- Dashboard moderno con KPIs en tiempo real
- 12 módulos core especializados para retail

## 📋 Arquitectura Core

### Componentes Principales

```
DataXPOS Preset
├── Role Permissions — Backend (app/core/role_permissions.py)
│   ├── DATAXPOS_ROLE_VIEWS: Matriz rol → permisos (keys legacy .html)
│   ├── TEMPLATE_METADATA: Label, icon, URL de cada permiso
│   └── get_dataxpos_nav(): Genera navegacion dinamica
├── Role Routes — Frontend (frontend/src/components/layout/Sidebar.tsx)
│   ├── ROLE_ROUTES: Matriz rol → rutas React permitidas
│   └── ALL_NAV: 53 items de navegacion con grupos y orden
├── Dashboard React (frontend/src/pages/pos/DataXPOS.tsx)
│   ├── KPIs: Ventas, transacciones, ticket promedio, alertas
│   ├── Tabla de operaciones recientes
│   └── Quick Launcher: Acceso rapido a modulos permitidos
├── Preset Configuration (scripts/add_dataxpos_preset.py)
│   └── 12 modulos: core, pos, cash_management, inventory, etc.
└── Integration (app/main.py catch-all → React SPA)
    ├── React Router: / → /dataxpos via <Navigate>
    └── Backend: role_permissions.py aun provee nav via API
```

> **Nota:** El backend `role_permissions.py` usa nombres de template `.html` como identificadores abstractos de permisos (legacy). El frontend mapea estos a rutas React via `ROLE_ROUTES` en `Sidebar.tsx`. Ambos deben mantenerse sincronizados.

## 👥 Roles y Permisos

### Matriz de Acceso

| Rol | Contexto | Templates | Descripción |
|-----|----------|-----------|-------------|
| **ADMINISTRADOR** | HQ | 24 | Acceso total: catálogo maestro, usuarios, command center, reportes globales |
| **DUEÑO** | HQ | 14 | Vista reducida: catálogo, clientes, inventario, log ventas |
| **GERENTE** | Branch | 8 | POS completo, reportes sucursal, cortes de caja |
| **CAJERO** | Branch | 9 | POS, ventas, configuración impresora, buzón móvil |
| **VENDEDOR** | Mobile | 6 | Dashboard móvil, venta móvil, consulta productos |
| **SOPORTE_OPERATIVO** | Mobile | 5 | Solo consulta (sin venta), dashboard móvil |
| **CLIENTE** | Portal | 2 | Portal de clientes, vista de pedidos |

### Paginas Clave por Rol

**ADMINISTRADOR** (HQ):
- `pages/core/AdminCatalog.tsx` → `/admin/catalog` — Catalogo Maestro
- `pages/hq/HQOperations.tsx` → `/hq/operations` — Centro de Mando
- `pages/hq/HQBranches.tsx` → `/hq/branches` — Gestion Sucursales
- `pages/core/Users.tsx` → `/users` — Administracion Usuarios
- `pages/core/Organization.tsx` → `/organization` — Configuracion Empresa

**GERENTE/CAJERO** (Branch):
- `pages/pos/POS.tsx` → `/pos` — Terminal de Venta
- `pages/finance/CashHistory.tsx` → `/cash-history` — Cortes de Caja
- `pages/sales/SalesHistory.tsx` → `/sales` — Historial Ventas
- `pages/finance/Reports.tsx` → `/reports` — Reportes Sucursal (solo GERENTE)

**VENDEDOR** (Mobile):
- `pages/mobile/MobileSales.tsx` → `/mobile/sales` — Venta Movil
- `pages/mobile/MobileQuery.tsx` → `/mobile/query` — Consulta Productos
- `pages/mobile/MobileDashboard.tsx` → `/mobile/dashboard` — Dashboard Movil

### Paginas Universales

Todos los roles tienen acceso a:
- `pages/pos/DataXPOS.tsx` → `/dataxpos` — Dashboard principal
- `pages/hr/HRMe.tsx` → `/hr/me` — Expediente personal
- `/` redirige automaticamente a `/dataxpos` via React Router

## 🧩 Módulos Habilitados

```python
DATAXPOS_MODULES = [
    "core",                        # Sistema base
    "pos",                         # Punto de venta
    "cash_management",             # Gestión de caja
    "inventory",                   # Inventario
    "catalog",                     # Catálogo de productos
    "branch_catalog_enablement",   # Habilitación por sucursal
    "returns",                     # Devoluciones
    "pricing",                     # Gestión de precios
    "promotions",                  # Promociones
    "payments",                    # Métodos de pago
    "crm",                         # CRM básico
    "reports"                      # Reportería
]
```

## 🔄 Flujo de Datos del Dashboard

### 1. Inicializacion

```typescript
// DataXPOS.tsx — al montar el componente
// El authStore ya tiene user, org, branch desde el login
const { user, organizationId } = useAuthStore()

// Fetch KPIs y operaciones recientes via useEffect
useEffect(() => {
  reportsApi.getCommandCenterStats().then(setStats)
  salesApi.list({ limit: 5 }).then(setSales)
}, [])
```

### 2. KPIs y Metricas

```
GET /api/reports/command-center/stats
→ Response: {
    global: {
        total_sales: 150000.00,
        total_tickets: 1250,
        ticket_average: 120.00
    },
    alerts: [
        { type: "CRITICAL", message: "Stock bajo en Producto X" }
    ]
}
```

### 3. Operaciones Recientes

```
GET /api/sales/?limit=5
→ Response: {
    items: [
        { id: "uuid", folio: 12345, series: "A", total_amount: 1500.00,
          status: "PAID" | "PENDING" | "CANCELLED", branch_id: 1 }
    ],
    total: N
}
```

### 4. Navegacion Dinamica

La navegacion se construye client-side en `Sidebar.tsx`:

```typescript
// ROLE_ROUTES filtra ALL_NAV segun el rol del usuario
const allowedRoutes = ROLE_ROUTES[user.role] || []
const navItems = ALL_NAV.filter(item => allowedRoutes.includes(item.url))
// Se agrupan por item.group y ordenan por item.sort
```

## Caracteristicas del Dashboard (`DataXPOS.tsx`)

### KPIs Principales

1. **Flujo de Caja (Mes)**: Total de ventas del mes actual
2. **Transacciones**: Numero total de tickets
3. **Ticket Promedio**: Promedio de venta por transaccion
4. **Alertas Stock**: Productos con stock bajo/critico

Renderizados con componentes `<DaxCard>` del sistema de UI compartido.

### Tabla de Operaciones

- Ultimas 5 ventas
- Columnas: Hash ID, Origen (sucursal), Importe, Estado
- Estados con colores Tailwind:
  - `PAID` → `emerald` (verde)
  - `PENDING` → `amber` (amarillo)
  - `CANCELLED` → `red` (rojo)

### Context Switcher (Solo Admin)

```
POST /api/auth/context/switch
Body: { branch_id: 123 }
→ Redirige a /pos con contexto de cajero
```

## 🔧 Integración con el Sistema

### 1. Navegacion Frontend (fuente de verdad activa)

**Archivo**: `frontend/src/components/layout/Sidebar.tsx`

```typescript
// ROLE_ROUTES define que rutas ve cada rol
const ROLE_ROUTES: Record<string, string[]> = {
  ADMINISTRADOR: ['/hq/operations', '/admin/catalog', '/users', ...],
  CAJERO: ['/pos', '/cash-history', '/sales', '/products', ...],
  // ...
}

// ALL_NAV (53 items) provee label, icon, url, group, sort
// El Sidebar filtra ALL_NAV segun ROLE_ROUTES[user.role]
```

### 2. Redireccion Automatica

**Frontend**: `App.tsx` — React Router redirige `/` → `/dataxpos` via `<Navigate>`.

**Backend**: `app/main.py` catch-all sirve `frontend/dist/index.html` para cualquier ruta no-API, delegando todo el routing a React Router.

### 3. Validacion de Permisos (Backend)

**Archivo**: `app/core/role_permissions.py`

```python
# Verificar si un rol puede acceder (usa keys .html legacy como IDs)
can_access_template(role: Role, template_name: str) -> bool

# Obtener permisos de un rol
get_allowed_templates(role: Role) -> list[str]

# Generar navegacion dinamica (respuesta API)
get_dataxpos_nav(role: Role) -> list[dict]
```

> El frontend no depende de estas funciones para la navegacion — usa `ROLE_ROUTES` directamente. Estas funciones backend se mantienen para validacion server-side y compatibilidad.

## 🚀 Scripts de Inicialización

### Crear/Actualizar Preset

```bash
python scripts/add_dataxpos_preset.py
```

**Funcionalidad**:
1. Verifica si el preset existe en la DB
2. Si existe: actualiza módulos si hay cambios
3. Si no existe: crea nuevo preset con 12 módulos
4. Marca como `is_system=True`

### Asignar Preset a Organización

```bash
python scripts/set_dataxpos_preset.py
```

### Vincular Organización

```bash
python scripts/link_dataxpos.py
```

## 📝 Reglas de Negocio

### Permisos

1. **Validación Backend**: Siempre validar permisos en el servidor, no confiar solo en UI
2. **Multi-tenancy Python-side**: Aislamiento de datos por `organization_id` + `branch_id` (no hay RLS en PostgreSQL)
3. **JWT Claims**: Token incluye `role`, `branch_id`, `user_id`

### Navegacion

1. **Rutas sin entrada directa en Sidebar**: `/dataxpos` esta fijada como home para roles no-HQ; `/login` y `/` no aparecen en nav
2. **Portal de Clientes**: Solo accesible para rol `CLIENTE` (`/portal`)
3. **Context Switcher**: Solo visible para `ADMINISTRADOR` en contexto HQ

### Contextos

| Rol | Contexto Requerido | Puede Cambiar |
|-----|-------------------|---------------|
| ADMINISTRADOR | HQ | ✅ Sí (a Branch) |
| DUEÑO | HQ | ❌ No |
| GERENTE | BRANCH | ❌ No |
| CAJERO | BRANCH | ❌ No |
| VENDEDOR | MOBILE | ❌ No |
| SOPORTE_OPERATIVO | MOBILE | ❌ No |
| CLIENTE | Portal | ❌ No |

## 🛠️ Cómo Extender el Sistema

### Agregar Nuevo Rol

1. **Definir en modelo** (`app/models/users.py`):
```python
class Role(str, Enum):
    NUEVO_ROL = "NUEVO_ROL"
```

2. **Backend — Agregar permisos** (`app/core/role_permissions.py`):
```python
DATAXPOS_ROLE_VIEWS = {
    Role.NUEVO_ROL: [
        "pagina1.html",  # keys legacy, usados como IDs abstractos
        "dataxpos.html",
    ]
}
ROLE_CONTEXT_REQUIREMENTS = {
    Role.NUEVO_ROL: "BRANCH"  # o "HQ" o "MOBILE"
}
```

3. **Frontend — Agregar rutas** (`frontend/src/components/layout/Sidebar.tsx`):
```typescript
ROLE_ROUTES['NUEVO_ROL'] = ['/ruta1', '/dataxpos']
```

4. **Frontend — Agregar tipo** (`frontend/src/types/auth.ts`):
```typescript
type Role = '...' | 'NUEVO_ROL'
```

### Agregar Nueva Pagina

1. **Crear componente React** en `frontend/src/pages/<dominio>/NuevaPagina.tsx`

2. **Agregar ruta** en `frontend/src/App.tsx`:
```tsx
const NuevaPagina = lazy(() => import('./pages/<dominio>/NuevaPagina'))
// Dentro de las Routes:
<Route path="nueva-pagina" element={<NuevaPagina />} />
```

3. **Agregar al sidebar** en `frontend/src/components/layout/Sidebar.tsx`:
```typescript
// En ALL_NAV:
{ label: 'Nueva Pagina', icon: 'fa-solid fa-star', url: '/nueva-pagina', group: 'Grupo', sort: N }
// En ROLE_ROUTES, agregar '/nueva-pagina' a los roles que deben verla
```

4. **Backend (opcional)** — Agregar metadata en `role_permissions.py`:
```python
TEMPLATE_METADATA["nueva_pagina.html"] = {
    "label": "Nueva Pagina", "icon": "fa-star", "url": "/nueva-pagina"
}
# Agregar a DATAXPOS_ROLE_VIEWS para los roles relevantes
```

### Agregar Nuevo Modulo

1. **Actualizar lista** (`scripts/add_dataxpos_preset.py`):
```python
DATAXPOS_MODULES = [
    # ... modulos existentes
    "nuevo_modulo"
]
```

2. **Ejecutar script**:
```bash
python scripts/add_dataxpos_preset.py
```

3. **Implementar logica** en backend + crear pagina React correspondiente

## 🔍 Debugging y Troubleshooting

### Problema: Usuario no ve paginas esperadas en sidebar

**Verificar**:
1. Rol del usuario en DB: `SELECT role FROM users WHERE id = X`
2. Rutas del rol en `ROLE_ROUTES` en `Sidebar.tsx`
3. Que la ruta existe en `ALL_NAV` con label/icon/group correctos
4. Permisos backend en `DATAXPOS_ROLE_VIEWS[role]` (para validacion API)

### Problema: Dashboard no carga KPIs

**Verificar**:
1. Endpoint `/api/reports/command-center/stats` responde OK
2. Estructura de respuesta coincide con esperado
3. Console del navegador (React DevTools) para errores
4. Network tab: verificar que el token JWT se envia correctamente

### Problema: Sidebar vacio o sin items

**Verificar**:
1. `user.role` en `authStore` coincide con un key en `ROLE_ROUTES`
2. `ALL_NAV` tiene entries con URLs que coincidan con `ROLE_ROUTES[role]`
3. El componente `Sidebar.tsx` recibe el user del store correctamente

## 📚 Referencias Rápidas

### Archivos Clave

- **Permisos backend**: `app/core/role_permissions.py`
- **Navegacion frontend**: `frontend/src/components/layout/Sidebar.tsx` (`ROLE_ROUTES`, `ALL_NAV`)
- **Dashboard**: `frontend/src/pages/pos/DataXPOS.tsx`
- **Router frontend**: `frontend/src/App.tsx`
- **Preset Init**: `scripts/add_dataxpos_preset.py`
- **Main backend**: `app/main.py` (catch-all → React SPA)

### Endpoints API

- `GET /api/users/me/context` - Contexto y permisos del usuario
- `GET /api/reports/command-center/stats` - KPIs globales
- `GET /api/sales/?limit=N` - Operaciones recientes
- `POST /api/auth/context/switch` - Cambiar contexto (admin only)
- `GET /api/branches/` - Lista de sucursales

### Funciones Útiles

```python
# Verificar acceso
can_access_template(role, "pos.html") -> bool

# Obtener templates permitidos
get_allowed_templates(Role.CAJERO) -> list[str]

# Generar navegación
get_dataxpos_nav(Role.GERENTE) -> list[dict]

# Obtener contexto requerido
get_required_context(Role.VENDEDOR) -> "MOBILE"
```

## ⚡ Comandos Rápidos

```bash
# Inicializar preset
python scripts/add_dataxpos_preset.py

# Asignar a organización
python scripts/set_dataxpos_preset.py

# Verificar roles en DB
psql -d postgres -c "SELECT username, role FROM users;"

# Ver templates de un rol
python -c "from app.core.role_permissions import *; print(DATAXPOS_ROLE_VIEWS[Role.CAJERO])"
```

---

**Ultima actualizacion**: 2026-04-15  
**Version**: 2.0 (migrado a React SPA)  
**Autor**: Atlas ERP Team
