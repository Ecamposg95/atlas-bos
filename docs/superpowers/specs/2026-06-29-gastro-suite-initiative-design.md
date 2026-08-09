# Atlas One · Gastro Suite — Spec de Iniciativa

**Fecha:** 2026-06-29
**Tipo:** Spec de iniciativa (descompone en 9 sub-proyectos, cada uno con su propio spec → plan → cycle)
**Base comercial:** `context/Atlas One · Gastro Suite — Deck ejecutivo.pdf` (15 slides)
**Estado:** Aprobado para descomposición. Carve-out priorizado del mega-plan de 11 presets.

---

## 1. Qué es la Gastro Suite

Iniciativa **carve-out** que convierte los presets **RESTAURANT / CAFE / BAR** en productos 100% operativos y vendibles, compartiendo **una sola espina operativa** encabezada por el lazo de control **Venta → Receta → Inventario → Merma → Margen**, empaquetados bajo la identidad comercial **"Gastro Suite"** con modelo de onboarding de **piloto de 1 unidad**.

Dark-kitchen, multi-sucursal y conceptos híbridos son **configuraciones** sobre los 3 presets núcleo, no presets nuevos.

**Posición en el roadmap:** se extrae del mega-plan de 11 presets ([[project_11_presets_mvp_plan]]) y se prioriza ahora, por delante/en paralelo a Wave 1/2. El deck es la razón comercial de la priorización. Aprovecha SP-0 (Atlas One Design System) ya cerrado.

## 2. Frontera del MVP

**Dentro:** base operativa ("HOY" del deck slide 12) + motor recetas→inventario→merma→margen + homes ricas de los 3 presets + toda la capa "SIGUIENTE" (multi-sucursal, bar nocturno completo, compras/reabasto, promociones por horario).

**Fuera:** Atlas IA gastro (el deck mismo dice "próximamente"), integraciones externas, drag-drop de mesas para reagendar, recurrencias, artboards Touch/Mobile más allá de los 3 surfaces operativos (comanda, KDS, POS).

## 3. Arquitectura de la espina (unidad central compartida)

El motor se inserta en el pipeline **existente** `venta → StockOnHand → InventoryMovement`:

```
Venta finalizada (PENDING → PAID)
        │
        ▼
  ¿el variant vendido tiene Recipe?
        │ no ──► comportamiento actual (descuenta el propio variant)
        │ sí
        ▼
  recipes.explode(variant_id, qty) → [(insumo_id, qty_consumida)]
        │
        ▼
  por cada insumo: StockOnHand.qty_on_hand -= qty  +  InventoryMovement(type=RECIPE_CONSUMPTION)
        │
        ▼
  COGS del ticket = Σ(qty_insumo × costo_insumo)  →  margen = precio − COGS
```

**Modelos nuevos (módulo `recipes`):**
- `Recipe` — 1:1 con un `ProductVariant` vendible; `yield_qty`, estado, versión.
- `RecipeLine` — `(recipe, insumo_variant_id, qty, unit)` — el BOM.
- `WasteLog` (merma) — variance teórico vs. físico + merma directa registrada.

**Interfaces públicas (consumidas por otros módulos, sin ver internals):**
- `recipes.cost_of(variant_id) -> Money`
- `recipes.explode(variant_id, qty) -> list[InsumoConsumption]`
- `recipes.apply_consumption(sale, db)` — invocado por la finalización de venta.

**Dependencias:** `products` (`ProductVariant`/`StockOnHand`), `sales`, `inventory` (`InventoryMovement`/`MovementType`), `cash`.

**Principio de aislamiento:** costeo/merma/margen vive *solo* en `recipes`; las superficies (mesas, KDS, barra, homes) lo consumen por interfaz y nunca recalculan costos.

### 3.1 Grounding verificado (puntos de integración)

- **Hook:** `app/routers/sales.py:552-566` (bloque `SALE_OUT`), punto de inserción tras línea 566 dentro del loop de items. Variables disponibles: `variant`, `qty_dec` (Decimal), `current_user.branch_id`, `org_id`, `db`, `existing_sale`.
- **MovementType:** `app/models/inventory.py:15-22` — añadir `RECIPE_CONSUMPTION`.
- **Insumo vs producto:** añadir `is_raw_material: Boolean` a `ProductVariant` (`app/modules/products/models.py:89`, junto a `cost`).
- **Trampa de ediciones:** ediciones de venta revierten stock SIN movimiento (`sales.py:384-393`). **Decisión:** disparar el consumo en finalización `PENDING→PAID`, no en create, para evitar reversa silenciosa.
- **Gotchas:** `organization_id` nullable → usar fallback `or_(org_id==X, org_id==None)`; filtrar por `branch_id`; convertir cantidades vía `Decimal(str(...))`; mantener el hook dentro de la transacción de venta para atomicidad.

## 4. Descomposición en 9 sub-proyectos

| ID | Sub-proyecto | Capa | Núcleo |
|---|---|---|---|
| **GS-0** | Espina operativa | backend | `Recipe`+`RecipeLine`+`WasteLog`, `is_raw_material`, `RECIPE_CONSUMPTION`, hook de consumo, costeo `cost_of()/explode()/apply_consumption()`, endpoints margen/merma, CRUD recetas |
| **GS-1** | Restaurant ops | backend | `tables` (zonas, mesas, estados, cuentas, turnos) + `kitchen`/KDS (cola, estados ítem, SLA) + comandas con tiempos/modificadores. Molde: `appointments` |
| **GS-2** | Restaurant frontend | front | Home plano-de-mesas + comanda touch + pantalla KDS. ~13 componentes nuevos `atlas-one/*` theme-aware desde el inicio |
| **GS-3** | Bar profundo | backend | Copeo = receta de yield fraccional (reusa GS-0), inventario de botellas con volumen parcial, promociones por horario, corte nocturno (variante de cierre) |
| **GS-4** | Bar frontend (DARK) | front | Resuelve theming `tone="dark"` en primitivos compartidos; `DarkKpi`, `BottleInventoryList`, `PourLevelBar`, `PromoCard` + home dark + POS coctelería |
| **GS-5** | Café frontend | front | El más liviano (reusa `Kpi`/`BarChart`); `RecipeMarginList`, `SupplyLevelList`, `ModifierPanel` + home + POS con modificadores + cola barista |
| **GS-6** | Compras / reabasto | backend | Entidad **Proveedor** (falta hoy) + conectar `PurchaseRecommendation`(abasto)→`PurchaseOrder`(finance)→recepción→`PURCHASE_IN`; sugerido de compra desde merma + tasa de consumo |
| **GS-7** | Multi-sucursal | back+front | "Comparativo de unidades" + "rentabilidad por concepto" + stock crítico agregado sobre `/reports/*` existente; dashboard ejecutivo de grupo |
| **GS-8** | Suite + roles + piloto | cross | Agrupación "Gastro Suite" sobre los 3 presets; roles nuevos MESERO/BARISTA/BARTENDER/COCINA/Director; trial (`trial_started_at/ends_at/branch_limit` en Organization) + wizard de config + enriquecer seed |

### 4.1 Grounding por sub-proyecto

- **GS-0/GS-1:** `recipes`, `purchasing`, `tables`, `kitchen` son stubs/greenfield. `appointments` es el molde (8 modelos, enum-once `_appt_*_enum`, `acquire_professional_lock` con `pg_advisory_xact_lock`, state machine, `services.py`). Migraciones idempotentes en `scripts/railway_init.py:run_migrations()` (no Alembic). Multi-tenant vía `get_tenant_scoped`/`scoped_query` (`app/core/tenant_query.py`).
- **GS-2/4/5:** SP-0 ya portó 23 componentes a `frontend/src/components/atlas-one/`. Componentes nuevos consolidados (~20): `FloorPlan`+`TableShape`, `SelectedTableCard`, `WaiterLeaderboard`, `KdsTicket`+`KdsTicketRail`+`ShiftStatBar`, `CommandaItem`/`CoursedOrderList`, `OrderPanel`, `OrderLineRow`, `MenuItemTile`, `CategoryTabs`, `RankedList`, `Stat`, `MeterBar` (base de `PourLevelBar`/`MarginBar`/`StockBar`), `SuggestionChip`, `DarkKpi`, `BottleInventoryList`, `PromoCard`, `RecipeMarginList`, `SupplyLevelList`, `ModifierPanel`+`ModifierPill`. **Restaurant** = plano interactivo (light); **Bar** = dashboard DARK (palette `D`); **Café** = dashboard light (reusa `Kpi`/`BarChart`).
- **GS-6:** `app/models/abasto.py` tiene `PurchaseRecommendation`; `app/models/finance.py` tiene `PurchaseOrder`/`PurchaseOrderLine` pero `supplier_name` es texto, **sin entidad Proveedor**. `PURCHASE_IN` ya existe en `MovementType`.
- **GS-7:** `app/routers/platform/reports.py` ya tiene pivotes por branch (`/reports/branches`, `/reports/sellers`), pero NO "comparativo de unidades" ni "rentabilidad por concepto" prearmados.
- **GS-8:** `IndustryPreset` (`app/models/modules.py:45-58`) ya define `ATLAS_ONE_RESTAURANT/CAFE/BAR` con módulos `kitchen/tables/recipes` (`scripts/init_presets_v2.py:343-371`); gating completo (`require_module`, `OrganizationModule`, `enabledModulesStore`). **Falta:** agrupación "Suite" + trial real (hoy solo `plan` string, sin enforcement) + datos demo gastro ricos (1 branch/org, sin recetas/mesas/KDS/modificadores). Roles: 7 existentes; net-new MESERO/BARISTA/BARTENDER/COCINA/Director — extensión vía `Role` enum + `ATLAS_POS_ROLE_VIEWS` + `ROLE_CONTEXT_REQUIREMENTS` + tipos frontend.

## 5. Secuencia en 3 tandas (híbrido: piloto Restaurant primero)

```
TANDA 1 — PILOTO RESTAURANT (valida la espina contra un preset real)
  GS-0 Espina ──► GS-1 Restaurant ops ──► GS-2 Restaurant frontend
                       ∥ GS-8a (solo roles MESERO/COCINA, en paralelo)
  ➜ Entregable: preset Restaurant 100% operativo, listo para piloto de 1 unidad

TANDA 2 — BAR + CAFÉ (reusan espina ya validada)
  GS-3 Bar profundo ──► GS-4 Bar frontend (resuelve theming)
  GS-5 Café frontend (reusa componentes de GS-2)        ∥ con GS-3/GS-4
  ➜ Entregable: los 3 presets gastro vendibles

TANDA 3 — GRUPO + CIERRE COMERCIAL
  GS-6 Compras  ∥  GS-7 Multi-sucursal  ∥  GS-8b (trial + wizard + seed)
  ➜ Entregable: Gastro Suite completa "operar→controlar→escalar"
```

**Camino crítico:** GS-0 bloquea todo (es la espina). GS-2 produce los componentes `atlas-one/*` theme-aware que GS-4/GS-5 reusan → Restaurant frontend va primero aunque Bar/Café sean conceptualmente paralelos.

## 6. Decisiones de diseño resueltas

1. **Timing del consumo:** disparar el hook en finalización **PENDING→PAID**, no en create. Razón: evita la trampa de reversa silenciosa en ediciones de venta (`sales.py:384-393`). Alternativa (hook en create con reversa explícita) descartada por complejidad.
2. **Theming Bar:** construir los primitivos compartidos `atlas-one/*` con prop `tone` (light/dark) **desde GS-2**, para que Bar (GS-4) reuse en vez de forkear. Evita ~8 componentes duplicados.
3. **Identidad "Gastro Suite":** NO es un nuevo primitivo de gating — es una **agrupación ligera** (metadata/tag) sobre los 3 `IndustryPreset` existentes + wrapper comercial/onboarding. Reusa toda la infra de módulos ya construida.

## 7. Riesgos

- **R1 — Hook en camino de venta productivo:** GS-0 toca `create_sale`. Exige tests exhaustivos + rollout con flag + verificación vía Railway logs (no hay venv local para pytest — CI gate de GitHub Actions es el guardián).
- **R2 — `is_raw_material` vs visibilidad POS:** los insumos no deben aparecer en el POS sin romper `ProductBranchStatus`. Filtrar POS por `is_raw_material=False`.
- **R3 — Datos demo multi-branch:** tanda 3 (GS-7) asume multi-branch que hoy no existe (1 branch/org). GS-8 los siembra.
- **R4 — Scope grande (9 sub-proyectos):** la disciplina de tandas es lo que evita el desborde. No saltar de tanda sin cerrar la anterior.

## 8. Criterios de éxito

- **Tanda 1:** un org demo RESTAURANT vende un platillo → se descuentan insumos vía receta → se registra merma → el margen del ticket es correcto; plano de mesas + KDS operan en la home rica.
- **Tanda 2:** Bar (dark) y Café operan sus homes ricas reusando la espina; copeo descuenta fracción de botella; promos por horario aplican.
- **Tanda 3:** sugerido de compra se genera desde consumo; dashboard de grupo compara unidades; un org puede entrar en modo piloto (1 sucursal, trial con vencimiento) vía wizard.

## 9. Relacionados

- [[project_11_presets_mvp_plan]] — mega-plan padre; esta iniciativa extrae y prioriza su Wave 3 + SP-4.
- [[reference_appointments_backend]] — molde estructural para GS-1 (tables/kitchen).
- [[reference_module_guide]] — convenciones de módulo para GS-0/GS-1/GS-6.
- [[project_phase2_inflight]] — Phase 2 modularization; ortogonal pero comparte convenciones.
