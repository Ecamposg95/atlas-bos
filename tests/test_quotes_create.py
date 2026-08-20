"""
Cotizaciones — el descuento por línea y las notas del vendedor deben
persistirse, no descartarse (regresión del fix de auditoría UI P0).
"""
from decimal import Decimal

import pytest

from app.models.modules import Module, OrganizationModule
from app.models.sales import SalesDocument, SalesLineItem


@pytest.fixture()
def quotes_module_enabled(db, org):
    mod = db.query(Module).filter(Module.key == "quotes").first()
    if not mod:
        mod = Module(key="quotes", name="Quotes")
        db.add(mod); db.flush()
    db.add(OrganizationModule(
        organization_id=org.id, module_key="quotes", is_enabled=True,
    ))
    db.flush()


def test_create_quote_persists_discounts_and_notes(client, db, auth_cajero_a, products_setup, quotes_module_enabled):
    payload = {
        "doc_type": "QUOTE",
        "items": [
            {"sku": "SKU-A", "quantity": 2, "discount": 10},
            {"sku": "SKU-BOTH", "quantity": 1},
        ],
        "payments": [],
        "notes": "Entrega el viernes",
    }
    r = client.post("/api/quotes/", json=payload, headers=auth_cajero_a)
    assert r.status_code == 200, r.text
    quote_id = r.json()["quote_id"]

    doc = db.query(SalesDocument).filter(SalesDocument.id == quote_id).one()
    assert doc.notes == "Entrega el viernes"
    # SKU-A: 100 × 2 × 0.90 = 180.00 · SKU-BOTH: 150.00 → total 330.00
    assert Decimal(str(doc.total_amount)) == Decimal("330.00")

    lines = db.query(SalesLineItem).filter(SalesLineItem.document_id == quote_id).all()
    by_sku = {l.description.split(" - ")[0]: l for l in lines}
    assert Decimal(str(by_sku["SKU-A"].discount_percent)) == Decimal("10")
    assert Decimal(str(by_sku["SKU-A"].total_line)) == Decimal("180.00")
    assert Decimal(str(by_sku["SKU-BOTH"].total_line)) == Decimal("150.00")


def test_create_quote_without_discount_or_notes_keeps_old_behavior(client, db, auth_cajero_a, products_setup, quotes_module_enabled):
    payload = {
        "doc_type": "QUOTE",
        "items": [{"sku": "SKU-A", "quantity": 3}],
        "payments": [],
    }
    r = client.post("/api/quotes/", json=payload, headers=auth_cajero_a)
    assert r.status_code == 200, r.text
    quote_id = r.json()["quote_id"]

    doc = db.query(SalesDocument).filter(SalesDocument.id == quote_id).one()
    assert doc.notes is None
    assert Decimal(str(doc.total_amount)) == Decimal("300.00")
