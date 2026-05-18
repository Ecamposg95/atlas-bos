# Atlas One Appointments MVP — Design

**Date:** 2026-05-18
**Status:** Approved (pending user review of this written spec)
**Owner:** Backend + Frontend platform
**Related:** [`docs/modules/MODULE_GUIDE.md`](../../modules/MODULE_GUIDE.md), [`context/ATLAS_ONE_PRESETS_TAXONOMY.md`](../../../context/ATLAS_ONE_PRESETS_TAXONOMY.md), [`docs/superpowers/specs/2026-05-13-presets-expansion-design.md`](2026-05-13-presets-expansion-design.md)

---

## 1. Context

El módulo `appointments` hoy es un stub: `app/modules/appointments/router.py` solo expone `/health` que devuelve `{ready: false}`. Está habilitado por 5 presets Atlas One (`BARBER`, `BEAUTY_WELLNESS`, `HEALTH`, `SERVICES`, y el legacy `BEAUTY`), así que el día que un cliente real activa cualquiera de esos verticales, el sidebar muestra "Agenda" pero la pantalla es una card "Próximamente". Es la mayor brecha entre lo que vendemos y lo que entregamos.

Este spec define el MVP completo de Appointments para cerrar esa brecha. Decisiones del usuario en brainstorming (2026-05-18):

- **Alcance**: MVP completo (3-4 semanas) — CRUD + calendario + reservas online + recordatorios manuales + integración con commissions.
- **Recursos**: profesional + recurso (cabina/silla/consultorio) por cita.
- **Servicios**: multi-servicio por cita (corte + tinte = 1 cita 2h).
- **Reserva online**: portal de cliente con cuenta propia (email + password).
- **Recordatorios**: botón manual de WhatsApp (link wa.me).
- **Commissions link**: en `complete` con `actual_professional_id` opcional para resolver "Juan tenía cita, atendió Pedro".

## 2. Goal

Que cualquier org con preset `ATLAS_ONE_BARBER`/`BEAUTY_WELLNESS`/`HEALTH`/`SERVICES` pueda:

1. Configurar profesionales con horarios semanales y bloques (vacaciones).
2. Configurar recursos (cabinas/sillas/consultorios) y servicios (productos con duración).
3. Ver un calendario semana/día por profesional, agendar citas para clientes existentes.
4. Pasar la cita por el lifecycle (`PENDING → CONFIRMED → IN_PROGRESS → COMPLETED`).
5. Enviar recordatorios manuales por WhatsApp.
6. Exponer un portal público `/book/<org-slug>/<branch-slug>` donde clientes finales pueden registrarse, ver servicios/horarios y agendar solos.
7. Al completar la cita, registrar quién atendió realmente, listo para que el módulo `commissions` lo consuma cuando sea su turno.

## 3. Non-goals (out of scope)

- Recordatorios automáticos por cron (email, WhatsApp Business API).
- Drag-and-drop en el calendario para reagendar (usar formulario).
- Recurrencia automática de citas ("cada 2 semanas").
- Cálculo automático de comisiones — este MVP solo deja la pista (`actual_professional_id` + venta ligada).
- Cobro adelantado o depósito al agendar.
- Push notifications.
- Integración con Google Calendar / iCal / Outlook.
- Tests de frontend (solo `tsc --noEmit` + smoke manual).

## 4. Data model

Todas las tablas viven en `app/modules/appointments/models.py`. Todas con `organization_id` (multi-tenant) + `branch_id` donde aplique. Status mantenido con SQLAlchemy `Enum`.

### 4.1 `Resource` (`appointments_resources`)

Cabinas, sillas, consultorios — cualquier espacio físico reservable.

```python
class ResourceType(str, enum.Enum):
    CHAIR = "CHAIR"           # barbería: silla
    CABIN = "CABIN"           # spa/beauty: cabina
    CONSULTORY = "CONSULTORY" # médico
    BAY = "BAY"               # taller: bahía
    TABLE = "TABLE"           # bar (futuro)

class Resource(Base, TenantMixin):
    __tablename__ = "appointments_resources"
    id              = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id       = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    name            = Column(String, nullable=False)
    resource_type   = Column(Enum(ResourceType), nullable=False)
    capacity        = Column(Integer, nullable=False, default=1)
    is_active       = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
```

### 4.2 `Professional` (`appointments_professionals`)

Extensión 1:1 de `User` con metadata de agenda. Un User existe sin Professional; solo los que se marcan como tales aparecen en el calendario.

```python
class Professional(Base, TenantMixin):
    __tablename__ = "appointments_professionals"
    id                  = Column(Integer, primary_key=True)
    organization_id     = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    user_id             = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    branch_id           = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    default_resource_id = Column(Integer, ForeignKey("appointments_resources.id"), nullable=True)
    color               = Column(String(7), nullable=True)   # "#RRGGBB" para el calendario
    is_bookable         = Column(Boolean, nullable=False, default=True)
    bio                 = Column(String, nullable=True)
    photo_url           = Column(String, nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    user     = relationship("User")
    branch   = relationship("Branch")
    default_resource = relationship("Resource")
```

### 4.3 `ProfessionalSchedule` (`appointments_schedules`)

Horario semanal recurrente. Una fila por (profesional, día de la semana).

```python
class ProfessionalSchedule(Base, TenantMixin):
    __tablename__ = "appointments_schedules"
    id              = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    weekday         = Column(Integer, nullable=False)        # 0=lunes ... 6=domingo
    start_time      = Column(Time, nullable=False)
    end_time        = Column(Time, nullable=False)
    __table_args__ = (UniqueConstraint("professional_id", "weekday", name="uq_sched_prof_weekday"),)
```

### 4.4 `ProfessionalBlock` (`appointments_blocks`)

Bloques puntuales: vacaciones, juntas, día libre.

```python
class ProfessionalBlock(Base, TenantMixin):
    __tablename__ = "appointments_blocks"
    id              = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    starts_at       = Column(DateTime(timezone=True), nullable=False)
    ends_at         = Column(DateTime(timezone=True), nullable=False)
    reason          = Column(String, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
```

### 4.5 `Service` (`appointments_services`)

Extensión 1:1 de `ProductVariant`: un servicio es un producto que tiene duración. Reúsa pricing/IVA/etc. existentes del catálogo.

```python
class Service(Base, TenantMixin):
    __tablename__ = "appointments_services"
    id                       = Column(Integer, primary_key=True)
    organization_id          = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    product_variant_id       = Column(String(36), ForeignKey("product_variants.id"), nullable=False, unique=True)
    duration_minutes         = Column(Integer, nullable=False)
    buffer_minutes_after     = Column(Integer, nullable=False, default=0)
    requires_resource_type   = Column(Enum(ResourceType), nullable=True)
    is_bookable_online       = Column(Boolean, nullable=False, default=True)
    created_at               = Column(DateTime(timezone=True), server_default=func.now())

    variant = relationship("ProductVariant")
```

### 4.6 `Appointment` (`appointments`)

```python
class AppointmentStatus(str, enum.Enum):
    PENDING      = "PENDING"
    CONFIRMED    = "CONFIRMED"
    IN_PROGRESS  = "IN_PROGRESS"
    COMPLETED    = "COMPLETED"
    CANCELED     = "CANCELED"
    NO_SHOW      = "NO_SHOW"

class BookingChannel(str, enum.Enum):
    STAFF  = "STAFF"
    PORTAL = "PORTAL"

class Appointment(Base, TenantMixin):
    __tablename__ = "appointments"
    id                  = Column(Integer, primary_key=True)
    organization_id     = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id           = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    customer_id         = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    professional_id     = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    resource_id         = Column(Integer, ForeignKey("appointments_resources.id"), nullable=True, index=True)
    starts_at           = Column(DateTime(timezone=True), nullable=False)
    ends_at             = Column(DateTime(timezone=True), nullable=False)
    status              = Column(Enum(AppointmentStatus), nullable=False, default=AppointmentStatus.PENDING)
    notes               = Column(String, nullable=True)
    booking_channel     = Column(Enum(BookingChannel), nullable=False, default=BookingChannel.STAFF)
    actual_professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=True)  # filled on /complete
    sales_document_id   = Column(String(36), ForeignKey("sales_documents.id"), nullable=True)            # filled on /complete
    created_by          = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())
```

Indexes adicionales (críticos para `/availability`):

```sql
CREATE INDEX ix_appt_professional_range ON appointments (professional_id, starts_at, ends_at);
CREATE INDEX ix_appt_resource_range     ON appointments (resource_id, starts_at, ends_at) WHERE resource_id IS NOT NULL;
CREATE INDEX ix_appt_org_branch_starts  ON appointments (organization_id, branch_id, starts_at);
```

### 4.7 `AppointmentService` (`appointments_services_link`)

Many-to-many con snapshot de duración (no se rompe si el servicio cambia después).

```python
class AppointmentService(Base, TenantMixin):
    __tablename__ = "appointments_services_link"
    id              = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    appointment_id  = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    service_id      = Column(Integer, ForeignKey("appointments_services.id"), nullable=False)
    sort_order      = Column(Integer, nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=False)  # snapshot
```

### 4.8 `AppointmentEvent` (`appointments_events`)

Timeline auditable de transiciones de estado.

```python
class AppointmentEventType(str, enum.Enum):
    CREATED      = "CREATED"
    CONFIRMED    = "CONFIRMED"
    STARTED      = "STARTED"
    COMPLETED    = "COMPLETED"
    CANCELED     = "CANCELED"
    NO_SHOW      = "NO_SHOW"
    RESCHEDULED  = "RESCHEDULED"

class AppointmentEvent(Base, TenantMixin):
    __tablename__ = "appointments_events"
    id              = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    appointment_id  = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    event_type      = Column(Enum(AppointmentEventType), nullable=False)
    actor_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    payload         = Column(JSON, nullable=True)   # ej. {"reason": "Cliente reagendó", "from": "...", "to": "..."}
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
```

### 4.9 Status lifecycle

```
                ┌─────────────┐
                │   PENDING   │ ◄── POST /appointments (staff o portal)
                └──────┬──────┘
        /cancel        │  /confirm
       ┌───────────────┴───────────────┐
       ▼                               ▼
  ┌─────────┐                  ┌───────────────┐
  │CANCELED │                  │   CONFIRMED   │
  └─────────┘                  └───────┬───────┘
                                       │ /start
                                       ▼
                              ┌────────────────┐
                              │  IN_PROGRESS   │
                              └────────┬───────┘
                       /no-show        │  /complete
                       ┌───────────────┴───────────────┐
                       ▼                               ▼
                  ┌─────────┐                   ┌─────────────┐
                  │ NO_SHOW │                   │  COMPLETED  │
                  └─────────┘                   └─────────────┘
```

Cualquier transición inválida (ej. PENDING → COMPLETED directo) responde 409 Conflict con detalle del estado actual.

## 5. API surface

Todos los endpoints viven bajo `/api/appointments`. Backoffice usa `require_module("appointments")` + `get_tenant_scoped` (helper de `app/core/tenant_query.py`). Portal de cliente usa auth separado por `Customer`.

### 5.1 Resources

```
GET    /resources                                  → list (filter: branch_id)
POST   /resources                                  → create
PUT    /resources/{id}                             → update
DELETE /resources/{id}                             → soft-delete (is_active=false)
```

### 5.2 Professionals + schedule + blocks

```
GET    /professionals                              → list (filter: branch_id, is_bookable)
POST   /professionals                              → create from existing user_id
PUT    /professionals/{id}                         → update
DELETE /professionals/{id}                         → soft-delete (is_bookable=false)

GET    /professionals/{id}/schedule                → 7-day weekly grid
PUT    /professionals/{id}/schedule                → bulk-replace [{weekday, start_time, end_time}]

GET    /professionals/{id}/blocks                  → list active+future blocks
POST   /professionals/{id}/blocks                  → create
DELETE /blocks/{block_id}                          → delete
```

### 5.3 Services

```
GET    /services                                   → list (servicios bookable)
POST   /services/from-variant                      → upgrade un ProductVariant a Service
PUT    /services/{id}                              → update (duration, buffer, requires_resource_type)
DELETE /services/{id}                              → quitar marca de servicio (ProductVariant intacto)
```

### 5.4 Appointments

```
GET    /availability                               → core endpoint, ver §6
GET    /appointments                               → list (filters: branch_id, from, to, status, professional_id, customer_id)
POST   /appointments                               → create
GET    /appointments/{id}                          → detail + services + events timeline
PUT    /appointments/{id}                          → edit (re-valida disponibilidad si cambian starts_at/services)

POST   /appointments/{id}/confirm                  → PENDING → CONFIRMED
POST   /appointments/{id}/start                    → CONFIRMED → IN_PROGRESS
POST   /appointments/{id}/complete                 → IN_PROGRESS → COMPLETED
                                                     Payload: { sales_document_id?, actual_professional_id? }
POST   /appointments/{id}/cancel                   → → CANCELED (payload: { reason })
POST   /appointments/{id}/no-show                  → → NO_SHOW

DELETE /appointments/{id}                          → soft-delete (uso excepcional)
```

### 5.5 Customer portal (público)

**Auth strategy** — reusa el patrón existente de `app/routers/portal.py`: el cliente final se autentica como `User` con `role=CLIENTE`, no como Customer. El registro de portal crea un User(role=CLIENTE) + opcionalmente vincula a un Customer existente (por email match) o crea uno nuevo. Esto evita agregar `password_hash` a Customer y reusa el flujo `/api/auth/login` ya estable (OAuth2PasswordRequestForm).

```
POST   /portal/booking/register                    → { email, password, name, phone, org_slug }
                                                     → crea User(role=CLIENTE) + Customer linked
                                                     → devuelve token (mismo formato que /api/auth/login)
POST   /portal/booking/login                       → reusa /api/auth/login (form-data username+password)
GET    /portal/booking/me                          → datos del User CLIENTE + Customer linked

GET    /portal/booking/branches?org_slug=          → sucursales públicas (no requiere auth)
GET    /portal/booking/services?branch_id=         → servicios bookable (no requiere auth)
GET    /portal/booking/professionals?branch_id=    → profesionales bookable (sin email/teléfono interno)
GET    /portal/booking/availability                → motor de §6 (no requiere auth para preview)
POST   /portal/booking/appointments                → { service_ids[], starts_at, professional_id? }
                                                     → requiere User(role=CLIENTE) auth
                                                     → booking_channel=PORTAL, created_by=user.id
GET    /portal/booking/appointments                → mis citas (filtrado por customer_id del user)
POST   /portal/booking/appointments/{id}/cancel    → ventana de 24h (configurable por org)
```

Notas:
- Endpoints bajo `/api/portal/booking/...` para no chocar con `/api/portal/...` existente (accounts/finance).
- `customer_id` en `Appointment` se resuelve internamente: el User CLIENTE busca su Customer linked por email match, o el endpoint lo crea on-demand al primer booking.

## 6. `/availability` algorithm

Endpoint más crítico — fuente única de verdad sobre conflictos.

**Input:** `branch_id, date, service_ids[], professional_id?, resource_id?, slot_minutes=15`.

**Algoritmo:**

```python
def get_availability(branch_id, date, service_ids, professional_id=None, resource_id=None, slot_minutes=15):
    # 1. Total duration = suma de duration + buffer
    total = sum(svc.duration_minutes + svc.buffer_minutes_after for svc in services)

    # 2. Profesionales candidatos
    pros = [Professional.get(professional_id)] if professional_id \
           else Professional.bookable_in_branch(branch_id)

    # 3. Pre-cargar TODAS las citas + bloques del día (2 queries) → memoria
    appts_today = Appointment.query.filter(
        Appointment.branch_id == branch_id,
        Appointment.starts_at < end_of_day,
        Appointment.ends_at > start_of_day,
        Appointment.status.in_(['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
    ).all()
    blocks_today = ProfessionalBlock.query.filter(
        ProfessionalBlock.starts_at < end_of_day,
        ProfessionalBlock.ends_at > start_of_day
    ).all()

    # 4. Generar slots por profesional con verificación in-memory
    slots = []
    for prof in pros:
        sched = ProfessionalSchedule.for_weekday(prof.id, date.weekday())
        if not sched:
            continue
        cursor = combine(date, sched.start_time, org.timezone)
        end_of_window = combine(date, sched.end_time, org.timezone)
        while cursor + total <= end_of_window:
            slot_end = cursor + total
            if _slot_free_in_memory(prof, cursor, slot_end, resource_id, appts_today, blocks_today):
                slots.append({"start": cursor, "end": slot_end,
                              "professional_id": prof.id, "resource_id": resource_id})
            cursor += slot_minutes

    return sorted(slots, key=lambda s: (s["start"], s["professional_id"]))
```

**Conflictos:** overlap test estándar — `A.start < B.end AND A.end > B.start`. Aplica a:
- Otras citas activas del mismo profesional.
- Bloques del profesional (vacaciones, juntas).
- Si `resource_id` viene, citas activas con ese `resource_id`.

**Timezone:** `Organization.timezone` (default `America/Mexico_City`). BD almacena UTC; el endpoint interpreta `date` en la timezone de la org. Frontend recibe UTC y formatea local.

**Concurrencia:** en `POST /appointments` y `PUT` (cuando cambia horario), usar Postgres advisory lock por `professional_id` dentro de la misma transacción:

```python
if dialect == "postgresql":
    db.execute(text("SELECT pg_advisory_xact_lock(:lock)"), {"lock": hash(f"prof:{professional_id}") % 2**31})
# re-validar disponibilidad antes de INSERT
# advisory_xact_lock se libera al COMMIT/ROLLBACK
```

SQLite (tests): no-op via dialect branching.

**Performance:** 2 queries por llamada al endpoint, evaluación in-memory. Aceptable para 5-20 profesionales × 1 día. Escala con vista materializada si crece.

**Edge cases:**

| Caso | Comportamiento |
|---|---|
| Profesional sin `ProfessionalSchedule` para ese día | Excluido (0 slots) |
| Profesional `is_bookable=false` | Excluido |
| Servicio con `requires_resource_type='CHAIR'`, sucursal sin sillas activas | HTTP 422 con detalle |
| Cita ocupa parcialmente el slot pedido | Conflicto (cualquier overlap) |
| `date` en pasado | Permitido en GET; POST con `starts_at` en pasado → 400 |
| Cancelación 5 min antes (staff) | OK |
| Cancelación desde portal cliente | Regla 24h por defecto, configurable |

## 7. Frontend

### 7.1 Backoffice (staff)

```
frontend/src/pages/appointments/
├── AppointmentsCalendar.tsx     — calendario semana/día por profesional, side panel detail
├── AppointmentComposer.tsx      — form crear/editar con autocomplete cliente, suggest de slots
├── AppointmentDetail.tsx        — panel lateral con servicios, timeline, botones de acción + WhatsApp
└── AppointmentsSettings.tsx     — tabs Recursos | Profesionales | Servicios
```

**Librería de calendario**: `react-big-calendar` (~50KB gz). Cubre semana+día + drag-and-drop futuro.

**Layout AppointmentsCalendar**:
- Toolbar izquierda: sucursal, vista día/semana, filtros (profesionales, recurso, estatus), botón "Nueva cita".
- Centro: grilla del calendario, columnas = profesionales con `Professional.color`.
- Side panel derecha: detalle de cita seleccionada o composer de nueva cita.

**Botón WhatsApp**: `window.open(\`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(template)}\`)` con plantilla:

> "Hola {nombre}, te recordamos tu cita en {org} el {fecha} a las {hora}. ¿Confirmas tu asistencia?"

### 7.2 Portal cliente

```
frontend/src/pages/portal/booking/
├── PortalBookingFlow.tsx        — wizard 4 pasos: servicio → profesional → fecha → confirmar
├── PortalLogin.tsx              — login + registro inline
└── MyAppointments.tsx           — lista de citas del cliente con cancelar
```

URL pública: `/book/<org-slug>/<branch-slug>`. El `<org-slug>` se deriva del nombre (campo `Organization.slug` nuevo o calculado).

### 7.3 API client

`frontend/src/api/appointments.ts` con tipos `Appointment`, `Resource`, `Professional`, `Service`, `AvailabilitySlot`, `AppointmentEvent` y funciones espejo de los endpoints de §5.

### 7.4 Sidebar update

`frontend/src/components/layout/Sidebar.tsx`: el item `Agenda` (ya gated por `module:'appointments'`) cambia `url` de `/appointments` a `/appointments/calendar`. Coming-soon de appointments se borra.

## 8. Migration + seed + rollout

### 8.1 Schema migration

Las tablas se crean con `Base.metadata.create_all(checkfirst=True)` (que ya corre en `init_database()` de `scripts/railway_init.py`). Los índices compuestos + partial van en `run_migrations()`:

```python
appointment_indexes = [
    "CREATE INDEX IF NOT EXISTS ix_appt_org_branch_starts ON appointments (organization_id, branch_id, starts_at);",
    "CREATE INDEX IF NOT EXISTS ix_appt_professional_range ON appointments (professional_id, starts_at, ends_at);",
    "CREATE INDEX IF NOT EXISTS ix_appt_resource_range ON appointments (resource_id, starts_at, ends_at) WHERE resource_id IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS ix_appt_customer ON appointments (customer_id);",
    "CREATE INDEX IF NOT EXISTS ix_appt_events ON appointments_events (appointment_id, created_at);",
    "CREATE INDEX IF NOT EXISTS ix_blocks_prof_range ON appointments_blocks (professional_id, starts_at, ends_at);",
]
```

El partial index `WHERE resource_id IS NOT NULL` solo se aplica en Postgres (SQLite no soporta partial indexes vía `CREATE INDEX`).

### 8.2 Demo seed

`scripts/seed_demo_orgs.py` extiende los demos de los 4 verticales relevantes (BARBER, BEAUTY_WELLNESS, HEALTH, SERVICES) con:

1. Marcar `demo_cajero_<preset>` como `Professional` con `is_bookable=true`.
2. Crear `ProfessionalSchedule`: Lun-Sáb 9:00-18:00.
3. Crear 1-2 `Resource` con tipo apropiado al preset.
4. Marcar los primeros 4 `ProductVariant` del demo como `Service` con duraciones realistas.
5. Crear 3 citas demo: una HOY confirmada, una HOY+2h pendiente, una AYER completada.

### 8.3 Tests (~25-30)

```
tests/test_appointments_models.py        — 5: status transitions, multi-tenant, eventos
tests/test_appointments_availability.py  — 8-10: working hours, blocks, conflicts, resource req, multi-service
tests/test_appointments_lifecycle.py     — 8: CRUD, cada transición, double-booking 409, actual_professional
tests/test_appointments_portal.py        — 5: register, login, list, book, cancel + multi-tenant isolation
```

Frontend tests: out of scope (proyecto sin tests frontend formales).

### 8.4 Rollout

Tres pushes coordinados:

| Push | Contenido | Verifica |
|---|---|---|
| **1** | Backend (models, schemas, router, services) + migración + tests | Endpoints vivos, CI verde |
| **2** | Frontend backoffice + seed extendido + sidebar update | Calendario navegable en demos |
| **3** | Frontend portal cliente + `Organization.slug` field | Portal `/book/<slug>` funciona |

Cada push pasa el CI gate añadido en sub-proyecto F.

## 9. Métricas de éxito MVP

- Crear cita desde calendario en < 30 s.
- `/availability` responde < 200 ms para 1 día/5 profesionales.
- 0 conflictos cross-tenant (cubierto por tests).
- Lifecycle completo end-to-end funciona en demo Barber.
- Portal de cliente permite que un usuario sin cuenta registre + agende en < 90 s.

## 10. Risks

| Riesgo | Mitigación |
|---|---|
| Double-booking por concurrencia simultánea | Postgres `pg_advisory_xact_lock` por `professional_id` en POST/PUT |
| `/availability` lento con muchos profesionales | Pre-carga en 2 queries + evaluación in-memory. Reevaluar si > 20 profesionales |
| Timezone drift entre cliente y servidor | BD en UTC, conversión en endpoint usando `Organization.timezone`; frontend recibe UTC |
| Portal expone PII no deseada (teléfono interno del profesional) | Endpoint `/portal/professionals` retorna solo `id, name, bio, photo_url`, omite contacto |
| Cliente del portal de org A intenta acceder a org B | Auth de Customer ligado a `organization_id`; todos los endpoints filtran con `tenant_query` |
| Cancelaciones masivas vía portal | Regla 24h por defecto + audit log en `AppointmentEvent.actor_user_id` (el User CLIENTE es siempre el actor) |
| Schema large (`appointments` con > 1M rows) | Indexes cubren queries críticas; tabla particionable por `starts_at` en el futuro |

## 11. Files touched

```
Backend:
  app/modules/appointments/__init__.py          (existe — actualizar STATUS: Stable)
  app/modules/appointments/models.py            (nuevo, ~250 líneas, 8 clases)
  app/modules/appointments/schemas.py           (nuevo, ~200 líneas, Pydantic v2)
  app/modules/appointments/router.py            (rewrite — quita stub /health, agrega ~25 endpoints)
  app/modules/appointments/services.py          (nuevo, ~200 líneas — availability algorithm, lifecycle helpers)
  app/modules/appointments/portal_router.py     (nuevo, ~150 líneas — portal booking endpoints)
  app/main.py                                   (agregar include_router para portal_router en /api/portal/booking)
  scripts/railway_init.py                       (agregar índices al run_migrations)
  scripts/seed_demo_orgs.py                     (extender con seed_appointments_demo)
  tests/test_appointments_models.py             (nuevo)
  tests/test_appointments_availability.py       (nuevo)
  tests/test_appointments_lifecycle.py          (nuevo)
  tests/test_appointments_portal.py             (nuevo)
  app/modules/tenants/models.py                 (agregar Organization.slug — confirmado: no existe hoy)

Frontend:
  frontend/src/api/appointments.ts              (nuevo, ~250 líneas)
  frontend/src/pages/appointments/AppointmentsCalendar.tsx   (nuevo, ~400 líneas)
  frontend/src/pages/appointments/AppointmentComposer.tsx    (nuevo, ~250 líneas)
  frontend/src/pages/appointments/AppointmentDetail.tsx      (nuevo, ~200 líneas)
  frontend/src/pages/appointments/AppointmentsSettings.tsx   (nuevo, ~300 líneas)
  frontend/src/pages/portal/booking/PortalBookingFlow.tsx    (nuevo, ~400 líneas)
  frontend/src/pages/portal/booking/PortalLogin.tsx          (nuevo, ~120 líneas)
  frontend/src/pages/portal/booking/MyAppointments.tsx       (nuevo, ~150 líneas)
  frontend/src/App.tsx                          (agregar 4 rutas + lazy imports)
  frontend/src/components/layout/Sidebar.tsx    (cambiar url /appointments → /appointments/calendar)
  frontend/src/pages/coming-soon/index.tsx      (borrar AppointmentsComingSoon)
  frontend/package.json                         (agregar react-big-calendar + moment o date-fns)
```

## 12. Test plan

**Backend**:
- `pytest tests/test_appointments_*.py` — los 4 archivos, ~25-30 tests, verdes.
- `pytest tests/` — suite completa sin regresiones.
- CI gate (sub-proyecto F) aplica.

**Frontend**:
- `cd frontend && npx tsc --noEmit` — exit 0.
- `cd frontend && npm run build` — sin errores.
- Smoke manual contra Railway:
  - Login con `demo_barber/demo1234` → `/appointments/calendar` muestra calendario con 3 citas demo.
  - Crear cita nueva desde slot vacío del calendario.
  - Click en cita → side panel con timeline.
  - Botón WhatsApp abre `wa.me/...`.
  - Lifecycle: confirmar → iniciar → completar.
  - Settings: agregar nuevo Resource, marcar nuevo Service.
  - Portal: navegar `/book/demo-atlas-one-barber/barber-shop-centro`, registrarse, agendar, ver "mis citas".
- Multi-tenant smoke: con `demo_beauty` no se ven citas de `demo_barber`.

---

**Última actualización:** 2026-05-18 — design aprobado en brainstorming sección por sección.
