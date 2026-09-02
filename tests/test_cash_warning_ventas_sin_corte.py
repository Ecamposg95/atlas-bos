"""El cierre debe avisar si hay ventas en efectivo fuera de todo corte.

Ninguna pantalla exponia `cash_session_id`, asi que el dueño no tenia forma de
detectar el efectivo huerfano. La deteccion vivia solo en SQL manual de los
runbooks.

Ronda de correcciones 1: la primera version de la consulta (a) no filtraba por
status (una venta CANCELLED con Payment sin borrar disparaba falso positivo),
y (b) usaba `session.opened_at` como ventana en vez del inicio del dia
calendario MX (una huerfana ANTES de abrir turno, el caso motivador, no se
reportaba nunca). Los dos casos de abajo cubren exactamente esos defectos.
"""
from datetime import datetime, timezone
from decimal import Decimal

from app.models.cash import CashSession
from app.models.sales import DocumentStatus, PaymentMethod, Payment, SalesDocument


def _venta_en_efectivo(db, org, branch, user, monto="15.00", status=DocumentStatus.PAID,
                        created_at=None, folio=999):
    s = SalesDocument(
        organization_id=org.id, branch_id=branch.id, seller_id=user.id,
        folio=folio, series="A", subtotal=Decimal(monto), tax_amount=Decimal("0"),
        total_amount=Decimal(monto), status=status, doc_type="ORDER",
        cash_session_id=None,
    )
    if created_at is not None:
        s.created_at = created_at
    db.add(s); db.flush()
    db.add(Payment(sales_document_id=s.id, amount=Decimal(monto),
                   method=PaymentMethod.CASH, organization_id=org.id))
    db.commit()
    return s


def test_el_cierre_avisa_de_ventas_sin_corte(client, db, org, branch_a, cajero_a, auth_cajero_a):
    sesion = CashSession(user_id=cajero_a.id, branch_id=branch_a.id,
                         organization_id=org.id, opening_balance=Decimal("0"), status="OPEN")
    db.add(sesion); db.commit(); db.refresh(sesion)
    _venta_en_efectivo(db, org, branch_a, cajero_a)

    resp = client.post("/api/cash/close", json={"closing_balance": "0.00"},
                       headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp.status_code in (200, 201), resp.text
    codigos = [w.get("code") for w in resp.json().get("warnings", [])]
    assert "SALES_WITHOUT_SESSION" in codigos, (
        f"el cierre debe avisar del efectivo fuera de corte; alertas: {codigos}"
    )


def test_venta_cancelada_no_dispara_falso_positivo(client, db, org, branch_a, cajero_a, auth_cajero_a):
    """cancel_sale marca CANCELLED pero no borra el Payment (no es una venta
    consumada); esa venta NO es efectivo huerfano y no debe disparar la alerta.
    """
    sesion = CashSession(user_id=cajero_a.id, branch_id=branch_a.id,
                         organization_id=org.id, opening_balance=Decimal("0"), status="OPEN")
    db.add(sesion); db.commit(); db.refresh(sesion)
    _venta_en_efectivo(db, org, branch_a, cajero_a, status=DocumentStatus.CANCELLED)

    resp = client.post("/api/cash/close", json={"closing_balance": "0.00"},
                       headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp.status_code in (200, 201), resp.text
    codigos = [w.get("code") for w in resp.json().get("warnings", [])]
    assert "SALES_WITHOUT_SESSION" not in codigos, (
        f"una venta CANCELLED no debe contar como efectivo huerfano; alertas: {codigos}"
    )


def test_huerfana_anterior_a_la_apertura_del_turno_si_dispara(client, db, org, branch_a, cajero_a, auth_cajero_a):
    """Caso motivador de la tarea: el dueño vende a las 9am, el cajero abre
    caja a las 10am. Esa venta debe seguir siendo visible al cerrar — la
    ventana es el dia calendario MX, no el instante de apertura del turno.

    Fechas fijas (lejos de cualquier frontera de dia MX) para que la prueba
    no dependa de la hora real en que corre: 2026-06-15, apertura 10am MX
    (16:00 UTC), venta huerfana a la 1am MX del mismo dia (07:00 UTC).
    """
    abierto_utc = datetime(2026, 6, 15, 16, 0, 0, tzinfo=timezone.utc)   # 10:00 MX
    huerfana_utc = datetime(2026, 6, 15, 7, 0, 0, tzinfo=timezone.utc)  # 01:00 MX, mismo dia

    sesion = CashSession(user_id=cajero_a.id, branch_id=branch_a.id,
                         organization_id=org.id, opening_balance=Decimal("0"),
                         status="OPEN", opened_at=abierto_utc)
    db.add(sesion); db.commit(); db.refresh(sesion)
    _venta_en_efectivo(db, org, branch_a, cajero_a, created_at=huerfana_utc)

    resp = client.post("/api/cash/close", json={"closing_balance": "0.00"},
                       headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp.status_code in (200, 201), resp.text
    codigos = [w.get("code") for w in resp.json().get("warnings", [])]
    assert "SALES_WITHOUT_SESSION" in codigos, (
        f"una huerfana del mismo dia MX, antes de abrir turno, debe avisar; alertas: {codigos}"
    )
