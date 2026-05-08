"""Branches CRUD + lifecycle (archive/unarchive/delete)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import json as _json

from app.database import get_db
from app.models.organization import Organization
from app.models.users import User
from app.schemas.branches import BranchCreate, BranchUpdate, BranchRead
from app.security import require_platform_admin, require_superadmin

from ._shared import _BRANCH_UPDATE_FIELDS, _audit

router = APIRouter()


# --- Branches CRUD ---

@router.get("/branches", response_model=List[BranchRead])
def list_branches(
    organization_id: Optional[int] = None,
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    from app.models.organization import Branch
    query = db.query(Branch)
    if organization_id:
        query = query.filter(Branch.organization_id == organization_id)
    if not include_archived:
        query = query.filter(Branch.is_active.is_(True))
    return query.order_by(Branch.id.desc()).offset(skip).limit(limit).all()

@router.get("/branches/{branch_id}/dependencies")
def branch_dependencies(branch_id: int, db: Session = Depends(get_db)):
    """Report counts of records that block a hard delete of this branch."""
    from app.models.organization import Branch
    from app.models.sales import SalesDocument
    from app.models.cash import CashSession
    br = db.query(Branch).filter(Branch.id == branch_id).first()
    if not br:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {
        "users": db.query(User).filter(User.branch_id == branch_id).count(),
        "sales": db.query(SalesDocument).filter(SalesDocument.branch_id == branch_id).count(),
        "cash_sessions": db.query(CashSession).filter(CashSession.branch_id == branch_id).count(),
    }

@router.post("/branches/{branch_id}/archive")
def archive_branch(branch_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    from app.models.organization import Branch
    br = db.query(Branch).filter(Branch.id == branch_id).first()
    if not br:
        raise HTTPException(status_code=404, detail="Branch not found")
    br.is_active = False
    _audit(db, current_user.id, "ARCHIVE_BRANCH", "BRANCH", branch_id,
           _json.dumps({"name": br.name, "org_id": br.organization_id}))
    db.commit()
    return {"message": "Branch archived", "is_active": False}

@router.post("/branches/{branch_id}/unarchive")
def unarchive_branch(branch_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    from app.models.organization import Branch
    br = db.query(Branch).filter(Branch.id == branch_id).first()
    if not br:
        raise HTTPException(status_code=404, detail="Branch not found")
    br.is_active = True
    _audit(db, current_user.id, "UNARCHIVE_BRANCH", "BRANCH", branch_id,
           _json.dumps({"name": br.name, "org_id": br.organization_id}))
    db.commit()
    return {"message": "Branch restored", "is_active": True}

@router.post("/branches", response_model=BranchRead)
def create_branch(
    branch_in: BranchCreate,
    organization_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    from app.models.organization import Branch
    org_id = organization_id or branch_in.organization_id
    if not org_id:
        raise HTTPException(status_code=422, detail="organization_id requerido (en body o query)")
    if not db.query(Organization.id).filter(Organization.id == org_id).first():
        raise HTTPException(status_code=404, detail="Organization not found")

    branch_data = branch_in.dict(exclude={"inherit_catalog"})
    branch_data["organization_id"] = org_id
    db_branch = Branch(**branch_data)
    db.add(db_branch)
    db.flush()
    _audit(db, current_user.id, "CREATE_BRANCH", "BRANCH", db_branch.id,
           _json.dumps({"name": db_branch.name, "org_id": org_id}))
    db.commit()
    db.refresh(db_branch)
    return db_branch

@router.put("/branches/{branch_id}", response_model=BranchRead)
def update_branch(branch_id: int, branch_in: BranchUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    from app.models.organization import Branch
    db_branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not db_branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    update_data = branch_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field in _BRANCH_UPDATE_FIELDS:
            setattr(db_branch, field, value)

    _audit(db, current_user.id, "UPDATE_BRANCH", "BRANCH", branch_id,
           _json.dumps({"name": db_branch.name}))
    db.add(db_branch)
    db.commit()
    db.refresh(db_branch)
    return db_branch

@router.delete("/branches/{branch_id}")
def delete_branch(
    branch_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    from app.models.organization import Branch
    from app.models.sales import SalesDocument, SalesLineItem, Payment
    from app.models.cash import CashSession, CashMovement

    db_branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not db_branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    if not force:
        detached_users = db.query(User).filter(User.branch_id == branch_id).update(
            {"branch_id": None}, synchronize_session=False
        )

        sales_count = db.query(SalesDocument).filter(SalesDocument.branch_id == branch_id).count()
        if sales_count > 0:
            raise HTTPException(status_code=400, detail=f"No se puede eliminar: {sales_count} venta(s) registrada(s) en esta sucursal.")
        cash_count = db.query(CashSession).filter(CashSession.branch_id == branch_id).count()
        if cash_count > 0:
            raise HTTPException(status_code=400, detail=f"No se puede eliminar: {cash_count} sesión(es) de caja en esta sucursal.")

        _audit(db, current_user.id, "DELETE_BRANCH", "BRANCH", branch_id,
               _json.dumps({"name": db_branch.name, "org_id": db_branch.organization_id, "detached_users": detached_users}))
        db.delete(db_branch)
        db.commit()
        return {"message": "Branch deleted successfully", "detached_users": detached_users}

    from app.models.returns import SaleReturn, SaleReturnItem
    from app.models.products import ProductBranchStatus
    from app.models.inventory import InventoryMovement, StockOnHand
    from app.models.abasto import PurchaseRecommendation
    from app.models.hr import Employee, BranchAssignment, Attendance
    from app.models.finance import Expense, PurchaseOrder
    from app.models.logistics import (
        TransferOrder, TransferOrderLine, TransferFulfillment, TransferFulfillmentLine,
    )

    deleted = {}
    try:
        detached_users = db.query(User).filter(User.branch_id == branch_id).update(
            {"branch_id": None}, synchronize_session=False
        )
        db.flush()

        sale_ids = [r[0] for r in db.query(SalesDocument.id).filter(
            SalesDocument.branch_id == branch_id
        ).all()]
        if sale_ids:
            return_ids = [r[0] for r in db.query(SaleReturn.id).filter(
                SaleReturn.sale_id.in_(sale_ids)
            ).all()]
            if return_ids:
                deleted["sale_return_items"] = db.query(SaleReturnItem).filter(
                    SaleReturnItem.return_id.in_(return_ids)
                ).delete(synchronize_session=False)
                db.flush()
                deleted["sale_returns"] = db.query(SaleReturn).filter(
                    SaleReturn.id.in_(return_ids)
                ).delete(synchronize_session=False)
                db.flush()
            deleted["payments"] = db.query(Payment).filter(
                Payment.sales_document_id.in_(sale_ids)
            ).delete(synchronize_session=False)
            db.flush()
            deleted["sales_lines"] = db.query(SalesLineItem).filter(
                SalesLineItem.document_id.in_(sale_ids)
            ).delete(synchronize_session=False)
            db.flush()
        deleted["sale_returns_branch"] = db.query(SaleReturn).filter(
            SaleReturn.branch_id == branch_id
        ).delete(synchronize_session=False)
        db.flush()
        deleted["sales"] = db.query(SalesDocument).filter(
            SalesDocument.branch_id == branch_id
        ).delete(synchronize_session=False)
        db.flush()

        session_ids = [r[0] for r in db.query(CashSession.id).filter(
            CashSession.branch_id == branch_id
        ).all()]
        if session_ids:
            deleted["cash_movements"] = db.query(CashMovement).filter(
                CashMovement.session_id.in_(session_ids)
            ).delete(synchronize_session=False)
            db.flush()
            db.query(SaleReturn).filter(SaleReturn.cash_session_id.in_(session_ids)).update(
                {"cash_session_id": None}, synchronize_session=False
            )
            db.flush()
            deleted["cash_sessions"] = db.query(CashSession).filter(
                CashSession.id.in_(session_ids)
            ).delete(synchronize_session=False)
            db.flush()

        deleted["product_branch_status"] = db.query(ProductBranchStatus).filter(
            ProductBranchStatus.branch_id == branch_id
        ).delete(synchronize_session=False)
        db.flush()

        deleted["inventory_movements"] = db.query(InventoryMovement).filter(
            (InventoryMovement.branch_id == branch_id)
            | (InventoryMovement.from_branch_id == branch_id)
            | (InventoryMovement.to_branch_id == branch_id)
        ).delete(synchronize_session=False)
        deleted["stock_on_hand"] = db.query(StockOnHand).filter(
            StockOnHand.branch_id == branch_id
        ).delete(synchronize_session=False)
        db.flush()

        deleted["purchase_recommendations"] = db.query(PurchaseRecommendation).filter(
            PurchaseRecommendation.branch_id == branch_id
        ).delete(synchronize_session=False)
        db.flush()

        transfer_ids = [r[0] for r in db.query(TransferOrder.id).filter(
            TransferOrder.requesting_branch_id == branch_id
        ).all()]
        from sqlalchemy import or_
        ful_filter = TransferFulfillment.source_branch_id == branch_id
        if transfer_ids:
            ful_filter = or_(ful_filter, TransferFulfillment.transfer_id.in_(transfer_ids))
        ful_ids = [r[0] for r in db.query(TransferFulfillment.id).filter(ful_filter).all()]
        if ful_ids:
            deleted["transfer_fulfillment_lines"] = db.query(TransferFulfillmentLine).filter(
                TransferFulfillmentLine.fulfillment_id.in_(ful_ids)
            ).delete(synchronize_session=False)
            db.flush()
            deleted["transfer_fulfillments"] = db.query(TransferFulfillment).filter(
                TransferFulfillment.id.in_(ful_ids)
            ).delete(synchronize_session=False)
            db.flush()
        if transfer_ids:
            deleted["transfer_order_lines"] = db.query(TransferOrderLine).filter(
                TransferOrderLine.transfer_id.in_(transfer_ids)
            ).delete(synchronize_session=False)
            db.flush()
            deleted["transfer_orders"] = db.query(TransferOrder).filter(
                TransferOrder.id.in_(transfer_ids)
            ).delete(synchronize_session=False)
            db.flush()

        deleted["attendances"] = db.query(Attendance).filter(
            Attendance.branch_id == branch_id
        ).delete(synchronize_session=False)
        deleted["branch_assignments"] = db.query(BranchAssignment).filter(
            BranchAssignment.branch_id == branch_id
        ).delete(synchronize_session=False)
        db.flush()

        db.query(Employee).filter(Employee.base_branch_id == branch_id).update(
            {"base_branch_id": None}, synchronize_session=False
        )
        db.flush()

        db.query(Expense).filter(Expense.branch_id == branch_id).update(
            {"branch_id": None}, synchronize_session=False
        )
        db.query(PurchaseOrder).filter(PurchaseOrder.branch_id == branch_id).update(
            {"branch_id": None}, synchronize_session=False
        )
        db.flush()

        db.delete(db_branch)
        db.flush()

        _audit(db, current_user.id, "HARD_DELETE_BRANCH", "BRANCH", branch_id,
               _json.dumps({"name": db_branch.name, "org_id": db_branch.organization_id,
                            "detached_users": detached_users, "deleted": deleted}, default=str))
        db.commit()
        return {
            "message": f"Branch {db_branch.name} hard-deleted with cascade",
            "detached_users": detached_users,
            "deleted": deleted,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Hard delete failed: {str(e)}")
