"""Crítico: doble reembolso al aprobar dos devoluciones por el total.

`approve_return` validaba R-2 reconstruyendo el total original

    original_sale_total = sale.total_amount + prior_refunded

pero `sale.total_amount` YA viene neteado por cada aprobación previa. Al
sumarle otra vez lo devuelto se recompone el original, de modo que una
segunda devolución por el total tambien pasa la validacion y el dinero sale
dos veces.

El guard "ya existe una devolución pendiente" no protege: es check-then-insert
sin bloqueo ni restriccion unica, asi que dos peticiones concurrentes crean
dos devoluciones PENDING por el total.

Hallazgo portado de Atlas-Rmazh (critico #3 de su auditoria del 2026-08-12).
"""
from decimal import Decimal

import pytest

from app.crud import returns as crud_returns
from app.models.sales import DocumentStatus, PaymentMethod, SalesDocument, SalesLineItem
from app.models.returns import SaleReturn, SaleReturnItem
from app.schemas.returns import SaleReturnCreate


def _venta(db, org, branch, user, variant, precio=Decimal("50.00"), qty=2):
    s = SalesDocument(
        organization_id=org.id, branch_id=branch.id, seller_id=user.id,
        folio=1, series="A",
        subtotal=precio * qty, tax_amount=Decimal("0"), total_amount=precio * qty,
        status=DocumentStatus.PAID, doc_type="ORDER",
    )
    db.add(s); db.flush()
    db.add(SalesLineItem(
        document_id=s.id, variant_id=variant.id, description="Producto",
        quantity=qty, unit_price=precio, total_line=precio * qty,
        organization_id=org.id,
    ))
    db.commit(); db.refresh(s)
    return s


def _crear_devolucion(db, org, branch, user, sale, variant, monto, qty=1):
    return crud_returns.create_return(
        db=db,
        return_in=SaleReturnCreate(
            sale_id=sale.id,
            reason="prueba",
            total_refunded=monto,
            refund_method=PaymentMethod.CARD,
            items=[{"variant_id": variant.id, "quantity": qty, "refund_amount": monto}],
        ),
        user_id=user.id, branch_id=branch.id, organization_id=org.id,
    )


@pytest.fixture()
def escenario(db, org, branch_a, cajero_a, products_setup):
    _, variant = products_setup["product_a"]
    venta = _venta(db, org, branch_a, cajero_a, variant)
    return org, branch_a, cajero_a, venta, variant


class TestDobleReembolso:
    def test_no_se_puede_aprobar_una_segunda_devolucion_por_el_total(self, db, escenario):
        """Reproduce el estado que deja la carrera: dos PENDING por el total.

        `create_return` valida cantidades solo contra devoluciones APROBADAS, y
        el guard de "ya hay una PENDING" es check-then-insert sin bloqueo. Dos
        peticiones concurrentes pasan ambas y dejan dos PENDING por el total.
        Aqui se construye ese estado directamente para probar la validacion de
        `approve_return`, que es la ultima linea de defensa.
        """
        org, branch, user, venta, variant = escenario

        d1 = _crear_devolucion(db, org, branch, user, venta, variant, Decimal("100.00"), qty=2)
        d2 = SaleReturn(
            sale_id=venta.id, user_id=user.id, branch_id=branch.id,
            total_refunded=Decimal("100.00"), refund_method=PaymentMethod.CARD,
            reason="segunda de la carrera", status="PENDING", organization_id=org.id,
        )
        db.add(d2); db.flush()
        db.add(SaleReturnItem(
            return_id=d2.id, variant_id=variant.id, quantity=Decimal("2"),
            refund_amount=Decimal("100.00"), organization_id=org.id,
        ))
        db.commit()

        crud_returns.approve_return(db, d1.id, supervisor_id=user.id, organization_id=org.id)
        db.refresh(venta)
        restante = Decimal(str(venta.total_amount or 0))
        assert restante <= Decimal("0.01"), (
            f"tras devolver el total no debe quedar nada por devolver (quedan {restante})"
        )

        with pytest.raises(ValueError, match=r"excede|restante"):
            crud_returns.approve_return(db, d2.id, supervisor_id=user.id, organization_id=org.id)

        aprobadas = db.query(SaleReturn).filter(
            SaleReturn.sale_id == venta.id, SaleReturn.status == "APPROVED"
        ).count()
        assert aprobadas == 1, "solo la primera devolucion debe quedar aprobada"

    def test_devolucion_parcial_sigue_permitida(self, db, escenario):
        """El arreglo no debe romper el caso legitimo: dos parciales que suman el total."""
        org, branch, user, venta, variant = escenario

        d1 = _crear_devolucion(db, org, branch, user, venta, variant, Decimal("50.00"), qty=1)
        crud_returns.approve_return(db, d1.id, supervisor_id=user.id, organization_id=org.id)

        d2 = _crear_devolucion(db, org, branch, user, venta, variant, Decimal("50.00"), qty=1)
        crud_returns.approve_return(db, d2.id, supervisor_id=user.id, organization_id=org.id)

        aprobadas = db.query(SaleReturn).filter(
            SaleReturn.sale_id == venta.id, SaleReturn.status == "APPROVED"
        ).count()
        assert aprobadas == 2

    def test_no_se_aprueba_devolucion_de_venta_cancelada(self, db, escenario):
        """Aprobarla sobrescribiria el estado CANCELLED y sacaria dinero real."""
        org, branch, user, venta, variant = escenario
        d = _crear_devolucion(db, org, branch, user, venta, variant, Decimal("100.00"), qty=2)
        venta.status = DocumentStatus.CANCELLED
        db.commit()
        with pytest.raises(ValueError, match=r"cancelad"):
            crud_returns.approve_return(db, d.id, supervisor_id=user.id, organization_id=org.id)
