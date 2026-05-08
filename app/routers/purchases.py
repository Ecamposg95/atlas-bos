from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from decimal import Decimal
from datetime import date, datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.core.tenant_context import get_current_active_organization
from app.core.security import get_current_user
from app.models import (
    User, Branch,
    Product, ProductVariant, StockOnHand, InventoryMovement,
    PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus,
)
from app.crud.products import get_variant_if_visible

router = APIRouter()


# ── Pydantic schemas ────────────────────────────────────────────────────────

class POLineIn(BaseModel):
    variant_id: Optional[str] = None
    product_name: str
    sku: Optional[str] = None
    qty_ordered: Decimal
    unit_cost: Decimal


class POCreateIn(BaseModel):
    supplier_name: str
    supplier_contact: Optional[str] = None
    branch_id: Optional[int] = None
    notes: Optional[str] = None
    lines: List[POLineIn]


class POLineReceiveIn(BaseModel):
    line_id: int
    qty_received: Decimal


class POReceiveIn(BaseModel):
    lines: List[POLineReceiveIn]


# ── Helpers ─────────────────────────────────────────────────────────────────

def _next_folio(db: Session, org_id: int) -> str:
    count = db.query(func.count(PurchaseOrder.id)).filter(
        PurchaseOrder.organization_id == org_id
    ).scalar() or 0
    return f"OC-{str(count + 1).zfill(5)}"


def _po_to_dict(po: PurchaseOrder) -> dict:
    total = sum(
        float(ln.qty_ordered) * float(ln.unit_cost) for ln in po.lines
    )
    received_total = sum(
        float(ln.qty_received) * float(ln.unit_cost) for ln in po.lines
    )
    return {
        "id": po.id,
        "folio": po.folio,
        "supplier_name": po.supplier_name,
        "supplier_contact": po.supplier_contact,
        "branch_id": po.branch_id,
        "branch_name": po.branch.name if po.branch else None,
        "status": po.status.value,
        "notes": po.notes,
        "total": total,
        "received_total": received_total,
        "created_by": po.created_by.full_name or po.created_by.username if po.created_by else None,
        "created_at": po.created_at.isoformat() if po.created_at else None,
        "received_at": po.received_at.isoformat() if po.received_at else None,
        "lines": [
            {
                "id": ln.id,
                "variant_id": ln.variant_id,
                "product_name": ln.product_name,
                "sku": ln.sku,
                "qty_ordered": float(ln.qty_ordered),
                "qty_received": float(ln.qty_received),
                "unit_cost": float(ln.unit_cost),
                "line_total": float(ln.qty_ordered) * float(ln.unit_cost),
            }
            for ln in po.lines
        ],
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_purchase_stats(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
):
    """KPIs del módulo de compras."""
    today = date.today()
    month_start = today.replace(day=1)

    base = db.query(PurchaseOrder).filter(PurchaseOrder.organization_id == org_id)

    # Total comprado este mes (órdenes RECEIVED)
    received_this_month = base.filter(
        PurchaseOrder.status == PurchaseOrderStatus.RECEIVED,
        cast(PurchaseOrder.created_at, Date) >= month_start,
    ).all()
    total_month = sum(
        sum(float(ln.qty_ordered) * float(ln.unit_cost) for ln in po.lines)
        for po in received_this_month
    )

    # Órdenes activas (DRAFT + ORDERED + PARTIAL)
    active_count = base.filter(
        PurchaseOrder.status.in_([
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.ORDERED,
            PurchaseOrderStatus.PARTIAL,
        ])
    ).count()

    # Total histórico
    all_received = base.filter(PurchaseOrder.status == PurchaseOrderStatus.RECEIVED).all()
    total_historic = sum(
        sum(float(ln.qty_ordered) * float(ln.unit_cost) for ln in po.lines)
        for po in all_received
    )

    # Proveedor más frecuente
    from sqlalchemy import text
    top_supplier_row = db.execute(
        text("""
            SELECT supplier_name, COUNT(*) AS cnt
            FROM purchase_orders
            WHERE organization_id = :org_id AND status = 'RECEIVED'
            GROUP BY supplier_name
            ORDER BY cnt DESC
            LIMIT 1
        """),
        {"org_id": org_id}
    ).fetchone()
    top_supplier = top_supplier_row[0] if top_supplier_row else "—"

    return {
        "total_month": round(total_month, 2),
        "active_orders": active_count,
        "total_historic": round(total_historic, 2),
        "top_supplier": top_supplier,
    }


@router.get("/")
def list_purchase_orders(
    status: Optional[str] = Query(None),
    branch_id: Optional[int] = Query(None),
    date_start: Optional[date] = Query(None),
    date_end: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
):
    query = db.query(PurchaseOrder).filter(PurchaseOrder.organization_id == org_id)

    if status:
        try:
            query = query.filter(PurchaseOrder.status == PurchaseOrderStatus(status))
        except ValueError:
            pass
    if branch_id:
        query = query.filter(PurchaseOrder.branch_id == branch_id)
    if date_start:
        query = query.filter(cast(PurchaseOrder.created_at, Date) >= date_start)
    if date_end:
        query = query.filter(cast(PurchaseOrder.created_at, Date) <= date_end)

    total = query.count()
    orders = query.order_by(PurchaseOrder.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [_po_to_dict(po) for po in orders],
    }


@router.post("", include_in_schema=False)
@router.post("/")
def create_purchase_order(
    payload: POCreateIn,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
    current_user: User = Depends(get_current_user),
):
    if not payload.lines:
        raise HTTPException(status_code=400, detail="La orden debe tener al menos una línea.")

    # Validar sucursal si se especifica
    if payload.branch_id:
        branch = db.query(Branch).filter(
            Branch.id == payload.branch_id,
            Branch.organization_id == org_id,
        ).first()
        if not branch:
            raise HTTPException(status_code=400, detail="Sucursal inválida o no pertenece a tu organización.")

    folio = _next_folio(db, org_id)
    po = PurchaseOrder(
        folio=folio,
        organization_id=org_id,
        branch_id=payload.branch_id,
        supplier_name=payload.supplier_name,
        supplier_contact=payload.supplier_contact,
        notes=payload.notes,
        status=PurchaseOrderStatus.DRAFT,
        created_by_user_id=current_user.id,
    )
    db.add(po)
    db.flush()

    for ln in payload.lines:
        # A2-13: defense in depth — validar tenant del variant si se pasa.
        # Admins pueden comprar items no activos en POS de ninguna sucursal;
        # require_pos_active=False.
        if ln.variant_id:
            variant_ok = get_variant_if_visible(
                db, current_user, org_id,
                variant_id=ln.variant_id,
                require_pos_active=False,
            )
            if not variant_ok:
                raise HTTPException(
                    status_code=404,
                    detail=f"Variante {ln.variant_id} no pertenece a tu organización.",
                )

        line = PurchaseOrderLine(
            purchase_order_id=po.id,
            variant_id=ln.variant_id,
            product_name=ln.product_name,
            sku=ln.sku,
            qty_ordered=ln.qty_ordered,
            qty_received=Decimal("0"),
            unit_cost=ln.unit_cost,
        )
        db.add(line)

    db.commit()
    db.refresh(po)
    return _po_to_dict(po)


@router.get("/{po_id}")
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
):
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id,
        PurchaseOrder.organization_id == org_id,
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    return _po_to_dict(po)


@router.patch("/{po_id}/status")
def update_po_status(
    po_id: int,
    new_status: str,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
    current_user: User = Depends(get_current_user),
):
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id,
        PurchaseOrder.organization_id == org_id,
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    try:
        po.status = PurchaseOrderStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Estado inválido: {new_status}")
    db.commit()
    return {"ok": True, "status": po.status.value}


@router.post("/{po_id}/receive")
def receive_purchase_order(
    po_id: int,
    payload: POReceiveIn,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
    current_user: User = Depends(get_current_user),
):
    """Registra la recepción de mercancía, actualiza stock y costo promedio."""
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id,
        PurchaseOrder.organization_id == org_id,
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    if po.status == PurchaseOrderStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="No se puede recibir una orden cancelada.")

    branch_id = po.branch_id or (current_user.branch_id)
    if not branch_id:
        raise HTTPException(
            status_code=400,
            detail="La orden o el usuario deben tener una sucursal asignada para recibir inventario.",
        )

    lines_map = {ln.id: ln for ln in po.lines}

    for recv in payload.lines:
        line = lines_map.get(recv.line_id)
        if not line:
            continue
        if recv.qty_received <= 0:
            continue

        pending = float(line.qty_ordered) - float(line.qty_received)
        if float(recv.qty_received) > pending:
            raise HTTPException(
                status_code=400,
                detail=f"Línea {line.id}: cantidad a recibir ({recv.qty_received}) supera la pendiente ({pending}).",
            )

        line.qty_received = Decimal(str(float(line.qty_received) + float(recv.qty_received)))

        if line.variant_id:
            # Actualizar stock
            stock = db.query(StockOnHand).filter(
                StockOnHand.variant_id == line.variant_id,
                StockOnHand.branch_id == branch_id,
                StockOnHand.organization_id == org_id,
            ).first()
            if not stock:
                stock = StockOnHand(
                    variant_id=line.variant_id,
                    branch_id=branch_id,
                    organization_id=org_id,
                    qty_on_hand=Decimal("0"),
                )
                db.add(stock)
                db.flush()

            qty_before = stock.qty_on_hand
            stock.qty_on_hand += recv.qty_received

            # Actualizar costo promedio en variante
            variant = db.query(ProductVariant).filter(
                ProductVariant.id == line.variant_id,
                ProductVariant.organization_id == org_id,
            ).first()
            if variant:
                variant.cost = line.unit_cost

            # Movimiento de inventario
            movement = InventoryMovement(
                organization_id=org_id,
                branch_id=branch_id,
                variant_id=line.variant_id,
                user_id=current_user.id,
                movement_type="PURCHASE",
                qty_change=recv.qty_received,
                qty_before=qty_before,
                qty_after=stock.qty_on_hand,
                reference=po.folio,
            )
            db.add(movement)

    # Actualizar estado de la orden
    all_lines = po.lines
    all_received = all(float(ln.qty_received) >= float(ln.qty_ordered) for ln in all_lines)
    any_received = any(float(ln.qty_received) > 0 for ln in all_lines)

    if all_received:
        po.status = PurchaseOrderStatus.RECEIVED
        po.received_at = datetime.now(timezone.utc)
    elif any_received:
        po.status = PurchaseOrderStatus.PARTIAL
    else:
        po.status = PurchaseOrderStatus.ORDERED

    db.commit()
    db.refresh(po)
    return _po_to_dict(po)


@router.delete("/{po_id}")
def cancel_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
    current_user: User = Depends(get_current_user),
):
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id,
        PurchaseOrder.organization_id == org_id,
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    if po.status == PurchaseOrderStatus.RECEIVED:
        raise HTTPException(status_code=400, detail="No se puede cancelar una orden ya recibida.")
    po.status = PurchaseOrderStatus.CANCELLED
    db.commit()
    return {"ok": True}
