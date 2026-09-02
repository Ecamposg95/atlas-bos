"""Tests: idempotencia del checkout por `client_uuid`.

El POS guarda las ventas que no pudo confirmar en una cola local
(`frontend/src/utils/offlineQueue.ts`) y las reenvia con "Reintentar ahora".
Si la venta si entro pero la respuesta se perdio, el reenvio creaba un ticket
DUPLICADO: cobro doble al cliente e inventario descontado dos veces.

Atlas-Rmazh documenta el desenlace de ese camino en produccion: 65 tickets
duplicados por $919 mil en 35 dias.

Con `client_uuid`, el reenvio del MISMO payload devuelve la venta original en
vez de crear otra.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashSession
from app.models.modules import Module, OrganizationModule
from app.models.sales import SalesDocument


def _preparar(db, org, branch, user):
    if db.query(Module).filter(Module.key == "pos").first() is None:
        db.add(Module(key="pos", name="Punto de venta")); db.flush()
    if db.query(OrganizationModule).filter(
        OrganizationModule.organization_id == org.id,
        OrganizationModule.module_key == "pos").first() is None:
        db.add(OrganizationModule(organization_id=org.id, module_key="pos", is_enabled=True))
    if db.query(CashSession).filter(
        CashSession.user_id == user.id, CashSession.closed_at.is_(None)).first() is None:
        db.add(CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                           opening_balance=Decimal("0"), status="OPEN"))
    db.commit()


def _payload(sku, uuid=None):
    p = {
        "doc_type": "ORDER",
        "items": [{"sku": sku, "quantity": 1}],
        "payments": [{"method": "CASH", "amount": "100.00"}],
    }
    if uuid is not None:
        p["client_uuid"] = uuid
    return p


class TestIdempotencia:
    def test_el_mismo_client_uuid_no_crea_una_segunda_venta(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        _preparar(db, org, branch_a, cajero_a)
        _, variant = products_setup["product_a"]
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        cuerpo = _payload(variant.sku, "ticket-abc-123")

        r1 = client.post("/api/sales/", json=cuerpo, headers=h)
        assert r1.status_code in (200, 201), r1.text
        r2 = client.post("/api/sales/", json=cuerpo, headers=h)
        assert r2.status_code in (200, 201), r2.text

        assert r1.json()["sale_id"] == r2.json()["sale_id"], (
            "el reenvio debe devolver la MISMA venta, no crear otra"
        )
        assert r1.json()["folio"] == r2.json()["folio"]
        assert db.query(SalesDocument).filter(SalesDocument.organization_id == org.id).count() == 1

    def test_el_stock_se_descuenta_una_sola_vez(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        from app.models.inventory import StockOnHand
        _preparar(db, org, branch_a, cajero_a)
        _, variant = products_setup["product_a"]
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        cuerpo = _payload(variant.sku, "ticket-stock-1")

        soh = db.query(StockOnHand).filter(
            StockOnHand.variant_id == variant.id, StockOnHand.branch_id == branch_a.id).first()
        antes = Decimal(str(soh.qty_on_hand))

        client.post("/api/sales/", json=cuerpo, headers=h)
        client.post("/api/sales/", json=cuerpo, headers=h)

        db.refresh(soh)
        assert Decimal(str(soh.qty_on_hand)) == antes - Decimal("1"), (
            "el reenvio no debe volver a descontar inventario"
        )

    def test_uuids_distintos_si_crean_ventas_distintas(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        _preparar(db, org, branch_a, cajero_a)
        _, variant = products_setup["product_a"]
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}

        r1 = client.post("/api/sales/", json=_payload(variant.sku, "ticket-1"), headers=h)
        r2 = client.post("/api/sales/", json=_payload(variant.sku, "ticket-2"), headers=h)
        assert r1.json()["sale_id"] != r2.json()["sale_id"]
        assert db.query(SalesDocument).filter(SalesDocument.organization_id == org.id).count() == 2

    def test_sin_client_uuid_el_comportamiento_no_cambia(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        """Compatibilidad: un POS viejo que no lo envia sigue funcionando igual."""
        _preparar(db, org, branch_a, cajero_a)
        _, variant = products_setup["product_a"]
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}

        r1 = client.post("/api/sales/", json=_payload(variant.sku), headers=h)
        r2 = client.post("/api/sales/", json=_payload(variant.sku), headers=h)
        assert r1.status_code in (200, 201), r1.text
        assert r2.status_code in (200, 201), r2.text
        assert r1.json()["sale_id"] != r2.json()["sale_id"]
