"""``/api/products/boxes-inventory`` and ``/api/products/packaging/{id}``.

Sprint 5b split — extracted verbatim from the original ``products.py``.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.dependencies import get_current_active_organization
from app.models import (
    Product, ProductVariant, StockOnHand, User, PackagingUnit,
)
from app.security import get_current_user
from app.crud.products import _is_admin
from app.schemas.products import PackagingUpdate

from ._shared import _MANAGER_ROLES, _PRODUCT_ADVANCED_ROLES

router = APIRouter()


@router.get("/boxes-inventory")
async def get_boxes_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization) # [HARDENING]
):
    """
    Returns all packaging units (boxes) with calculated availability
    based on the piece-count stock of their parent variant.

    Track 3 (POS bug-fix): cajero también puede ver inventario de cajas
    (queda scoped a su sucursal vía target_branch_id = current_user.branch_id
    más abajo). Multi-tenant safety preservada por el filtro
    Product.organization_id.
    """
    if current_user.role not in _PRODUCT_ADVANCED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="No autorizado para ver inventario de cajas",
        )
    # We join PackagingUnit with ProductVariant and then with Product to get names
    # and StockOnHand to get piece counts.
    query = db.query(
        PackagingUnit,
        Product.name.label("product_name"),
        ProductVariant.sku.label("sku"),
        StockOnHand.qty_on_hand
    ).join(ProductVariant, PackagingUnit.variant_id == ProductVariant.id)\
     .join(Product, ProductVariant.product_id == Product.id)

    # [HARDENING] Filter by Organization (Relaxed for Legacy)
    from sqlalchemy import or_, and_
    query = query.filter(or_(Product.organization_id == org_id, Product.organization_id == None))

    # If branch_id filter is needed in the future, it would go here.
    # For now, we assume global or filtered by current user branch if applicable.
    target_branch_id = current_user.branch_id

    if target_branch_id:
        query = query.outerjoin(StockOnHand, and_(
            ProductVariant.id == StockOnHand.variant_id,
            StockOnHand.branch_id == target_branch_id,
            or_(StockOnHand.organization_id == org_id, StockOnHand.organization_id == None)
        ))
    else:
        # Fallback or Global Admin View - simplistic approach:
        # To avoid Cartesian product if multiple stocks exist, maybe just join first one?
        # Or just outerjoin. If duplicates occur, the UI might show repeated rows.
        # Ideally we should sum, but let's stick to simple outerjoin for now.
        query = query.outerjoin(StockOnHand, and_(
             ProductVariant.id == StockOnHand.variant_id,
             or_(StockOnHand.organization_id == org_id, StockOnHand.organization_id == None)
        ))

    results = []
    for pkg, p_name, sku, stock in query.all():
        units_per = float(pkg.units_per_package)
        stock_val = float(stock or 0)

        boxes_available = int(stock_val // units_per)
        loose_pieces = int(stock_val % units_per)

        results.append({
            "packaging_id": str(pkg.id),
            "product_name": p_name,
            "sku": sku,
            "box_name": pkg.name,
            "box_barcode": pkg.barcode,
            "units_per_package": units_per,
            "package_price": float(pkg.package_price),
            "stock_pieces": stock_val,
            "boxes_available": boxes_available,
            "loose_pieces": loose_pieces,
            "product_id": str(pkg.variant.product_id),
        })

    return results


@router.put("/packaging/{packaging_id}")
def update_packaging(
    packaging_id: str,
    payload: PackagingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization)
):
    """Update a PackagingUnit (box config) by id."""
    # Track 3: cajero también puede editar empaques de su org.
    if current_user.role not in _PRODUCT_ADVANCED_ROLES:
        raise HTTPException(status_code=403, detail="No autorizado para editar empaques")

    from sqlalchemy import or_
    pkg = db.query(PackagingUnit).filter(
        PackagingUnit.id == packaging_id,
        or_(PackagingUnit.organization_id == org_id, PackagingUnit.organization_id == None)
    ).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Empaque no encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "box_name" in data:
        pkg.name = data["box_name"]
    if "units_per_package" in data and data["units_per_package"] is not None:
        if data["units_per_package"] <= 0:
            raise HTTPException(status_code=422, detail="units_per_package debe ser > 0")
        pkg.units_per_package = float(data["units_per_package"])
    if "package_price" in data and data["package_price"] is not None:
        if data["package_price"] < 0:
            raise HTTPException(status_code=422, detail="package_price debe ser >= 0")
        pkg.package_price = float(data["package_price"])
    if "box_barcode" in data:
        pkg.barcode = data["box_barcode"] or None

    db.commit()
    db.refresh(pkg)
    return {"status": "ok", "packaging_id": str(pkg.id)}
