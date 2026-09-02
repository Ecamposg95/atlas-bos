"""El efectivo entra al corte donde se recibio, no al de la venta original.

Ni Novedades Kaory ni Novedades Ginebra usan credito a clientes todavia -- este
riesgo esta latente, no manifestado -- pero se activa el dia que den la primera
venta a plazos: hoy el efectivo de una venta a credito con abono parcial NO
entra al esperado de NINGUNA caja, aunque los billetes esten fisicamente en el
cajon (`DocumentStatus.PENDING` estaba fuera de `CASH_INCLUDED_STATUSES`).

Nota de diseño -- por que las ventas PENDING se siembran directo en BD (como
ya hace `test_cash_warning_ventas_sin_corte.py`) en vez de vía POST completo a
`/api/sales/`: el guard H-1 ("Pagos insuficientes") rechaza cualquier POST
cuyo `total_paid` no cubra el total con tolerancia de 1 centavo, y una venta a
credito puro (`payments: []`) dispara un bug preexistente y ajeno a esta tarea
-- `sum()` de una lista vacia devuelve `int 0` en vez de `Decimal(0)`, y
`total_paid.quantize(...)` truena luego con `AttributeError` -- asi que ese
camino no sirve hoy para sembrar el estado que este test necesita. Se deja
documentado en el reporte de la tarea como hallazgo aparte; no se toca aqui.
"""
from decimal import Decimal

from app.models.cash import CashSession
from app.models.modules import Module, OrganizationModule
from app.models.sales import DocumentStatus, PaymentMethod, Payment, SalesDocument
from app.services.cash_reconciliation import compute_expected_cash


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


def _venta_pendiente(db, org, branch, user, sesion, total="100.00", folio=999):
    """Venta a credito (PENDING) ya vinculada a una sesion de caja, sin pagos
    todavia -- mimetiza lo que deja `/api/sales/` para una venta a plazos."""
    s = SalesDocument(
        organization_id=org.id, branch_id=branch.id, seller_id=user.id,
        folio=folio, series="A", subtotal=Decimal(total), tax_amount=Decimal("0"),
        total_amount=Decimal(total), status=DocumentStatus.PENDING, doc_type="ORDER",
        cash_session_id=sesion.id,
    )
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_abono_parcial_en_efectivo_entra_al_esperado(db, org, branch_a, cajero_a):
    """Venta a credito con abono en efectivo: los pesos estan en el cajon."""
    sesion = _abrir_caja(db, org, branch_a, cajero_a)
    venta = _venta_pendiente(db, org, branch_a, cajero_a, sesion)

    # Abono parcial en efectivo (40 de los 100 que debe la venta).
    db.add(Payment(sales_document_id=venta.id, amount=Decimal("40.00"),
                   method=PaymentMethod.CASH, organization_id=org.id))
    db.commit()

    esperado = Decimal(str(compute_expected_cash(db, sesion).expected))
    assert esperado == Decimal("40.00"), (
        f"los 40 pesos del abono estan en el cajon; el esperado dice {esperado}"
    )


def test_completar_venta_pendiente_en_turno_posterior_reasigna_la_sesion(
    client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
):
    """El resto de una venta a credito, liquidado en un turno distinto al que
    la abrio, debe contar para el corte de HOY -- no quedar atribuido a un
    turno viejo que probablemente ya esta cerrado.
    """
    _habilitar_pos(db, org)
    _, variant = products_setup["product_a"]
    sesion_1 = _abrir_caja(db, org, branch_a, cajero_a)
    venta = _venta_pendiente(db, org, branch_a, cajero_a, sesion_1)
    assert venta.cash_session_id == sesion_1.id

    # El turno 1 cierra sin que el cliente haya liquidado nada.
    close_resp = client.post(
        "/api/cash/close", json={"closing_balance": "0.00"},
        headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
    )
    assert close_resp.status_code in (200, 201), close_resp.text

    # Turno 2 (mismo cajero, sesion distinta): el cliente liquida el total via
    # el mismo endpoint de venta (rama `existing_sale`, `sale_in.id=venta.id`).
    sesion_2 = _abrir_caja(db, org, branch_a, cajero_a)

    resp2 = client.post("/api/sales/", json={
        "id": venta.id,
        "doc_type": "ORDER",
        "items": [{"sku": variant.sku, "quantity": 1}],
        "payments": [{"method": "CASH", "amount": "100.00"}],
    }, headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp2.status_code in (200, 201), resp2.text

    db.refresh(venta)
    assert venta.status == DocumentStatus.PAID
    assert venta.cash_session_id == sesion_2.id, (
        "al liquidarse en un turno distinto al de apertura, el efectivo debe "
        "quedar acreditado al turno de HOY, no al turno (ya cerrado) de la venta original"
    )

    esperado_2 = Decimal(str(compute_expected_cash(db, sesion_2).expected))
    assert esperado_2 == Decimal("100.00"), (
        f"la venta liquidada por completo hoy debe contar entera en el corte de hoy; "
        f"el esperado dice {esperado_2}"
    )
