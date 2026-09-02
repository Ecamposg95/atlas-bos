"""Todo movimiento de caja debe saber quien lo creo.

`cash_movements` no tenia columna de autor y POST /movements no escribia
auditoria: por esa ruta, quien saco el dinero era irrecuperable.
"""
from decimal import Decimal

from app.models.cash import CashMovement, CashSession
from app.models.cash_audit import CashAuditLog


def _abrir_caja(db, org, branch, user):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                    opening_balance=Decimal("1000"), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


class TestAutoriaDeMovimientos:
    def test_la_salida_guarda_el_autor(self, client, db, org, branch_a, cajero_a, auth_cajero_a):
        _abrir_caja(db, org, branch_a, cajero_a)
        resp = client.post(
            "/api/cash/outflow?amount=100&reason=compra de material de limpieza",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 200, resp.text
        mv = db.query(CashMovement).one()
        assert mv.created_by_user_id == cajero_a.id

    def test_movements_tambien_audita(self, client, db, org, branch_a, cajero_a, auth_cajero_a):
        sesion = _abrir_caja(db, org, branch_a, cajero_a)
        resp = client.post(
            "/api/cash/movements",
            # `session_id` es obligatorio en CashMovementCreate (app/schemas/cash.py);
            # el brief lo omitia y el endpoint respondia 422 antes de llegar a
            # nuestro codigo. Se agrega aqui porque es un requisito preexistente
            # del schema, no algo que esta tarea deba tocar.
            json={
                "session_id": sesion.id,
                "type": "OUT",
                "amount": "100.00",
                "concept": "compra de material de limpieza",
            },
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code in (200, 201), resp.text
        mv = db.query(CashMovement).one()
        assert mv.created_by_user_id == cajero_a.id
        assert db.query(CashAuditLog).filter(CashAuditLog.session_id == sesion.id).count() >= 1
