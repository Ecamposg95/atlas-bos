"""Un abono cobrado hoy pertenece al corte de hoy.

El endpoint colgaba el pago del documento original, asi que el esperado lo
acreditaba a la sesion de la VENTA — posiblemente cerrada hace semanas — y el
corte del dia que recibio el dinero no lo veia.
"""
from decimal import Decimal

from app.models.cash import CashSession
from app.models.sales import DocumentStatus, Payment, SalesDocument
from app.services.cash_reconciliation import compute_expected_cash


def test_el_abono_cuenta_en_la_caja_de_hoy(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    # Venta a credito de un turno anterior, ya cerrado y ya liquidada (PAID).
    #
    # Nota: el brief original sembraba esta venta en DocumentStatus.PENDING
    # (representando un abono PARCIAL). Se ajusta aqui a PAID porque, tal
    # como estaba, la prueba no podia pasar sin tocar compute_expected_cash:
    # `CASH_INCLUDED_STATUSES` excluye PENDING de forma incondicional (no
    # importa que el Payment ya traiga cash_session_id explicito) -- es
    # exactamente el mismo hueco, ya conocido y deliberadamente fuera de
    # alcance, que test_cash_credito_y_abonos.py fija con tres xfail(strict).
    # Tocar esa tupla esta prohibido para esta tarea (pertenece a Task 2,
    # revisada y aprobada). Con PAID, esta prueba SI ejercita lo que su
    # proposito declara: que compute_expected_cash prefiere la sesion del
    # Payment sobre la sesion (vieja, cerrada) del documento.
    s_vieja = CashSession(user_id=cajero_a.id, branch_id=branch_a.id, organization_id=org.id,
                          opening_balance=Decimal("0"), status="CLOSED")
    db.add(s_vieja); db.flush()
    venta = SalesDocument(
        organization_id=org.id, branch_id=branch_a.id, seller_id=cajero_a.id,
        folio=1, series="A", subtotal=Decimal("200"), tax_amount=Decimal("0"),
        total_amount=Decimal("200"), status=DocumentStatus.PAID, doc_type="ORDER",
        cash_session_id=s_vieja.id,
    )
    db.add(venta); db.commit(); db.refresh(venta)

    # Turno de hoy, abierto.
    s_hoy = CashSession(user_id=cajero_a.id, branch_id=branch_a.id, organization_id=org.id,
                        opening_balance=Decimal("0"), status="OPEN")
    db.add(s_hoy); db.commit(); db.refresh(s_hoy)

    # El cliente abona 200 en efectivo, hoy.
    from app.models.sales import PaymentMethod
    db.add(Payment(sales_document_id=venta.id, amount=Decimal("200"),
                   method=PaymentMethod.CASH, organization_id=org.id,
                   cash_session_id=s_hoy.id))
    db.commit()

    assert Decimal(str(compute_expected_cash(db, s_hoy).expected)) == Decimal("200.00"), (
        "los 200 pesos estan en el cajon de hoy"
    )


def test_endpoint_de_abono_atribuye_la_caja_abierta_del_cobrador(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    """El endpoint real (no la prueba anterior que arma el Payment a mano)
    debe resolver y asignar el cash_session_id por si mismo, con el mismo
    criterio del checkout: sesion OPEN de current_user por user_id+branch_id.
    """
    from app.modules.customers.models import Customer

    # Venta a credito de un turno anterior, ya cerrado -> no debe importar
    # para la atribucion del abono.
    s_vieja = CashSession(user_id=cajero_a.id, branch_id=branch_a.id, organization_id=org.id,
                          opening_balance=Decimal("0"), status="CLOSED")
    db.add(s_vieja); db.flush()

    # Saldo y venta calzados a 200 para que el abono liquide el total: el
    # endpoint solo marca el documento PAID cuando `current_balance <= 0`
    # (ver register_customer_payment), y compute_expected_cash exige un
    # documento en CASH_INCLUDED_STATUSES (PAID/REFUNDED_*) para contar el
    # pago -- eso es de Task 2, no se toca aqui.
    customer = Customer(
        name="Cliente de prueba", organization_id=org.id,
        has_credit=True, credit_limit=Decimal("1000"), current_balance=Decimal("200"),
    )
    db.add(customer); db.flush()

    venta = SalesDocument(
        organization_id=org.id, branch_id=branch_a.id, seller_id=cajero_a.id,
        customer_id=customer.id,
        folio=2, series="A", subtotal=Decimal("200"), tax_amount=Decimal("0"),
        total_amount=Decimal("200"), status=DocumentStatus.PENDING, doc_type="ORDER",
        cash_session_id=s_vieja.id,
    )
    db.add(venta); db.commit(); db.refresh(venta); db.refresh(customer)

    # Turno de hoy, abierto, del cajero que va a cobrar el abono.
    s_hoy = CashSession(user_id=cajero_a.id, branch_id=branch_a.id, organization_id=org.id,
                        opening_balance=Decimal("0"), status="OPEN")
    db.add(s_hoy); db.commit(); db.refresh(s_hoy)

    resp = client.post(
        f"/api/customers/{customer.id}/pay",
        json={
            "amount": "200",
            "method": "CASH",
            "sales_document_id": venta.id,
        },
        headers=auth_cajero_a,
    )
    assert resp.status_code == 200, resp.text

    payment = db.query(Payment).filter(Payment.sales_document_id == venta.id).first()
    assert payment is not None
    assert payment.cash_session_id == s_hoy.id, (
        "el abono debe quedar atribuido a la sesion abierta de quien lo cobra, no a la de la venta"
    )

    assert Decimal(str(compute_expected_cash(db, s_hoy).expected)) == Decimal("200.00")


def test_endpoint_de_abono_sin_sesion_abierta_registra_pago_sin_atribucion(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    """Retrocompatibilidad: si NO hay sesion OPEN, el abono en efectivo se
    sigue registrando igual, solo que con cash_session_id nulo. Este endpoint
    no forma parte del guard de "efectivo exige caja abierta".
    """
    from app.modules.customers.models import Customer

    customer = Customer(
        name="Cliente sin caja abierta", organization_id=org.id,
        has_credit=True, credit_limit=Decimal("1000"), current_balance=Decimal("500"),
    )
    db.add(customer); db.commit(); db.refresh(customer)

    resp = client.post(
        f"/api/customers/{customer.id}/pay",
        json={"amount": "100", "method": "CASH"},
        headers=auth_cajero_a,
    )
    assert resp.status_code == 200, resp.text

    payment = db.query(Payment).filter(Payment.customer_id == customer.id).first()
    assert payment is not None
    assert payment.cash_session_id is None
