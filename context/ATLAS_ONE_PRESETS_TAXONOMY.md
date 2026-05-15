# Atlas One — Presets Taxonomy (v2)

> **Versión vigente desde:** 2026-05-15.
> **Reemplaza:** la taxonomía v1 (2026-05-13) que tenía 5 verticales Atlas One (`BEAUTY`, `GASTRO`, `RETAIL`, `SERVICES`, `ENTERPRISE`).
> **Política de legacy:** los enum values v1 NO se eliminan — siguen funcionando para orgs ya creadas. El operador migra cuando decida.

---

## 1. Rationale

La taxonomía v1 unía verticales con flujos operativos muy distintos bajo un mismo preset:

- **Beauty** mezclaba barberías masculinas, estéticas femeninas, spas, wellness y clínicas (quiroprácticos, fisio). El nombre comercial "Beauty" alejaba al barbero, al fisio y al consultorio médico.
- **Gastro** mezclaba bares (inventario líquido, cocteles), cafés (mostrador rápido, sin mesas) y restaurantes (mesas, meseros, cocina). Cada uno necesita un set distinto de módulos.
- **No existía Health** — un consultorio médico/dental no tenía dónde encajar; terminaba mal asignado a `SERVICES` (talleres) o `BEAUTY` (estética).

La v2 desglosa estos en presets vertical-específicos para que el cliente final reconozca su negocio en el nombre.

---

## 2. Presets activos (11) + legacy (2)

| ID enum | Display name | Para qué tipo de negocio | Color theme |
|---|---|---|---|
| `ATLAS_POS` | Atlas POS | POS de entrada para cualquier vertical | Azul default |
| `ATLAS_ONE_RETAIL` | Atlas One Retail | Ferreterías, abarrotes, farmacias, papelerías, refaccionarias | Azul (#2563eb) |
| `ATLAS_ONE_BARBER` 🆕 | Atlas One Barber | Barberías masculinas (cortes, barba, líneas, paquetes) | Cyan oscuro (#0891b2) |
| `ATLAS_ONE_BEAUTY_WELLNESS` 🆕 | Atlas One Beauty & Wellness | Estéticas, uñas, depilación, maquillaje, spas, wellness no clínico | Rosa (#ec4899) |
| `ATLAS_ONE_HEALTH` 🆕 | Atlas One Health | Consultorios médicos, dentales, quiroprácticos, fisio, terapia | Turquesa (#06b6d4) |
| `ATLAS_ONE_RESTAURANT` 🆕 | Atlas One Restaurant | Restaurantes con mesas + meseros + cocina | Naranja (#f97316) |
| `ATLAS_ONE_CAFE` 🆕 | Atlas One Café | Cafeterías, bakery, mostrador rápido (sin mesas asignadas) | Café-ámbar (#d97706) |
| `ATLAS_ONE_BAR` 🆕 | Atlas One Bar | Bares y cantinas: cocteles, bartenders, inventario líquido | Violeta oscuro (#7c3aed) |
| `ATLAS_ONE_SERVICES` | Atlas One Services | Talleres mecánicos, mantenimiento, OT | Verde esmeralda (#10b981) |
| `ATLAS_ONE_ENTERPRISE` | Atlas One Enterprise | Implementación completa multi-vertical | Púrpura (#a855f7) |
| `CUSTOM` | Personalizado | Manual desde cero (solo `core` + `users`) | Azul default |
| `ATLAS_ONE_BEAUTY` ⚠️ legacy | Atlas One Beauty (legacy) | Compat con orgs v1 | Rosa |
| `ATLAS_ONE_GASTRO` ⚠️ legacy | Atlas One Gastro (legacy) | Compat con orgs v1 | Naranja |

---

## 3. Módulos por preset

**Base común** para verticales con POS: `core, users, catalog, payments, cash_management, crm, pos, reports`.

| Preset | Módulos completos |
|---|---|
| `ATLAS_POS` | core, pos, cash_management, catalog, inventory, returns, pricing, payments, reports |
| `ATLAS_ONE_RETAIL` | base + inventory, returns, pricing, crm, branch_catalog_enablement, purchasing, promotions, quotes |
| `ATLAS_ONE_BARBER` | base + appointments, commissions, memberships |
| `ATLAS_ONE_BEAUTY_WELLNESS` | base + inventory, appointments, commissions, memberships |
| `ATLAS_ONE_HEALTH` | base + appointments, commissions, memberships (planes de tratamiento). **No incluye** `inventory` por default — el negocio cobra servicios. |
| `ATLAS_ONE_RESTAURANT` | base + inventory, kitchen, tables, recipes, commissions |
| `ATLAS_ONE_CAFE` | base + inventory, kitchen. **Sin** tables (mostrador) y **sin** recipes (operativa más simple). |
| `ATLAS_ONE_BAR` | base + inventory, tables, recipes (cocteles), commissions |
| `ATLAS_ONE_SERVICES` | core, users, catalog, payments, crm, workshops, appointments, quotes, commissions, reports |
| `ATLAS_ONE_ENTERPRISE` | TODO el catálogo (incluye módulos BETA: ai, manufacturing, hr, etc.) |
| `CUSTOM` | core, users |

---

## 4. Decisiones de naming explicadas

### 4.1 ¿Por qué `BARBER` separado de `BEAUTY_WELLNESS`?

El cliente masculino que busca un sistema para su barbería rechaza un producto llamado "Beauty". El barbero está acostumbrado a un vocabulario distinto: sillas (no cabinas), barba (no estética facial), paquetes de N cortes (no membresías de spa). Atlas One Barber le habla directamente.

### 4.2 ¿Por qué `BEAUTY_WELLNESS` y no separar Beauty + Spa?

Operativamente son casi idénticos: agenda por profesional, comisiones, membresías, servicios prepagados. La diferencia comercial (estética vs spa) es de branding del cliente, no del software. Mantener 1 preset reduce mantenimiento sin perder utilidad. Si en el futuro se demuestra que el spa necesita flujos distintos (cuartos con horarios distintos, terapias agendadas en bloques), se separa.

### 4.3 ¿Por qué 1 `HEALTH` unificado y no `MEDICAL` + `DENTAL`?

Los flujos clínicos son muy similares: agenda, paciente con historial, sesiones recurrentes, comisiones por profesional, planes de tratamiento prepagados. Las particularidades (radiografías dentales, presupuestos dentales largos) se manejan a nivel de UI/catálogo de servicios, no de preset. Si DENTAL crece a complejidad propia (cuadrante, tratamiento dental electrónico) se separa.

### 4.4 ¿Por qué `RESTAURANT` + `CAFE` + `BAR` separados?

Aquí sí hay diferencias **operativas** reales:

- **Cafe**: mostrador, comanda rápida, sin asignación de mesas, sin meseros con comisión. `tables` y `commissions` se vuelven ruido.
- **Restaurant**: mesas asignadas, meseros con comisión, comandas a cocina por mesa, recetas costeadas.
- **Bar**: tabs abiertas, inventario líquido (control por onza/ml), cocteles con recetas dinámicas, bartender con comisión por venta.

Un café no necesita el plano de mesas; un bar no necesita el KDS de cocina (salvo botanas). Cada preset habilita solo lo que aporta valor al día 1.

### 4.5 ¿Por qué mantener `ATLAS_ONE_BEAUTY` y `ATLAS_ONE_GASTRO` como legacy?

Borrar valores del enum Postgres es destructivo (requiere recrear el tipo). Y siempre hay orgs cliente ya configuradas con esos valores. El cleanup se difiere a una migración manual cuando el operador confirme que cero orgs los usan.

El seed (`scripts/init_presets_v2.py`) los mantiene en la tabla `industry_presets` con `display_name` marcado `(legacy)` para que el UI lo deje claro. El `PresetHome` los alias a sus equivalentes v2 (`BEAUTY → BeautyWellnessHome`, `GASTRO → RestaurantHome`) — la org legacy no pierde su home.

---

## 5. Color theme por preset

Cada vertical tiene una variable CSS `--p-accent` distinta vía selectores `[data-preset="..."]` en `frontend/src/index.css`. El store `enabledModulesStore` aplica `data-preset` a `<html>` cuando carga el contexto del usuario. Esto cascadea automáticamente a todos los lugares que usan `var(--p-accent)` (botones, badges, nav activo, etc.).

La paleta busca asociación cultural inmediata:
- Barber: cyan oscuro (sobrio, masculino).
- Beauty & Wellness: rosa (estética femenina).
- Health: turquesa (asociación médica).
- Restaurant: naranja (apetito, energía).
- Café: café-ámbar (café tostado).
- Bar: violeta oscuro (noche, ambiente bar).
- Services: verde esmeralda (operación, taller).
- Enterprise: púrpura (premium).
- POS / Custom / Retail: azul default.

---

## 6. Cómo agregar otra vertical en el futuro

Receta (siguiendo la convención de v2):

1. **Enum** — agregar value a `app/modules/tenants/models.py:IndustryType` (al final, sin tocar los existentes).
2. **railway_init.py** — agregar el value al array `atlas_one_industry_values` en `run_migrations()` para que `ALTER TYPE ... ADD VALUE IF NOT EXISTS` corra al deploy.
3. **scripts/init_presets_v2.py** — agregar entry a `PRESETS` con el set de módulos. Si introduces módulos nuevos, agregarlos también a `MODULES_CATALOG` y `MODULE_UPSELL`.
4. **scripts/seed_demo_orgs.py** — agregar entry a `DEMOS` con admin + cajero + productos demo representativos.
5. **frontend/src/index.css** — bloque `[data-preset="ATLAS_ONE_<NEW>"]` con su paleta.
6. **frontend/src/pages/home/PresetHome.tsx** — case nuevo + función `<NewVertical>Home` con widgets relevantes.
7. **Este doc** — actualizar la tabla del §2 y, si aplica, rationale en §4.

Sin paso 1+2, el deploy explota con `invalid input value for enum`. Sin paso 5+6, el color y home quedan al fallback genérico (azul + redirect a `/hq/operations`).

---

## 7. Política de legacy y eliminación

- **No se elimina** ningún value del enum sin migración explícita de datos.
- **No se elimina** la fila legacy en `industry_presets` automáticamente; el seed la marca `(legacy)` y deja de promoverla en UI.
- Cleanup real: SQL manual cuando el operador confirme cero orgs usando el value.

---

**Última actualización:** 2026-05-15
