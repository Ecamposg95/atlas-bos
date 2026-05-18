# Appointments Backend MVP — Implementation Plan (Push 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-18-appointments-mvp-design.md`

**Goal:** Reemplazar el stub `/health` de `app/modules/appointments/` por el backend completo del MVP: 8 modelos, ~25 endpoints (resources, professionals, services, appointments + lifecycle + portal booking), helper de availability con concurrency guard, migración de índices, seed demo extendido y ~25 tests.

**Architecture:** El módulo vive en `app/modules/appointments/` siguiendo MODULE_GUIDE §3. La lógica de availability se aísla en `services.py` (no en el router) para reuso entre backoffice y portal cliente. Auth del portal reusa `User(role=CLIENTE)` y el flujo `/api/auth/login` existente. Multi-tenancy se garantiza con el helper `get_tenant_scoped` de `app/core/tenant_query.py`.

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Postgres (prod) / SQLite (test) · Pydantic v2 · pytest · `pg_advisory_xact_lock` para concurrencia.

**Out of scope (próximos plans):**
- Plan 2: frontend backoffice (calendario, composer, settings)
- Plan 3: frontend portal cliente (booking wizard, mis citas)

---

## File structure

**Backend creados:**
- `app/modules/appointments/models.py` — 8 SQLAlchemy classes
- `app/modules/appointments/schemas.py` — Pydantic
- `app/modules/appointments/services.py` — availability algorithm + lifecycle helpers
- `app/modules/appointments/router.py` — rewrite del stub (~25 endpoints backoffice)
- `app/modules/appointments/portal_router.py` — endpoints `/api/portal/booking/*`
- `tests/test_appointments_models.py` — 5 tests
- `tests/test_appointments_availability.py` — 9 tests
- `tests/test_appointments_lifecycle.py` — 8 tests
- `tests/test_appointments_portal.py` — 5 tests

**Backend modificados:**
- `app/modules/appointments/__init__.py` — STATUS: Stable + docstring extendido
- `app/modules/appointments/router.py` (rewrite — quita stub `/health`)
- `app/modules/tenants/models.py` — añade `Organization.slug`
- `app/main.py` — include_router para `portal_router`
- `scripts/railway_init.py` — añade `ALTER TABLE organization ADD COLUMN slug` + índices appointments
- `scripts/seed_demo_orgs.py` — extiende DEMOS de BARBER/BEAUTY_WELLNESS/HEALTH/SERVICES con seed de appointments

---

## Pre-flight

- [ ] **Step 0.1:** Verificar tree limpio + main al día

```bash
git status --short
git log --oneline -3
```

Expected: `git status` vacío. Último commit visible: `22052da docs(spec): add appointments MVP design`.

- [ ] **Step 0.2:** Verificar baseline tests pasan

```bash
pytest tests/ -x --tb=line 2>&1 | tail -10
```

Expected: green (o solo fallos pre-existentes no relacionados con appointments).

---

## Task 1: Add `Organization.slug` column

**Files:**
- Modify: `app/modules/tenants/models.py` (clase `Organization`)
- Modify: `scripts/railway_init.py` (sección `run_migrations`)
- Test: `tests/test_appointments_models.py` (smoke test del slug)

`Organization.slug` lo necesitan el portal (`/book/<slug>/<branch-slug>`) y la migración Railway debe agregarlo a orgs existentes con un default derivado del nombre.

- [ ] **Step 1.1: Crear test file con primer test del slug**

Crear `tests/test_appointments_models.py`:

```python
"""Tests for appointments models + Organization.slug prereq."""
import pytest
from app.modules.tenants.models import Organization


def test_organization_has_slug_column(db, org):
    """Organization table must expose a `slug` column (nullable, str)."""
    # Smoke: write+read a slug value
    org.slug = "demo-org-slug"
    db.commit()
    db.refresh(org)
    assert org.slug == "demo-org-slug"
```

- [ ] **Step 1.2: Run test → debe fallar**

```bash
pytest tests/test_appointments_models.py::test_organization_has_slug_column -v
```

Expected: `AttributeError: 'Organization' object has no attribute 'slug'` o similar.

- [ ] **Step 1.3: Añadir columna al modelo**

Editar `app/modules/tenants/models.py` clase `Organization`, justo después de `industry_type` (alrededor de la línea 181). Insertar:

```python
    slug = Column(String(64), nullable=True, unique=True, index=True)
```

- [ ] **Step 1.4: Run test → debe pasar**

```bash
pytest tests/test_appointments_models.py::test_organization_has_slug_column -v
```

Expected: PASS.

- [ ] **Step 1.5: Añadir migración en railway_init**

Editar `scripts/railway_init.py`. En la lista de tuplas `migrations` dentro de `run_migrations()` (justo antes de `# Atlas One presets expansion 2026-05-13`), insertar:

```python
        # Appointments MVP 2026-05-18 — slug for public portal URLs
        ("organization", "slug", "ALTER TABLE organization ADD COLUMN slug VARCHAR(64);"),
```

Y después de aplicar las migrations, añadir un bloque de backfill al final de `run_migrations()` (justo antes del último `print("✅ Migrations complete")`):

```python
    # Appointments MVP — backfill slug from name for orgs that don't have one
    print("\n  Backfill organization.slug…")
    with engine.begin() as conn:
        import re
        rows = conn.execute(text("SELECT id, name FROM organization WHERE slug IS NULL")).fetchall()
        for org_id, name in rows:
            slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")[:64] or f"org-{org_id}"
            # Ensure unique
            cand, n = slug, 1
            while conn.execute(text("SELECT 1 FROM organization WHERE slug = :s"), {"s": cand}).scalar():
                n += 1
                cand = f"{slug}-{n}"[:64]
            conn.execute(text("UPDATE organization SET slug = :s WHERE id = :id"), {"s": cand, "id": org_id})
            print(f"    · org {org_id} ('{name}') → slug='{cand}'")
        print(f"  ✓ backfilled {len(rows)} orgs")

    # Add unique index after backfill (idempotent)
    with engine.connect() as conn:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_organization_slug ON organization (slug);"))
        conn.commit()
```

- [ ] **Step 1.6: Commit**

```bash
git add app/modules/tenants/models.py scripts/railway_init.py tests/test_appointments_models.py
git commit -m "$(cat <<'EOF'
feat(models): add Organization.slug for public portal URLs

slug is the URL-friendly identifier used by the appointments customer
portal (/book/<slug>/<branch-slug>). Nullable + indexed for now;
backfill in railway_init derives it from the org name on every
deploy and ensures uniqueness.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Appointments models (8 classes)

**Files:**
- Create: `app/modules/appointments/models.py`
- Modify: `app/modules/appointments/__init__.py` (STATUS: Stable)
- Modify: `tests/test_appointments_models.py` (más tests)

- [ ] **Step 2.1: Escribir tests de modelos faltantes**

Append a `tests/test_appointments_models.py`:

```python
from datetime import datetime, time, timedelta, timezone
from app.modules.appointments.models import (
    Appointment,
    AppointmentEvent,
    AppointmentEventType,
    AppointmentService,
    AppointmentStatus,
    BookingChannel,
    Professional,
    ProfessionalBlock,
    ProfessionalSchedule,
    Resource,
    ResourceType,
    Service,
)


def test_resource_create(db, org, branch_a):
    r = Resource(
        organization_id=org.id,
        branch_id=branch_a.id,
        name="Silla 1",
        resource_type=ResourceType.CHAIR,
        capacity=1,
        is_active=True,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    assert r.id > 0
    assert r.resource_type == ResourceType.CHAIR


def test_professional_links_to_user(db, org, branch_a, cajero_a):
    p = Professional(
        organization_id=org.id,
        user_id=cajero_a.id,
        branch_id=branch_a.id,
        color="#0891b2",
        is_bookable=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    assert p.user_id == cajero_a.id
    assert p.is_bookable is True


def test_appointment_status_default_is_pending(db, org, branch_a, cajero_a):
    pro = Professional(organization_id=org.id, user_id=cajero_a.id, branch_id=branch_a.id)
    db.add(pro)
    db.flush()
    # Customer comes from app.modules.customers.models — minimal stub
    from app.modules.customers.models import Customer
    cust = Customer(organization_id=org.id, name="Test Client")
    db.add(cust)
    db.flush()
    now = datetime.now(timezone.utc)
    appt = Appointment(
        organization_id=org.id,
        branch_id=branch_a.id,
        customer_id=cust.id,
        professional_id=pro.id,
        starts_at=now,
        ends_at=now + timedelta(minutes=30),
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    assert appt.status == AppointmentStatus.PENDING
    assert appt.booking_channel == BookingChannel.STAFF


def test_appointment_event_records_lifecycle(db, org):
    # AppointmentEvent is just a log row — confirm it persists
    ev = AppointmentEvent(
        organization_id=org.id,
        appointment_id=1,  # FK not enforced for this isolated unit test in SQLite
        event_type=AppointmentEventType.CREATED,
        payload={"by": "staff"},
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    assert ev.event_type == AppointmentEventType.CREATED
    assert ev.payload == {"by": "staff"}
```

- [ ] **Step 2.2: Run tests → deben fallar**

```bash
pytest tests/test_appointments_models.py -v
```

Expected: ImportError porque `app.modules.appointments.models` no exporta las clases nuevas todavía (solo tiene el stub).

- [ ] **Step 2.3: Crear `app/modules/appointments/models.py`**

```python
"""Atlas BOS modules/appointments/models — agenda domain.

DOMAIN: Appointments (Resource + Professional + Service + Appointment + Event)
STATUS: Stable

8 tables:
  - appointments_resources
  - appointments_professionals
  - appointments_schedules
  - appointments_blocks
  - appointments_services
  - appointments
  - appointments_services_link
  - appointments_events
"""
import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class ResourceType(str, enum.Enum):
    CHAIR = "CHAIR"
    CABIN = "CABIN"
    CONSULTORY = "CONSULTORY"
    BAY = "BAY"
    TABLE = "TABLE"


class AppointmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELED = "CANCELED"
    NO_SHOW = "NO_SHOW"


class BookingChannel(str, enum.Enum):
    STAFF = "STAFF"
    PORTAL = "PORTAL"


class AppointmentEventType(str, enum.Enum):
    CREATED = "CREATED"
    CONFIRMED = "CONFIRMED"
    STARTED = "STARTED"
    COMPLETED = "COMPLETED"
    CANCELED = "CANCELED"
    NO_SHOW = "NO_SHOW"
    RESCHEDULED = "RESCHEDULED"


# ── Models ────────────────────────────────────────────────────────────────────

class Resource(Base):
    __tablename__ = "appointments_resources"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    resource_type = Column(Enum(ResourceType, name="appt_resource_type"), nullable=False)
    capacity = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Professional(Base):
    __tablename__ = "appointments_professionals"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    default_resource_id = Column(Integer, ForeignKey("appointments_resources.id"), nullable=True)
    color = Column(String(7), nullable=True)
    is_bookable = Column(Boolean, nullable=False, default=True)
    bio = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    default_resource = relationship("Resource")


class ProfessionalSchedule(Base):
    __tablename__ = "appointments_schedules"
    __table_args__ = (
        UniqueConstraint("professional_id", "weekday", name="uq_sched_prof_weekday"),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    weekday = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)


class ProfessionalBlock(Base):
    __tablename__ = "appointments_blocks"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Service(Base):
    __tablename__ = "appointments_services"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    product_variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False, unique=True)
    duration_minutes = Column(Integer, nullable=False)
    buffer_minutes_after = Column(Integer, nullable=False, default=0)
    requires_resource_type = Column(Enum(ResourceType, name="appt_resource_type"), nullable=True)
    is_bookable_online = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    variant = relationship("ProductVariant")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=False, index=True)
    resource_id = Column(Integer, ForeignKey("appointments_resources.id"), nullable=True, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(
        Enum(AppointmentStatus, name="appt_status"),
        nullable=False,
        default=AppointmentStatus.PENDING,
    )
    notes = Column(String, nullable=True)
    booking_channel = Column(
        Enum(BookingChannel, name="appt_booking_channel"),
        nullable=False,
        default=BookingChannel.STAFF,
    )
    actual_professional_id = Column(Integer, ForeignKey("appointments_professionals.id"), nullable=True)
    sales_document_id = Column(String(36), ForeignKey("sales_documents.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    professional = relationship(
        "Professional",
        foreign_keys=[professional_id],
    )
    actual_professional = relationship(
        "Professional",
        foreign_keys=[actual_professional_id],
    )
    resource = relationship("Resource")
    services = relationship(
        "AppointmentService",
        back_populates="appointment",
        cascade="all, delete-orphan",
    )
    events = relationship(
        "AppointmentEvent",
        back_populates="appointment",
        cascade="all, delete-orphan",
        order_by="AppointmentEvent.created_at",
    )


class AppointmentService(Base):
    __tablename__ = "appointments_services_link"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("appointments_services.id"), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=False)

    appointment = relationship("Appointment", back_populates="services")
    service = relationship("Service")


class AppointmentEvent(Base):
    __tablename__ = "appointments_events"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    event_type = Column(Enum(AppointmentEventType, name="appt_event_type"), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    appointment = relationship("Appointment", back_populates="events")
```

- [ ] **Step 2.4: Actualizar `__init__.py`**

Reemplazar `app/modules/appointments/__init__.py`:

```python
"""Atlas BOS module - appointments.

DOMAIN: Agenda (Resources, Professionals, Schedules, Blocks, Services, Appointments)
STATUS: Stable

Used by presets: ATLAS_ONE_BARBER, ATLAS_ONE_BEAUTY_WELLNESS,
ATLAS_ONE_HEALTH, ATLAS_ONE_SERVICES, ATLAS_ONE_BEAUTY (legacy).

See docs/superpowers/specs/2026-05-18-appointments-mvp-design.md
"""
```

- [ ] **Step 2.5: Registrar modelos en `app/models/__init__.py`**

Inspect `app/models/__init__.py` para confirmar que NO se importan los modelos appointments allá — el patrón de Phase 2 es que cada módulo posee sus propios modelos y `Base.metadata.create_all()` los detecta vía `import app.models` (que carga el árbol). Para que SQLAlchemy registre las clases, debemos asegurar que el módulo se importe en algún momento del arranque.

Añadir al final de `app/models/__init__.py`:

```python
# 13. Appointments (registered on Base.metadata for create_all)
from app.modules.appointments import models as _appointments_models  # noqa: F401
```

- [ ] **Step 2.6: Run tests → deben pasar**

```bash
pytest tests/test_appointments_models.py -v
```

Expected: 5 PASS.

- [ ] **Step 2.7: Commit**

```bash
git add app/modules/appointments/ app/models/__init__.py tests/test_appointments_models.py
git commit -m "$(cat <<'EOF'
feat(appointments): add 8 SQLAlchemy models

Resource, Professional, ProfessionalSchedule, ProfessionalBlock,
Service, Appointment, AppointmentService, AppointmentEvent.

All multi-tenant via organization_id (TenantMixin column inlined for
clarity since each model also keeps explicit business FKs).
Enums: ResourceType, AppointmentStatus, BookingChannel,
AppointmentEventType.

Models registered with Base.metadata via import in app/models/__init__.py
so Base.metadata.create_all() picks them up on init_database().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Pydantic schemas

**Files:**
- Create: `app/modules/appointments/schemas.py`

Schemas Pydantic en/out para los 8 modelos. No tienen test propio (los validan los tests de endpoints después).

- [ ] **Step 3.1: Crear `app/modules/appointments/schemas.py`**

```python
"""Atlas BOS modules/appointments/schemas — Pydantic v2."""
from datetime import datetime, time
from typing import List, Optional

from pydantic import BaseModel, Field

from app.modules.appointments.models import (
    AppointmentEventType,
    AppointmentStatus,
    BookingChannel,
    ResourceType,
)


# ── Resource ─────────────────────────────────────────────────────────────────

class ResourceBase(BaseModel):
    name: str
    resource_type: ResourceType
    branch_id: int
    capacity: int = 1
    is_active: bool = True


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    resource_type: Optional[ResourceType] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class ResourceRead(ResourceBase):
    id: int
    organization_id: int

    class Config:
        from_attributes = True


# ── Professional ─────────────────────────────────────────────────────────────

class ProfessionalBase(BaseModel):
    user_id: int
    branch_id: int
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    is_bookable: bool = True
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    default_resource_id: Optional[int] = None


class ProfessionalCreate(ProfessionalBase):
    pass


class ProfessionalUpdate(BaseModel):
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    is_bookable: Optional[bool] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    default_resource_id: Optional[int] = None


class ProfessionalRead(ProfessionalBase):
    id: int
    organization_id: int
    user_full_name: Optional[str] = None  # populated by router for convenience

    class Config:
        from_attributes = True


# ── Schedule ─────────────────────────────────────────────────────────────────

class ScheduleSlot(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time


class ScheduleReplaceRequest(BaseModel):
    slots: List[ScheduleSlot]


# ── Block ────────────────────────────────────────────────────────────────────

class BlockBase(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: Optional[str] = None


class BlockCreate(BlockBase):
    pass


class BlockRead(BlockBase):
    id: int
    professional_id: int

    class Config:
        from_attributes = True


# ── Service ──────────────────────────────────────────────────────────────────

class ServiceBase(BaseModel):
    duration_minutes: int = Field(gt=0)
    buffer_minutes_after: int = 0
    requires_resource_type: Optional[ResourceType] = None
    is_bookable_online: bool = True


class ServiceFromVariant(ServiceBase):
    variant_id: str  # ProductVariant.id is UUID string


class ServiceUpdate(BaseModel):
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    buffer_minutes_after: Optional[int] = None
    requires_resource_type: Optional[ResourceType] = None
    is_bookable_online: Optional[bool] = None


class ServiceRead(ServiceBase):
    id: int
    organization_id: int
    product_variant_id: str
    variant_name: Optional[str] = None  # populated by router

    class Config:
        from_attributes = True


# ── Availability ─────────────────────────────────────────────────────────────

class AvailabilityQuery(BaseModel):
    branch_id: int
    date: str  # ISO date "YYYY-MM-DD" — parsed in service layer
    service_ids: List[int]
    professional_id: Optional[int] = None
    resource_id: Optional[int] = None
    slot_minutes: int = 15


class AvailabilitySlot(BaseModel):
    start: datetime
    end: datetime
    professional_id: int
    resource_id: Optional[int] = None


# ── Appointment ──────────────────────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    customer_id: int
    professional_id: int
    resource_id: Optional[int] = None
    service_ids: List[int]
    starts_at: datetime
    notes: Optional[str] = None
    branch_id: int


class AppointmentUpdate(BaseModel):
    professional_id: Optional[int] = None
    resource_id: Optional[int] = None
    starts_at: Optional[datetime] = None
    notes: Optional[str] = None
    service_ids: Optional[List[int]] = None


class AppointmentEventRead(BaseModel):
    id: int
    event_type: AppointmentEventType
    actor_user_id: Optional[int] = None
    payload: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AppointmentServiceRead(BaseModel):
    service_id: int
    duration_minutes: int
    sort_order: int

    class Config:
        from_attributes = True


class AppointmentRead(BaseModel):
    id: int
    organization_id: int
    branch_id: int
    customer_id: int
    professional_id: int
    resource_id: Optional[int] = None
    starts_at: datetime
    ends_at: datetime
    status: AppointmentStatus
    notes: Optional[str] = None
    booking_channel: BookingChannel
    actual_professional_id: Optional[int] = None
    sales_document_id: Optional[str] = None
    services: List[AppointmentServiceRead] = []
    events: List[AppointmentEventRead] = []

    class Config:
        from_attributes = True


class CompleteAppointment(BaseModel):
    sales_document_id: Optional[str] = None
    actual_professional_id: Optional[int] = None


class CancelAppointment(BaseModel):
    reason: Optional[str] = None
```

- [ ] **Step 3.2: Compile check**

```bash
python3 -m py_compile app/modules/appointments/schemas.py
```

Expected: no output (success).

- [ ] **Step 3.3: Commit**

```bash
git add app/modules/appointments/schemas.py
git commit -m "$(cat <<'EOF'
feat(appointments): add Pydantic schemas (Resource, Professional, Service, Appointment, …)

Covers create/update/read for all 8 entities plus AvailabilityQuery,
AvailabilitySlot, CompleteAppointment, CancelAppointment payloads.

Color field validates hex pattern. Service durations / capacities use
Pydantic Field(gt=0) for positive-int enforcement.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Availability service (TDD)

**Files:**
- Create: `app/modules/appointments/services.py`
- Create: `tests/test_appointments_availability.py`

`services.py` aísla la lógica de availability. Lo prueban 9 tests cubriendo working hours, blocks, conflicts y multi-service.

- [ ] **Step 4.1: Crear tests primero**

```python
"""Tests for app.modules.appointments.services.get_availability."""
from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.modules.appointments.models import (
    Appointment,
    AppointmentStatus,
    AppointmentService as ApptServiceLink,
    Professional,
    ProfessionalBlock,
    ProfessionalSchedule,
    Resource,
    ResourceType,
    Service,
)
from app.modules.appointments.services import get_availability


@pytest.fixture
def appt_setup(db, org, branch_a, cajero_a):
    """A Professional working Mon-Fri 09:00-18:00 + one Service of 30min."""
    pro = Professional(organization_id=org.id, user_id=cajero_a.id, branch_id=branch_a.id, is_bookable=True)
    db.add(pro)
    db.flush()
    for wd in range(0, 5):  # Mon-Fri
        db.add(ProfessionalSchedule(
            organization_id=org.id, professional_id=pro.id, weekday=wd,
            start_time=time(9, 0), end_time=time(18, 0),
        ))

    # A ProductVariant + Service. The ProductVariant.id is UUID.
    from app.models.products import Product, ProductVariant
    p = Product(name="Corte", organization_id=org.id, is_active=True)
    db.add(p)
    db.flush()
    v = ProductVariant(
        product_id=p.id, sku="CUT-001", variant_name="Estándar",
        price=100, cost=0, has_iva=False, tax_rate=0,
        organization_id=org.id,
    )
    db.add(v)
    db.flush()
    svc = Service(
        organization_id=org.id, product_variant_id=v.id,
        duration_minutes=30, buffer_minutes_after=0,
    )
    db.add(svc)
    db.commit()
    db.refresh(pro)
    db.refresh(svc)
    return {"professional": pro, "branch": branch_a, "service": svc}


def _next_monday() -> date:
    today = date.today()
    return today + timedelta(days=(7 - today.weekday()) % 7 or 7)


def test_availability_returns_slots_for_working_day(db, org, appt_setup):
    slots = get_availability(
        db, organization_id=org.id, branch_id=appt_setup["branch"].id,
        target_date=_next_monday(), service_ids=[appt_setup["service"].id],
    )
    assert len(slots) > 0
    # 09:00 - 18:00 = 9h × 60 = 540 min. With 30min service + 15min steps, expect 35 slots.
    assert any(s["start"].time() == time(9, 0) for s in slots)
    assert all(s["end"] - s["start"] == timedelta(minutes=30) for s in slots)


def test_availability_excludes_sunday(db, org, appt_setup):
    # Next Sunday (weekday 6) — no schedule entry
    today = date.today()
    sunday = today + timedelta(days=(6 - today.weekday()) % 7 or 7)
    slots = get_availability(
        db, organization_id=org.id, branch_id=appt_setup["branch"].id,
        target_date=sunday, service_ids=[appt_setup["service"].id],
    )
    assert slots == []


def test_availability_filters_unbookable_professional(db, org, appt_setup):
    appt_setup["professional"].is_bookable = False
    db.commit()
    slots = get_availability(
        db, organization_id=org.id, branch_id=appt_setup["branch"].id,
        target_date=_next_monday(), service_ids=[appt_setup["service"].id],
    )
    assert slots == []


def test_availability_excludes_block_window(db, org, appt_setup):
    monday = _next_monday()
    # Block 10:00 - 12:00 ese día
    db.add(ProfessionalBlock(
        organization_id=org.id, professional_id=appt_setup["professional"].id,
        starts_at=datetime.combine(monday, time(10, 0), tzinfo=timezone.utc),
        ends_at=datetime.combine(monday, time(12, 0), tzinfo=timezone.utc),
        reason="Junta",
    ))
    db.commit()
    slots = get_availability(
        db, organization_id=org.id, branch_id=appt_setup["branch"].id,
        target_date=monday, service_ids=[appt_setup["service"].id],
    )
    # No slot que cruce [10:00, 12:00)
    for s in slots:
        st, en = s["start"].time(), s["end"].time()
        assert not (st < time(12, 0) and en > time(10, 0))


def test_availability_excludes_conflicting_appointment(db, org, appt_setup):
    from app.modules.customers.models import Customer
    cust = Customer(organization_id=org.id, name="Lib")
    db.add(cust)
    db.flush()
    monday = _next_monday()
    # Cita existente 11:00 - 11:30
    db.add(Appointment(
        organization_id=org.id, branch_id=appt_setup["branch"].id,
        customer_id=cust.id, professional_id=appt_setup["professional"].id,
        starts_at=datetime.combine(monday, time(11, 0), tzinfo=timezone.utc),
        ends_at=datetime.combine(monday, time(11, 30), tzinfo=timezone.utc),
        status=AppointmentStatus.CONFIRMED,
    ))
    db.commit()
    slots = get_availability(
        db, organization_id=org.id, branch_id=appt_setup["branch"].id,
        target_date=monday, service_ids=[appt_setup["service"].id],
    )
    # Ningún slot que cruce [11:00, 11:30)
    for s in slots:
        st, en = s["start"].time(), s["end"].time()
        assert not (st < time(11, 30) and en > time(11, 0))


def test_availability_ignores_canceled_appointment(db, org, appt_setup):
    from app.modules.customers.models import Customer
    cust = Customer(organization_id=org.id, name="Lib2")
    db.add(cust)
    db.flush()
    monday = _next_monday()
    db.add(Appointment(
        organization_id=org.id, branch_id=appt_setup["branch"].id,
        customer_id=cust.id, professional_id=appt_setup["professional"].id,
        starts_at=datetime.combine(monday, time(11, 0), tzinfo=timezone.utc),
        ends_at=datetime.combine(monday, time(11, 30), tzinfo=timezone.utc),
        status=AppointmentStatus.CANCELED,
    ))
    db.commit()
    slots = get_availability(
        db, organization_id=org.id, branch_id=appt_setup["branch"].id,
        target_date=monday, service_ids=[appt_setup["service"].id],
    )
    # Slot 11:00 disponible (la cita está cancelada)
    assert any(s["start"].time() == time(11, 0) for s in slots)


def test_availability_multi_service_sums_duration(db, org, appt_setup):
    # Crear segundo servicio de 60 min
    from app.models.products import Product, ProductVariant
    p2 = Product(name="Tinte", organization_id=org.id, is_active=True)
    db.add(p2); db.flush()
    v2 = ProductVariant(
        product_id=p2.id, sku="TINT-001", variant_name="Estándar",
        price=300, cost=50, organization_id=org.id, has_iva=False, tax_rate=0,
    )
    db.add(v2); db.flush()
    svc2 = Service(organization_id=org.id, product_variant_id=v2.id, duration_minutes=60)
    db.add(svc2)
    db.commit()
    db.refresh(svc2)

    slots = get_availability(
        db, organization_id=org.id, branch_id=appt_setup["branch"].id,
        target_date=_next_monday(),
        service_ids=[appt_setup["service"].id, svc2.id],  # 30 + 60 = 90 min
    )
    # Cada slot dura 90 minutos
    assert all((s["end"] - s["start"]).total_seconds() == 90 * 60 for s in slots)


def test_availability_filters_by_professional_id(db, org, branch_a, cajero_a, gerente_a, appt_setup):
    # Segundo professional sin schedule → /availability filtrado por cajero_a debe devolver solo sus slots
    pro2 = Professional(
        organization_id=org.id, user_id=gerente_a.id, branch_id=branch_a.id, is_bookable=True,
    )
    db.add(pro2); db.commit()
    # Pedir solo el profesional original
    slots = get_availability(
        db, organization_id=org.id, branch_id=branch_a.id,
        target_date=_next_monday(), service_ids=[appt_setup["service"].id],
        professional_id=appt_setup["professional"].id,
    )
    assert all(s["professional_id"] == appt_setup["professional"].id for s in slots)


def test_availability_resource_required_but_none_available(db, org, branch_a, appt_setup):
    # Marcar servicio como requires_resource_type=CABIN
    appt_setup["service"].requires_resource_type = ResourceType.CABIN
    db.commit()
    # Pero la sucursal no tiene cabinas activas → debería levantar excepción
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        get_availability(
            db, organization_id=org.id, branch_id=branch_a.id,
            target_date=_next_monday(), service_ids=[appt_setup["service"].id],
        )
    assert exc.value.status_code == 422
```

- [ ] **Step 4.2: Run tests → fallan**

```bash
pytest tests/test_appointments_availability.py -v
```

Expected: ImportError porque `services.py` no existe.

- [ ] **Step 4.3: Crear `app/modules/appointments/services.py`**

```python
"""Atlas BOS modules/appointments/services — business logic.

Core algorithm: `get_availability()` — single source of truth for "what
slots can be booked." Used both by backoffice and by the customer portal.

Lifecycle helpers: `transition_appointment_status()` and friends.
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.appointments.models import (
    Appointment,
    AppointmentStatus,
    Professional,
    ProfessionalBlock,
    ProfessionalSchedule,
    Resource,
    Service,
)

ACTIVE_STATUSES = {
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
}


def _combine_utc(d: date, t: time) -> datetime:
    """Combine date + time as UTC. Org-timezone awareness is a follow-up."""
    return datetime(d.year, d.month, d.day, t.hour, t.minute, tzinfo=timezone.utc)


def get_availability(
    db: Session,
    *,
    organization_id: int,
    branch_id: int,
    target_date: date,
    service_ids: List[int],
    professional_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    slot_minutes: int = 15,
) -> List[dict]:
    """Compute available slots for a date.

    Returns a list of dicts: {start, end, professional_id, resource_id}.
    Raises HTTPException(422) if services need a resource type the branch
    doesn't have active.
    """
    # 1. Load services + total duration
    services = (
        db.query(Service)
        .filter(Service.organization_id == organization_id, Service.id.in_(service_ids))
        .all()
    )
    if len(services) != len(service_ids):
        raise HTTPException(status_code=422, detail="One or more services not found")

    total_minutes = sum(s.duration_minutes + s.buffer_minutes_after for s in services)
    total_delta = timedelta(minutes=total_minutes)

    # 2. Validate resource requirement if any
    required_type = next((s.requires_resource_type for s in services if s.requires_resource_type), None)
    if required_type is not None:
        available_resources = (
            db.query(Resource)
            .filter(
                Resource.organization_id == organization_id,
                Resource.branch_id == branch_id,
                Resource.resource_type == required_type,
                Resource.is_active == True,  # noqa: E712
            )
            .count()
        )
        if available_resources == 0:
            raise HTTPException(
                status_code=422,
                detail=f"Branch has no active {required_type.value} resources required by service",
            )

    # 3. Candidate professionals
    pros_q = db.query(Professional).filter(
        Professional.organization_id == organization_id,
        Professional.branch_id == branch_id,
        Professional.is_bookable == True,  # noqa: E712
    )
    if professional_id is not None:
        pros_q = pros_q.filter(Professional.id == professional_id)
    pros = pros_q.all()
    if not pros:
        return []

    weekday = target_date.weekday()
    pro_ids = [p.id for p in pros]

    # 4. Pre-load schedules, blocks, appointments for the day in 3 queries
    schedules = {
        s.professional_id: s
        for s in db.query(ProfessionalSchedule)
        .filter(
            ProfessionalSchedule.organization_id == organization_id,
            ProfessionalSchedule.professional_id.in_(pro_ids),
            ProfessionalSchedule.weekday == weekday,
        )
        .all()
    }

    start_of_day = _combine_utc(target_date, time(0, 0))
    end_of_day = start_of_day + timedelta(days=1)

    blocks_by_pro: dict[int, List[ProfessionalBlock]] = {pid: [] for pid in pro_ids}
    for blk in (
        db.query(ProfessionalBlock)
        .filter(
            ProfessionalBlock.organization_id == organization_id,
            ProfessionalBlock.professional_id.in_(pro_ids),
            ProfessionalBlock.starts_at < end_of_day,
            ProfessionalBlock.ends_at > start_of_day,
        )
        .all()
    ):
        blocks_by_pro[blk.professional_id].append(blk)

    appts_by_pro: dict[int, List[Appointment]] = {pid: [] for pid in pro_ids}
    for ap in (
        db.query(Appointment)
        .filter(
            Appointment.organization_id == organization_id,
            Appointment.branch_id == branch_id,
            Appointment.starts_at < end_of_day,
            Appointment.ends_at > start_of_day,
            Appointment.status.in_(ACTIVE_STATUSES),
        )
        .all()
    ):
        if ap.professional_id in appts_by_pro:
            appts_by_pro[ap.professional_id].append(ap)

    # 5. Resource-specific appointments (if resource_id pinned)
    resource_appts: List[Appointment] = []
    if resource_id is not None:
        resource_appts = (
            db.query(Appointment)
            .filter(
                Appointment.organization_id == organization_id,
                Appointment.resource_id == resource_id,
                Appointment.starts_at < end_of_day,
                Appointment.ends_at > start_of_day,
                Appointment.status.in_(ACTIVE_STATUSES),
            )
            .all()
        )

    slot_delta = timedelta(minutes=slot_minutes)
    out: List[dict] = []

    for pro in pros:
        sched = schedules.get(pro.id)
        if not sched:
            continue
        window_start = _combine_utc(target_date, sched.start_time)
        window_end = _combine_utc(target_date, sched.end_time)

        cursor = window_start
        while cursor + total_delta <= window_end:
            slot_end = cursor + total_delta
            # Conflict checks
            if _overlaps_any(cursor, slot_end, blocks_by_pro.get(pro.id, [])):
                cursor += slot_delta
                continue
            if _overlaps_any(cursor, slot_end, appts_by_pro.get(pro.id, [])):
                cursor += slot_delta
                continue
            if resource_id is not None and _overlaps_any(cursor, slot_end, resource_appts):
                cursor += slot_delta
                continue
            out.append({
                "start": cursor,
                "end": slot_end,
                "professional_id": pro.id,
                "resource_id": resource_id,
            })
            cursor += slot_delta

    out.sort(key=lambda s: (s["start"], s["professional_id"]))
    return out


def _overlaps_any(start: datetime, end: datetime, items) -> bool:
    for it in items:
        it_start = getattr(it, "starts_at", None)
        it_end = getattr(it, "ends_at", None)
        if it_start is None or it_end is None:
            continue
        if it_start < end and it_end > start:
            return True
    return False


def acquire_professional_lock(db: Session, professional_id: int) -> None:
    """Postgres advisory lock to prevent double-booking races.

    No-op on SQLite (tests). Lock is released automatically at COMMIT or
    ROLLBACK of the surrounding transaction.
    """
    if db.bind.dialect.name != "postgresql":
        return
    from sqlalchemy import text
    lock_key = hash(f"appt-prof:{professional_id}") % (2**31)
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": lock_key})
```

- [ ] **Step 4.4: Run tests → deben pasar**

```bash
pytest tests/test_appointments_availability.py -v
```

Expected: 9 PASS.

- [ ] **Step 4.5: Commit**

```bash
git add app/modules/appointments/services.py tests/test_appointments_availability.py
git commit -m "$(cat <<'EOF'
feat(appointments): availability service + Postgres advisory lock

services.get_availability() is the single source of truth for slot
generation. Pre-loads schedule + blocks + appointments in 3 queries,
then runs overlap checks in memory. Validates that the branch has
resources of the type required by any service in the request.

acquire_professional_lock() wraps pg_advisory_xact_lock for the
double-booking race; no-op on SQLite so tests don't choke.

9 tests cover:
- working day returns slots
- non-working day returns []
- is_bookable=false excludes
- block windows excluded
- conflicting active appointment excluded
- canceled appointments ignored
- multi-service sums duration
- filter by professional_id
- service requires resource that branch lacks → 422

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Backoffice CRUD routers (resources, professionals, services, schedule, blocks)

**Files:**
- Create: `app/modules/appointments/router.py` (rewrite — quita stub)

Este task agrupa 4 endpoints CRUD muy parecidos. Para no inflar el plan, sigo el patrón uniformemente. Tests del CRUD viven en `test_appointments_lifecycle.py` junto con el flow principal.

- [ ] **Step 5.1: Rewrite `app/modules/appointments/router.py`**

```python
"""Atlas BOS modules/appointments/router — Backoffice REST API.

Endpoints for staff (require_module + tenant guard). Customer portal
endpoints live in portal_router.py.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant_query import get_tenant_scoped, scoped_query
from app.models import User
from app.modules.appointments.models import (
    Professional,
    ProfessionalBlock,
    ProfessionalSchedule,
    Resource,
    Service,
)
from app.modules.appointments.schemas import (
    BlockCreate,
    BlockRead,
    ProfessionalCreate,
    ProfessionalRead,
    ProfessionalUpdate,
    ResourceCreate,
    ResourceRead,
    ResourceUpdate,
    ScheduleReplaceRequest,
    ServiceFromVariant,
    ServiceRead,
    ServiceUpdate,
)

router = APIRouter()


def _org_id(user: User) -> int:
    org = getattr(user, "organization_id", None)
    if org is None:
        raise HTTPException(status_code=400, detail="No active organization in context")
    return org


# ── Resources ───────────────────────────────────────────────────────────────

@router.get("/resources", response_model=List[ResourceRead])
def list_resources(
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, Resource, current_user).filter(Resource.is_active == True)  # noqa: E712
    if branch_id is not None:
        q = q.filter(Resource.branch_id == branch_id)
    return q.order_by(Resource.name).all()


@router.post("/resources", response_model=ResourceRead, status_code=status.HTTP_201_CREATED)
def create_resource(
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = Resource(organization_id=_org_id(current_user), **payload.dict())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/resources/{resource_id}", response_model=ResourceRead)
def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = get_tenant_scoped(db, Resource, resource_id, current_user)
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = get_tenant_scoped(db, Resource, resource_id, current_user)
    r.is_active = False
    db.commit()


# ── Professionals ───────────────────────────────────────────────────────────

@router.get("/professionals", response_model=List[ProfessionalRead])
def list_professionals(
    branch_id: Optional[int] = None,
    only_bookable: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, Professional, current_user)
    if branch_id is not None:
        q = q.filter(Professional.branch_id == branch_id)
    if only_bookable:
        q = q.filter(Professional.is_bookable == True)  # noqa: E712
    results = q.all()
    # Hydrate user_full_name for the UI
    out = []
    for p in results:
        d = ProfessionalRead.from_orm(p).dict()
        d["user_full_name"] = p.user.full_name if p.user else None
        out.append(ProfessionalRead(**d))
    return out


@router.post("/professionals", response_model=ProfessionalRead, status_code=status.HTTP_201_CREATED)
def create_professional(
    payload: ProfessionalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = Professional(organization_id=_org_id(current_user), **payload.dict())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/professionals/{prof_id}", response_model=ProfessionalRead)
def update_professional(
    prof_id: int,
    payload: ProfessionalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = get_tenant_scoped(db, Professional, prof_id, current_user)
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/professionals/{prof_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_professional(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = get_tenant_scoped(db, Professional, prof_id, current_user)
    p.is_bookable = False
    db.commit()


# ── Schedule ────────────────────────────────────────────────────────────────

@router.get("/professionals/{prof_id}/schedule")
def get_schedule(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_tenant_scoped(db, Professional, prof_id, current_user)  # tenant guard
    rows = (
        db.query(ProfessionalSchedule)
        .filter(
            ProfessionalSchedule.professional_id == prof_id,
            ProfessionalSchedule.organization_id == _org_id(current_user),
        )
        .order_by(ProfessionalSchedule.weekday)
        .all()
    )
    return [
        {"weekday": r.weekday, "start_time": r.start_time.isoformat(), "end_time": r.end_time.isoformat()}
        for r in rows
    ]


@router.put("/professionals/{prof_id}/schedule")
def replace_schedule(
    prof_id: int,
    payload: ScheduleReplaceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_tenant_scoped(db, Professional, prof_id, current_user)
    org_id = _org_id(current_user)
    # Delete existing rows for this professional then insert new ones
    db.query(ProfessionalSchedule).filter(
        ProfessionalSchedule.professional_id == prof_id,
        ProfessionalSchedule.organization_id == org_id,
    ).delete()
    for slot in payload.slots:
        if slot.start_time >= slot.end_time:
            raise HTTPException(status_code=422, detail=f"weekday {slot.weekday}: start_time must be before end_time")
        db.add(ProfessionalSchedule(
            organization_id=org_id, professional_id=prof_id,
            weekday=slot.weekday, start_time=slot.start_time, end_time=slot.end_time,
        ))
    db.commit()
    return {"status": "ok", "slots": len(payload.slots)}


# ── Blocks ──────────────────────────────────────────────────────────────────

@router.get("/professionals/{prof_id}/blocks", response_model=List[BlockRead])
def list_blocks(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_tenant_scoped(db, Professional, prof_id, current_user)
    return (
        db.query(ProfessionalBlock)
        .filter(
            ProfessionalBlock.professional_id == prof_id,
            ProfessionalBlock.organization_id == _org_id(current_user),
        )
        .order_by(ProfessionalBlock.starts_at)
        .all()
    )


@router.post("/professionals/{prof_id}/blocks", response_model=BlockRead, status_code=status.HTTP_201_CREATED)
def create_block(
    prof_id: int,
    payload: BlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_tenant_scoped(db, Professional, prof_id, current_user)
    if payload.starts_at >= payload.ends_at:
        raise HTTPException(status_code=422, detail="starts_at must be before ends_at")
    blk = ProfessionalBlock(
        organization_id=_org_id(current_user),
        professional_id=prof_id,
        **payload.dict(),
    )
    db.add(blk)
    db.commit()
    db.refresh(blk)
    return blk


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    blk = get_tenant_scoped(db, ProfessionalBlock, block_id, current_user)
    db.delete(blk)
    db.commit()


# ── Services ────────────────────────────────────────────────────────────────

@router.get("/services", response_model=List[ServiceRead])
def list_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = scoped_query(db, Service, current_user).all()
    out = []
    for s in rows:
        d = ServiceRead.from_orm(s).dict()
        d["variant_name"] = s.variant.variant_name if s.variant else None
        out.append(ServiceRead(**d))
    return out


@router.post("/services/from-variant", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def upgrade_variant_to_service(
    payload: ServiceFromVariant,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the variant belongs to the user's org
    from app.models.products import ProductVariant
    variant = (
        db.query(ProductVariant)
        .filter(
            ProductVariant.id == payload.variant_id,
            ProductVariant.organization_id == _org_id(current_user),
        )
        .first()
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    if (
        db.query(Service)
        .filter(Service.product_variant_id == payload.variant_id)
        .first()
    ):
        raise HTTPException(status_code=409, detail="Variant is already a Service")

    s = Service(
        organization_id=_org_id(current_user),
        product_variant_id=payload.variant_id,
        duration_minutes=payload.duration_minutes,
        buffer_minutes_after=payload.buffer_minutes_after,
        requires_resource_type=payload.requires_resource_type,
        is_bookable_online=payload.is_bookable_online,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/services/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = get_tenant_scoped(db, Service, service_id, current_user)
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = get_tenant_scoped(db, Service, service_id, current_user)
    db.delete(s)
    db.commit()
```

- [ ] **Step 5.2: Compile check**

```bash
python3 -m py_compile app/modules/appointments/router.py
```

Expected: no output.

- [ ] **Step 5.3: Commit**

```bash
git add app/modules/appointments/router.py
git commit -m "$(cat <<'EOF'
feat(appointments): backoffice CRUD endpoints

Resources, professionals, schedule (weekly grid replace), blocks
(create/list/delete), services (upgrade ProductVariant). All with
get_tenant_scoped + scoped_query for multi-tenant isolation.

Stub /health is gone — module is no longer beta-only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Availability + Appointment CRUD endpoints

**Files:**
- Modify: `app/modules/appointments/router.py` (append endpoints)
- Create: `tests/test_appointments_lifecycle.py`

- [ ] **Step 6.1: Crear tests del lifecycle**

```python
"""Tests for appointment CRUD + status lifecycle endpoints."""
from datetime import date, datetime, time, timedelta, timezone
import pytest


def _next_monday_utc_at(hour: int) -> datetime:
    today = date.today()
    monday = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
    return datetime(monday.year, monday.month, monday.day, hour, 0, tzinfo=timezone.utc)


@pytest.fixture
def appt_fixtures(db, org, branch_a, cajero_a):
    """Set up Professional with schedule + 1 Service + 1 Customer."""
    from app.modules.appointments.models import (
        Professional, ProfessionalSchedule, Service,
    )
    from app.modules.customers.models import Customer
    from app.models.products import Product, ProductVariant

    pro = Professional(organization_id=org.id, user_id=cajero_a.id, branch_id=branch_a.id, is_bookable=True)
    db.add(pro)
    db.flush()
    for wd in range(0, 5):
        db.add(ProfessionalSchedule(
            organization_id=org.id, professional_id=pro.id, weekday=wd,
            start_time=time(9, 0), end_time=time(18, 0),
        ))
    p = Product(name="Corte", organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    v = ProductVariant(
        product_id=p.id, sku="CUT-FX", variant_name="Estándar",
        price=100, cost=0, has_iva=False, tax_rate=0, organization_id=org.id,
    )
    db.add(v); db.flush()
    svc = Service(organization_id=org.id, product_variant_id=v.id, duration_minutes=30)
    db.add(svc)
    cust = Customer(organization_id=org.id, name="Cliente Test")
    db.add(cust)
    db.commit()
    return {
        "professional": pro, "service": svc, "customer": cust,
        "branch": branch_a,
    }


def test_availability_endpoint_returns_slots(client, auth_superadmin, db, org, appt_fixtures):
    monday = _next_monday_utc_at(0).date().isoformat()
    resp = client.get(
        "/api/appointments/availability",
        params={
            "branch_id": appt_fixtures["branch"].id,
            "date": monday,
            "service_ids": appt_fixtures["service"].id,
        },
        headers=auth_superadmin,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert "start" in data[0]


def test_create_appointment(client, auth_superadmin, db, org, appt_fixtures):
    starts_at = _next_monday_utc_at(10)
    resp = client.post(
        "/api/appointments/appointments",
        json={
            "customer_id": appt_fixtures["customer"].id,
            "professional_id": appt_fixtures["professional"].id,
            "service_ids": [appt_fixtures["service"].id],
            "starts_at": starts_at.isoformat(),
            "branch_id": appt_fixtures["branch"].id,
        },
        headers=auth_superadmin,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "PENDING"
    assert data["booking_channel"] == "STAFF"
    assert len(data["services"]) == 1


def test_create_appointment_rejects_double_booking(client, auth_superadmin, db, org, appt_fixtures):
    starts_at = _next_monday_utc_at(10)
    payload = {
        "customer_id": appt_fixtures["customer"].id,
        "professional_id": appt_fixtures["professional"].id,
        "service_ids": [appt_fixtures["service"].id],
        "starts_at": starts_at.isoformat(),
        "branch_id": appt_fixtures["branch"].id,
    }
    r1 = client.post("/api/appointments/appointments", json=payload, headers=auth_superadmin)
    assert r1.status_code == 201
    r2 = client.post("/api/appointments/appointments", json=payload, headers=auth_superadmin)
    assert r2.status_code == 409


def test_confirm_then_start_then_complete(client, auth_superadmin, db, org, appt_fixtures):
    starts_at = _next_monday_utc_at(11)
    r = client.post(
        "/api/appointments/appointments",
        json={
            "customer_id": appt_fixtures["customer"].id,
            "professional_id": appt_fixtures["professional"].id,
            "service_ids": [appt_fixtures["service"].id],
            "starts_at": starts_at.isoformat(),
            "branch_id": appt_fixtures["branch"].id,
        },
        headers=auth_superadmin,
    )
    aid = r.json()["id"]

    assert client.post(f"/api/appointments/appointments/{aid}/confirm", headers=auth_superadmin).json()["status"] == "CONFIRMED"
    assert client.post(f"/api/appointments/appointments/{aid}/start", headers=auth_superadmin).json()["status"] == "IN_PROGRESS"
    resp = client.post(
        f"/api/appointments/appointments/{aid}/complete",
        json={},
        headers=auth_superadmin,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "COMPLETED"

    # Timeline: at least 4 events (CREATED, CONFIRMED, STARTED, COMPLETED)
    detail = client.get(f"/api/appointments/appointments/{aid}", headers=auth_superadmin).json()
    types = [e["event_type"] for e in detail["events"]]
    assert "CREATED" in types
    assert "CONFIRMED" in types
    assert "STARTED" in types
    assert "COMPLETED" in types


def test_complete_with_actual_professional_id(client, auth_superadmin, db, org, branch_a, gerente_a, appt_fixtures):
    # Crear segundo profesional para usar como "actual"
    from app.modules.appointments.models import Professional
    pro2 = Professional(organization_id=org.id, user_id=gerente_a.id, branch_id=branch_a.id, is_bookable=True)
    db.add(pro2); db.commit(); db.refresh(pro2)

    starts_at = _next_monday_utc_at(12)
    r = client.post(
        "/api/appointments/appointments",
        json={
            "customer_id": appt_fixtures["customer"].id,
            "professional_id": appt_fixtures["professional"].id,
            "service_ids": [appt_fixtures["service"].id],
            "starts_at": starts_at.isoformat(),
            "branch_id": appt_fixtures["branch"].id,
        },
        headers=auth_superadmin,
    )
    aid = r.json()["id"]
    client.post(f"/api/appointments/appointments/{aid}/confirm", headers=auth_superadmin)
    client.post(f"/api/appointments/appointments/{aid}/start", headers=auth_superadmin)
    resp = client.post(
        f"/api/appointments/appointments/{aid}/complete",
        json={"actual_professional_id": pro2.id},
        headers=auth_superadmin,
    )
    assert resp.status_code == 200
    assert resp.json()["actual_professional_id"] == pro2.id


def test_cancel_transitions_to_canceled(client, auth_superadmin, db, org, appt_fixtures):
    starts_at = _next_monday_utc_at(13)
    r = client.post(
        "/api/appointments/appointments",
        json={
            "customer_id": appt_fixtures["customer"].id,
            "professional_id": appt_fixtures["professional"].id,
            "service_ids": [appt_fixtures["service"].id],
            "starts_at": starts_at.isoformat(),
            "branch_id": appt_fixtures["branch"].id,
        },
        headers=auth_superadmin,
    )
    aid = r.json()["id"]
    resp = client.post(
        f"/api/appointments/appointments/{aid}/cancel",
        json={"reason": "Client requested"},
        headers=auth_superadmin,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELED"


def test_invalid_transition_pending_to_completed_returns_409(client, auth_superadmin, db, org, appt_fixtures):
    starts_at = _next_monday_utc_at(14)
    r = client.post(
        "/api/appointments/appointments",
        json={
            "customer_id": appt_fixtures["customer"].id,
            "professional_id": appt_fixtures["professional"].id,
            "service_ids": [appt_fixtures["service"].id],
            "starts_at": starts_at.isoformat(),
            "branch_id": appt_fixtures["branch"].id,
        },
        headers=auth_superadmin,
    )
    aid = r.json()["id"]
    resp = client.post(
        f"/api/appointments/appointments/{aid}/complete",
        json={},
        headers=auth_superadmin,
    )
    assert resp.status_code == 409


def test_no_show_terminal_state(client, auth_superadmin, db, org, appt_fixtures):
    starts_at = _next_monday_utc_at(15)
    r = client.post(
        "/api/appointments/appointments",
        json={
            "customer_id": appt_fixtures["customer"].id,
            "professional_id": appt_fixtures["professional"].id,
            "service_ids": [appt_fixtures["service"].id],
            "starts_at": starts_at.isoformat(),
            "branch_id": appt_fixtures["branch"].id,
        },
        headers=auth_superadmin,
    )
    aid = r.json()["id"]
    client.post(f"/api/appointments/appointments/{aid}/confirm", headers=auth_superadmin)
    resp = client.post(f"/api/appointments/appointments/{aid}/no-show", headers=auth_superadmin)
    assert resp.status_code == 200
    assert resp.json()["status"] == "NO_SHOW"
```

- [ ] **Step 6.2: Run tests → fallan**

```bash
pytest tests/test_appointments_lifecycle.py -v
```

Expected: 404 en los endpoints porque no existen aún.

- [ ] **Step 6.3: Append endpoints al router**

Pegar al final de `app/modules/appointments/router.py`:

```python
# ── Availability ────────────────────────────────────────────────────────────

from datetime import date as _date  # noqa: E402
from typing import List as _List  # noqa: E402

from app.modules.appointments.schemas import (  # noqa: E402
    AvailabilitySlot,
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
    CancelAppointment,
    CompleteAppointment,
)
from app.modules.appointments.services import (  # noqa: E402
    acquire_professional_lock,
    get_availability,
)
from app.modules.appointments.models import (  # noqa: E402
    Appointment,
    AppointmentEvent,
    AppointmentEventType,
    AppointmentService as ApptServiceLink,
    AppointmentStatus,
    BookingChannel,
)


@router.get("/availability", response_model=_List[AvailabilitySlot])
def availability_endpoint(
    branch_id: int,
    date: str,
    service_ids: str = Query(..., description="comma-separated ids: '1,2,3'"),
    professional_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    slot_minutes: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        target = _date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
    ids = [int(s) for s in service_ids.split(",") if s.strip()]
    if not ids:
        raise HTTPException(status_code=422, detail="service_ids required")
    return get_availability(
        db,
        organization_id=_org_id(current_user),
        branch_id=branch_id,
        target_date=target,
        service_ids=ids,
        professional_id=professional_id,
        resource_id=resource_id,
        slot_minutes=slot_minutes,
    )


# ── Appointment CRUD + lifecycle ────────────────────────────────────────────

def _emit(db, appt: Appointment, ev_type: AppointmentEventType, actor_user_id: Optional[int] = None, payload=None):
    db.add(AppointmentEvent(
        organization_id=appt.organization_id,
        appointment_id=appt.id,
        event_type=ev_type,
        actor_user_id=actor_user_id,
        payload=payload,
    ))


def _services_or_422(db, org_id: int, service_ids: List[int]) -> List[Service]:
    svcs = db.query(Service).filter(Service.organization_id == org_id, Service.id.in_(service_ids)).all()
    if len(svcs) != len(service_ids):
        raise HTTPException(status_code=422, detail="Service(s) not found")
    return svcs


def _validate_no_conflict(db, *, org_id, professional_id, resource_id, starts_at, ends_at, exclude_id=None):
    q = db.query(Appointment).filter(
        Appointment.organization_id == org_id,
        Appointment.professional_id == professional_id,
        Appointment.starts_at < ends_at,
        Appointment.ends_at > starts_at,
        Appointment.status.in_([
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
        ]),
    )
    if exclude_id is not None:
        q = q.filter(Appointment.id != exclude_id)
    if q.first():
        raise HTTPException(status_code=409, detail="Professional has a conflicting appointment")
    if resource_id is not None:
        q2 = db.query(Appointment).filter(
            Appointment.organization_id == org_id,
            Appointment.resource_id == resource_id,
            Appointment.starts_at < ends_at,
            Appointment.ends_at > starts_at,
            Appointment.status.in_([
                AppointmentStatus.PENDING,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.IN_PROGRESS,
            ]),
        )
        if exclude_id is not None:
            q2 = q2.filter(Appointment.id != exclude_id)
        if q2.first():
            raise HTTPException(status_code=409, detail="Resource has a conflicting appointment")


@router.get("/appointments", response_model=List[AppointmentRead])
def list_appointments(
    branch_id: Optional[int] = None,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    professional_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, Appointment, current_user)
    if branch_id is not None:
        q = q.filter(Appointment.branch_id == branch_id)
    if professional_id is not None:
        q = q.filter(Appointment.professional_id == professional_id)
    if customer_id is not None:
        q = q.filter(Appointment.customer_id == customer_id)
    if from_:
        q = q.filter(Appointment.starts_at >= from_)
    if to:
        q = q.filter(Appointment.starts_at <= to)
    return q.order_by(Appointment.starts_at).all()


@router.post("/appointments", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _org_id(current_user)
    # Verify professional + customer + branch belong to org
    pro = get_tenant_scoped(db, Professional, payload.professional_id, current_user)
    svcs = _services_or_422(db, org_id, payload.service_ids)

    acquire_professional_lock(db, payload.professional_id)

    total = sum(s.duration_minutes + s.buffer_minutes_after for s in svcs)
    ends_at = payload.starts_at + timedelta(minutes=total)

    _validate_no_conflict(
        db,
        org_id=org_id, professional_id=payload.professional_id,
        resource_id=payload.resource_id,
        starts_at=payload.starts_at, ends_at=ends_at,
    )

    appt = Appointment(
        organization_id=org_id,
        branch_id=payload.branch_id,
        customer_id=payload.customer_id,
        professional_id=payload.professional_id,
        resource_id=payload.resource_id,
        starts_at=payload.starts_at,
        ends_at=ends_at,
        notes=payload.notes,
        booking_channel=BookingChannel.STAFF,
        created_by=current_user.id,
    )
    db.add(appt)
    db.flush()
    for idx, svc in enumerate(svcs):
        db.add(ApptServiceLink(
            organization_id=org_id, appointment_id=appt.id, service_id=svc.id,
            sort_order=idx, duration_minutes=svc.duration_minutes,
        ))
    _emit(db, appt, AppointmentEventType.CREATED, current_user.id)
    db.commit()
    db.refresh(appt)
    return appt


@router.get("/appointments/{aid}", response_model=AppointmentRead)
def get_appointment(
    aid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_tenant_scoped(db, Appointment, aid, current_user)


@router.put("/appointments/{aid}", response_model=AppointmentRead)
def update_appointment(
    aid: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    if appt.status in [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELED, AppointmentStatus.NO_SHOW]:
        raise HTTPException(status_code=409, detail=f"Cannot edit appointment in {appt.status.value}")
    org_id = appt.organization_id
    changed_time = False

    if payload.professional_id is not None:
        appt.professional_id = payload.professional_id
    if payload.resource_id is not None:
        appt.resource_id = payload.resource_id
    if payload.notes is not None:
        appt.notes = payload.notes
    if payload.service_ids is not None:
        svcs = _services_or_422(db, org_id, payload.service_ids)
        db.query(ApptServiceLink).filter(ApptServiceLink.appointment_id == appt.id).delete()
        for idx, svc in enumerate(svcs):
            db.add(ApptServiceLink(
                organization_id=org_id, appointment_id=appt.id, service_id=svc.id,
                sort_order=idx, duration_minutes=svc.duration_minutes,
            ))
        # recompute ends_at from current starts_at
        total = sum(s.duration_minutes + s.buffer_minutes_after for s in svcs)
        appt.ends_at = (payload.starts_at or appt.starts_at) + timedelta(minutes=total)
        changed_time = True
    if payload.starts_at is not None:
        appt.starts_at = payload.starts_at
        if not changed_time:
            # recompute ends_at based on current services snapshot
            durations = (
                db.query(ApptServiceLink.duration_minutes)
                .filter(ApptServiceLink.appointment_id == appt.id)
                .all()
            )
            total = sum(d[0] for d in durations)
            appt.ends_at = appt.starts_at + timedelta(minutes=total)
            changed_time = True

    if changed_time:
        acquire_professional_lock(db, appt.professional_id)
        _validate_no_conflict(
            db, org_id=org_id, professional_id=appt.professional_id,
            resource_id=appt.resource_id, starts_at=appt.starts_at, ends_at=appt.ends_at,
            exclude_id=appt.id,
        )
        _emit(db, appt, AppointmentEventType.RESCHEDULED, current_user.id,
              payload={"new_starts_at": appt.starts_at.isoformat()})

    db.commit()
    db.refresh(appt)
    return appt


def _transition(db, appt: Appointment, new_status: AppointmentStatus, allowed_from: List[AppointmentStatus],
                ev_type: AppointmentEventType, actor_id: int, payload=None):
    if appt.status not in allowed_from:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid transition from {appt.status.value} to {new_status.value}",
        )
    appt.status = new_status
    _emit(db, appt, ev_type, actor_id, payload=payload)
    db.commit()
    db.refresh(appt)


@router.post("/appointments/{aid}/confirm", response_model=AppointmentRead)
def confirm_appointment(aid: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    _transition(db, appt, AppointmentStatus.CONFIRMED, [AppointmentStatus.PENDING],
                AppointmentEventType.CONFIRMED, current_user.id)
    return appt


@router.post("/appointments/{aid}/start", response_model=AppointmentRead)
def start_appointment(aid: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    _transition(db, appt, AppointmentStatus.IN_PROGRESS, [AppointmentStatus.CONFIRMED],
                AppointmentEventType.STARTED, current_user.id)
    return appt


@router.post("/appointments/{aid}/complete", response_model=AppointmentRead)
def complete_appointment(
    aid: int,
    payload: CompleteAppointment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    if appt.status != AppointmentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid transition from {appt.status.value} to COMPLETED",
        )
    if payload.sales_document_id is not None:
        appt.sales_document_id = payload.sales_document_id
    if payload.actual_professional_id is not None:
        appt.actual_professional_id = payload.actual_professional_id
    appt.status = AppointmentStatus.COMPLETED
    _emit(db, appt, AppointmentEventType.COMPLETED, current_user.id,
          payload={"actual_professional_id": appt.actual_professional_id,
                   "sales_document_id": appt.sales_document_id})
    db.commit()
    db.refresh(appt)
    return appt


@router.post("/appointments/{aid}/cancel", response_model=AppointmentRead)
def cancel_appointment(
    aid: int,
    payload: CancelAppointment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    _transition(
        db, appt, AppointmentStatus.CANCELED,
        [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
        AppointmentEventType.CANCELED, current_user.id,
        payload={"reason": payload.reason},
    )
    return appt


@router.post("/appointments/{aid}/no-show", response_model=AppointmentRead)
def no_show_appointment(aid: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    _transition(db, appt, AppointmentStatus.NO_SHOW,
                [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING],
                AppointmentEventType.NO_SHOW, current_user.id)
    return appt
```

Asegurar que `timedelta` esté importado al inicio del archivo:

```python
from datetime import timedelta
```

(Si ya está, omitir.)

- [ ] **Step 6.4: Wire router en `app/main.py`**

Buscar el bloque donde se registran los stubs Atlas One (alrededor de línea ~165 después de Step 4 del rebrand previo). Reemplazar la línea:

```python
app.include_router(appointments_router, prefix="/api/appointments", tags=["Agenda (Beta)"])
```

por:

```python
app.include_router(appointments_router, prefix="/api/appointments", tags=["Agenda"])
```

(Solo quitar `(Beta)` ya que el módulo es Stable.)

- [ ] **Step 6.5: Run tests → deben pasar**

```bash
pytest tests/test_appointments_lifecycle.py -v
```

Expected: 8 PASS.

- [ ] **Step 6.6: Commit**

```bash
git add app/modules/appointments/router.py app/main.py tests/test_appointments_lifecycle.py
git commit -m "$(cat <<'EOF'
feat(appointments): availability + appointment CRUD + lifecycle

Availability endpoint reuses services.get_availability. CRUD wires
get_tenant_scoped + scoped_query. Lifecycle: confirm/start/complete/
cancel/no-show with strict state-machine validation (409 on invalid
transitions). _emit() writes AppointmentEvent timeline rows. Conflict
check on POST and on PUT when starts_at or service_ids change.
acquire_professional_lock guards against double-booking races in
Postgres; no-op in SQLite tests.

8 lifecycle tests cover the happy path, double-booking 409,
actual_professional_id on /complete, invalid transitions, cancel,
no-show.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Customer portal router

**Files:**
- Create: `app/modules/appointments/portal_router.py`
- Modify: `app/main.py` (include portal_router)
- Create: `tests/test_appointments_portal.py`

El portal reusa `User(role=CLIENTE)` para auth. Reusa `/api/auth/login` para login. Solo agrega `/register` (que crea User+Customer) y endpoints scoped al cliente logueado.

- [ ] **Step 7.1: Crear tests del portal**

```python
"""Tests for /api/portal/booking customer-facing endpoints."""
from datetime import date, time, timedelta, datetime, timezone
import pytest


@pytest.fixture
def portal_setup(db, org, branch_a, cajero_a):
    """Configure org with slug + professional + service for portal booking."""
    from app.modules.appointments.models import Professional, ProfessionalSchedule, Service
    from app.models.products import Product, ProductVariant

    org.slug = "demo-portal-org"
    db.commit()

    pro = Professional(organization_id=org.id, user_id=cajero_a.id, branch_id=branch_a.id, is_bookable=True)
    db.add(pro); db.flush()
    for wd in range(0, 7):
        db.add(ProfessionalSchedule(
            organization_id=org.id, professional_id=pro.id, weekday=wd,
            start_time=time(9, 0), end_time=time(18, 0),
        ))
    p = Product(name="Corte", organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    v = ProductVariant(
        product_id=p.id, sku="CUT-PT", variant_name="Estándar",
        price=100, cost=0, has_iva=False, tax_rate=0, organization_id=org.id,
    )
    db.add(v); db.flush()
    svc = Service(organization_id=org.id, product_variant_id=v.id, duration_minutes=30)
    db.add(svc)
    db.commit()
    db.refresh(pro)
    db.refresh(svc)
    return {"professional": pro, "service": svc, "branch": branch_a}


def test_portal_register_creates_user_and_customer(client, db, org, portal_setup):
    resp = client.post(
        "/api/portal/booking/register",
        json={
            "email": "test_portal@demo.com",
            "password": "secret123",
            "name": "Test Portal Customer",
            "phone": "+5215555555555",
            "org_slug": org.slug,
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "access_token" in data
    # Verify User created with role=CLIENTE
    from app.models.users import User, Role
    u = db.query(User).filter(User.username == "test_portal@demo.com").first()
    assert u is not None
    assert u.role == Role.CLIENTE
    # Customer linked
    from app.modules.customers.models import Customer
    c = db.query(Customer).filter(Customer.email == "test_portal@demo.com", Customer.organization_id == org.id).first()
    assert c is not None


def test_portal_login_via_existing_auth(client, db, org, portal_setup):
    client.post(
        "/api/portal/booking/register",
        json={
            "email": "p_login@demo.com",
            "password": "secret123",
            "name": "P Login",
            "phone": "+521",
            "org_slug": org.slug,
        },
    )
    # Use standard /api/auth/login form-data
    resp = client.post(
        "/api/auth/login",
        data={"username": "p_login@demo.com", "password": "secret123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_portal_book_appointment(client, db, org, portal_setup):
    reg = client.post(
        "/api/portal/booking/register",
        json={
            "email": "book@demo.com", "password": "secret123",
            "name": "B Book", "phone": "+521", "org_slug": org.slug,
        },
    )
    token = reg.json()["access_token"]
    today = date.today()
    monday = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
    starts_at = datetime(monday.year, monday.month, monday.day, 11, 0, tzinfo=timezone.utc)
    resp = client.post(
        "/api/portal/booking/appointments",
        json={
            "branch_id": portal_setup["branch"].id,
            "professional_id": portal_setup["professional"].id,
            "service_ids": [portal_setup["service"].id],
            "starts_at": starts_at.isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["booking_channel"] == "PORTAL"


def test_portal_list_only_my_appointments(client, db, org, portal_setup):
    reg = client.post(
        "/api/portal/booking/register",
        json={
            "email": "mine@demo.com", "password": "secret123",
            "name": "Mine", "phone": "+521", "org_slug": org.slug,
        },
    )
    token = reg.json()["access_token"]
    today = date.today()
    monday = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
    starts_at = datetime(monday.year, monday.month, monday.day, 12, 0, tzinfo=timezone.utc)
    client.post(
        "/api/portal/booking/appointments",
        json={
            "branch_id": portal_setup["branch"].id,
            "professional_id": portal_setup["professional"].id,
            "service_ids": [portal_setup["service"].id],
            "starts_at": starts_at.isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = client.get("/api/portal/booking/appointments", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 1


def test_portal_cancel_within_window(client, db, org, portal_setup):
    reg = client.post(
        "/api/portal/booking/register",
        json={
            "email": "cancel@demo.com", "password": "secret123",
            "name": "Cancel", "phone": "+521", "org_slug": org.slug,
        },
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    # Cita 7 días en el futuro → más allá de 24h
    monday = date.today() + timedelta(days=7 + ((7 - date.today().weekday()) % 7 or 7))
    starts_at = datetime(monday.year, monday.month, monday.day, 13, 0, tzinfo=timezone.utc)
    r = client.post(
        "/api/portal/booking/appointments",
        json={
            "branch_id": portal_setup["branch"].id,
            "professional_id": portal_setup["professional"].id,
            "service_ids": [portal_setup["service"].id],
            "starts_at": starts_at.isoformat(),
        },
        headers=headers,
    )
    aid = r.json()["id"]
    resp = client.post(f"/api/portal/booking/appointments/{aid}/cancel", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELED"
```

- [ ] **Step 7.2: Run tests → fallan**

```bash
pytest tests/test_appointments_portal.py -v
```

Expected: 404 endpoints.

- [ ] **Step 7.3: Crear `app/modules/appointments/portal_router.py`**

```python
"""Atlas BOS modules/appointments/portal_router — public customer booking.

Auth: customer logs in as User(role=CLIENTE). Register endpoint creates
User + Customer linked by email + organization. Login reuses the
standard /api/auth/login OAuth2PasswordRequestForm flow.

URL prefix: /api/portal/booking/*
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    get_password_hash,
)
from app.models import User
from app.models.users import PlatformRole, Role, UserOrganization
from app.modules.appointments.models import (
    Appointment,
    AppointmentEvent,
    AppointmentEventType,
    AppointmentService as ApptServiceLink,
    AppointmentStatus,
    BookingChannel,
    Professional,
    Service,
)
from app.modules.appointments.services import (
    acquire_professional_lock,
    get_availability,
)
from app.modules.customers.models import Customer
from app.modules.tenants.models import Branch, Organization

router = APIRouter()


# ── Schemas (inline because they're specific to portal) ─────────────────────

class PortalRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    org_slug: str


class PortalLogin(BaseModel):
    email: EmailStr
    password: str
    org_slug: str


class PortalBookingCreate(BaseModel):
    branch_id: int
    professional_id: int
    service_ids: List[int]
    starts_at: datetime


# ── Helpers ─────────────────────────────────────────────────────────────────

def _org_from_slug(db: Session, slug: str) -> Organization:
    org = db.query(Organization).filter(Organization.slug == slug).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def _customer_for_portal_user(db: Session, user: User) -> Customer:
    """Resolve the Customer record linked to a portal User (role=CLIENTE)."""
    if user.role != Role.CLIENTE:
        raise HTTPException(status_code=403, detail="Not a portal customer")
    # The User is linked to ONE active organization through UserOrganization
    org_link = (
        db.query(UserOrganization)
        .filter(UserOrganization.user_id == user.id, UserOrganization.is_active == True)  # noqa: E712
        .first()
    )
    if not org_link:
        raise HTTPException(status_code=400, detail="Portal user has no active org")
    cust = (
        db.query(Customer)
        .filter(
            Customer.organization_id == org_link.organization_id,
            Customer.email == user.username,
        )
        .first()
    )
    if not cust:
        raise HTTPException(status_code=404, detail="Customer record not found for portal user")
    return cust


# ── Auth ────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
def portal_register(payload: PortalRegister, db: Session = Depends(get_db)):
    org = _org_from_slug(db, payload.org_slug)

    # User unique by username (email)
    existing = db.query(User).filter(User.username == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already exists, try login")

    user = User(
        username=payload.email,
        full_name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=get_password_hash(payload.password),
        role=Role.CLIENTE,
        platform_role=PlatformRole.NONE,
        is_active=True,
    )
    db.add(user); db.flush()

    # Link to org
    db.add(UserOrganization(user_id=user.id, organization_id=org.id, is_active=True, org_role="MEMBER"))

    # Create matching Customer
    cust = (
        db.query(Customer)
        .filter(Customer.organization_id == org.id, Customer.email == payload.email)
        .first()
    )
    if cust is None:
        cust = Customer(
            organization_id=org.id,
            name=payload.name,
            email=payload.email,
            phone=payload.phone,
        )
        db.add(cust)

    db.commit()

    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer", "user_id": user.id, "org_id": org.id}


@router.get("/me")
def portal_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != Role.CLIENTE:
        raise HTTPException(status_code=403, detail="Not a portal customer")
    cust = _customer_for_portal_user(db, current_user)
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "customer_id": cust.id,
        "organization_id": cust.organization_id,
        "name": cust.name,
    }


# ── Public discovery (no auth required) ─────────────────────────────────────

@router.get("/branches")
def portal_list_branches(org_slug: str, db: Session = Depends(get_db)):
    org = _org_from_slug(db, org_slug)
    rows = (
        db.query(Branch)
        .filter(Branch.organization_id == org.id, Branch.is_active == True)  # noqa: E712
        .order_by(Branch.name)
        .all()
    )
    return [{"id": b.id, "name": b.name, "city": b.city} for b in rows]


@router.get("/services")
def portal_list_services(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    rows = (
        db.query(Service)
        .filter(
            Service.organization_id == branch.organization_id,
            Service.is_bookable_online == True,  # noqa: E712
        )
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.variant.variant_name if s.variant else None,
            "duration_minutes": s.duration_minutes,
            "price": float(s.variant.price) if s.variant and s.variant.price else None,
        }
        for s in rows
    ]


@router.get("/professionals")
def portal_list_professionals(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    rows = (
        db.query(Professional)
        .filter(
            Professional.organization_id == branch.organization_id,
            Professional.branch_id == branch_id,
            Professional.is_bookable == True,  # noqa: E712
        )
        .all()
    )
    return [
        {"id": p.id, "name": p.user.full_name if p.user else None,
         "bio": p.bio, "photo_url": p.photo_url, "color": p.color}
        for p in rows
    ]


@router.get("/availability")
def portal_availability(
    branch_id: int,
    date: str,
    service_ids: str,
    professional_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    from datetime import date as _date
    try:
        target = _date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
    ids = [int(s) for s in service_ids.split(",") if s.strip()]
    return get_availability(
        db,
        organization_id=branch.organization_id,
        branch_id=branch_id,
        target_date=target,
        service_ids=ids,
        professional_id=professional_id,
    )


# ── Authenticated booking ───────────────────────────────────────────────────

@router.post("/appointments", status_code=status.HTTP_201_CREATED)
def portal_book(
    payload: PortalBookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _customer_for_portal_user(db, current_user)
    org_id = cust.organization_id

    pro = db.query(Professional).filter(
        Professional.id == payload.professional_id, Professional.organization_id == org_id,
    ).first()
    if not pro:
        raise HTTPException(status_code=404, detail="Professional not found")

    svcs = db.query(Service).filter(
        Service.organization_id == org_id, Service.id.in_(payload.service_ids),
        Service.is_bookable_online == True,  # noqa: E712
    ).all()
    if len(svcs) != len(payload.service_ids):
        raise HTTPException(status_code=422, detail="Service(s) not bookable online")

    total = sum(s.duration_minutes + s.buffer_minutes_after for s in svcs)
    ends_at = payload.starts_at + timedelta(minutes=total)

    acquire_professional_lock(db, payload.professional_id)

    # Conflict check (same logic as backoffice)
    conflict = db.query(Appointment).filter(
        Appointment.organization_id == org_id,
        Appointment.professional_id == payload.professional_id,
        Appointment.starts_at < ends_at,
        Appointment.ends_at > payload.starts_at,
        Appointment.status.in_([
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
        ]),
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Slot no longer available")

    appt = Appointment(
        organization_id=org_id,
        branch_id=payload.branch_id,
        customer_id=cust.id,
        professional_id=payload.professional_id,
        starts_at=payload.starts_at,
        ends_at=ends_at,
        booking_channel=BookingChannel.PORTAL,
        created_by=current_user.id,
    )
    db.add(appt); db.flush()
    for idx, svc in enumerate(svcs):
        db.add(ApptServiceLink(
            organization_id=org_id, appointment_id=appt.id, service_id=svc.id,
            sort_order=idx, duration_minutes=svc.duration_minutes,
        ))
    db.add(AppointmentEvent(
        organization_id=org_id, appointment_id=appt.id,
        event_type=AppointmentEventType.CREATED,
        actor_user_id=current_user.id, payload={"channel": "PORTAL"},
    ))
    db.commit()
    db.refresh(appt)
    return {
        "id": appt.id,
        "status": appt.status.value,
        "booking_channel": appt.booking_channel.value,
        "starts_at": appt.starts_at.isoformat(),
        "ends_at": appt.ends_at.isoformat(),
    }


@router.get("/appointments")
def portal_my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _customer_for_portal_user(db, current_user)
    rows = (
        db.query(Appointment)
        .filter(
            Appointment.organization_id == cust.organization_id,
            Appointment.customer_id == cust.id,
        )
        .order_by(Appointment.starts_at.desc())
        .all()
    )
    return [
        {"id": a.id, "starts_at": a.starts_at.isoformat(), "ends_at": a.ends_at.isoformat(),
         "status": a.status.value, "professional_id": a.professional_id,
         "branch_id": a.branch_id}
        for a in rows
    ]


@router.post("/appointments/{aid}/cancel")
def portal_cancel(
    aid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _customer_for_portal_user(db, current_user)
    appt = (
        db.query(Appointment)
        .filter(
            Appointment.id == aid,
            Appointment.organization_id == cust.organization_id,
            Appointment.customer_id == cust.id,
        )
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.status not in (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED):
        raise HTTPException(status_code=409, detail=f"Cannot cancel from {appt.status.value}")
    # 24h window check
    now = datetime.now(timezone.utc)
    if appt.starts_at - now < timedelta(hours=24):
        raise HTTPException(status_code=409, detail="Too close to start time (24h policy)")
    appt.status = AppointmentStatus.CANCELED
    db.add(AppointmentEvent(
        organization_id=cust.organization_id, appointment_id=appt.id,
        event_type=AppointmentEventType.CANCELED, actor_user_id=current_user.id,
        payload={"by": "portal"},
    ))
    db.commit()
    return {"id": appt.id, "status": appt.status.value}
```

- [ ] **Step 7.4: Wire portal router en `app/main.py`**

Buscar el bloque "Atlas One stub modules" en `app/main.py` y añadir DESPUÉS de `app.include_router(appointments_router, ...)`:

```python
from app.modules.appointments.portal_router import router as appointments_portal_router

app.include_router(
    appointments_portal_router,
    prefix="/api/portal/booking",
    tags=["Portal: Booking (público)"],
)
```

- [ ] **Step 7.5: Run tests → deben pasar**

```bash
pytest tests/test_appointments_portal.py -v
```

Expected: 5 PASS.

- [ ] **Step 7.6: Commit**

```bash
git add app/modules/appointments/portal_router.py app/main.py tests/test_appointments_portal.py
git commit -m "$(cat <<'EOF'
feat(appointments): customer portal booking endpoints

Public discovery: /branches, /services, /professionals, /availability
(no auth — for landing page browse).

Auth via User(role=CLIENTE) + existing /api/auth/login:
- POST /register creates User + Customer linked by email + org
- GET  /me      returns the portal session context

Booking (authenticated as CLIENTE):
- POST /appointments       create with booking_channel=PORTAL
- GET  /appointments       list mine
- POST /appointments/{id}/cancel  with 24h policy

Reuses services.acquire_professional_lock + get_availability so the
portal and backoffice share the same conflict resolution.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Migration indexes + seed demo extension

**Files:**
- Modify: `scripts/railway_init.py` (indexes appointments)
- Modify: `scripts/seed_demo_orgs.py` (seed_appointments_demo)

- [ ] **Step 8.1: Añadir índices en railway_init**

En `scripts/railway_init.py`, buscar la lista `index_migrations` dentro de `run_migrations()` y APPEND al final (antes del cierre del bloque):

```python
        # Appointments MVP 2026-05-18 — critical indexes for availability + lifecycle
        (
            "ix_appt_org_branch_starts",
            "CREATE INDEX IF NOT EXISTS ix_appt_org_branch_starts ON appointments (organization_id, branch_id, starts_at);",
        ),
        (
            "ix_appt_professional_range",
            "CREATE INDEX IF NOT EXISTS ix_appt_professional_range ON appointments (professional_id, starts_at, ends_at);",
        ),
        (
            "ix_appt_customer",
            "CREATE INDEX IF NOT EXISTS ix_appt_customer ON appointments (customer_id);",
        ),
        (
            "ix_appt_events",
            "CREATE INDEX IF NOT EXISTS ix_appt_events ON appointments_events (appointment_id, created_at);",
        ),
        (
            "ix_blocks_prof_range",
            "CREATE INDEX IF NOT EXISTS ix_blocks_prof_range ON appointments_blocks (professional_id, starts_at, ends_at);",
        ),
```

Añadir partial index (solo Postgres) en un bloque aparte después del loop existente:

```python
    # Partial index — only Postgres supports CREATE INDEX ... WHERE
    if engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_appt_resource_range "
                "ON appointments (resource_id, starts_at, ends_at) "
                "WHERE resource_id IS NOT NULL;"
            ))
            conn.commit()
            print("  ✓ index ix_appt_resource_range (partial) ensured")
```

- [ ] **Step 8.2: Extender seed_demo_orgs con seed de appointments**

En `scripts/seed_demo_orgs.py`, después de la función `ensure_products` añadir:

```python
def seed_appointments_demo(db, spec, org, branch, cashier_user, products):
    """For demos with appointments-enabled presets, populate professional + schedule + sample appointments."""
    from datetime import date, datetime, time, timedelta, timezone
    from app.modules.appointments.models import (
        Appointment,
        AppointmentStatus,
        AppointmentService as ApptServiceLink,
        BookingChannel,
        Professional,
        ProfessionalSchedule,
        Resource,
        ResourceType,
        Service,
    )
    from app.modules.customers.models import Customer
    from app.models.products import ProductVariant

    APPT_PRESETS = {
        "ATLAS_ONE_BARBER":          ResourceType.CHAIR,
        "ATLAS_ONE_BEAUTY_WELLNESS": ResourceType.CABIN,
        "ATLAS_ONE_HEALTH":          ResourceType.CONSULTORY,
        "ATLAS_ONE_SERVICES":        ResourceType.BAY,
        "ATLAS_ONE_BEAUTY":          ResourceType.CABIN,  # legacy alias
    }
    industry = spec["industry_type"].value
    res_type = APPT_PRESETS.get(industry)
    if res_type is None:
        return  # preset doesn't use appointments

    # Idempotent: skip if professional already exists for this cashier+branch
    existing_pro = (
        db.query(Professional)
        .filter(Professional.user_id == cashier_user.id, Professional.branch_id == branch.id)
        .first()
    )
    if existing_pro:
        logger.info("    · appointments seed already present, skipping")
        return

    pro = Professional(
        organization_id=org.id, user_id=cashier_user.id, branch_id=branch.id,
        is_bookable=True, color="#06b6d4",
        bio=f"Profesional demo de {spec['name']}",
    )
    db.add(pro); db.flush()
    for wd in range(0, 6):  # Mon-Sat
        db.add(ProfessionalSchedule(
            organization_id=org.id, professional_id=pro.id, weekday=wd,
            start_time=time(9, 0), end_time=time(18, 0),
        ))

    res = Resource(
        organization_id=org.id, branch_id=branch.id,
        name=f"{res_type.value} 1", resource_type=res_type, capacity=1, is_active=True,
    )
    db.add(res); db.commit()

    # Mark first 4 product variants as Services
    durations = [30, 45, 60, 30]
    variants = (
        db.query(ProductVariant)
        .filter(ProductVariant.organization_id == org.id)
        .order_by(ProductVariant.created_at)
        .limit(4)
        .all()
    )
    services = []
    for v, d in zip(variants, durations):
        if db.query(Service).filter(Service.product_variant_id == v.id).first():
            continue
        s = Service(
            organization_id=org.id, product_variant_id=v.id,
            duration_minutes=d, buffer_minutes_after=5,
            requires_resource_type=res_type, is_bookable_online=True,
        )
        db.add(s)
        services.append(s)
    db.commit()
    for s in services:
        db.refresh(s)
    logger.info(f"    + {len(services)} service(s) marked")

    # Demo customer
    cust = Customer(
        organization_id=org.id, name="Cliente Demo Agenda",
        email="cliente.demo@atlasone.test", phone="+5215555555555",
    )
    db.add(cust); db.commit()

    if not services:
        return

    svc = services[0]
    today = datetime.now(timezone.utc)
    today_local = today.replace(hour=10, minute=0, second=0, microsecond=0)
    yesterday = today_local - timedelta(days=1)
    later_today = today_local + timedelta(hours=2)

    demos = [
        (today_local, AppointmentStatus.CONFIRMED),
        (later_today, AppointmentStatus.PENDING),
        (yesterday, AppointmentStatus.COMPLETED),
    ]
    for starts_at, st in demos:
        a = Appointment(
            organization_id=org.id, branch_id=branch.id, customer_id=cust.id,
            professional_id=pro.id, resource_id=res.id,
            starts_at=starts_at, ends_at=starts_at + timedelta(minutes=svc.duration_minutes),
            status=st, booking_channel=BookingChannel.STAFF,
        )
        db.add(a); db.flush()
        db.add(ApptServiceLink(
            organization_id=org.id, appointment_id=a.id, service_id=svc.id,
            sort_order=0, duration_minutes=svc.duration_minutes,
        ))
    db.commit()
    logger.info(f"    + 3 demo appointments seeded (1 confirmed today, 1 pending, 1 completed yesterday)")
```

Ahora invocarlo. Buscar el bucle principal en `seed_all()` y añadir DESPUÉS de `ensure_products(db, org, spec["products"])` (justo antes del `succeeded += 1`):

```python
            # Appointments-enabled presets get a professional, schedule, and 3 demo appointments
            try:
                cashier = db.query(User).filter(User.username == spec.get("cashier_username", "")).first()
                if cashier:
                    seed_appointments_demo(db, spec, org, branch, cashier, spec["products"])
            except Exception as e:
                db.rollback()
                logger.warning(f"    ⚠ appointments demo seed failed: {e}")
```

(Asegurar `from app.models.users import User` está importado al inicio de `seed_demo_orgs.py`. Si no, añadir.)

- [ ] **Step 8.3: Compile check**

```bash
python3 -m py_compile scripts/railway_init.py scripts/seed_demo_orgs.py
```

Expected: no output.

- [ ] **Step 8.4: Run full test suite**

```bash
pytest tests/ --tb=line 2>&1 | tail -20
```

Expected: green o solo fallos pre-existentes no relacionados.

- [ ] **Step 8.5: Commit**

```bash
git add scripts/railway_init.py scripts/seed_demo_orgs.py
git commit -m "$(cat <<'EOF'
feat(seed): railway indexes + appointments demo data

railway_init.py adds 5 indexes + 1 partial index (Postgres only) for
the new appointments tables. Critical for /availability performance.

seed_demo_orgs.py adds seed_appointments_demo(): for orgs with
ATLAS_ONE_BARBER / BEAUTY_WELLNESS / HEALTH / SERVICES / BEAUTY presets,
seeds a Professional (the demo cajero) with Mon-Sat 9-18 schedule, one
resource of the type appropriate to the vertical, marks the first 4
variants as Services with realistic durations, and creates 3 sample
appointments (1 confirmed today, 1 pending today+2h, 1 completed
yesterday) so the calendar isn't empty on first login.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Push + smoke test

- [ ] **Step 9.1: Verify CI gate passes locally**

```bash
pytest tests/ -x --tb=short 2>&1 | tail -15
cd frontend && npx tsc --noEmit && cd ..
```

Expected: pytest green, tsc exit 0.

- [ ] **Step 9.2: Source keychain + push**

```bash
. ~/.keychain/ctoecg-sh
git push origin main 2>&1 | tail -5
```

Expected: `<previous_sha>..<new_sha>  main -> main`.

- [ ] **Step 9.3: Monitor Railway deploy**

Esperar ~3-5 min. En Railway logs buscar:
- `🔧 Creating database tables...` — debe incluir las 8 tablas nuevas (`appointments`, `appointments_*`)
- `✓ organization.slug added`
- `Backfill organization.slug…` con N orgs procesadas
- `✓ index ix_appt_org_branch_starts ensured` (los 5 índices + el partial)
- `🎭 Atlas One — seeding demo organizations...` con líneas `+ N service(s) marked` y `+ 3 demo appointments seeded` para BARBER/BEAUTY_WELLNESS/HEALTH/SERVICES.

- [ ] **Step 9.4: Smoke manual end-to-end**

Loguearse a Railway frontend con `demo_barber / demo1234`. Abrir DevTools → Network. Hacer:

```
GET /api/appointments/professionals?branch_id=<id>
   → debe devolver al menos 1 profesional (demo_cajero_barber)

GET /api/appointments/services
   → debe devolver 4 services

GET /api/appointments/appointments
   → debe devolver 3 citas demo

GET /api/appointments/availability?branch_id=<id>&date=2026-05-19&service_ids=<id>
   → debe devolver slots libres
```

Expected: status 200 en todas, datos no vacíos.

Probar también `demo_pos / demo1234` (preset sin appointments):

```
GET /api/appointments/appointments
   → 200 con [] (no hay citas pero el endpoint no rompe)
```

---

## Done criteria

- [ ] Los 27+ tests en los 4 archivos de appointments pasan.
- [ ] `pytest tests/` green sin regresiones.
- [ ] CI gate verde.
- [ ] Railway deploy logs muestran tablas creadas + 5 índices + partial index.
- [ ] Endpoints responden 200 con datos reales en demo orgs Barber/BeautyWellness/Health/Services.
- [ ] Demo orgs sin preset de appointments siguen funcionando (POS, Custom, Retail).

## Follow-ups (next plans)

- **Plan 2 — Frontend backoffice** (`AppointmentsCalendar`, `AppointmentComposer`, `AppointmentDetail`, `AppointmentsSettings`, sidebar update, react-big-calendar).
- **Plan 3 — Frontend portal cliente** (`PortalBookingFlow`, `PortalLogin`, `MyAppointments`, public `/book/<slug>` route).

Cada uno se brainstormea + se escribe su plan cuando este Plan 1 esté en main verde.
