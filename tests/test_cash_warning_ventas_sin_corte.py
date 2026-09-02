"""El cierre debe avisar si hay ventas en efectivo fuera de todo corte.

Ninguna pantalla exponia `cash_session_id`, asi que el dueño no tenia forma de
detectar el efectivo huerfano. La deteccion vivia solo en SQL manual de los
runbooks.
"""
from decimal import Decimal

from app.models.cash import CashSession
from app.models.sales import DocumentStatus, PaymentMethod, Payment, SalesDocument


def _venta_huerfana_en_efectivo(db, org, branch, user, monto="15.00"):
    s = SalesDocument(
        organization_id=org.id, branch_id=branch.id, seller_id=user.id,
        folio=999, series="A", subtotal=Decimal(monto), tax_amount=Decimal("0"),
        total_amount=Decimal(monto), status=DocumentStatus.PAID, doc_type="ORDER",
        cash_session_id=None,
    )
    db.add(s); db.flush()
    db.add(Payment(sales_document_id=s.id, amount=Decimal(monto),
                   method=PaymentMethod.CASH, organization_id=org.id))
    db.commit()
    return s


def test_el_cierre_avisa_de_ventas_sin_corte(client, db, org, branch_a, cajero_a, auth_cajero_a):
    sesion = CashSession(user_id=cajero_a.id, branch_id=branch_a.id,
                         organization_id=org.id, opening_balance=Decimal("0"), status="OPEN")
    db.add(sesion); db.commit(); db.refresh(sesion)
    _venta_huerfana_en_efectivo(db, org, branch_a, cajero_a)

    resp = client.post("/api/cash/close", json={"closing_balance": "0.00"},
                       headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp.status_code in (200, 201), resp.text
    codigos = [w.get("code") for w in resp.json().get("warnings", [])]
    assert "SALES_WITHOUT_SESSION" in codigos, (
        f"el cierre debe avisar del efectivo fuera de corte; alertas: {codigos}"
    )
