"""Endpoint /api/customers/{id}/pdf-statement: auth, org-scoping, PDF válido."""
from decimal import Decimal

import pytest

from app.modules.customers.models import Customer, CustomerLedgerEntry
from app.models.organization import Organization


@pytest.fixture()
def customer_a(db, org):
    c = Customer(name="Cliente Uno", phone="4491112233",
                 organization_id=org.id, current_balance=Decimal("100.00"))
    db.add(c)
    db.commit()
    db.refresh(c)
    db.add(CustomerLedgerEntry(customer_id=c.id, amount=Decimal("100.00"),
                               description="Venta a crédito", organization_id=org.id))
    db.commit()
    return c


@pytest.fixture()
def other_org_customer(db):
    other = Organization(name="Otra Org", status="ACTIVE")
    db.add(other)
    db.commit()
    c = Customer(name="Ajeno", organization_id=other.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def test_pdf_statement_requires_auth(client, customer_a):
    r = client.get(f"/api/customers/{customer_a.id}/pdf-statement")
    assert r.status_code == 401


def test_pdf_statement_cross_org_is_404(client, auth_admin, other_org_customer):
    r = client.get(f"/api/customers/{other_org_customer.id}/pdf-statement",
                   headers=auth_admin)
    assert r.status_code == 404


def test_pdf_statement_returns_pdf(client, auth_admin, customer_a):
    r = client.get(f"/api/customers/{customer_a.id}/pdf-statement", headers=auth_admin)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
