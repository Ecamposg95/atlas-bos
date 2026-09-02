"""Sacar efectivo del cajon debe estar tan protegido como devolverlo al cliente.

Hoy /outflow solo comprueba que el monto sea > 0. En produccion un CAJERO saco
$9,000 de un fondo de $10,000 escribiendo "error" como motivo, sin que nadie lo
autorizara. En el mismo repositorio, devolver mas de $10,000 exige rol GERENTE+,
umbral explicito y confirmacion forzada.
"""
from decimal import Decimal

import pytest
from sqlalchemy.dialects import postgresql

from app.models.cash import CashMovement, CashSession
from app.routers import cash as cash_router
from app.services.cash_reconciliation import compute_expected_cash


def _abrir_caja(db, org, branch, user, fondo="100.00"):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                    opening_balance=Decimal(fondo), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


class TestGuardasDeSalida:
    def test_no_puede_dejar_la_caja_en_negativo(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        _abrir_caja(db, org, branch_a, cajero_a, "100.00")
        resp = client.post(
            "/api/cash/outflow?amount=5000&reason=pago a proveedor de papeleria",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 409, (
            f"una salida mayor al efectivo disponible debe rechazarse: {resp.status_code}"
        )
        assert db.query(CashMovement).count() == 0

    def test_monto_alto_exige_rol_superior(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        _abrir_caja(db, org, branch_a, cajero_a, "10000.00")
        resp = client.post(
            "/api/cash/outflow?amount=9000&reason=deposito bancario del corte",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 403, (
            f"un cajero no debe sacar montos altos sin autorizacion: {resp.status_code}"
        )

    def test_gerente_si_puede_el_monto_alto(
        self, client, db, org, branch_a, gerente_a, auth_gerente_a
    ):
        _abrir_caja(db, org, branch_a, gerente_a, "10000.00")
        resp = client.post(
            "/api/cash/outflow?amount=9000&reason=deposito bancario del corte",
            headers={**auth_gerente_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 200, resp.text

    def test_motivo_vacio_o_trivial_se_rechaza(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        _abrir_caja(db, org, branch_a, cajero_a, "1000.00")
        for motivo in ["", "error", "x"]:
            resp = client.post(
                f"/api/cash/outflow?amount=50&reason={motivo}",
                headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
            )
            assert resp.status_code == 422, (
                f"el motivo {motivo!r} no deberia aceptarse: {resp.status_code}"
            )

    def test_salida_valida_pasa_y_baja_el_esperado(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        sesion = _abrir_caja(db, org, branch_a, cajero_a, "1000.00")
        resp = client.post(
            "/api/cash/outflow?amount=200&reason=compra de bolsas para la tienda",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 200, resp.text
        db.refresh(sesion)
        assert Decimal(str(compute_expected_cash(db, sesion).expected)) == Decimal("800.00")


class TestBloqueoDeFilaEnSalidas:
    """Ronda de correcciones 1 (hallazgo Importante): dos salidas
    concurrentes contra la misma sesion pueden leer el mismo `disponible`
    antes de que ninguna haga commit y las dos pasar el 409 — la caja
    termina en negativo. `_lock_cash_session_query` aplica FOR UPDATE
    sobre la fila de CashSession antes de decidir (mismo patron que
    `app/crud/returns.py:144`).

    SQLite (el motor de estos tests) hace de `with_for_update()` un
    no-op silencioso — no hay error, pero tampoco serializa nada — asi
    que reproducir la carrera con hilos reales sobre SQLite no probaria
    nada. En su lugar: (1) se compila la consulta contra el dialecto de
    Postgres para verificar que el SQL resultante lleva FOR UPDATE, y
    (2) se espia el helper para confirmar que las rutas de escritura
    realmente lo invocan antes de leer el saldo.
    """

    def test_helper_agrega_for_update_a_la_consulta(self, db):
        base = db.query(CashSession).filter(CashSession.id == 1)
        bloqueada = cash_router._lock_cash_session_query(
            db.query(CashSession).filter(CashSession.id == 1)
        )
        sql_normal = str(base.statement.compile(dialect=postgresql.dialect()))
        sql_bloqueada = str(bloqueada.statement.compile(dialect=postgresql.dialect()))
        assert "FOR UPDATE" not in sql_normal
        assert "FOR UPDATE" in sql_bloqueada

    def test_outflow_bloquea_la_fila_antes_de_leer_el_saldo(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, monkeypatch
    ):
        _abrir_caja(db, org, branch_a, cajero_a, "1000.00")
        llamadas = []
        original = cash_router._lock_cash_session_query

        def _espia(query):
            llamadas.append(query)
            return original(query)

        monkeypatch.setattr(cash_router, "_lock_cash_session_query", _espia)

        resp = client.post(
            "/api/cash/outflow?amount=50&reason=compra de insumos varios",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 200, resp.text
        assert len(llamadas) == 1, (
            "/outflow debe bloquear la fila de la sesion antes de leer el disponible"
        )

    def test_movements_bloquea_solo_en_la_rama_out(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, monkeypatch
    ):
        sesion = _abrir_caja(db, org, branch_a, cajero_a, "1000.00")
        llamadas = []
        original = cash_router._lock_cash_session_query

        def _espia(query):
            llamadas.append(query)
            return original(query)

        monkeypatch.setattr(cash_router, "_lock_cash_session_query", _espia)

        resp_in = client.post(
            "/api/cash/movements",
            json={
                "session_id": sesion.id, "type": "IN", "amount": 50,
                "concept": "reposicion de fondo de caja",
            },
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp_in.status_code == 200, resp_in.text
        assert len(llamadas) == 0, "una entrada (IN) no necesita bloquear la fila"

        resp_out = client.post(
            "/api/cash/movements",
            json={
                "session_id": sesion.id, "type": "OUT", "amount": 50,
                "concept": "compra de insumos varios",
            },
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp_out.status_code == 200, resp_out.text
        assert len(llamadas) == 1, (
            "una salida (OUT) por /movements debe bloquear la fila antes de leer el disponible"
        )
