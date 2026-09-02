"""Un cobro en EFECTIVO siempre debe pertenecer a una caja abierta.

El guard usaba el rol como discriminador, asi que un ADMINISTRADOR con sucursal
—el dueño que atiende su propia tienda— cobraba en efectivo sin caja y esos
pesos no entraban en ningun corte. Verificado en produccion: 4 de 8 ventas de
Novedades Ginebra sin cash_session_id, una de ellas en efectivo.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashSession
from app.models.modules import Module, OrganizationModule
from app.models.sales import SalesDocument


def _habilitar_pos(db, org):
    if db.query(Module).filter(Module.key == "pos").first() is None:
        db.add(Module(key="pos", name="Punto de venta")); db.flush()
    if db.query(OrganizationModule).filter(
        OrganizationModule.organization_id == org.id,
        OrganizationModule.module_key == "pos").first() is None:
        db.add(OrganizationModule(organization_id=org.id, module_key="pos", is_enabled=True))
    db.commit()


def _abrir_caja(db, org, branch, user):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                    opening_balance=Decimal("0"), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


def _venta(sku, metodo):
    return {
        "doc_type": "ORDER",
        "items": [{"sku": sku, "quantity": 1}],
        "payments": [{"method": metodo, "amount": "100.00"}],
    }


class TestEfectivoExigeCaja:
    # Nota: usamos `branch_a` (una sucursal STORE, con stock cargado por
    # `products_setup`) para el admin en vez de `hq_branch`. `hq_branch` es
    # can_sell=False y no tiene StockOnHand para product_a, asi que vender ahi
    # truena con 400 "Stock insuficiente" antes de llegar al guard de caja —
    # ruido ajeno a lo que este test verifica. Sigue calzando con el escenario
    # del docstring del modulo: "el dueño que atiende su propia tienda".
    def test_admin_no_puede_cobrar_efectivo_sin_caja(
        self, client, db, org, branch_a, admin_user, auth_admin, products_setup
    ):
        _habilitar_pos(db, org)
        _, variant = products_setup["product_a"]
        admin_user.branch_id = branch_a.id
        db.commit()

        resp = client.post("/api/sales/", json=_venta(variant.sku, "CASH"),
                           headers={**auth_admin, "X-Organization-ID": str(org.id)})
        assert resp.status_code == 409, (
            f"un cobro en efectivo sin caja debe rechazarse, respondio {resp.status_code}: {resp.text[:300]}"
        )
        assert "efectivo" in resp.json()["detail"].lower()
        assert db.query(SalesDocument).filter(SalesDocument.organization_id == org.id).count() == 0

    def test_admin_si_puede_cobrar_con_TARJETA_sin_caja(
        self, client, db, org, branch_a, admin_user, auth_admin, products_setup
    ):
        """La tarjeta no toca el cajon: la exencion de back-office sigue viva."""
        _habilitar_pos(db, org)
        _, variant = products_setup["product_a"]
        admin_user.branch_id = branch_a.id
        db.commit()

        resp = client.post("/api/sales/", json=_venta(variant.sku, "CARD"),
                           headers={**auth_admin, "X-Organization-ID": str(org.id)})
        assert resp.status_code in (200, 201), resp.text

    def test_con_caja_abierta_el_efectivo_queda_asociado(
        self, client, db, org, branch_a, admin_user, auth_admin, products_setup
    ):
        _habilitar_pos(db, org)
        _, variant = products_setup["product_a"]
        admin_user.branch_id = branch_a.id
        db.commit()
        sesion = _abrir_caja(db, org, branch_a, admin_user)

        resp = client.post("/api/sales/", json=_venta(variant.sku, "CASH"),
                           headers={**auth_admin, "X-Organization-ID": str(org.id)})
        assert resp.status_code in (200, 201), resp.text
        venta = db.query(SalesDocument).filter(SalesDocument.organization_id == org.id).one()
        assert venta.cash_session_id == sesion.id, (
            "la venta debe quedar asociada a la caja abierta"
        )

    def test_el_cajero_sigue_bloqueado_como_antes(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        _habilitar_pos(db, org)
        _, variant = products_setup["product_a"]
        resp = client.post("/api/sales/", json=_venta(variant.sku, "CASH"),
                           headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
        assert resp.status_code == 409
