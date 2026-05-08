"""Global Users CRUD + dependencies + reset-password + role change."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json as _json

from app.core.database import get_db
from app.models.users import User, UserOrganization, PlatformRole, Role as AppRole
from app.schemas.users import UserCreate, UserUpdate, UserRead as GlobalUserRead
from app.core.security import get_password_hash
from app.modules.platform.dependencies import require_platform_admin

from ._shared import _USER_UPDATE_FIELDS, _audit, _sync_user_organization

router = APIRouter()


# --- Global Users CRUD ---

@router.get("/users", response_model=List[GlobalUserRead])
def list_global_users(
    organization_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    include_inactive: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    from sqlalchemy.orm import joinedload
    from app.models.organization import Branch

    query = db.query(User).options(joinedload(User.branch))

    if not include_inactive:
        query = query.filter(User.is_active.is_(True))

    if branch_id:
        query = query.filter(User.branch_id == branch_id)
    elif organization_id:
        # Match users either via their branch's org OR via UserOrganization link
        user_ids_via_assoc = db.query(UserOrganization.user_id).filter(
            UserOrganization.organization_id == organization_id,
            UserOrganization.is_active.is_(True),
        )
        user_ids_via_branch = db.query(User.id).join(Branch, Branch.id == User.branch_id).filter(
            Branch.organization_id == organization_id
        )
        query = query.filter(
            (User.id.in_(user_ids_via_assoc)) | (User.id.in_(user_ids_via_branch))
        )

    users = query.order_by(User.id.desc()).offset(skip).limit(limit).all()

    # Resolve organization_id: UserOrganization (primary) then branch (fallback)
    if users:
        user_ids = [u.id for u in users]
        assocs = db.query(UserOrganization).filter(
            UserOrganization.user_id.in_(user_ids),
            UserOrganization.is_active.is_(True),
        ).all()
        assoc_map = {a.user_id: a.organization_id for a in assocs}
        for u in users:
            u.organization_id = assoc_map.get(u.id) or (u.branch.organization_id if u.branch else None)

    return users

@router.post("/users", response_model=GlobalUserRead)
def create_global_user(user_in: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    if user_in.password and len(user_in.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")

    db_user = User(
        username=user_in.username,
        full_name=user_in.full_name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role or AppRole.CAJERO,
        platform_role=PlatformRole.NONE,  # Never allow escalation via create
        branch_id=user_in.branch_id,
        is_active=user_in.is_active
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # 1. Sync via explicit organization_id (takes priority)
    if user_in.organization_id:
        assoc = db.query(UserOrganization).filter(
            UserOrganization.user_id == db_user.id,
            UserOrganization.organization_id == user_in.organization_id
        ).first()
        if not assoc:
            assoc = UserOrganization(
                user_id=db_user.id,
                organization_id=user_in.organization_id,
                org_role="MEMBER",
                is_active=True
            )
            db.add(assoc)
            db.commit()
        db_user.organization_id = user_in.organization_id
    # 2. Sync via branch_id if no explicit org was sent but branch belongs to one
    elif db_user.branch_id:
        org_id = _sync_user_organization(db, db_user.id, db_user.branch_id)
        db_user.organization_id = org_id

    _audit(db, current_user.id, "CREATE_USER", "USER", db_user.id,
           _json.dumps({"username": db_user.username, "role": str(db_user.role)}))
    db.commit()
    return db_user

@router.get("/users/{user_id}", response_model=GlobalUserRead)
def read_global_user(user_id: int, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    user = db.query(User).options(joinedload(User.branch)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Resolve organization_id: UserOrganization (primary) then branch (fallback)
    assoc = db.query(UserOrganization).filter(
        UserOrganization.user_id == user.id,
        UserOrganization.is_active.is_(True),
    ).first()
    user.organization_id = assoc.organization_id if assoc else (user.branch.organization_id if user.branch else None)
    return user

@router.put("/users/{user_id}", response_model=GlobalUserRead)
def update_global_user(user_id: int, user_in: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    from sqlalchemy.orm import joinedload
    db_user = db.query(User).options(joinedload(User.branch)).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_in.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        if len(update_data["password"]) < 8:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
        db_user.password_hash = get_password_hash(update_data.pop("password"))
    else:
        update_data.pop("password", None)

    for field, value in update_data.items():
        if field in ("organization_id", "platform_role", "password_hash"):
            continue  # Never allow these via mass assignment
        if field in _USER_UPDATE_FIELDS:
            setattr(db_user, field, value)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Sync organization membership (replace semantics: one active org per user)
    if user_in.organization_id:
        # Deactivate any other active association so there's a single source of truth
        db.query(UserOrganization).filter(
            UserOrganization.user_id == db_user.id,
            UserOrganization.organization_id != user_in.organization_id,
            UserOrganization.is_active.is_(True),
        ).update({"is_active": False}, synchronize_session=False)

        assoc = db.query(UserOrganization).filter(
            UserOrganization.user_id == db_user.id,
            UserOrganization.organization_id == user_in.organization_id
        ).first()

        if assoc:
            assoc.is_active = True
        else:
            assoc = UserOrganization(
                user_id=db_user.id,
                organization_id=user_in.organization_id,
                org_role="MEMBER",
                is_active=True
            )
            db.add(assoc)
        db.commit()
        db_user.organization_id = user_in.organization_id
    elif db_user.branch_id:
        org_id = _sync_user_organization(db, db_user.id, db_user.branch_id)
        db_user.organization_id = org_id
    else:
        db_user.organization_id = None

    _audit(db, current_user.id, "UPDATE_USER", "USER", user_id,
           _json.dumps({"username": db_user.username}))
    db.commit()
    return db_user

@router.get("/users/{user_id}/dependencies")
def user_dependencies(user_id: int, db: Session = Depends(get_db)):
    from app.models.sales import SalesDocument, DocumentType
    from app.models.cash import CashSession
    from app.models.finance import Expense

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.models.hr import BranchAssignment, Employee

    emp_ids = [r[0] for r in db.query(Employee.id).filter(Employee.user_id == user_id).all()]
    ba_count = 0
    if emp_ids:
        ba_count = db.query(BranchAssignment).filter(
            BranchAssignment.employee_id.in_(emp_ids)
        ).count()

    return {
        "organizations": db.query(UserOrganization).filter(UserOrganization.user_id == user_id).count(),
        "branch_assignments": ba_count,
        "sales_created": db.query(SalesDocument).filter(
            SalesDocument.seller_id == user_id,
            SalesDocument.doc_type != DocumentType.QUOTE,
        ).count(),
        "cash_sessions": db.query(CashSession).filter(CashSession.user_id == user_id).count(),
        "quotes_created": db.query(SalesDocument).filter(
            SalesDocument.seller_id == user_id,
            SalesDocument.doc_type == DocumentType.QUOTE,
        ).count(),
        "expenses_created": db.query(Expense).filter(Expense.user_id == user_id).count(),
    }

@router.delete("/users/{user_id}")
def delete_global_user(
    user_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")

    if not force:
        user.is_active = False
        _audit(db, current_user.id, "DELETE_USER", "USER", user_id,
               _json.dumps({"username": user.username, "action": "soft_delete"}))
        db.commit()
        return {"message": f"Usuario {user.username} desactivado exitosamente."}

    from app.models.sales import SalesDocument, Payment
    from app.models.returns import SaleReturn
    from app.models.products import Product
    from app.models.inventory import InventoryMovement
    from app.models.finance import AccountTransaction
    from app.models.logistics import ContainerLoadCalc
    from app.models.hr import Employee, BranchAssignment, Attendance
    from app.models.platform import PlatformAuditLog

    username = user.username
    try:
        db.query(UserOrganization).filter(UserOrganization.user_id == user_id).delete(
            synchronize_session=False
        )
        db.flush()

        emp_ids = [r[0] for r in db.query(Employee.id).filter(Employee.user_id == user_id).all()]
        if emp_ids:
            db.query(BranchAssignment).filter(
                BranchAssignment.employee_id.in_(emp_ids)
            ).delete(synchronize_session=False)
            db.query(Attendance).filter(
                Attendance.employee_id.in_(emp_ids)
            ).delete(synchronize_session=False)
            db.flush()
            db.query(Employee).filter(Employee.user_id == user_id).update(
                {"user_id": None}, synchronize_session=False
            )
            db.flush()

        db.query(Attendance).filter(Attendance.created_by_user_id == user_id).update(
            {"created_by_user_id": None}, synchronize_session=False
        )
        db.query(Payment).filter(Payment.created_by_id == user_id).update(
            {"created_by_id": None}, synchronize_session=False
        )
        db.query(SaleReturn).filter(SaleReturn.supervisor_id == user_id).update(
            {"supervisor_id": None}, synchronize_session=False
        )
        db.query(Product).filter(Product.created_by_user_id == user_id).update(
            {"created_by_user_id": None}, synchronize_session=False
        )
        db.query(InventoryMovement).filter(InventoryMovement.user_id == user_id).update(
            {"user_id": None}, synchronize_session=False
        )
        db.query(AccountTransaction).filter(AccountTransaction.created_by_user_id == user_id).update(
            {"created_by_user_id": None}, synchronize_session=False
        )
        db.query(ContainerLoadCalc).filter(ContainerLoadCalc.created_by_user_id == user_id).update(
            {"created_by_user_id": None}, synchronize_session=False
        )
        db.query(PlatformAuditLog).filter(PlatformAuditLog.actor_user_id == user_id).update(
            {"actor_user_id": None}, synchronize_session=False
        )
        db.flush()

        db.delete(user)
        db.flush()

        _audit(db, current_user.id, "HARD_DELETE_USER", "USER", user_id,
               _json.dumps({"username": username}))
        db.commit()
        return {"message": f"Usuario {username} eliminado permanentemente.", "hard_deleted": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Hard delete failed: {str(e)}")


# --- 12. USER RESET PASSWORD + ROLE CHANGE ---

class UserPasswordReset(BaseModel):
    new_password: Optional[str] = None  # Si se omite, se genera


class UserRoleChange(BaseModel):
    role: str  # tenant role (CAJERO, GERENTE, etc.)


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    body: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Reset password for a user. SUPERADMIN only. Returns the temp password to display once."""
    from app.services.audit_service import write_audit
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede resetear passwords")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    import secrets
    new_pwd = body.new_password or secrets.token_urlsafe(12)
    user.password_hash = get_password_hash(new_pwd)
    write_audit(db, actor_user_id=current_user.id, action="RESET_PASSWORD",
                entity_type="USER", entity_id=str(user.id))
    db.commit()
    return {"id": user.id, "email": user.email, "temp_password": new_pwd}


@router.patch("/users/{user_id}/role")
def change_user_role(
    user_id: int,
    body: UserRoleChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Change tenant role of a user. SUPERADMIN only."""
    from app.services.audit_service import write_audit
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede cambiar roles tenant")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    old_role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    try:
        user.role = AppRole(body.role)
    except ValueError:
        raise HTTPException(400, f"Rol '{body.role}' inválido")
    write_audit(db, actor_user_id=current_user.id, action="CHANGE_USER_ROLE",
                entity_type="USER", entity_id=str(user.id),
                meta={"from": old_role, "to": body.role})
    db.commit()
    return {"id": user.id, "role": body.role}
