"""Sacar efectivo del cajon debe estar tan protegido como devolverlo al cliente.

Hoy /outflow solo comprueba que el monto sea > 0. En produccion un CAJERO saco
$9,000 de un fondo de $10,000 escribiendo "error" como motivo, sin que nadie lo
autorizara. En el mismo repositorio, devolver mas de $10,000 exige rol GERENTE+,
umbral explicito y confirmacion forzada.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashMovement, CashSession
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
