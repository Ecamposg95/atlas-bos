"""El saldo inicial es una declaracion de estado, no una transaccion.

No existia forma de corregirlo y POST /open con caja abierta devolvia 200
descartando el valor recibido en silencio. El unico camino que le quedaba al
cajero era registrar una "entrada de efectivo" falsa — que es exactamente lo
que ocurrio en produccion: fondo 1.00 seguido de una entrada de 1,376.00.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashMovement, CashSession
from app.models.cash_audit import CashAuditLog


class TestSaldoInicial:
    def test_abrir_con_caja_abierta_avisa_en_vez_de_ignorar(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        r1 = client.post("/api/cash/open", json={"opening_balance": "1.00"}, headers=h)
        assert r1.status_code in (200, 201), r1.text

        r2 = client.post("/api/cash/open", json={"opening_balance": "1377.00"}, headers=h)
        assert r2.status_code == 409, (
            "reabrir con otro saldo no puede responder exito y descartar el valor"
        )
        assert "1.00" in r2.json()["detail"]

    def test_se_puede_corregir_antes_de_la_primera_venta(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        sesion_id = client.post("/api/cash/open", json={"opening_balance": "1.00"},
                                headers=h).json()["id"]

        resp = client.patch(
            f"/api/cash/sessions/{sesion_id}/opening-balance",
            json={"opening_balance": "1377.00", "reason": "fondo capturado mal al abrir"},
            headers=h,
        )
        assert resp.status_code == 200, resp.text
        sesion = db.query(CashSession).filter(CashSession.id == sesion_id).one()
        assert Decimal(str(sesion.opening_balance)) == Decimal("1377.00")
        assert db.query(CashMovement).count() == 0, (
            "corregir el fondo no debe inventar un movimiento de efectivo"
        )

    def test_la_correccion_queda_auditada_con_reason_legible(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        """Ronda de correcciones 1 (hallazgo Importante): la pantalla de

        auditoria (PlatformCashAudit.tsx -> TimelineRow) solo renderiza
        `ev.payload.reason`, nunca `motivo`. Si el evento no trae esa clave
        con un texto legible, la correccion aparece en la pantalla como una
        segunda "Caja abierta" indistinguible de la apertura real.
        """
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        sesion_id = client.post("/api/cash/open", json={"opening_balance": "1.00"},
                                headers=h).json()["id"]

        resp = client.patch(
            f"/api/cash/sessions/{sesion_id}/opening-balance",
            json={"opening_balance": "1377.00", "reason": "fondo capturado mal al abrir"},
            headers=h,
        )
        assert resp.status_code == 200, resp.text

        eventos = db.query(CashAuditLog).filter(
            CashAuditLog.session_id == sesion_id,
            CashAuditLog.event_type == "SESSION_OPENED",
        ).order_by(CashAuditLog.id).all()
        # `open_session` (POST /open) no escribe audit log — solo el cierre
        # y esta correccion lo hacen hoy. El unico SESSION_OPENED de esta
        # sesion es, entonces, la correccion misma.
        assert len(eventos) == 1
        correccion = eventos[-1]
        assert correccion.payload_json.get("correccion") is True
        reason = correccion.payload_json.get("reason")
        assert reason, "el evento de correccion debe traer la clave 'reason' (la unica que lee la UI)"
        assert "1.00" in reason
        assert "1377.00" in reason
        # Los campos estructurados siguen disponibles para consultas programaticas.
        assert correccion.payload_json.get("antes") == "1.00"
        assert correccion.payload_json.get("despues") == "1377.00"

    def test_no_se_puede_corregir_con_movimientos_ya_registrados(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        sesion_id = client.post("/api/cash/open", json={"opening_balance": "1000.00"},
                                headers=h).json()["id"]
        client.post("/api/cash/outflow?amount=50&reason=compra de bolsas para la tienda",
                    headers=h)

        resp = client.patch(
            f"/api/cash/sessions/{sesion_id}/opening-balance",
            json={"opening_balance": "2000.00", "reason": "quiero cambiarlo"},
            headers=h,
        )
        assert resp.status_code == 409, (
            "con movimientos ya registrados, cambiar el fondo reescribe la historia"
        )

    def test_el_saldo_inicial_no_puede_ser_negativo(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        resp = client.post("/api/cash/open", json={"opening_balance": "-5.00"},
                           headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
        assert resp.status_code == 422
