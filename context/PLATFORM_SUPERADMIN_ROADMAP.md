# Atlas · Plataforma SUPERADMIN — Roadmap creativo

> Objetivo: convertir `/platform/*` de "consola de config" a **mission control SaaS** — observabilidad, growth, ops, revenue y IA en un solo lugar.
> Base: 56 endpoints en `app/routers/platform.py` (2188 LOC) + 9 subpáginas UI V2 ya shipped.

---

## 1. Inventario — qué existe hoy

### Endpoints agrupados

| Área | Endpoints | UI |
|---|---|---|
| **Stats globales** | `GET /stats/global`, `/stats/trends`, `/stats/industry-distribution`, `/stats/top-tenants` | ✅ PlatformMetrics V2 |
| **Organizaciones CRUD** | `POST/GET/PUT/DELETE /organizations`, `/organizations/{id}`, `/dependencies`, `/archive`, `/unarchive`, `/suspend`, `/activate`, `/bootstrap`, `/export` | ✅ PlatformOrganizations |
| **Sucursales** | `GET/POST/PUT/DELETE /branches`, `/branches/{id}/archive`, `/unarchive`, `/dependencies` | ✅ PlatformBranches |
| **Usuarios globales** | `GET/POST/PUT/DELETE /users`, `/users/{id}/dependencies`, `/reset-password`, `/role` | ✅ PlatformUsers |
| **Admins de plataforma** | `GET/POST /admins`, `/admins/{id}/role`, `/admins/{id}` | ✅ PlatformAdmins |
| **Módulos (catálogo)** | `GET/POST/PUT/DELETE /modules`, `/modules/catalog`, `/modules/counts`, `/modules/{key}/dependencies`, `/modules/presets` | ✅ PlatformModules |
| **Presets por industria** | `GET/POST/PUT/DELETE /presets`, `/presets/{id}` | ✅ PlatformPresets |
| **Capacidades de org** | `GET /organizations/{id}/modules`, `PATCH /modules/{key}`, `PATCH /industry`, `POST /apply-preset`, `/reset-preset` | ✅ PlatformOrgDetail (parcial) |
| **Impersonación** | `POST /impersonate`, `/impersonate/exit` | ⚠️ Audit-only (no token swap) |
| **Audit log** | `GET /audit/logs` | ✅ PlatformAuditLog |

### Lo que NO tiene el SUPERADMIN hoy
- Dashboard real-time (todo es snapshot al cargar; sin WebSocket/SSE)
- Alertas / notificaciones (ej. "org X perdió 80% ventas hoy")
- Billing / facturación / invoices (modelo `plan` existe como string pero sin ciclo)
- Health checks por tenant (DB size, última venta, uptime interno)
- Comparativos entre orgs (benchmark mes/año)
- Feature flags por org (existe `OrganizationModule` pero sin UI de A/B)
- Gestión de backups / restore por org
- Onboarding wizard (crear org + admin + branch + preset en un flujo guiado)
- Importación masiva (CSV de orgs/users/branches)
- Búsqueda global cross-tenant (hoy hay que ir página por página)
- Comunicación con tenants (announcements, banners)
- Rate limiting / API quotas por org
- Logs de errores runtime (no solo audit de acciones)
- Experimentos / rollouts graduales
- Soporte y tickets
- SLA / uptime tracking
- Cost per tenant (cuánto consume cada uno)

---

## 2. Gaps críticos por severidad

🔴 **Bloqueantes para un SaaS serio**
1. Impersonación real (hoy solo audita, no swap de token) → bloqueado en backend
2. No hay billing: `plan` y `status` son strings sueltos sin ciclo de renovación, sin invoice, sin trial timer
3. No hay alertas — si una org deja de facturar, nadie se entera hasta que abres el dashboard

🟡 **Fricción operativa alta**
4. Crear org nueva requiere 5 clicks en 3 páginas (org → admin → branch → preset → modules). Hay `bootstrap` endpoint pero sin wizard UI.
5. No hay búsqueda global ("¿en qué org está el usuario juan@x.com?")
6. Audit log es crudo (JSON blobs en payload) — sin filtros visuales ni timeline
7. No hay comparativos — KPIs son absolutos, no relativos a mes pasado ni benchmarks

🟢 **Oportunidades de delight**
8. AI copilot dentro del panel (query en lenguaje natural → SQL seguro sobre los models)
9. "Incident mode" — pausar todas las orgs de una industria con un click
10. Exportes programados (reporte semanal de plataforma por email)

---

## 3. Roadmap creativo — organizado por eje

### 🎯 Eje A · Intelligence (observabilidad viva)

**A1. Real-time activity stream** — ticker lateral en la app que muestra: ventas recién creadas, orgs activadas, errores 5xx, usuarios logueándose. SSE desde el backend, filtrable por tipo de evento.
- Backend: `GET /platform/stream` (text/event-stream), feed de tablas + NOTIFY/LISTEN de Postgres
- UI: panel colapsable en `PlatformLayout` tipo Vercel "recent activity"

**A2. Health matrix** — grid de orgs × métricas críticas (última venta, DB size, errores 24h, usuarios activos, ratio módulos enabled). Verde/ámbar/rojo.
- Endpoint nuevo: `GET /platform/health/matrix`
- UI: nueva página `/platform/health` con tabla densa tipo Datadog

**A3. Anomaly detection básico** — flag automático cuando una org cae >50% en ventas vs. su promedio de 7d. Sin ML, solo z-score sobre `revenue_trend`.
- Endpoint: `GET /platform/alerts/active`, `POST /platform/alerts/{id}/ack`
- Tabla nueva: `platform_alert` (org_id, severity, kind, first_seen, acked_at, resolved_at)

**A4. Comparativos cross-tenant** — en `OrgDetail`, mostrar percentil de esta org vs. el resto de su industria (ej. "top 23% en ticket promedio").
- Endpoint: `GET /organizations/{id}/benchmark` — devuelve percentiles
- UI: card nueva "Benchmark" en OrgDetail

**A5. Timeline visual de audit log** — reemplazar la tabla cruda por feed editorial con grouping por día, chips por `action`, JSON payload renderizado bonito, diff antes/después cuando aplica.
- Backend: mejorar `/audit/logs` con `before_json`/`after_json` en payload (cambio futuro)
- UI: rediseñar PlatformAuditLog con `LatestFeed` style

---

### 🚀 Eje B · Growth & Onboarding

**B1. Onboarding wizard** — un solo flujo `/platform/orgs/new` en 4 pasos: Identidad (name, industry, timezone) → Preset (modules recomendados) → HQ Branch → Primer admin. Un endpoint unificado `POST /organizations/bootstrap` que hoy existe pero sin UI amigable.
- UI: stepper con back/next, preview de módulos que se activarán

**B2. Import masivo CSV** — pegar CSV de orgs/users/branches con preview → validación → commit batch.
- Endpoint: `POST /platform/imports/preview` (devuelve diffs), `POST /platform/imports/commit`
- UI: página `/platform/imports` con dropzone + tabla preview

**B3. Templates de org** — "duplicar org X como template" para casos piloto. Clona modules, presets, branches (sin datos).
- Endpoint: `POST /organizations/{id}/clone` (ya parecido con bootstrap)
- UI: botón en OrgDetail

**B4. Invitación pública de admins** — generar magic link de invitación para que el dueño de la org cree su primer admin sin que el SUPERADMIN maneje contraseñas.
- Tabla nueva: `org_invitation` (token, org_id, email, expires_at, used_at)
- Endpoints: `POST /organizations/{id}/invitations`, `POST /invitations/{token}/claim` (público)
- UI: botón "Enviar invitación" en OrgDetail → genera link copiable

---

### 💰 Eje C · Revenue / SaaS tooling

**C1. Plans & subscriptions** — modelo de suscripción real con ciclos, no solo un string.
- Tablas nuevas: `subscription_plan` (name, price_mxn, modules_included, limits_json), `org_subscription` (org_id, plan_id, started_at, current_period_end, status: active/past_due/cancelled, trial_ends_at)
- Endpoints: `GET/POST /plans`, `POST /organizations/{id}/subscribe`, `/cancel`, `/change-plan`
- UI: nueva página `/platform/billing` + card "Subscription" en OrgDetail

**C2. Usage metering** — cuenta transactions, API calls, storage por org/mes.
- Tabla nueva: `usage_counter` (org_id, metric, period_ym, value)
- Middleware simple en `app/main.py` que incrementa contadores por request
- UI: gráfica usage/plan_limit con barra de consumo

**C3. Invoice lite** — generar invoice mensual por org (PDF via `pdf_generator.py`), listar histórico.
- Tabla: `invoice` (org_id, period, amount, status, pdf_url)
- Endpoint: `GET /organizations/{id}/invoices`, `POST /invoices/{id}/mark-paid`

**C4. Trial countdown** — banner en la UI de cada org cuando quedan ≤7 días de trial, con CTA para convertir.
- Backend: campo `trial_ends_at` en org_subscription
- UI: componente global que lee del endpoint `/organizations/me/subscription`

**C5. Revenue forecasting** — proyección MRR/ARR basada en historia de trials → paid conversions.
- Endpoint: `GET /platform/revenue/forecast`
- UI: card en PlatformMetrics con línea proyectada al final del chart

---

### ⚙️ Eje D · Operational control

**D1. Búsqueda global ⌘K** — hotkey `cmd+k` abre command palette con: orgs por nombre, users por email/username, branches, modules, actions (ir a X, crear Y, suspender Z). Similar a Linear/Raycast.
- Endpoint: `GET /platform/search?q=...&types=org,user,branch`
- UI: CommandPalette component reusable

**D2. Bulk actions** — seleccionar múltiples orgs/users/branches y: archivar, suspender, cambiar plan, enviar anuncio.
- Endpoints: `POST /platform/bulk/archive-orgs`, `/suspend-orgs`, `/change-plan` con `{ids: []}`
- UI: checkbox columna en DataTable + toolbar contextual

**D3. Incident mode** — botón rojo global que: suspende todas las orgs de una industria (ej. fallo de integración de una vertical), envía banner a sus usuarios. Reversible en un click.
- Endpoint: `POST /platform/incidents/start`, `/incidents/{id}/resolve`
- Tabla: `platform_incident` (id, title, scope_type: industry/plan/all, scope_value, started_at, resolved_at, banner_html)
- UI: botón destructivo en la página Metrics con confirm modal

**D4. Announcements / broadcast** — SUPERADMIN envía mensaje que aparece como banner en todas las orgs (o filtradas por industry/plan).
- Tabla: `platform_announcement` (id, title, body_md, severity, targets_json, published_at, expires_at)
- Endpoints: `GET/POST /platform/announcements`, `GET /announcements/active` (público por org context)
- UI: editor markdown + preview + targeting + cronograma

**D5. Scheduled tasks / maintenance windows** — programar suspensión temporal ("todas las orgs retail el domingo 2-4am").
- Tabla: `platform_schedule` (kind, cron_expr, payload_json, last_run_at, next_run_at)
- Requiere scheduler (apscheduler) en `app/main.py`
- UI: lista + editor cron con preview de próximas ejecuciones

**D6. Database introspection por org** — ver tamaño de tabla, conteo de filas, última actividad. Útil para detectar orgs dormidas.
- Endpoint: `GET /organizations/{id}/db-stats` (SELECT pg_total_relation_size, row counts por tabla principal)
- UI: card en OrgDetail

---

### 🔒 Eje E · Security & Compliance

**E1. Impersonación real** — actualizar JWT para incluir `impersonator_id` y `scoped_org_id`, backend valida y scope-limita. Banner visible permanente, todas las acciones quedan con doble autoría.
- Cambio en `app/security/__init__.py`: incluir impersonator claim en token
- Endpoint `/impersonate` debe devolver JWT nuevo, no solo cookie
- UI: ya tiene `ImpersonationBanner` — wire al nuevo flujo

**E2. Two-factor para SUPERADMIN** — obligatorio TOTP o WebAuthn. Sin 2FA no puede entrar a `/platform/*`.
- Tabla: `user_totp` (user_id, secret, enabled_at)
- Endpoints: `POST /users/{id}/2fa/enroll`, `/2fa/verify`, `/2fa/disable`
- UI: flujo de setup con QR + backup codes

**E3. Session management** — ver todas las sesiones activas del SUPERADMIN, revocar remotamente.
- Tabla: `active_session` (user_id, jti, user_agent, ip, created_at, last_seen, revoked_at)
- Endpoint: `GET /users/me/sessions`, `DELETE /sessions/{jti}`
- UI: página `/platform/security/sessions`

**E4. IP allowlist para panel SUPERADMIN** — solo ciertos IPs pueden acceder a `/platform/*`.
- Settings: tabla `platform_config` con `allowed_ips` JSON array
- Middleware: `require_platform_admin` verifica IP
- UI: página `/platform/security/network`

**E5. Export de auditoría a SIEM** — endpoint que devuelve audit_log incremental en formato CEF/JSON para Splunk/Datadog.
- Endpoint: `GET /platform/audit/export?since=...&format=cef`
- UI: página para configurar webhook/destino + preview

**E6. Compliance reports** — "who accessed what" — exportes predefinidos por org/date range.
- Endpoint: `GET /platform/compliance/reports/{kind}` (kinds: gdpr_access, data_deletion, admin_actions)
- UI: página `/platform/compliance` con botones de export

---

### 🧪 Eje F · Feature platform

**F1. Feature flags per-org** — ya existe `OrganizationModule` pero podemos extenderlo con rollout %, A/B groups.
- Tabla: `feature_flag` (key, default_enabled, rollout_pct), `org_feature_override` (org_id, key, enabled, variant)
- Endpoints: `GET/POST /platform/flags`, `PATCH /organizations/{id}/flags/{key}`
- UI: página `/platform/flags` con toggles + porcentaje + lista de orgs con override

**F2. Gradual rollouts** — "activar módulo X al 10% de orgs retail, subir 5% cada día". Scheduler lo ejecuta.
- Tabla: `rollout_plan` (module_key, scope, current_pct, target_pct, step, cadence_hours)
- UI: wizard de rollout con timeline visual

**F3. Kill switch por módulo** — desactivar un módulo globalmente si está roto, sin redeploy.
- Extiende `Module` con `is_killed: bool`
- `require_module` respeta el flag
- UI: botón "Kill" rojo en PlatformModules

---

### 🤖 Eje G · AI-assisted ops

**G1. Natural language query** — "¿Cuántas orgs retail activas en CDMX con plan ENTERPRISE?" → traducción a SQL con Claude, validación, ejecución read-only.
- Endpoint: `POST /platform/ai/query { prompt }` → `{ sql, results }`
- Backend: Claude API con tool calling + schema whitelist
- UI: input tipo chat en la página Metrics (aprovecha que ya hay Anthropic SDK candidato)

**G2. Auto-suggest para presets** — al crear org, Claude sugiere module bundle basado en industria + tamaño (# branches planeadas).
- Endpoint: `POST /platform/ai/suggest-preset { industry, branches_estimated, use_case }`
- UI: botón "Sugerir módulos" en el wizard de onboarding

**G3. Anomaly explanation** — cuando hay alerta de caída, Claude explica en lenguaje natural qué cambió ("ventas cayeron porque branch X no tuvo sesión de caja hoy").
- Endpoint: `POST /platform/ai/explain-anomaly { alert_id }`
- UI: card en alertas con "Explicar con IA"

**G4. Smart org health score** — índice 0-100 por org basado en: ventas activas, usuarios activos, módulos usados, errores. Ponderado por Claude una vez para calibrar pesos.
- Endpoint: `GET /organizations/{id}/health-score` (cacheado 1h)
- UI: gauge en OrgDetail + columna en PlatformOrganizations

---

### 🛠️ Eje H · Developer platform

**H1. API keys por org** — cada org puede tener tokens de API server-to-server, SUPERADMIN los gestiona.
- Tabla: `api_key` (id, org_id, name, hashed_key, scopes, last_used_at, revoked_at)
- Endpoints: `GET/POST /organizations/{id}/api-keys`, `DELETE /api-keys/{id}`
- UI: página `/platform/api-keys` cross-tenant

**H2. Webhooks outbound** — org-level webhooks a eventos (sale.created, org.updated).
- Tabla: `webhook_endpoint`, `webhook_delivery`
- Endpoints: CRUD + `POST /webhook-deliveries/{id}/retry`
- UI: editor + log de deliveries con status

**H3. SDK playground** — página con curl/Python/JS snippets generados dinámicamente para cada endpoint de `/api/*`, tomando un API key real.
- UI: página `/platform/api-docs` que lee del OpenAPI schema de FastAPI

---

## 4. Priorización sugerida

### 🏃 Sprint 0 — quick wins (1-2 PRs cada uno)
1. **D1** Command palette ⌘K (alta ergonomía, UI aislada)
2. **A5** Timeline visual para audit log (rediseño de página existente)
3. **B1** Onboarding wizard (usa endpoint `/bootstrap` existente)
4. **D2** Bulk actions en tablas (extiende DataTable)

### 🚴 Sprint 1 — capabilities (2-4 PRs)
5. **A2** Health matrix
6. **A3** Anomaly detection básico + alertas
7. **D4** Announcements system
8. **E3** Session management

### 🚗 Sprint 2 — SaaS serio (tabla nueva + backend + UI)
9. **C1** Plans & subscriptions — **bloqueante para monetizar**
10. **C2** Usage metering
11. **E1** Impersonación real con JWT
12. **E2** 2FA obligatorio

### 🚀 Sprint 3 — diferenciadores
13. **G1** AI natural language query (usa Claude SDK)
14. **F2** Gradual rollouts
15. **H1+H2** API keys + webhooks

### 🛰️ Longer term
16. **A1** Real-time activity stream (requiere SSE infra)
17. **D5** Scheduled tasks (requiere worker)
18. **H3** SDK playground auto-generado
19. **C3+C4** Invoice + trial countdown
20. **G4** Health score con IA

---

## 5. Quick wins visuales (sin backend nuevo, menos de 1 día cada uno)

- **Sticky KPIs en tabla Organizations** — freeze los 4 KPIs del top al scrollear.
- **Inline editing** en tabla: click en celda `status` → dropdown inline, PATCH al instante.
- **Keyboard shortcuts** (`g o` = go organizations, `g u` = go users, `n` = new).
- **Dark/Light toggle para platform panel** — ya hay sistema de temas en la SPA.
- **Preview modal en row hover** — hover 500ms sobre una org → tooltip con mini-stats.
- **Empty states ilustrativos** — hoy dicen "sin datos"; agregar copy + CTA ("Aún no hay orgs · [Crear una]").
- **Breadcrumb clickeable con dropdown** para cambiar entre secciones rápido.
- **Toast stack con undo** — "Org archivada. [Deshacer]" (5s).

---

## 6. Decisiones que necesito antes de arrancar

1. **¿Monetización real ya o después?** — C1+C2+C3 es un mini-stripe interno. Si no la vamos a usar este trimestre, skip.
2. **¿Multi-idioma del panel?** — hoy solo ES. ¿Traducir a EN para clientes internacionales?
3. **¿Usamos Claude API integrada o no?** — G1-G4 son matadores pero añaden costos + dependencia externa.
4. **¿Permitir SUPERADMIN múltiples o único?** — hoy múltiples pero audit log no distingue bien. Si son >1, necesitamos E3 (sessions).
5. **¿Tiempo real vs snapshot?** — A1 (SSE) agrega complejidad de infra (proxies, reconnect). Snapshot con refresh manual + auto-poll 30s puede ser suficiente.

---

## 7. Arquitectura implícita

Si ejecutamos todos los ejes, el panel termina con:

```
/platform/
├── metrics           · ✅ ya shipped V2
├── health            · 🆕 A2 · matrix por org
├── alerts            · 🆕 A3 · inbox de anomalías
├── organizations     · ✅ + bulk D2 + commandK D1
├── organizations/:id · ✅ + benchmark A4 + health-score G4 + API keys H1 + subscription C1
├── users             · ✅
├── admins            · ✅
├── branches          · ✅
├── modules           · ✅ + rollouts F2 + kill F3
├── presets           · ✅
├── flags             · 🆕 F1 · feature flags cross-tenant
├── billing           · 🆕 C1 · plans, invoices, MRR
├── announcements     · 🆕 D4 · broadcast editor
├── incidents         · 🆕 D3 · kill switch por industria
├── imports           · 🆕 B2 · CSV bulk
├── api-keys          · 🆕 H1
├── webhooks          · 🆕 H2
├── api-docs          · 🆕 H3 · SDK playground
├── audit             · ✅ rediseñado A5
├── compliance        · 🆕 E6
├── security/
│   ├── sessions      · 🆕 E3
│   └── network       · 🆕 E4 · IP allowlist
└── ai/               · 🆕 G1 · nlq chat
```

---

## 8. Qué NO haría

- Multi-región o sharding — overkill para el tamaño actual.
- Service mesh / micro-services split — mantener monolito FastAPI.
- Rebuild de frontend en Next.js o similar — Vite+React funciona bien.
- ML propio — usar Claude para G1-G4 en vez de entrenar modelos.
- Sistema de tickets complejo (HelpScout) — basta con una inbox simple si hace falta.

---

## 9. Próximo paso sugerido

Arrancar por **Sprint 0** (Command palette + Audit timeline + Wizard de onboarding + Bulk actions). Son 4 PRs independientes, 100% frontend con endpoints existentes, nos dan el 40% del valor percibido del plan.

Si me dices que sí a ese sprint, lo rompo en 4 PRs separados y empiezo por el Command Palette ⌘K (mayor impacto en productividad del SUPERADMIN).
