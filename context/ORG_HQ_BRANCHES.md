# ORG_HQ_BRANCHES.md — Task Pack: Estructura de Organización, HQ y Sucursales

> **Versión**: 1.0 | **Fecha**: 2026-03-07
> Este documento define el modelo conceptual y las reglas de negocio para la arquitectura multi-nivel del sistema Atlas BOS.
> Es una fuente de verdad de diseño: cualquier decisión técnica sobre tenancy, scope y visibilidad debe ser consistente con lo aquí definido.

---

## 1. Objetivo

Implementar y dejar consistente la arquitectura multi-tenant del sistema, distinguiendo claramente entre:

- **Organización** — contenedor raíz del negocio
- **HQ / Centro de mando** — nodo de gobierno y control
- **Sucursales** — unidades operativas locales
- **Bodegas / Almacenes** — unidades logísticas
- **Usuarios por alcance** — scope vinculado al nivel
- **Visibilidad de datos por nivel** — RBAC + tenancy combinados

El sistema **no** se modela como una tienda plana. Es una jerarquía donde una organización puede tener múltiples unidades operativas y un nodo central de control.

---

## 2. Jerarquía Conceptual

```
┌──────────────────────────────────────────────────────┐
│                    ORGANIZACIÓN                      │
│  (identidad fiscal, config global, reglas operativas)│
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │              HQ / Centro de Mando           │    │
│  │  (gobierno, supervisión, configuración)     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Sucursal A │  │  Sucursal B │  │  Sucursal C │ │
│  │  (operación)│  │  (operación)│  │  (operación)│ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │              Bodega / Almacén                 │  │
│  │  (logística, surtido, inventario centralizado)│  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 3. Definición de Cada Nivel

### 3.1 Organización

La organización es la entidad principal del negocio. Es el **tenant** en el sentido multi-tenant.

**Ejemplos:**
- RMAZH Comercializadora
- BJX Motors
- Atlas Tech Retail Group

**Contiene:**
- Identidad comercial y fiscal (RFC, razón social)
- Configuración general y branding
- Usuarios globales
- HQ
- Sucursales
- Bodegas
- Reglas operativas
- Toda la operación vinculada (inventario, ventas, personas)

> La organización es el **contenedor superior** de todo. Nada existe fuera de una organización.

**Implementación actual:** Modelo `Organization` en `app/models/organization.py`.
El campo `hq_branch_id` apunta al branch designado como HQ.

---

### 3.2 HQ / Centro de Mando

El HQ **no es forzosamente una sucursal física**. Puede ser:

- Un espacio operativo
- Una plataforma administrativa
- Una capa lógica del sistema
- Un centro de mando virtual
- Una oficina central física o híbrida, si aplica

**Su función real:** Concentrar el **gobierno y control** de la organización.

**El HQ puede fungir como:**
- Centro administrativo maestro
- Nodo de monitoreo global
- Punto de configuración
- Capa de supervisión
- Consola de control inter-sucursales
- Centro de decisión sobre inventario, usuarios, permisos y visibilidad

> ⚠️ **IMPORTANTE:** El HQ **no debe modelarse obligatoriamente** como una sucursal tradicional con flujo de caja, punto de venta o atención al público.

**Puede existir como:**
- Entidad lógica especial dentro de la organización
- Branch especial de tipo `HQ` (ver `BranchType.HQ` en `organization.py`)
- Workspace administrativo sin operación comercial directa

**Alcances del HQ:**
| Capacidad | Disponible |
|-----------|-----------|
| Configuración global | ✅ |
| Administración de sucursales | ✅ |
| Administración de bodegas | ✅ |
| Usuarios globales | ✅ |
| Catálogos globales | ✅ |
| Reglas de inventario | ✅ |
| Transferencias inter-sucursal | ✅ |
| Reportes consolidados | ✅ |
| Dashboards de toda la organización | ✅ |
| Habilitación/deshabilitación de productos por sucursal | ✅ |
| Punto de venta directo | ⚠️ Opcional / condicional |
| Caja propia | ⚠️ Opcional / condicional |

**Implementación actual:** `BranchType.HQ` en el enum `BranchType`.
Campo `is_headquarters = True` en `Branch` (deprecated, usar `branch_type`).
Los usuarios sin `branch_id` (branch_id = None) se interpretan como usuarios HQ/globales.

---

### 3.3 Sucursal

La sucursal es una **unidad operativa** del negocio.

**Ejemplos:**
- Sucursal Centro
- Sucursal Tuxpan
- Sucursal Valle
- Sucursal Victoria

**Cada sucursal puede tener:**
- Caja propia
- Ventas locales
- Inventario local (`StockOnHand` por `branch_id`)
- Usuarios locales (asignados con `branch_id`)
- Clientes
- Movimientos de inventario
- Transferencias
- Reglas operativas específicas

> A diferencia del HQ, la sucursal **sí representa una operación local** con flujo comercial propio.

**Implementación actual:** Modelo `Branch` con `branch_type = BranchType.STORE`.
Todo el stock, ventas y movimientos se filtran por `branch_id`.

---

### 3.4 Bodega / Almacén

La bodega es una **unidad logística**, no necesariamente un punto de venta.

**Puede pertenecer a:**
- La organización (bodega central)
- Una sucursal (bodega auxiliar)
- El HQ (bodega maestra)
- Una red logística transversal

**Sirve para:**
- Almacenar inventario
- Surtir sucursales
- Centralizar stock
- Controlar entradas, salidas y transferencias

**Implementación actual:** `BranchType.WAREHOUSE` en el enum. No existe aún un modelo dedicado de bodega separado de Branch. Usar Branch con `branch_type = WAREHOUSE` y `can_sell = False`.

---

## 4. Diferencia Conceptual Crítica

| Nivel | Razón de existir | Operación comercial | Inventario |
|-------|-----------------|---------------------|-----------|
| **HQ** | Administrar, supervisar, orquestar | ❌ No (por defecto) | 🔍 Visibilidad global |
| **Sucursal** | Vender, cobrar, atender, operar caja | ✅ Sí | 📦 Stock local propio |
| **Bodega** | Resguardar y distribuir inventario | ❌ No | 📦 Stock centralizado |

---

## 5. Reglas de Negocio No Negociables

### A. Toda sucursal pertenece a una organización
No puede haber sucursales huérfanas. Siempre `branch.organization_id` es requerido.

### B. El HQ pertenece a la organización y funge como centro maestro
El HQ puede ver y gestionar toda la operación de la organización. Es el único nivel con visibilidad 360°.

### C. HQ ≠ Sucursal (semánticamente)
Aunque técnicamente pueda modelarse como una entidad similar a Branch, a nivel de negocio tiene semántica distinta. No hereda automáticamente los flujos de caja ni el scope restringido de una sucursal.

### D. Los usuarios deben tener alcance definido
No basta con el rol. Deben tener scope organizacional claro:

| Tipo de usuario | `branch_id` | Visibilidad |
|----------------|-------------|-------------|
| HQ / Global (DUEÑO, ADMINISTRADOR sin branch) | `None` | Global: toda la organización |
| Gerente de sucursal | `branch_id` asignado | Local: solo su sucursal |
| Cajero | `branch_id` asignado | Restringido: operación de su branch |

### E. Toda consulta debe filtrar por tenant
Nada debe mezclarse entre organizaciones. El `organization_id` debe estar presente en **cada query de negocio**.

---

## 6. Reglas de Visibilidad de Productos

### Caso 1: Producto creado en Sucursal
- Queda activo en **esa sucursal** (se crea `ProductBranchStatus` con `is_active_pos=True` para su `branch_id`)
- HQ puede supervisarlo
- **No impacta automáticamente** a las demás sucursales
- Implementación: `create_product` detecta `current_user.branch_id` y crea el status solo para esa sucursal

### Caso 2: Producto creado desde HQ
- Puede ser **global** (asignado a todas las sucursales) o a **sucursales específicas**
- El HQ define el alcance vía `target_branch_ids`
- Implementación: Si `current_user.branch_id = None` y `target_branch_ids` viene en el payload, se usan esos. Si no hay `target_branch_ids` → error 400 (HQ debe elegir alcance)

### Caso 3: Importación masiva desde HQ
Al hacer una carga masiva (CSV/Excel) desde el centro de mando, debe preguntarse el alcance:

| Opción de alcance | Descripción |
|-------------------|-------------|
| `ALL_BRANCHES` | Habilitar en todas las sucursales activas |
| `SELECTED_BRANCHES` | Selección manual de sucursales objetivo |
| `HQ_ONLY` | Solo disponible en HQ (si puede vender) |
| `HQ_AND_SELECTED` | HQ + unidades específicas |

---

## 7. Modelo de Datos Actual vs. Modelo Objetivo

### Estado actual (`organization.py`)

```python
class BranchType(str, enum.Enum):
    HQ        = "HQ"        # Centro de mando
    STORE     = "STORE"     # Sucursal operativa
    WAREHOUSE = "WAREHOUSE" # Bodega logística
    OFFICE    = "OFFICE"    # Oficina (sin venta)

class Branch(Base, TenantMixin):
    branch_type    = Column(Enum(BranchType), default=BranchType.STORE)
    can_sell       = Column(Boolean, default=True)
    is_headquarters = Column(Boolean, default=False)  # ← DEPRECADO, usar branch_type

class Organization(Base):
    hq_branch_id = Column(Integer, ForeignKey("branches.id"))  # Puntero al HQ
```

### Gaps identificados

| Gap | Impacto | Acción requerida |
|-----|---------|-----------------|
| `is_headquarters` field duplica info de `branch_type = HQ` | Confusión, inconsistencia | Deprecar `is_headquarters`, migrar a `branch_type` |
| No existe relación `Organization → branches` (1:N) | No se puede consultar "todas las sucursales de la org" directamente | Agregar `relationship("Branch", ...)` en `Organization` |
| `Branch` no tiene flag `is_virtual` | No hay forma de marcar HQ como nodo lógico puro | Agregar campo `is_virtual: bool` |
| `WAREHOUSE` no distingue si pertenece a una sucursal o es central | Ambigüedad logística | Agregar `parent_branch_id: Optional[int]` en Branch |

---

## 8. Scope de Usuarios — Implementación

### Lógica de scope en queries

```python
# Patrón estándar para toda query de datos de negocio:

def get_user_scope(current_user: User) -> dict:
    """Retorna los filtros de scope para un usuario dado."""
    return {
        "organization_id": current_user.organization_id,
        "branch_id": current_user.branch_id,  # None = HQ/Global
        "is_hq": current_user.branch_id is None
    }

# En cualquier router:
scope = get_user_scope(current_user)
if not scope["is_hq"]:
    query = query.filter(Model.branch_id == scope["branch_id"])
```

### JWT Claims requeridos
El token JWT debe contener:
- `user_id`
- `organization_id`
- `branch_id` (puede ser `null` para HQ)
- `role`
- `context_type` → `"HQ"` | `"BRANCH"` | `"MOBILE"`

---

## 9. Alcances Funcionales por Nivel (Quick Reference)

### Nivel HQ / Centro de mando
```
✅ Configuración global de la organización
✅ CRUD de sucursales y bodegas
✅ CRUD de usuarios globales
✅ Catálogos globales (productos, precios, categorías)
✅ Habilitación/deshabilitación de productos por sucursal (Matriz Comercial)
✅ Transferencias inter-sucursal
✅ Reportes consolidados (todas las sucursales)
✅ Dashboards organizacionales
✅ Importaciones masivas con alcance configurable
⚠️ POS / Caja: Solo si el HQ tiene can_sell=True
```

### Nivel Sucursal
```
✅ Ventas locales (POS)
✅ Gestión de caja (apertura, corte, cierre)
✅ Clientes locales
✅ Inventario asignado (StockOnHand local)
✅ Usuarios locales
✅ Operación diaria
✅ Importar productos (scope: solo su sucursal)
❌ Modificar configuración global
❌ Ver datos de otras sucursales
❌ Crear/editar usuarios de otras sucursales
```

### Nivel Bodega
```
✅ Control de existencias
✅ Entradas de mercancía
✅ Salidas hacia sucursales
✅ Transferencias
✅ Surtido a sucursales
❌ Ventas directas al público
❌ Flujo de caja
```

---

## 10. Relación con Módulos del Sistema

| Módulo | HQ | Sucursal | Bodega |
|--------|-----|---------|--------|
| `catalog` / Products | ✅ Global | ✅ Local (filtrado) | ❌ |
| `inventory` / StockOnHand | 👁️ Read-all | ✅ CRUD local | ✅ CRUD local |
| `sales` / Transacciones | 👁️ Reportes | ✅ Operación | ❌ |
| `cash` / Caja | ❌ / 👁️ | ✅ Operación | ❌ |
| `commercial` / Matriz sucursales | ✅ Admin | 👁️ Solo vista | ❌ |
| `transfers` / Transferencias | ✅ Iniciar/aprobar | ✅ Recibir/enviar | ✅ |
| `reports` | ✅ Consolidado | ✅ Local | ❌ |
| `users` / Gestión | ✅ Global | ✅ Local | ❌ |

> Leyenda: ✅ Acceso completo | 👁️ Solo lectura / supervisión | ❌ Sin acceso

---

## 11. Issues de Implementación Conocidos

Ver también análisis en `00_CONTEXT_START_HERE.md`.

| # | Issue | Severidad | Área |
|---|-------|-----------|------|
| 1 | `is_headquarters` deprecado pero activo en código | 🟡 | `models/organization.py` |
| 2 | Usuarios HQ identificados por `branch_id = None` (implícito, no explícito) | 🟡 | `models/users.py` |
| 3 | No hay relación `Organization → List[Branch]` | 🟡 | `models/organization.py` |
| 4 | `WAREHOUSE` no puede indicar si pertenece a una sucursal padre | 🟡 | `models/organization.py` |
| 5 | Queries de KPI globales hacen cross join sin JOIN explícito | 🔴 | `routers/products.py` |
| 6 | Importación masiva no tiene selector de alcance por sucursal | 🟠 | `routers/products.py` |

---

## 12. Glosario

| Término | Definición |
|---------|-----------|
| **Organización** | Tenant raíz. El negocio completo. |
| **HQ** | Centro de mando / nodo de gobierno. Puede ser físico, híbrido o virtual. |
| **Sucursal** | Unidad operativa local con POS, caja e inventario propio. |
| **Bodega** | Unidad logística sin venta directa. |
| **Scope** | Alcance de visibilidad de un usuario (global u org-id + branch-id). |
| **TenantMixin** | Clase base que agrega `organization_id` a todos los modelos de negocio. |
| **branch_type** | Enum que distingue HQ / STORE / WAREHOUSE / OFFICE en el modelo Branch. |
| **ProductBranchStatus** | Tabla matricial que define la disponibilidad comercial de un SKU por sucursal. |
| **StockOnHand** | Stock físico de una variante en una sucursal específica. |
| **target_branch_ids** | Lista de branch IDs objetivo al crear/importar productos desde HQ. |
