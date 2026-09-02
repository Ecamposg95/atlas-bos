"""El saldo inicial es una declaracion de estado, no una transaccion.

No existia forma de corregirlo y POST /open con caja abierta devolvia 200
descartando el valor recibido en silencio. El unico camino que le quedaba al
cajero era registrar una "entrada de efectivo" falsa — que es exactamente lo
que ocurrio en produccion: fondo 1.00 seguido de una entrada de 1,376.00.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashMovement, CashSession


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
