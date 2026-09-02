"""`/api/reports/daily-summary` -- el resumen del dia que ve el duenio en el movil.

Dos defectos preexistentes, ambos en produccion desde el 8 de mayo de 2026:

1. La utilidad bruta filtraba por `DocumentStatus.COMPLETED`, un miembro que
   nunca existio en el enum (`DRAFT`, `PENDING`, `PAID`, `CANCELLED`,
   `REFUNDED_PARTIAL`, `REFUNDED_TOTAL`). El endpoint entero reventaba con
   `AttributeError` -> HTTP 500, de modo que `MobileDashboard.tsx` no cargaba.

2. Las otras tres consultas (total vendido, desglose de pagos y productos mas
   vendidos) no filtraban por estatus, asi que sumaban ventas canceladas y
   borradores como si fueran ingreso del dia. Ademas productos y utilidad no
   filtraban por sucursal, mezclando sucursales en una organizacion multi-sucursal.

El criterio de "esta venta ya es ingreso reconocido" tiene una sola fuente:
`SALES_REPORT_STATUSES` en `app/services/cash_reconciliation.py`.
"""
from decimal import Decimal

from app.models.sales import (
    DocumentStatus, Payment, PaymentMethod, SalesDocument, SalesLineItem,
)


def _v(products_setup):
    """Variante cualquiera: la linea exige `variant_id`, pero estas pruebas
    agrupan por `description`, que se fija por venta."""
    return products_setup["product_a"][1]


def _venta(db, org, branch, user, variant, folio, total, status, costo_unitario="40"):
    doc = SalesDocument(
        organization_id=org.id, branch_id=branch.id, seller_id=user.id,
        folio=folio, series="A", subtotal=Decimal(total), tax_amount=Decimal("0"),
        total_amount=Decimal(total), status=status, doc_type="ORDER",
    )
    db.add(doc); db.commit(); db.refresh(doc)
    db.add(SalesLineItem(
        organization_id=org.id, document_id=doc.id, variant_id=variant.id,
        description=f"Producto {folio}", quantity=1,
        unit_price=Decimal(total), total_line=Decimal(total),
        unit_cost=Decimal(costo_unitario),
    ))
    db.add(Payment(
        organization_id=org.id, sales_document_id=doc.id,
        method=PaymentMethod.CASH, amount=Decimal(total),
    ))
    db.commit()
    return doc


def test_daily_summary_responde_200(client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup):
    """Regresion del AttributeError: el endpoint debe responder, no reventar."""
    _venta(db, org, branch_a, cajero_a, _v(products_setup), "R-1", "100", DocumentStatus.PAID)

    resp = client.get("/api/reports/daily-summary", headers=auth_cajero_a)

    assert resp.status_code == 200, resp.text
    assert resp.json()["transactions_count"] == 1


def test_daily_summary_excluye_ventas_canceladas(
    client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
):
    """Una venta cancelada no es ingreso: no cuenta en total, pagos, top ni utilidad."""
    _venta(db, org, branch_a, cajero_a, _v(products_setup), "R-1", "100", DocumentStatus.PAID)
    _venta(db, org, branch_a, cajero_a, _v(products_setup), "R-2", "500", DocumentStatus.CANCELLED)

    data = client.get("/api/reports/daily-summary", headers=auth_cajero_a).json()

    assert data["transactions_count"] == 1
    assert data["total_revenue"] == 100.0
    assert data["payments"].get("CASH") == 100.0
    assert [p["name"] for p in data["top_selling_items"]] == ["Producto R-1"]
    assert data["gross_profit"] == 60.0  # 100 de venta - 40 de costo


def test_daily_summary_no_mezcla_sucursales(
    client, db, org, branch_a, branch_b, cajero_a, auth_cajero_a, products_setup
):
    """Productos y utilidad se limitan a la sucursal del usuario, como el total."""
    _venta(db, org, branch_a, cajero_a, _v(products_setup), "R-1", "100", DocumentStatus.PAID)
    _venta(db, org, branch_b, cajero_a, _v(products_setup), "R-9", "700", DocumentStatus.PAID)

    data = client.get("/api/reports/daily-summary", headers=auth_cajero_a).json()

    assert data["total_revenue"] == 100.0
    assert [p["name"] for p in data["top_selling_items"]] == ["Producto R-1"]
    assert data["gross_profit"] == 60.0
