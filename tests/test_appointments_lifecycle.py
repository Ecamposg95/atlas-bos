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
