"""Una venta a credito puro (`payments: []`) reventaba DESPUES de comitear.

Hallazgo preexistente (revisión final, #7): `sum()` sin valor inicial
devuelve `int 0` (no `Decimal`) cuando `sale_in.payments` esta vacio. Eso no
bloqueaba nada -- el folio ya se cobro, el stock ya se descontio y la deuda ya
se cargo al cliente -- y solo revienta al final, cuando
`total_paid.quantize(...)` truena con `AttributeError` porque `int` no tiene
`.quantize()`, devolviendo 500 sobre una venta que en BD SI quedo creada.

Arreglo: `sum(..., Decimal("0"))` con valor inicial explicito
(app/routers/sales.py, cerca de la linea 668).
"""
from decimal import Decimal

from app.models.cash import CashSession
from app.models.modules import Module, OrganizationModule
from app.models.sales import DocumentStatus, SalesDocument
from app.modules.customers.models import Customer


def _habilitar_pos(db, org):
    if db.query(Module).filter(Module.key == "pos").first() is None:
        db.add(Module(key="pos", name="Punto de venta")); db.flush()
    if db.query(OrganizationModule).filter(
        OrganizationModule.organization_id == org.id,
        OrganizationModule.module_key == "pos").first() is None:
        db.add(OrganizationModule(organization_id=org.id, module_key="pos", is_enabled=True))
    db.commit()


def _abrir_caja(db, org, branch, user):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                     opening_balance=Decimal("0"), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_venta_sin_pagos_no_revienta_con_500(
    client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
):
    _habilitar_pos(db, org)
    _, variant = products_setup["product_a"]
    _abrir_caja(db, org, branch_a, cajero_a)

    cliente = Customer(
        organization_id=org.id, name="Cliente a credito",
        has_credit=True, credit_limit=Decimal("10000.00"),
        current_balance=Decimal("0.00"),
    )
    db.add(cliente); db.commit(); db.refresh(cliente)

    resp = client.post("/api/sales/", json={
        "doc_type": "ORDER",
        "customer_id": cliente.id,
        "items": [{"sku": variant.sku, "quantity": 1}],
        "payments": [],
    }, headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})

    assert resp.status_code in (200, 201), (
        f"una venta a credito puro (sin pagos) no debe responder 500: "
        f"{resp.status_code}: {resp.text[:500]}"
    )
    body = resp.json()
    assert body["paid"] == 0.0
    assert body["credit_debt"] > 0

    venta = db.query(SalesDocument).filter(
        SalesDocument.organization_id == org.id
    ).one()
    assert venta.status == DocumentStatus.PENDING

    db.refresh(cliente)
    assert cliente.current_balance == venta.total_amount, (
        "la deuda cargada al cliente debe coincidir con el total de la venta"
    )
