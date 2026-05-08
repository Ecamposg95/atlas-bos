from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models.logistics import (
    TransferOrder, TransferOrderLine,
    TransferFulfillment, TransferFulfillmentLine,
    TransferStatus, FulfillmentStatus
)
from app.models.inventory import StockOnHand, InventoryMovement, MovementType
from app.models.organization import Branch
from app.models.products import Product, ProductVariant
from app.schemas.logistics import (
    TransferOrderCreate, TransferOrderRead,
    TransferFulfillmentCreate, TransferFulfillmentRead
)
from app.security import get_current_user
from app.dependencies import get_current_active_organization

router = APIRouter()

@router.post("/", response_model=TransferOrderRead)
def create_transfer_request(
    transfer_in: TransferOrderCreate,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization)
):
    # A2-18: validar que requesting_branch_id pertenezca al tenant.
    branch_ok = db.query(Branch.id).filter(
        Branch.id == transfer_in.requesting_branch_id,
        Branch.organization_id == org_id,
    ).first()
    if not branch_ok:
        raise HTTPException(400, "Sucursal inválida o no pertenece a tu organización.")

    # A2-18: validar que todos los variant_ids de las líneas pertenezcan al tenant.
    variant_ids = [ln.variant_id for ln in transfer_in.lines if ln.variant_id]
    if variant_ids:
        tenant_variants = {
            row[0] for row in db.query(ProductVariant.id)
            .join(Product, Product.id == ProductVariant.product_id)
            .filter(
                ProductVariant.id.in_(variant_ids),
                Product.organization_id == org_id,
            ).all()
        }
        if len(tenant_variants) != len(set(variant_ids)):
            raise HTTPException(
                404, "Una o más variantes no pertenecen a tu organización."
            )

    new_order = TransferOrder(
        organization_id=org_id,
        requesting_branch_id=transfer_in.requesting_branch_id,
        status=TransferStatus.REQUESTED,
        notes=transfer_in.notes
    )
    db.add(new_order)
    db.flush()

    for line in transfer_in.lines:
        new_line = TransferOrderLine(
            organization_id=org_id,
            transfer_id=new_order.id,
            variant_id=line.variant_id,
            qty_requested=line.qty_requested
        )
        db.add(new_line)

    db.commit()
    db.refresh(new_order)
    return new_order

@router.get("/", response_model=List[TransferOrderRead])
def get_transfers(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization)
):
    return db.query(TransferOrder).filter(TransferOrder.organization_id == org_id).all()

@router.post("/{id}/fulfill", response_model=TransferFulfillmentRead)
def fulfill_transfer(
    id: int,
    fulfillment_in: TransferFulfillmentCreate,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization)
):
    order = db.query(TransferOrder).filter(TransferOrder.id == id, TransferOrder.organization_id == org_id).first()
    if not order:
        raise HTTPException(404, "Transfer order not found")
        
    new_fulfillment = TransferFulfillment(
        organization_id=org_id,
        transfer_id=id,
        source_branch_id=fulfillment_in.source_branch_id,
        status=FulfillmentStatus.PREPARED
    )
    db.add(new_fulfillment)
    db.flush()
    
    for f_line in fulfillment_in.lines:
        new_f_line = TransferFulfillmentLine(
            organization_id=org_id,
            fulfillment_id=new_fulfillment.id,
            transfer_line_id=f_line.transfer_line_id,
            qty_fulfilled=f_line.qty_fulfilled
        )
        db.add(new_f_line)
        
    order.status = TransferStatus.PARTIALLY_FULFILLED
    db.commit()
    db.refresh(new_fulfillment)
    return new_fulfillment

@router.post("/fulfillment/{id}/ship", response_model=TransferFulfillmentRead)
def ship_fulfillment(
    id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
    current_user = Depends(get_current_user)
):
    fulfillment = db.query(TransferFulfillment).options(
        joinedload(TransferFulfillment.lines).joinedload(TransferFulfillmentLine.transfer_line)
    ).filter(TransferFulfillment.id == id, TransferFulfillment.organization_id == org_id).first()
    
    if not fulfillment:
        raise HTTPException(404, "Fulfillment not found")
    if fulfillment.status != FulfillmentStatus.PREPARED:
        raise HTTPException(400, "Only PREPARED fulfillments can be shipped")
        
    # Execute Stock movement (Out from source)
    for line in fulfillment.lines:
        variant_id = line.transfer_line.variant_id
        qty = Decimal(str(line.qty_fulfilled))
        
        # 1. Update Stock in Source (WAREHOUSE) — A2-19 tenant filter.
        stock = db.query(StockOnHand).filter(
            StockOnHand.branch_id == fulfillment.source_branch_id,
            StockOnHand.variant_id == variant_id,
            StockOnHand.organization_id == org_id,
        ).first()

        if not stock or stock.qty_on_hand < qty:
            raise HTTPException(400, f"Insufficient stock for variant {variant_id} in source branch")
            
        qty_before = stock.qty_on_hand
        stock.qty_on_hand -= qty
        
        # 2. Record Movement
        move = InventoryMovement(
            organization_id=org_id,
            branch_id=fulfillment.source_branch_id,
            from_branch_id=fulfillment.source_branch_id,
            to_branch_id=fulfillment.transfer.requesting_branch_id,
            variant_id=variant_id,
            user_id=current_user.id,
            movement_type=MovementType.TRANSFER_OUT,
            qty_change=-qty,
            qty_before=qty_before,
            qty_after=stock.qty_on_hand,
            reference=f"Transfer Fulfillment #{fulfillment.id}"
        )
        db.add(move)
        
    fulfillment.status = FulfillmentStatus.SHIPPED
    fulfillment.shipped_at = datetime.now()
    db.commit()
    db.refresh(fulfillment)
    return fulfillment

@router.post("/fulfillment/{id}/receive", response_model=TransferFulfillmentRead)
def receive_fulfillment(
    id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
    current_user = Depends(get_current_user)
):
    fulfillment = db.query(TransferFulfillment).options(
        joinedload(TransferFulfillment.lines).joinedload(TransferFulfillmentLine.transfer_line),
        joinedload(TransferFulfillment.transfer).joinedload(TransferOrder.lines)
    ).filter(TransferFulfillment.id == id, TransferFulfillment.organization_id == org_id).first()
    
    if not fulfillment:
        raise HTTPException(404, "Fulfillment not found")
    if fulfillment.status != FulfillmentStatus.SHIPPED:
        raise HTTPException(400, "Only SHIPPED fulfillments can be received")
        
    # Execute Stock movement (In to destination)
    for line in fulfillment.lines:
        variant_id = line.transfer_line.variant_id
        qty = Decimal(str(line.qty_fulfilled))
        
        # 1. Update Stock in requesting branch (STORE) — A2-19 tenant filter.
        stock = db.query(StockOnHand).filter(
            StockOnHand.branch_id == fulfillment.transfer.requesting_branch_id,
            StockOnHand.variant_id == variant_id,
            StockOnHand.organization_id == org_id,
        ).first()
        
        if not stock:
            # Create stock record if not exists
            stock = StockOnHand(
                organization_id=org_id,
                branch_id=fulfillment.transfer.requesting_branch_id,
                variant_id=variant_id,
                qty_on_hand=0
            )
            db.add(stock)
            db.flush()
            
        qty_before = stock.qty_on_hand
        stock.qty_on_hand += qty
        
        # 2. Record Movement
        move = InventoryMovement(
            organization_id=org_id,
            branch_id=fulfillment.transfer.requesting_branch_id,
            from_branch_id=fulfillment.source_branch_id,
            to_branch_id=fulfillment.transfer.requesting_branch_id,
            variant_id=variant_id,
            user_id=current_user.id,
            movement_type=MovementType.TRANSFER_IN,
            qty_change=qty,
            qty_before=qty_before,
            qty_after=stock.qty_on_hand,
            reference=f"Transfer Fulfillment #{fulfillment.id}"
        )
        db.add(move)
        
        # 3. Update Transfer Order Line
        line.transfer_line.qty_received += qty
        
    fulfillment.status = FulfillmentStatus.RECEIVED
    fulfillment.received_at = datetime.now()
    
    # Check if Order is fully completed
    is_complete = True
    for ol in fulfillment.transfer.lines:
        if ol.qty_received < ol.qty_requested:
            is_complete = False
            break
            
    if is_complete:
        fulfillment.transfer.status = TransferStatus.COMPLETED
        
    db.commit()
    db.refresh(fulfillment)
    return fulfillment
