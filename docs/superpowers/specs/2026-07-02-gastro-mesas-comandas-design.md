# Gastro — Mesas premium + Vista móvil de comandas (Fase 1)

**Fecha:** 2026-07-02
**Preset:** `ATLAS_ONE_RESTAURANT` (Atlas One Gastro)
**Rama:** `staging`
**Estado:** Diseño aprobado — pendiente plan de implementación

## Objetivo

Elevar la experiencia de restaurante en dos frentes:

1. **Mesas premium** — rediseñar el plano de mesas (`FloorPlan.tsx`) con más
   detalle y aspecto premium (desktop/tablet, para host/cajero/gerente).
2. **Vista móvil de comanda** — nueva pantalla optimizada para **celular** donde
   el mesero levanta comandas y las envía a cocina (KDS).

Rol que levanta comandas: **`VENDEDOR`** (mapea a "mesero"; no existe rol MESERO).

## Alcance

**En alcance (Fase 1):**
- Rediseño premium de `FloorPlan.tsx` con cards ricas + KPIs.
- Nueva vista móvil de comanda (`/comanda`) para VENDEDOR.
- Endpoint nuevo `PATCH /sales/parked/{id}` para mantener la cuenta sincronizada.
- Modales para crear área/mesa (reemplazan `window.prompt`).

**Fuera de alcance (Fase 2, después):**
- Plano del salón arrastrable con posicionamiento `pos_x/pos_y` (drag & drop).
- Concepto de "menú" separado del catálogo de productos.

## Estado actual (contexto)

- **Backend ya soporta:** `tables` (CRUD, open, free, transfer, assign-server,
  status), `kitchen` (fire ticket a KDS, bump/recall/cancel, stats),
  `sales/parked` (crear, resume, borrar).
- `open_table` crea un `ParkedTicket` con `cart_json={"items": []}` y enlaza
  `table.current_ticket_id`, marca `OCCUPIED`, setea `server_user_id` y `opened_at`.
- `fire_ticket` (`POST /kitchen/tickets`) acepta `items[]` (description, qty,
  variant_id, station_id, modifiers), `table_id`, `parked_ticket_id`, `notes`.
- Subscriber `free_table_on_sale`: al pagar la cuenta (parked → sale) libera la mesa.
- **Falta:** endpoint para **actualizar** `cart_json` de un parked ticket. Hoy solo
  se crea/retoma/borra. Sin esto, las comandas no se acumulan en la cuenta.
- `FloorPlan.tsx` actual: grid básico por área, botones Abrir/Liberar, creación
  con `window.prompt`. Sin detalle, sin comanda, no premium.
- **No existe** ninguna UI de levantar comandas.

## Componentes

### 1. Mesas premium — `FloorPlan.tsx` rediseñado (desktop/tablet)

**Barra superior — KPIs vivos:**
- Mesas ocupadas / libres (conteo).
- Cuentas abiertas (suma de totales de `cart_json`).
- Tiempo promedio de mesas abiertas.

**Card de mesa (rica):**
- Código de mesa + # de asientos (`seats`).
- Estado con color + icono: Libre / Ocupada / Pidió cuenta / Limpieza / Reservada.
- Timer vivo desde `opened_at` (minutos abierta).
- Mesero asignado (`server_user_id` → nombre/avatar).
- Total de la cuenta calculado desde `cart_json.items`.
- Badge de comandas en cocina (tickets KDS de esa mesa en estado activo).
- Acciones rápidas: Ver comanda / Cuenta / Liberar según estado.

**Creación de área/mesa:** modales reales (código, asientos, área) en lugar de
`window.prompt`.

**Endpoints usados:** `GET /tables`, `GET /tables/areas`, `POST /tables`,
`POST /tables/areas`, `POST /tables/{id}/open`, `POST /tables/{id}/free`,
`GET /kitchen/tickets?branch_id=` (para badges). Total de cuenta: cálculo
client-side desde `cart_json` del parked ticket (via `GET /sales/parked/{id}`).

### 2. Vista móvil de comanda — nueva ruta `/comanda` (celular, VENDEDOR)

**Pantalla A — "Mesas":**
- Grid táctil grande de mesas. Toggle **"Mis mesas / Todas"** (default: Mis mesas
  = mesas donde `server_user_id == user.id`; Todas muestra el salón completo).
- Tap en mesa libre → `POST /tables/{id}/open` (crea cuenta, se autoasigna mesero).
- Tap en mesa ocupada → abre su comanda.

**Pantalla B — Comanda de mesa:**
- Menú en grid: categorías + platillos desde el **catálogo de productos** existente.
- Tap agrega; stepper de cantidad; modificadores/notas por ítem.
- Dos secciones: **"Por enviar"** (borrador local) vs **"Enviado a cocina"**.
- Botón grande **`Enviar a cocina`**:
  1. `POST /kitchen/tickets` con los ítems "por enviar" (+ `table_id`,
     `parked_ticket_id`, `notes`) → aparece en KDS.
  2. `PATCH /sales/parked/{id}` anexando los ítems al `cart_json` de la cuenta.
- Muestra total de la cuenta; botón **"Pedir cuenta"** →
  `PATCH /tables/{id}/status` a `BILL_REQUESTED`.

### 3. Backend — adición mínima

**`PATCH /sales/parked/{id}`** (nuevo):
- Actualiza/anexa `cart_json` de un parked ticket existente.
- Scoped por organización (mismo patrón que los demás endpoints de parked).
- Request: `{ cart_json: {...} }` (reemplazo del carrito completo; el cliente
  hace merge de "cuenta actual + ítems nuevos" antes de mandar).
- Response: `ParkedTicketRead`.

El resto (open/free/assign-server, fire a KDS) ya existe y se reutiliza.

## Flujo de datos

```
Mesero abre mesa → POST /tables/{id}/open (crea parked ticket, autoasigna mesero)
   → agrega platillos → "Enviar a cocina":
        POST /kitchen/tickets      → comanda visible en KDS
        PATCH /sales/parked/{id}   → ítems sumados a la cuenta   [ENDPOINT NUEVO]
Cajero luego retoma la cuenta en POS → cobra → Sale creada
        → subscriber free_table_on_sale libera la mesa
```

## Decisiones (ambigüedad resuelta)

- **Menú = catálogo de productos existente.** Los platillos son productos; las
  categorías salen de las categorías de producto. No se crea un modelo "menú"
  aparte en Fase 1.
- **Vista móvil default "Mis mesas"** (del mesero logueado) con toggle a "Todas".
- **`PATCH /sales/parked/{id}` reemplaza el `cart_json` completo** (no hace merge
  en servidor); el merge cuenta-actual + nuevos-ítems ocurre en el cliente, que ya
  tiene el estado de la comanda.

## Pruebas

- **TDD backend:** tests del endpoint `PATCH /sales/parked/{id}` (update ok,
  aislamiento por org, 404 inexistente).
- **E2E:** mesa→comanda→KDS→cobro contra el demo de restaurante en staging
  (`demo_restaurant` / `demo1234`, org "Demo Atlas One Restaurant").
- **Visual:** screenshots Playwright — viewport móvil para `/comanda`, desktop
  para el plano rediseñado.

## Riesgos / notas

- Datos demo actuales: 4 mesas con `code`/nombre presentes pero la API los devolvía
  como `name: null` (el campo real es `code`); recetas con `total_cost: null`. No
  bloquean, pero conviene sembrar datos de menú (productos-platillo) para probar la
  comanda con contenido realista.
- El total de cuenta se calcula desde `cart_json`; hay que fijar el shape de item
  (id/variant, nombre, precio, qty, modificadores) y usarlo consistente entre POS,
  comanda y KDS.
