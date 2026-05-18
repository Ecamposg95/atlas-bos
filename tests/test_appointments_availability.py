"""Tests for app.modules.appointments.services.get_availability."""
from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.modules.appointments.models import (
    Appointment,
    AppointmentStatus,
    Professional,
    ProfessionalBlock,
    ProfessionalSchedule,
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
