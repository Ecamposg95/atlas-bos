"""Regresion: una venta no debe reventar si la variante no tiene variant_name.

`app/routers/sales.py` armaba la descripcion del renglon con

    f"...{' ('+variant.variant_name+')' if variant.variant_name != 'Estándar' else ''}"

y con `variant_name` en NULL la condicion es verdadera, asi que intentaba
concatenar None y devolvia 500. Le paso a Novedades Ginebra el 2026-09-01: su
catalogo se cargo sin `variant_name` y ninguna venta podia cobrarse.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashSession
from app.models.inventory import StockOnHand
from app.models.modules import Module, OrganizationModule
from app.models.products import Product, ProductBranchStatus, ProductVariant


def _habilitar_pos(db, org):
    """El endpoint de ventas exige el modulo 'pos' habilitado en la org."""
    if db.query(Module).filter(Module.key == "pos").first() is None:
        db.add(Module(key="pos", name="Punto de venta"))
        db.flush()
    ya = (
        db.query(OrganizationModule)
        .filter(
            OrganizationModule.organization_id == org.id,
            OrganizationModule.module_key == "pos",
        )
        .first()
    )
    if ya is None:
        db.add(OrganizationModule(organization_id=org.id, module_key="pos", is_enabled=True))
    else:
        ya.is_enabled = True
    db.commit()


def _abrir_caja(db, org, branch, user):
    """El checkout exige una sesion de caja abierta para el usuario."""
    abierta = (
        db.query(CashSession)
        .filter(CashSession.user_id == user.id, CashSession.closed_at.is_(None))
        .first()
    )
    if abierta is None:
        db.add(CashSession(
            user_id=user.id, branch_id=branch.id, organization_id=org.id,
            opening_balance=Decimal("0"), status="OPEN",
        ))
        db.commit()


def _producto_sin_variant_name(db, org, branch, sku="SIN-VN-01", nombre="Producto sin variante"):
    _habilitar_pos(db, org)
    p = Product(name=nombre, organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    v = ProductVariant(
        product_id=p.id, sku=sku, price=Decimal("15.00"), cost=Decimal("7.00"),
        organization_id=org.id, variant_name=None,
    )
    db.add(v); db.flush()
    db.add(ProductBranchStatus(
        variant_id=v.id, branch_id=branch.id, organization_id=org.id,
        is_active_pos=True, is_visible=True,
    ))
    db.add(StockOnHand(
        variant_id=v.id, branch_id=branch.id, organization_id=org.id,
        qty_on_hand=Decimal("100"), is_active=True,
    ))
    db.commit(); db.refresh(v)
    return p, v


class TestVentaConVariantNameNulo:
    def test_venta_con_tarjeta_no_revienta(self, client, db, org, branch_a, cajero_a, auth_cajero_a):
        _producto_sin_variant_name(db, org, branch_a)
        _abrir_caja(db, org, branch_a, cajero_a)
        resp = client.post(
            "/api/sales/",
            json={
                "doc_type": "ORDER",
                "items": [{"sku": "SIN-VN-01", "quantity": 1}],
                "payments": [{"method": "CARD", "amount": "15.00"}],
            },
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code != 500, (
            f"la venta no debe reventar con variant_name nulo: {resp.text[:400]}"
        )
        assert resp.status_code in (200, 201), resp.text

    def test_la_descripcion_es_solo_el_nombre_del_producto(self, client, db, org, branch_a, cajero_a, auth_cajero_a):
        """Sin nombre de variante, la descripcion no debe traer parentesis vacios."""
        _producto_sin_variant_name(db, org, branch_a, sku="SIN-VN-02", nombre="Vela de 6cm")
        _abrir_caja(db, org, branch_a, cajero_a)
        resp = client.post(
            "/api/sales/",
            json={
                "doc_type": "ORDER",
                "items": [{"sku": "SIN-VN-02", "quantity": 1}],
                "payments": [{"method": "CASH", "amount": "15.00"}],
            },
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code in (200, 201), resp.text

        from app.models.sales import SalesLineItem
        renglon = (
            db.query(SalesLineItem)
            .filter(SalesLineItem.organization_id == org.id)
            .order_by(SalesLineItem.id.desc())
            .first()
        )
        assert renglon.description == "Vela de 6cm"
        assert "None" not in renglon.description
        assert "()" not in renglon.description
