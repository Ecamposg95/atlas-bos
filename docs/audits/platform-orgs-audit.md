# Platform Organizations — Full Audit

> Branch: `release/beta`
> Scope: `PlatformOrganizations.tsx`, `PlatformOrgDetail.tsx`, `PlatformPresets.tsx` + backend `platform.py` orgs/presets/modules sections
> Generated: 2026-04-20

**Severity legend:** CRITICAL · HIGH · MEDIUM · LOW

---

## A1 — Frontend Bugs

### PlatformOrganizations.tsx (173 LOC)

| # | Loc | Description | Sev | Fix |
|---|-----|-------------|-----|-----|
| F-01 | `PlatformOrganizations.tsx:17` | `platformApi.getOrgs().then(setOrgs).finally(...)` — sin `.catch()`. Si falla, lista queda vacía sin feedback. | HIGH | Envolver en try/catch; `toast.error('No se pudieron cargar orgs')`; mantener `loading=false`. |
| F-02 | `PlatformOrganizations.tsx:27-38` | `handleCreate` tiene try/finally sin catch → errores de backend silenciados. | HIGH | Añadir catch con `toast.error(err?.response?.data?.detail)`. |
| F-03 | `PlatformOrganizations.tsx:41-44` | `handleDelete` sin try/catch. Backend retorna 400 con mensaje ("tiene N sucursales") que nunca llega al usuario. | CRITICAL | try/catch; mostrar `detail` del 400 como toast; refetch sólo en éxito. |
| F-04 | `PlatformOrganizations.tsx:41` | Usa `confirm()` nativo (mezcla con patrón de toasts). | MEDIUM | Reemplazar con modal propio de doble-confirmación para destructivo (ver C2). |
| F-05 | `PlatformOrganizations.tsx:112-117` | Botón delete icon-only sin `aria-label` ni `title`. | LOW | `aria-label="Eliminar organización {name}"`. |
| F-06 | `PlatformOrganizations.tsx:11` | Form estado no incluye `legal_name`, `tax_id`, `address`, `website`. Admin no puede llenarlos al crear. | MEDIUM | Expandir form en Phase B y permitir los campos del modelo. |

### PlatformOrgDetail.tsx (414 LOC)

| # | Loc | Description | Sev | Fix |
|---|-----|-------------|-----|-----|
| F-07 | `PlatformOrgDetail.tsx:14 + api/platform.ts:62-65` | **Tipo `OrgModule` desalineado con backend.** Backend devuelve `{key, name, scope, status, is_enabled}` (platform.py:757-763). Frontend espera `{module_key, is_enabled}`. En runtime `m.module_key` = undefined → `toggleModule(undefined,…)` → pega `/modules/undefined` → 404/no-op. **Toggles de módulo están rotos.** | **CRITICAL** | Alinear tipo a `{key, name, scope, status, is_enabled}`. Cambiar `m.module_key` → `m.key` en las 3 ocurrencias (líneas 56, 258, 260, 263). |
| F-08 | `PlatformOrgDetail.tsx:32-50` | `load` usa `Promise.all` con try/finally sin catch. Si una llamada falla (ej. bootstrap legacy), toda la página muestra "Organización no encontrada" incorrectamente. | HIGH | Manejar cada llamada por separado con `.catch` ó try/catch global; mostrar toast de error y preservar datos parciales. |
| F-09 | `PlatformOrgDetail.tsx:37, 43` | `getUsers()` trae TODOS los usuarios de la plataforma y filtra en cliente. Escala O(N). | HIGH | Usar `getUsers({organization_id: id})` con query param (backend ya soporta, platform.py:525). Requiere extender `platformApi.getUsers` para aceptar params. |
| F-10 | `PlatformOrgDetail.tsx:54-57` | `toggleModule` hace update optimista sin catch → si falla queda UI inconsistente. Además no deshabilita botón. | HIGH | try/catch con rollback; `disabled` durante request; toast error. |
| F-11 | `PlatformOrgDetail.tsx:59-63` | `handleSuspend` sin try/catch, sin loading state, usa `confirm()`. | HIGH | try/catch + toast + modal de confirmación. |
| F-12 | `PlatformOrgDetail.tsx:65-68` | `handleActivate` sin try/catch, sin feedback de éxito. | MEDIUM | try/catch + toast.success. |
| F-13 | `PlatformOrgDetail.tsx:70-75` | `handleBootstrap` usa `alert()` (rompe patrón toast). | MEDIUM | Reemplazar con `toast.success`. |
| F-14 | `PlatformOrgDetail.tsx:93-103` | `handleSaveEdit` sin catch; si falla el PUT, modal cierra y lista refresca mostrando datos viejos pensando que guardó. | HIGH | try/catch; no cerrar modal si falla. |
| F-15 | `PlatformOrgDetail.tsx:105-108` | `handleSetIndustry` sin try/catch, sin toast. Admin click → nada pasa visualmente si falla. | HIGH | try/catch + toast. |
| F-16 | `PlatformOrgDetail.tsx:227` | Hardcoded industry list con 9 valores. Modelo `IndustryType` tiene **19**. Faltan: DISTRIBUTOR_POS, ECOMMERCE, DENTAL, PROFESSIONAL_SERVICES, CAFE_BAKERY, FLEET_SERVICE, SALES_DISTRIBUTION, B2B_ENTERPRISE, WAREHOUSE_LOGISTICS, MANUFACTURING_LIGHT. | MEDIUM | Centralizar lista en `types/organization.ts` o derivar de constantes compartidas. |
| F-17 | `PlatformOrgDetail.tsx:46, 97` | `editForm` sólo incluye name/email/phone. Modelo tiene `legal_name`, `tax_id`, `website`, `address`, `logo_url`. | MEDIUM | Extender editForm con los campos del whitelist `_ORG_UPDATE_FIELDS` del backend (`legal_name`, `address`, `logo_url`). |
| F-18 | `PlatformOrgDetail.tsx:184, 394` | `(editForm as any)` y `(adminForm as any)` — casts innecesarios. | LOW | Eliminar con Pick/helper tipado. |
| F-19 | `PlatformOrgDetail.tsx:111` | Estado `org === null` siempre dice "Organización no encontrada" aunque el error sea 500 u offline. | MEDIUM | Separar estado error vs not-found. |

### PlatformPresets.tsx (165 LOC)

| # | Loc | Description | Sev | Fix |
|---|-----|-------------|-----|-----|
| F-20 | `PlatformPresets.tsx:22-25` | `load` sin catch. | HIGH | try/catch + toast.error. |
| F-21 | `PlatformPresets.tsx:36-52` | `handleSave` sin catch. Falla de create/update silenciosa. | HIGH | try/catch + toast.success en OK, toast.error con detail en fail. |
| F-22 | `PlatformPresets.tsx:54-58` | `handleDelete` sin catch. Backend rechaza `is_system=true` con 400 — usuario no se entera. | HIGH | try/catch + mostrar detail del 400. |
| F-23 | `PlatformPresets.tsx:128` | `(form as any)[f.key]` cast. | LOW | Tipar. |
| F-24 | `PlatformPresets.tsx:5-12` | Lista `ALL_MODULES` hardcoded y puede divergir del catálogo del backend (`/modules/catalog`). | MEDIUM | Cargar dinámicamente desde `platformApi.getModulesCatalog()`. |

### Conteos A1

| Archivo | CRITICAL | HIGH | MEDIUM | LOW | Total |
|---------|----------|------|--------|-----|-------|
| PlatformOrganizations.tsx | 1 | 2 | 2 | 1 | 6 |
| PlatformOrgDetail.tsx     | 1 | 7 | 4 | 1 | 13 |
| PlatformPresets.tsx       | 0 | 3 | 1 | 1 | 5 |
| **Total**                 | **2** | **12** | **7** | **3** | **24** |

---

## A2 — Backend Bugs (`app/routers/platform.py`, orgs/presets/modules)

| # | Loc | Description | Sev | Fix (deferred — backend PR separado) |
|---|-----|-------------|-----|-----|
| B-01 | `platform.py:203-209` `create_organization` | Usa `Organization(**org.dict())` sin whitelist. Si `OrganizationCreate` acepta `status`, `plan`, `industry_type`, pasan directos. | MEDIUM | Filtrar con `_ORG_UPDATE_FIELDS` extendido para create. |
| B-02 | `platform.py:740-764` `get_org_module_status` | Devuelve dict con `key` pero el schema esperado por el cliente es `module_key` (ver F-07). Sin `response_model`, Pydantic no valida. | HIGH | Definir schema `ModuleStatus` y exponer `module_key` (o alinear cliente a `key`). Ver F-07. |
| B-03 | `platform.py:222-238` `update_organization` | `_ORG_UPDATE_FIELDS` no incluye `tax_id`, `tax_regime`, `website`, `timezone`, `ticket_header`, `ticket_footer`, `printer_name`, `branding_config`. Admin no puede editarlos por la PUT. | MEDIUM | Extender whitelist. |
| B-04 | `platform.py:261-311` `assign_org_admin` | Dos `db.commit()` (líneas 281 y 310). Si segundo falla, queda usuario creado sin asociación. | MEDIUM | Una sola transacción. |
| B-05 | `platform.py:335-375` `bootstrap_organization` | Sin `_audit()` log. Cambia estado creando branches pero no deja rastro. | LOW | Añadir audit. |
| B-06 | `platform.py:377-417` `export_organization_data` | Solo exporta customers. Nombre sugiere export completo. `"export_date": "NOW"` literal string. | MEDIUM | Completar con products/sales/branches/users y usar `datetime.utcnow().isoformat()`. |
| B-07 | `platform.py:876-879` `get_module_catalog` | Devuelve ORM sin schema. Serialización implícita. | LOW | Añadir `response_model=List[ModuleRead]`. |
| B-08 | `platform.py:1020-1033` `get_industry_presets_legacy` | Endpoint legacy duplicado (`/modules/presets`) retorna formato distinto. Puede confundir. | LOW | Marcar deprecated en docstring. |

**Nota:** Bugs backend se documentan aquí pero NO se arreglan en este PR. Se abrirá branch `fix/platform-backend-orgs` separado tras validar beta.

**Excepción:** F-07 / B-02 cruzan frontend↔backend. Decisión: alinear **frontend** al backend (`key`, no `module_key`) en Phase B, porque el backend es la fuente de verdad y no podemos cambiar el contrato sin coordinar con otros consumers.

---

## A3 — Feature Gap Verification

Para cada gap, verifiqué `platformApi.<method>` en `platform.ts` + endpoint en `platform.py`.

| # | Feature | Jinja2 | React | API wrapper | Backend endpoint | Priority |
|---|---------|:------:|:-----:|:-----------:|:----------------:|:---------|
| G1 | **Impersonation** | ✅ | ❌ | ✅ `impersonate`, `exitImpersonate` (platform.ts:204-209) | ✅ POST `/impersonate`, POST `/impersonate/exit` (platform.py:810, 849) | **HIGH** |
| G2 | **Export JSON org** | ✅ | ❌ (API wired, UI no) | ✅ `exportOrg` (platform.ts:121) | ✅ GET `/organizations/{id}/export` (platform.py:377) — **parcial: solo customers** | **HIGH** |
| G3 | **Reset preset** | ✅ | ❌ | ✅ `resetPreset` (platform.ts:130) | ✅ POST `/organizations/{id}/reset-preset` (platform.py:969) | MEDIUM |
| G4 | **Apply preset** (separado de bootstrap) | ✅ | ❌ | ✅ `applyPreset` (platform.ts:127) | ✅ POST `/organizations/{id}/apply-preset` (platform.py:709) | MEDIUM |
| G5 | **Delete org desde detail** | ✅ | ❌ (solo en list) | ✅ `deleteOrg` | ✅ DELETE `/organizations/{id}` | **HIGH** |
| G6 | **Reload/refresh button** | ✅ | ❌ | n/a (re-call `load()`) | n/a | LOW |
| G7 | **Bootstrap desde list row** | ✅ | ❌ (solo detail) | ✅ `bootstrapOrg` | ✅ POST `/organizations/{id}/bootstrap` | LOW |
| G8 | **Export presets JSON** | ✅ | ❌ | ❌ — no hay método wrapper | ❌ **Backend missing** — no existe `/presets/export` | LOW (client-side blob) |
| G9 | **Filter presets by category** | ✅ | ❌ | n/a (client-side) | n/a | MEDIUM |
| G10 | **Module catalog viewer (STABLE/BETA)** | ✅ | ❌ | ✅ `getModulesCatalog` (platform.ts:172) | ✅ GET `/modules/catalog` (platform.py:876) — devuelve ORM sin schema (ver B-07) | MEDIUM |
| G11 | **Industry comparison modal** | ✅ | ❌ | n/a (client-side sobre `getPresets()`) | n/a | LOW |
| G12 | **Filter module status STABLE/BETA** | ✅ | ❌ | n/a (client-side) | n/a | LOW |
| G13 | **Summary stats** (count_industries, avg_modules, most_used) | ✅ | ❌ | ✅ `industryDistribution` + compute client-side | ✅ GET `/stats/industry-distribution` | LOW |
| G14 | **selectAll/deselectAll en modal** | ✅ | ❌ | n/a (UI state) | n/a | MEDIUM |

**Priority updates vs tarea original:**
- G2 (Export) subió de HIGH → **HIGH** pero con nota: backend solo exporta customers (B-06). UI debe advertir limitación hasta que backend se expanda.
- G8 Export presets JSON: plan original dice `API existe?` → **confirmado: no existe endpoint**. Se hace client-side con blob desde data ya cargada.
- G10 Module catalog: backend existe pero devuelve ORM sin schema. Tipar estrictamente en cliente.

---

## A4 — Data Model Observations

### Campos en `Organization` no expuestos en formularios React

De `app/models/organization.py:114-164`:

| Campo | Expuesto en UI? | Editable por PUT backend? |
|-------|:--------------:|:-------------------------:|
| `name` | ✅ | ✅ |
| `legal_name` | ❌ | ✅ |
| `tax_id` (RFC) | ❌ | ❌ (no whitelist) |
| `tax_regime` | ❌ | ❌ |
| `address` | ❌ (en form create inicial sí pero no en edit) | ✅ |
| `phone` | ✅ | ✅ |
| `email` | ✅ | ✅ |
| `website` | ❌ | ❌ |
| `logo_url` | ❌ | ✅ |
| `ticket_header` / `ticket_footer` | ❌ | ❌ |
| `printer_name` | ❌ | ❌ |
| `latitude` / `longitude` / `maps_url` | ❌ | ❌ |
| `timezone` | ❌ | ❌ |
| `status` | ✅ (indirecto vía suspend/activate) | n/a (endpoint dedicado) |
| `plan` | ❌ | ❌ (sin endpoint) |
| `industry_type` | ✅ parcial (9 de 19) | ✅ vía PATCH /industry |
| `branding_config` | ❌ | ❌ |
| `hq_branch_id` | ❌ | ❌ (bootstrap lo crea) |
| `is_active` | ❌ (duplica `status`) | ❌ |
| `created_at` | ✅ (solo lectura) | — |
| `updated_at` | ❌ | — |

**Recomendación:** Fase B/C expone al menos `legal_name`, `logo_url` y `address` en editForm (están en whitelist). Los demás (`tax_id`, `website`, `timezone`, `ticket_*`) requieren extensión del whitelist backend → backend PR.

### `IndustryType` enum — 19 values, UI muestra 9

Missing en `PlatformOrgDetail.tsx:227`:

```
DISTRIBUTOR_POS, ECOMMERCE, DENTAL, PROFESSIONAL_SERVICES,
CAFE_BAKERY, FLEET_SERVICE, SALES_DISTRIBUTION,
B2B_ENTERPRISE, WAREHOUSE_LOGISTICS, MANUFACTURING_LIGHT
```

**Propuesta:** Fase B: crear `frontend/src/types/organization.ts` con array centralizado derivado del enum backend. Reutilizar en PlatformOrgDetail + PlatformPresets + filtros (G9).

---

## Surprises no listadas en el plan original

1. **F-07 / B-02 módulos rotos en runtime** — tipo desalineado. Es **CRITICAL** (toggles no funcionan). Se arregla en Phase B fixando el tipo frontend (no backend).
2. **G2 export parcial** — backend solo devuelve customers, no es un backup completo como sugiere el título en Jinja. Lo marcamos como limitación visible en UI.
3. **G8 backend missing** — no hay `/presets/export`; se implementa 100% client-side con `Blob`.
4. **F-09 N+1 de usuarios** — `getUsers()` sin filtro. Performance issue real para platforms con muchos orgs. Requiere extender `platformApi.getUsers()` para aceptar `{organization_id}`.
5. **Whitelist backend (B-03) incompleta** — `legal_name`, `address`, `logo_url` están en whitelist, pero UI no los expone. Sin bug nuevo, solo feature parity.

---

## Plan de fixes por severity (para Phase B)

### Arreglar en Phase B
- **CRITICAL:** F-03, F-07 (2)
- **HIGH:** F-01, F-02, F-08, F-09, F-10, F-11, F-14, F-15, F-20, F-21, F-22 (11)
- **MEDIUM:** F-04, F-06, F-12, F-13, F-16, F-17, F-19, F-24 (8)

### Deferred (LOW en audit; listar como "known, defer")
- F-05 aria-label delete btn
- F-18 `any` casts (F-18, F-23)
- B-* todos los backend (PR separado)

### Backend-blocked (no se pueden arreglar sin cambio de backend; documentar y saltar)
- F-16 parcial: hasta 19 industrias — se puede hacer en frontend sin backend.
- G2 export incompleto — frontend solo puede descargar lo que backend devuelve.

### Conteo para Phase B
- Arreglables solo frontend: **21 bugs** (2 CRITICAL + 11 HIGH + 8 MEDIUM)
- Skipped LOW + backend: documentados arriba.

---

## Phase B — Commit map (ejecutado 2026-04-20)

| Commit | SHA | Bugs arreglados |
|--------|-----|-----------------|
| 1 | `37e78b1` | F-07 (CRITICAL) |
| 2 | `5670d6a` | F-09 (HIGH) |
| 3 | `a9b6eeb` | F-01, F-02, F-03 (2 HIGH + 1 CRITICAL) |
| 4 | `f0bae2e` | F-08, F-10, F-11, F-12, F-13, F-14, F-15, F-19 (6 HIGH + 2 MEDIUM) |
| 5 | `de6a422` | F-16 (MEDIUM) |
| 6 | `351e483` | F-20, F-21, F-22, F-24 (3 HIGH + 1 MEDIUM) |

**Total fixes Phase B: 17 bugs** (2 CRITICAL + 11 HIGH + 4 MEDIUM).

### Deferred (known, no fix en este PR)

| # | Severity | Razón |
|---|:--------:|-------|
| F-04 | MEDIUM | Delete en list mantiene `confirm()` nativo; destructivo serio (delete-org) se cubre en Phase C2 con doble modal. |
| F-06 | MEDIUM | Expandir create form con legal_name/address/website — se consolida con F-17 (edit form) en Phase C5/G10. |
| F-17 | MEDIUM | Expandir edit form con legal_name/address/logo_url — agendado para Phase C5/G10 por instrucción del usuario. |
| F-05 | LOW | aria-label en delete btn (list). Parcialmente cubierto: el toggle de módulo ya tiene aria-label; los demás icon-btns quedan para un pass de accesibilidad separado. |
| F-18 | LOW | `(editForm as any)` / `(adminForm as any)` casts. No impacta runtime. |
| F-23 | LOW | `(form as any)` cast en PlatformPresets. Idem. |
| B-01..B-08 | varios | Backend bugs — PR separado `fix/platform-backend-orgs`. |

---

## Phase C — Features (ejecutado 2026-04-20)

| Commit | SHA | Features |
|--------|-----|----------|
| 7 | `edda055` | C1 Impersonation (store + banner + modal), C2 Delete org doble-confirm, C3 Export detail + notice, C4 Apply/Reset preset, C8 Refresh, G10 edit form expandido |
| 8 | `f724a3c` | C3 Export icon en row + C9 Bootstrap desde row |
| 9 | `e6bf2ee` | C5 selectAll/deselectAll + C6 filter & stats + C7 module catalog viewer |
| 10 | `015a5a9` | UX honesto sobre impersonation (backend es audit-only) |

### C1 — Ajuste post-verificación (backend audit-only)

El endpoint `POST /platform/impersonate` (`app/routers/platform.py:810-847`) **NO emite un JWT nuevo** ni **setea ninguna cookie**. Solo escribe un `PlatformAuditLog` con `action="IMPERSONATE_START"` (líneas 830-836). El comment en línea 839 lo reconoce explícitamente:
```python
# In a real JWT app, we would issue a new JWT with 'impersonator_id' claim.
```

El axios client (`frontend/src/api/client.ts:9-20`) sigue enviando el token original del superadmin + su `X-Organization-ID`. Por lo tanto:
- UI cambiada de "Impersonate" → "Audit Mode"
- Banner muestra "AUDIT MODE · OBSERVING {org}"
- Modal de confirmación incluye bloque amber: *"El backend no emite un token nuevo: tu sesión sigue siendo superadmin. Accedes a la org vía X-Organization-ID, no como su admin."*
- `TODO(backend)` en `ImpersonationBanner.tsx` documenta cuándo cambiar copy si se agrega token swap.

### Features no implementadas

- **G8 Export presets JSON** — backend no tiene endpoint. Implementable 100% client-side con Blob; queda para PR separado si se prioriza.


