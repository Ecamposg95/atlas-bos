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
