"""El pago nace atribuido a la caja de quien cobra.

Task 3 del plan `pago-atribuido-a-caja`: hasta aqui, `Payment.cash_session_id`
(Task 1) existe pero nadie lo escribe -- todo pago nace en NULL y cae al
respaldo por documento (`session_sales_filter`, va Task 2). Este archivo
prueba que el checkout (`POST /api/sales/`) lo puebla en las dos ramas que
resuelven la sesion de caja en `app/routers/sales.py`:

1. Venta nueva: el `Payment` se crea con la sesion OPEN del cajero.
2. `existing_sale` (completar una venta PENDING): los pagos viejos se borran
   y se recrean -- los nuevos deben quedar en la sesion de HOY, no en la
   sesion (probablemente ya cerrada) que abrio la venta a credito. Este es
   justo el defecto que motivo todo el plan (ver cabecera de
   `tests/test_cash_credito_y_abonos.py`).
"""
from decimal import Decimal

from app.models.cash import CashSession
from app.models.modules import Module, OrganizationModule
from app.models.sales import DocumentStatus, Payment, SalesDocument


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


def _preparar(db, org, branch, user):
    """Alias del helper del brief: habilita POS y abre caja."""
    _habilitar_pos(db, org)
    return _abrir_caja(db, org, branch, user)


def test_el_pago_del_checkout_lleva_la_caja(
    client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
):
    sesion = _preparar(db, org, branch_a, cajero_a)
    _, variant = products_setup["product_a"]

    resp = client.post("/api/sales/", json={
        "doc_type": "ORDER",
        "items": [{"sku": variant.sku, "quantity": 1}],
        "payments": [{"method": "CASH", "amount": "100.00"}],
    }, headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp.status_code in (200, 201), resp.text

    pago = db.query(Payment).filter(Payment.organization_id == org.id).one()
    assert pago.cash_session_id == sesion.id, (
        "el pago debe quedar atribuido a la caja abierta del cajero que cobro"
    )


def _venta_pendiente(db, org, branch, user, sesion, total="100.00", folio=999):
    """Venta a credito (PENDING) ya vinculada a una sesion de caja, sin pagos
    todavia -- mimetiza lo que deja `/api/sales/` para una venta a plazos
    (mismo helper que `tests/test_cash_credito_y_abonos.py`)."""
    s = SalesDocument(
        organization_id=org.id, branch_id=branch.id, seller_id=user.id,
        folio=folio, series="A", subtotal=Decimal(total), tax_amount=Decimal("0"),
        total_amount=Decimal(total), status=DocumentStatus.PENDING, doc_type="ORDER",
        cash_session_id=sesion.id,
    )
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_pagos_recreados_al_completar_venta_pendiente_quedan_en_la_sesion_nueva(
    client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
):
    """El defecto que motivo este plan: al liquidar en un turno posterior una
    venta a credito, el checkout borra los pagos viejos y crea unos nuevos
    (rama `existing_sale`). Esos pagos nuevos deben llevar la sesion de HOY,
    no la sesion (ya cerrada) con la que se abrio la venta original.
    """
    _habilitar_pos(db, org)
    _, variant = products_setup["product_a"]
    sesion_1 = _abrir_caja(db, org, branch_a, cajero_a)
    venta = _venta_pendiente(db, org, branch_a, cajero_a, sesion_1)

    # El turno 1 cierra sin que el cliente haya liquidado nada.
    close_resp = client.post(
        "/api/cash/close", json={"closing_balance": "0.00"},
        headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
    )
    assert close_resp.status_code in (200, 201), close_resp.text

    # Turno 2 (mismo cajero, sesion distinta): el cliente liquida el total.
    sesion_2 = _abrir_caja(db, org, branch_a, cajero_a)

    resp2 = client.post("/api/sales/", json={
        "id": venta.id,
        "doc_type": "ORDER",
        "items": [{"sku": variant.sku, "quantity": 1}],
        "payments": [{"method": "CASH", "amount": "100.00"}],
    }, headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp2.status_code in (200, 201), resp2.text

    pago = db.query(Payment).filter(Payment.sales_document_id == venta.id).one()
    assert pago.cash_session_id == sesion_2.id, (
        "el pago recreado al completar la venta pendiente debe quedar en la "
        "sesion nueva (turno 2), no en la sesion original (turno 1, ya "
        "cerrada) -- ese es justo el defecto que este plan existe para cerrar"
    )
    assert pago.cash_session_id != sesion_1.id
