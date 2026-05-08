# ATLAS ONE / ATLAS BOS CONTEXT PACK v2

Documento maestro reestructurado para transformar el repositorio actual del POS en una plataforma modular tipo suite, usando **Atlas One** como nombre comercial, **Atlas BOS** como definición técnica/enterprise y **Atlas POS** como preset ligero de entrada.

---

## 1. Decisión estratégica de naming

La arquitectura de marca queda definida así:

```txt
Atlas One = nombre comercial principal
Atlas BOS = definición técnica / enterprise / arquitectura
Atlas POS = preset ligero y popular de entrada
```

### 1.1 Atlas One

**Atlas One** será el nombre comercial principal. Debe usarse en ventas, marketing, redes sociales, landing pages, presentaciones comerciales, demos con clientes y narrativa de producto.

Definición comercial:

> Atlas One es la suite todo-en-uno para operar, vender, controlar y escalar negocios físicos desde una sola plataforma.

Atlas One debe comunicar simplicidad, integración y crecimiento. El cliente no necesita entender desde el primer contacto qué es un BOS, qué es multi-tenant o qué significa API-First. Para el cliente, Atlas One debe sentirse como una sola plataforma para manejar su negocio.

### 1.2 Atlas BOS

**Atlas BOS** será la definición técnica, arquitectónica y enterprise. BOS significa **Business Operating System**.

Definición técnica:

> Atlas BOS es el Business Operating System que soporta Atlas One: una arquitectura modular, API-First, multi-tenant y extensible para operar distintos tipos de negocio desde un mismo core.

Atlas BOS debe usarse en documentación técnica, repositorio, arquitectura, pitch con inversionistas, clientes enterprise, integraciones, roadmaps y comunicación con desarrolladores.

### 1.3 Atlas POS

**Atlas POS** será el preset más ligero, popular y de entrada dentro de Atlas One.

Definición comercial:

> Atlas POS es el punto de entrada a Atlas One: una solución ligera para vender, cobrar, controlar caja, administrar productos y consultar inventario básico desde el primer día.

Atlas POS reemplaza a DataX POS como nombre comercial principal. El código actual del POS se usará como base histórica para construir Atlas POS, pero la marca DataX dejará de ser la referencia principal.

---

## 2. Jerarquía de producto

```txt
Atlas One
Suite comercial todo-en-uno
│
├── Atlas POS
│   └── Preset ligero de punto de venta
│
├── Atlas One Retail
│   └── Retail, stock, compras y proveedores
│
├── Atlas One Beauty
│   └── Agenda, servicios, profesionales, comisiones y membresías
│
├── Atlas One Gastro
│   └── POS, cocina, recetas, KDS, mermas y delivery
│
├── Atlas One CRM
│   └── Clientes, cotizaciones, seguimiento y oportunidades
│
├── Atlas One Stock
│   └── Inventario avanzado, almacenes, transferencias y costos
│
├── Atlas One AI
│   └── Copilotos, predicciones, automatizaciones y analítica inteligente
│
└── Atlas One Enterprise
    └── Integraciones, personalización, módulos avanzados y soporte consultivo

Powered by Atlas BOS
```

### Lectura correcta

- **Atlas One** es lo que compra y entiende el cliente.
- **Atlas POS** es el producto inicial más fácil de vender.
- **Atlas BOS** es el motor que permite modularidad, escalabilidad, multi-tenant, API-First e integraciones.

---

## 3. Nueva narrativa maestra

### Narrativa comercial

> Atlas One reúne punto de venta, inventario, clientes, caja, reportes y módulos especializados en una sola plataforma para que cualquier negocio físico pueda operar mejor desde el primer día.

### Narrativa técnica

> Atlas BOS es la arquitectura base de Atlas One: un Business Operating System modular, multi-tenant y API-First que centraliza entidades críticas como usuarios, sucursales, productos, inventario, ventas, pagos, clientes, permisos, auditoría y reportes.

### Narrativa enterprise

> Atlas One Enterprise, powered by Atlas BOS, permite diseñar operaciones a la medida mediante módulos activables, integraciones, permisos avanzados, analítica, automatización e inteligencia artificial.

### Frase estratégica

> Atlas One es la experiencia comercial todo-en-uno. Atlas BOS es el motor técnico. Atlas POS es la puerta de entrada.

---

## 4. Objetivo del nuevo repositorio

Se creará un nuevo repositorio a partir del código actual del POS, pero solo se clonará una vez. Ese nuevo repo será la base de la plataforma.

### Nombre recomendado del repositorio

```txt
atlas-bos
```

Justificación:

- El repo contiene el motor técnico, no solo el producto comercial.
- Atlas BOS es el concepto adecuado para backend, frontend, módulos, presets, migraciones, integraciones y arquitectura.
- Atlas One puede aparecer en README, documentación comercial y frontend como suite comercial.
- Atlas POS será un preset dentro del repo, no un repo separado.

### Alternativas aceptables

```txt
atlas-one-platform
atlas-business-os
atlas-platform
```

La recomendación final es **atlas-bos**.

---

## 5. Regla crítica de estrategia de código

No se deben clonar repositorios por vertical.

### No hacer

```txt
atlas-pos-retail
atlas-pos-beauty
atlas-pos-gastro
atlas-pos-pharmacy
atlas-pos-restaurant
```

Esto genera deuda técnica:

- Bugs duplicados.
- Migraciones inconsistentes.
- Diferencias de permisos.
- Interfaces divergentes.
- Inventario fragmentado.
- Caja y ventas con reglas distintas.
- Mayor costo de mantenimiento.

### Hacer

```txt
Core común + módulos activables + presets verticales + UI adaptable
```

El objetivo es construir una plataforma tipo Odoo, Zoho o NetSuite, pero más simple, ligera y enfocada a micronegocios físicos en México.

---

## 6. Evolución desde el POS actual

El sistema actual del POS debe entenderse como el antecedente funcional. No debe desecharse; debe transformarse.

### Antes

```txt
DataX POS = sistema de punto de venta completo
```

### Ahora

```txt
Atlas BOS = motor técnico modular
Atlas One = suite comercial
Atlas POS = preset ligero construido sobre Atlas BOS
```

### Decisión de migración conceptual

- Reemplazar el naming DataX POS por Atlas POS.
- Conservar la funcionalidad útil del POS actual.
- Refactorizar progresivamente hacia módulos.
- Separar lógica de negocio de templates/vistas.
- Convertir ventas, caja, productos e inventario en módulos reutilizables.
- Crear un sistema de presets para definir experiencia por tipo de negocio.

---

## 7. Stack técnico base

El stack objetivo es:

```txt
Backend: Python + FastAPI + SQLAlchemy 2.x
Database: PostgreSQL
Frontend: React + Vite + TypeScript
Arquitectura: API-First, modular, multi-tenant, low-latency
Deploy: Railway para backend/API y PostgreSQL gestionado
POS local: integración futura con agente local de impresión
```

### Principios técnicos

- API-First.
- Multi-tenant desde el diseño.
- Separación por módulos.
- Inventario basado en ledger de movimientos.
- Transacciones fuertes en ventas, inventario, compras y caja.
- Frontend adaptable por preset.
- Reutilización máxima del core.
- Bajo acoplamiento entre verticales.
- Auditoría operativa.
- Preparación para IA, webhooks e integraciones.

---

## 8. Arquitectura objetivo del repositorio

```txt
atlas-bos/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── security.py
│   │   │   ├── permissions.py
│   │   │   ├── tenant_context.py
│   │   │   ├── exceptions.py
│   │   │   └── audit.py
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── tenants/
│   │   │   ├── branches/
│   │   │   ├── users/
│   │   │   ├── customers/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── sales/
│   │   │   ├── payments/
│   │   │   ├── cash/
│   │   │   ├── purchasing/
│   │   │   ├── appointments/
│   │   │   ├── commissions/
│   │   │   ├── memberships/
│   │   │   ├── recipes/
│   │   │   ├── kds/
│   │   │   ├── crm/
│   │   │   ├── quotes/
│   │   │   ├── reports/
│   │   │   └── ai/
│   │   │
│   │   ├── presets/
│   │   │   ├── atlas_pos.py
│   │   │   ├── atlas_one_retail.py
│   │   │   ├── atlas_one_beauty.py
│   │   │   ├── atlas_one_gastro.py
│   │   │   ├── atlas_one_services.py
│   │   │   └── atlas_one_enterprise.py
│   │   │
│   │   └── main.py
│   │
│   ├── alembic/
│   ├── scripts/
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── core/
│   │   ├── shared/
│   │   ├── modules/
│   │   │   ├── pos/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── sales/
│   │   │   ├── cash/
│   │   │   ├── purchasing/
│   │   │   ├── appointments/
│   │   │   ├── kds/
│   │   │   ├── crm/
│   │   │   └── reports/
│   │   │
│   │   ├── presets/
│   │   │   ├── AtlasPOSPreset.ts
│   │   │   ├── AtlasOneRetailPreset.ts
│   │   │   ├── AtlasOneBeautyPreset.ts
│   │   │   ├── AtlasOneGastroPreset.ts
│   │   │   └── AtlasOneEnterprisePreset.ts
│   │   │
│   │   ├── router/
│   │   └── app.tsx
│   │
│   └── vite.config.ts
│
├── docs/
│   ├── architecture/
│   ├── product/
│   ├── modules/
│   ├── presets/
│   ├── agents/
│   └── decisions/
│
└── README.md
```

---

## 9. Core obligatorio de Atlas BOS

El core contiene capacidades que todos los presets necesitan, aunque cada uno las muestre de forma distinta.

### Core técnico

- Configuración central.
- Conexión PostgreSQL.
- SQLAlchemy session management.
- Manejo de migraciones.
- Seguridad.
- Autenticación.
- Autorización.
- Tenant context.
- Middleware.
- Logging.
- Auditoría.
- Healthcheck.
- Paginación.
- Filtros.
- Idempotencia.
- Manejo de errores.

### Core de negocio

- Tenants.
- Branches / sucursales.
- Users.
- Roles.
- Permissions.
- Customers.
- Products.
- Product variants.
- Units of measure.
- Inventory.
- Stock movements.
- Sales.
- Sale items.
- Payments.
- Cash sessions.
- Reports.
- Audit logs.
- Settings.

---

## 10. Módulos reutilizables

| Módulo | Propósito | Presets que lo usan |
| --- | --- | --- |
| auth | Login, sesiones, JWT, recuperación. | Todos |
| tenants | Empresas cliente y aislamiento. | Todos |
| branches | Sucursales, almacenes y puntos de venta. | Todos |
| users | Usuarios operativos y administrativos. | Todos |
| customers | Clientes, historial y datos de contacto. | POS, Retail, Beauty, Gastro, CRM |
| products | Productos, servicios, insumos, variantes. | Todos |
| inventory | StockOnHand y StockMovement. | POS, Retail, Beauty, Gastro, Stock |
| sales | Ventas, partidas, descuentos, totales. | POS, Retail, Beauty, Gastro |
| payments | Métodos de pago, referencias y conciliación. | Todos |
| cash | Apertura/cierre, arqueo y cortes. | POS, Retail, Gastro, Beauty |
| purchasing | Proveedores, órdenes y recepciones. | Retail, Stock, Gastro avanzado |
| appointments | Agenda y disponibilidad. | Beauty, Servicios, Clínicas |
| commissions | Comisiones por servicio/venta. | Beauty, Servicios, Retail avanzado |
| memberships | Paquetes, créditos y membresías. | Beauty, Fitness, Clínicas |
| recipes | Recetas/BOM, ingredientes y costeo. | Gastro, manufactura ligera |
| kds | Kitchen Display System. | Gastro |
| crm | Pipeline, seguimiento y oportunidades. | CRM, Retail avanzado, Servicios |
| quotes | Cotizaciones y propuestas. | Retail, Servicios, B2B |
| reports | KPIs y dashboards. | Todos |
| ai | Copilotos, predicciones y automatización. | Enterprise, módulos avanzados |

---

## 11. Preset principal: Atlas POS

Atlas POS debe ser el preset de entrada. Su objetivo es ser rápido, liviano, fácil de vender y fácil de implementar.

### 11.1 Propósito

> Permitir que un micronegocio empiece a vender, cobrar, controlar caja, registrar productos, imprimir tickets y revisar inventario básico desde el primer día.

### 11.2 Módulos activos por defecto

```json
{
  "preset": "atlas_pos",
  "commercial_name": "Atlas POS",
  "parent_suite": "Atlas One",
  "powered_by": "Atlas BOS",
  "enabled_modules": [
    "auth",
    "tenants",
    "branches",
    "users",
    "customers",
    "products",
    "sales",
    "payments",
    "cash",
    "inventory_basic",
    "tickets",
    "reports_basic"
  ],
  "disabled_modules": [
    "appointments",
    "commissions",
    "memberships",
    "recipes",
    "kds",
    "advanced_purchasing",
    "advanced_crm",
    "ai"
  ],
  "default_dashboard": "atlas_pos_dashboard",
  "ui_preset": "pos_lightweight"
}
```

### 11.3 Funciones que sí debe incluir en MVP

- Venta rápida.
- Búsqueda de productos.
- Escaneo de código de barras.
- Carrito.
- Descuentos simples.
- Métodos de pago.
- Impresión de ticket.
- Apertura y cierre de caja.
- Arqueo.
- Productos y categorías.
- Clientes básicos.
- Inventario básico.
- Reportes básicos.
- Usuarios y sucursal.

### 11.4 Funciones que NO debe incluir en MVP

- Compras avanzadas.
- Órdenes de compra complejas.
- KDS.
- Recetas.
- Agenda.
- Comisiones complejas.
- Membresías avanzadas.
- Producción.
- CRM avanzado.
- IA avanzada.
- Contabilidad completa.

### 11.5 Regla de producto

Atlas POS no debe convertirse en una base de código separada. Debe ser un preset configurado sobre Atlas BOS.

---

## 12. Presets verticales futuros

### 12.1 Atlas One Retail

Orientado a ferreterías, abarrotes, farmacias, papelerías, recauderías, refaccionarias y negocios con inventario de alta rotación.

Módulos principales:

- POS.
- Inventario avanzado.
- Compras.
- Proveedores.
- Unidades de medida.
- Stock min/max.
- Costo promedio.
- Kardex.
- Precios por volumen.
- Reportes de margen.

### 12.2 Atlas One Beauty

Orientado a barberías, estéticas, spas, estudios de uñas, clínicas de belleza y wellness.

Módulos principales:

- Agenda.
- Clientes.
- Servicios.
- Profesionales.
- Cabinas/sillas.
- Comisiones.
- Membresías.
- Paquetes.
- POS.
- Insumos.
- Recordatorios.

### 12.3 Atlas One Gastro

Orientado a cafeterías, dark kitchens, restaurantes pequeños, taquerías, food trucks y fast food.

Módulos principales:

- POS.
- Menú.
- Recetas.
- Ingredientes.
- KDS.
- Comandas.
- Mermas.
- Delivery.
- Tiempos de cocina.
- Costeo por platillo.

### 12.4 Atlas One Services

Orientado a negocios de servicios, talleres, consultorios, mantenimiento, soporte y operaciones con órdenes de trabajo.

Módulos principales:

- Clientes.
- Servicios.
- Órdenes de trabajo.
- Cotizaciones.
- Agenda.
- Técnicos.
- Comisiones.
- Reportes.

### 12.5 Atlas One Enterprise

Orientado a clientes más grandes, partners o implementaciones a la medida.

Módulos principales:

- Multi-sucursal avanzado.
- Permisos avanzados.
- Integraciones.
- IA.
- Dashboards ejecutivos.
- Automatizaciones.
- Auditoría avanzada.
- Soporte consultivo.

---

## 13. Multi-tenant y seguridad de datos

Atlas BOS debe ser multi-tenant desde el diseño. Cada empresa cliente opera dentro de un tenant aislado.

### Campos obligatorios en modelos operativos

```txt
tenant_id
branch_id cuando aplique
created_at
updated_at
created_by
updated_by
is_active
```

### Regla crítica

Nunca consultar recursos de negocio solo por `id`. Toda consulta debe incluir `tenant_id`.

Mal:

```python
db.query(Product).filter(Product.id == product_id).first()
```

Bien:

```python
db.query(Product).filter(
    Product.id == product_id,
    Product.tenant_id == current_user.tenant_id
).first()
```

### Feature flags por tenant

```json
{
  "tenant_id": "tenant_001",
  "commercial_suite": "atlas_one",
  "technical_core": "atlas_bos",
  "active_preset": "atlas_pos",
  "business_type": "retail",
  "enabled_modules": [
    "pos",
    "products",
    "sales",
    "payments",
    "cash",
    "inventory_basic",
    "reports_basic"
  ],
  "default_dashboard": "atlas_pos_dashboard",
  "ui_preset": "pos_lightweight"
}
```

---

## 14. Inventario como Stock Ledger

El inventario debe ser uno de los pilares más robustos de Atlas BOS.

No se debe depender únicamente de actualizar una columna `stock`. El sistema debe registrar cada movimiento.

### Entidades base

```txt
StockOnHand = estado actual materializado
StockMovement = historial transaccional de movimientos
```

### Tipos de movimiento

```txt
PURCHASE_RECEIPT
SALE
RETURN
ADJUSTMENT_IN
ADJUSTMENT_OUT
TRANSFER_IN
TRANSFER_OUT
WASTE
CONSUMPTION
PRODUCTION_IN
PRODUCTION_OUT
SERVICE_CONSUMPTION
RECIPE_CONSUMPTION
```

### Regla transaccional

Para cualquier operación que afecte inventario:

```txt
BEGIN TRANSACTION
1. Bloquear StockOnHand correspondiente.
2. Validar disponibilidad.
3. Crear StockMovement.
4. Actualizar StockOnHand.
5. Actualizar costo si aplica.
6. Confirmar operación relacionada.
COMMIT
```

En PostgreSQL se debe considerar row-level locking con `SELECT FOR UPDATE` en operaciones críticas.

---

## 15. Modelo de producto unificado

Para evitar duplicar modelos, el producto debe poder representar bienes físicos, servicios, platillos, membresías o bundles.

```txt
Product.type:
- PHYSICAL
- SERVICE
- MENU_ITEM
- INGREDIENT
- MEMBERSHIP
- BUNDLE
- SUPPLY
```

### Ejemplos

Retail:

```txt
Product.type = PHYSICAL
Ejemplo: Tornillo, shampoo, cable, medicamento
```

Beauty:

```txt
Product.type = SERVICE
Ejemplo: Corte, tinte, manicure
```

Gastro:

```txt
Product.type = MENU_ITEM
Ejemplo: Latte, hamburguesa, combo
```

Inventario de insumos:

```txt
Product.type = SUPPLY o INGREDIENT
Ejemplo: tinte, leche, café, guantes, vaso
```

---

## 16. Flujo comercial de expansión

La estrategia comercial debe permitir entrada baja y expansión progresiva.

```txt
Cliente inicia con Atlas POS
        ↓
Activa inventario avanzado
        ↓
Activa compras/proveedores
        ↓
Activa CRM/cotizaciones
        ↓
Activa vertical específico
        ↓
Activa IA / Enterprise / integraciones
```

Esto permite una ruta de upsell natural.

---

## 17. Plan de migración desde el código actual

### Fase 0: Respaldo

- Crear rama estable del POS actual.
- Documentar funcionalidades existentes.
- Identificar rutas, modelos, templates y dependencias.
- No romper producción actual.

### Fase 1: Renombramiento conceptual

- Actualizar README con Atlas One / Atlas BOS / Atlas POS.
- Sustituir textos visibles de DataX por Atlas POS cuando aplique.
- Mantener compatibilidad técnica temporal si existen nombres internos.
- Documentar decisión en `/docs/decisions/`.

### Fase 2: Modularización backend

- Separar core.
- Separar módulos.
- Mover modelos por dominio.
- Estandarizar routers.
- Crear services.
- Crear schemas.
- Agregar tenant isolation.
- Preparar migraciones.

### Fase 3: Modularización frontend

- Separar layout base.
- Crear sistema de navegación por preset.
- Crear dashboard Atlas POS.
- Crear configuración de módulos activos.
- Separar componentes reutilizables.
- Normalizar estilos.

### Fase 4: Inventario robusto

- Formalizar StockOnHand.
- Formalizar StockMovement.
- Crear operaciones transaccionales.
- Evitar descuentos directos sin movimiento.
- Preparar Kardex.

### Fase 5: Presets

- Implementar Atlas POS como preset inicial.
- Crear estructura para Atlas One Retail.
- Crear estructura para Atlas One Beauty.
- Crear estructura para Atlas One Gastro.

### Fase 6: QA, despliegue y documentación

- Tests por módulo.
- Seeds controlados.
- Migraciones reproducibles.
- Documentación de endpoints.
- OpenAPI limpio.
- Deploy en Railway.
- Separación QA/Prod.

---

## 18. Roles recomendados para múltiples IAs de desarrollo

Como se usarán varias IAs/agentes, se recomienda dividir responsabilidades.

### Agente 1: Arquitecto backend

Responsable de:

- Estructura FastAPI.
- SQLAlchemy models.
- Modularización.
- Tenant isolation.
- Services.
- Routers.
- Migraciones.

### Agente 2: Arquitecto frontend

Responsable de:

- React + Vite + TypeScript.
- Sistema de layouts.
- Presets UI.
- Sidebar dinámico.
- Componentes reutilizables.
- Atlas POS dashboard.

### Agente 3: Inventario y transacciones

Responsable de:

- StockMovement.
- StockOnHand.
- Kardex.
- Costo promedio.
- Transacciones PostgreSQL.
- Concurrencia.

### Agente 4: Producto y UX

Responsable de:

- Experiencia Atlas One.
- Atlas POS como preset ligero.
- Terminología comercial.
- Flujos por vertical.
- Priorización MVP.

### Agente 5: QA / DevOps

Responsable de:

- Tests.
- Railway.
- Variables de entorno.
- Healthcheck.
- Seeds.
- Scripts.
- Separación QA/Prod.

---

## 19. Prompt maestro para agentes de desarrollo

```txt
You are helping build Atlas One, a modular all-in-one business suite for physical businesses in Mexico and Latin America.

Commercial naming:
- Atlas One is the customer-facing product name.
- Atlas POS is the lightweight entry-level preset for point-of-sale operations.
- Atlas BOS is the technical and enterprise definition: Business Operating System.

Technical context:
- Backend: Python, FastAPI, SQLAlchemy 2.x
- Database: PostgreSQL
- Frontend: React, Vite, TypeScript
- Architecture: API-First, multi-tenant, modular, low-latency
- Deployment target: Railway

Strategic objective:
We are cloning the current POS codebase only once into a new repository called atlas-bos. The goal is not to create multiple cloned systems per industry. The goal is to refactor the current POS into a modular Business Operating System that powers Atlas One.

Product structure:
- Atlas BOS = technical core and enterprise architecture
- Atlas One = commercial all-in-one suite
- Atlas POS = lightweight entry preset
- Atlas One Retail = advanced retail/stock preset
- Atlas One Beauty = appointments/services/commissions preset
- Atlas One Gastro = recipes/KDS/food operations preset

Core modules:
auth, tenants, branches, users, customers, products, inventory, stock movements, sales, payments, cash sessions, reports, audit logs, settings.

Critical rules:
1. Do not duplicate business logic per vertical.
2. Enforce tenant_id in all tenant-owned queries.
3. Use StockMovement as the inventory ledger.
4. Keep Atlas POS lightweight.
5. Build modules that can be activated or disabled by tenant.
6. Separate core logic, module logic, presets, and UI.
7. Preserve current working POS behavior while refactoring progressively.
8. Prefer transactional correctness over quick patches.

Your output must be production-oriented, modular, and compatible with future vertical presets.
```

---

## 20. Primer task pack para iniciar el nuevo repo

```txt
Objective:
Transform the current POS codebase into the first version of Atlas BOS, the technical core powering Atlas One and its lightweight Atlas POS preset.

Context:
The commercial product is Atlas One.
The technical architecture is Atlas BOS.
The first preset is Atlas POS.
DataX POS naming must be replaced gradually by Atlas POS.

Tasks:
1. Audit the current repository structure.
2. Identify existing modules: auth, users, products, sales, inventory, cash, reports, printing.
3. Create a proposed modular folder structure under backend/app/modules.
4. Create backend/app/core for database, config, security, tenant context and shared utilities.
5. Create backend/app/presets/atlas_pos.py with enabled modules for the lightweight POS preset.
6. Update README to explain Atlas One, Atlas BOS and Atlas POS.
7. Do not break existing POS flows during the first refactor.
8. Create a migration plan before moving models.
9. Identify hardcoded names DataX/DataX POS and propose replacements.
10. Add TODO markers only where necessary and document every architectural decision.

Constraints:
- Do not clone separate repos for verticals.
- Do not rewrite everything from scratch.
- Preserve working behavior.
- Use incremental refactor.
- Keep tenant isolation in mind.
- Prepare the system for future modules and presets.
```

---

## 21. README recomendado para el nuevo repositorio

```md
# Atlas One

Atlas One is a modular all-in-one business suite for physical businesses in Mexico and Latin America.

It allows businesses to start with Atlas POS and progressively activate advanced modules such as inventory, purchasing, CRM, appointments, kitchen operations, reports, AI and enterprise integrations.

## Powered by Atlas BOS

Atlas BOS stands for Business Operating System.

It is the technical core behind Atlas One: an API-first, multi-tenant and modular architecture built with FastAPI, SQLAlchemy, PostgreSQL, React, Vite and TypeScript.

## First preset: Atlas POS

Atlas POS is the lightweight entry-level preset of Atlas One. It includes sales, payments, products, basic inventory, cash sessions, tickets and basic reports.

## Product architecture

- Atlas One: commercial suite
- Atlas BOS: technical core
- Atlas POS: lightweight preset
- Atlas One Retail: advanced retail preset
- Atlas One Beauty: appointments and services preset
- Atlas One Gastro: food operations preset
- Atlas One Enterprise: advanced/custom implementation
```

---

## 22. Decisiones críticas pendientes

Estas decisiones deben resolverse antes de avanzar demasiado:

1. ¿El nuevo repo será monorepo completo con backend y frontend juntos? Recomendado: sí.
2. ¿Se usará Alembic desde el inicio del refactor? Recomendado: sí.
3. ¿Se migrará el frontend actual a React + Vite de inmediato o progresivamente? Recomendado: progresivo si el sistema actual aún depende de templates.
4. ¿Se mantendrán templates server-side temporalmente? Recomendado: sí, si ya funcionan.
5. ¿Se separará QA y producción desde Railway? Recomendado: sí.
6. ¿Se manejarán permisos por rol y módulos activos? Recomendado: sí.
7. ¿El POS permitirá venta sin stock? Recomendado: configurable por tenant.
8. ¿Stock se descontará al cobrar o al confirmar venta? Recomendado: al confirmar venta/cobro.
9. ¿Inventario básico y avanzado serán módulos distintos? Recomendado: sí.
10. ¿Atlas POS tendrá compras? Recomendado: solo recepción/ajuste básico; compras avanzadas para Retail/Stock.

---

## 23. Resumen ejecutivo final

Atlas One será el nombre comercial de la suite todo-en-uno para negocios físicos.

Atlas BOS será el motor técnico y enterprise: un Business Operating System modular, API-First, multi-tenant y extensible.

Atlas POS será el preset ligero, popular y de entrada para ventas, caja, productos, pagos, tickets e inventario básico.

El repositorio actual del POS se debe clonar una sola vez hacia un nuevo repo llamado `atlas-bos`. Sobre ese repo se hará una refactorización progresiva para convertir el POS actual en una plataforma modular. No se deben crear repos separados por vertical. La estrategia correcta es construir un core común, módulos reutilizables y presets activables por tenant.

La visión final es crear una plataforma comparable en lógica a Odoo, Zoho o NetSuite, pero más ligera, mexicana, enfocada a micronegocios físicos y preparada para IA, automatización, integraciones y verticalización comercial.
