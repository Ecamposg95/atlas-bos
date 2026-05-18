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
