"""`opening_balance: Decimal = Field(ge=0)` vivía en `CashSessionBase`, y
`CashSessionRead` hereda de esa clase -- Pydantic aplicaba la cota también al
`response_model` de /status, /history, /open y /close. Una fila histórica con
fondo negativo (dato ya en BD, por la razón que sea) hacía que FastAPI
lanzara `ResponseValidationError` -> 500 al leerla, y en /history una sola
fila mala tumbaba la lista completa.

Hallazgo MEDIA (revisión final): la cota se movió a `CashSessionCreate`
(solo la entrada). `CashSessionRead` ya no la valida.
"""
from decimal import Decimal

from app.models.cash import CashSession


def _abrir_caja_con_fondo_negativo(db, org, branch, user, fondo="-50.00"):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                     opening_balance=Decimal(fondo), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_status_no_revienta_con_fondo_negativo_en_bd(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    _abrir_caja_con_fondo_negativo(db, org, branch_a, cajero_a)

    resp = client.get(
        "/api/cash/status",
        headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(str(resp.json()["opening_balance"])) == Decimal("-50.00")


def test_history_no_revienta_con_una_fila_de_fondo_negativo(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    sesion = _abrir_caja_con_fondo_negativo(db, org, branch_a, cajero_a)
    sesion.status = "CLOSED"
    db.commit()

    resp = client.get(
        "/api/cash/history",
        headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
    )
    assert resp.status_code == 200, resp.text
    assert any(row["id"] == sesion.id for row in resp.json())


def test_crear_sesion_con_fondo_negativo_sigue_dando_422(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    resp = client.post(
        "/api/cash/open",
        json={"opening_balance": "-10.00"},
        headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
    )
    assert resp.status_code == 422, resp.text
