"""`CashMovementCreate.type` era un `str` libre: un "out" en minúsculas se
colaba sin pasar por `_validar_salida` (sin motivo, sin saldo, sin umbral por
rol) porque esa rama solo se activa con `payload.type == "OUT"` exacto, y
luego el cálculo del esperado tampoco lo contaba porque solo reconoce
"IN"/"OUT" exactos -- quedaba un retiro sin control y sin efecto en el corte.

Hallazgo MEDIA (revisión final): `type` ahora es `Literal["IN", "OUT"]`, así
que FastAPI rechaza cualquier otro valor con 422 antes de tocar la sesión.
"""
from decimal import Decimal

from app.models.cash import CashMovement, CashSession


def _abrir_caja(db, org, branch, user, fondo="100.00"):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                     opening_balance=Decimal(fondo), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_type_en_minusculas_recibe_422_y_no_crea_movimiento(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    sesion = _abrir_caja(db, org, branch_a, cajero_a, "100.00")

    resp = client.post(
        "/api/cash/movements",
        json={"session_id": sesion.id, "type": "out", "amount": "50.00", "concept": "retiro sin control"},
        headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
    )
    assert resp.status_code == 422, resp.text
    assert db.query(CashMovement).filter(CashMovement.session_id == sesion.id).count() == 0


def test_type_valido_sigue_funcionando(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    sesion = _abrir_caja(db, org, branch_a, cajero_a, "100.00")

    resp = client.post(
        "/api/cash/movements",
        json={"session_id": sesion.id, "type": "IN", "amount": "50.00", "concept": "entrada de cambio inicial"},
        headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
    )
    assert resp.status_code == 200, resp.text
