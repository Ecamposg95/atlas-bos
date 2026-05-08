"""Platform admins management (SUPERADMIN/SUPPORT)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.users import User, PlatformRole
from app.security import require_platform_admin, get_password_hash

router = APIRouter()


# --- 10. ADMIN MANAGEMENT (SUPERADMIN/SUPPORT) ---

class AdminInvite(BaseModel):
    email: str
    full_name: Optional[str] = None
    platform_role: str  # 'SUPERADMIN' | 'SUPPORT'
    temp_password: Optional[str] = None


class AdminRoleChange(BaseModel):
    platform_role: str  # 'SUPERADMIN' | 'SUPPORT' | 'NONE'


class PlatformAdminManualCreate(BaseModel):
    email: str
    full_name: Optional[str] = None
    platform_role: str  # 'SUPERADMIN' | 'SUPPORT'
    password: str


@router.get("/admins")
def list_platform_admins(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """List all users with platform_role SUPERADMIN or SUPPORT."""
    admins = db.query(User).filter(
        User.platform_role.in_([PlatformRole.SUPERADMIN, PlatformRole.SUPPORT])
    ).order_by(User.id.desc()).all()
    return [{
        "id": a.id,
        "email": a.email,
        "username": a.username,
        "full_name": a.full_name,
        "platform_role": a.platform_role.value if hasattr(a.platform_role, 'value') else str(a.platform_role),
        "is_active": a.is_active,
        "last_login": getattr(a, 'last_login', None),
    } for a in admins]


@router.post("/admins")
def invite_platform_admin(
    body: AdminInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Invite a new platform admin (SUPERADMIN or SUPPORT). Only SUPERADMIN can do this."""
    from app.services.audit_service import write_audit
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede invitar admins")
    if body.platform_role not in ("SUPERADMIN", "SUPPORT"):
        raise HTTPException(400, "platform_role debe ser SUPERADMIN o SUPPORT")
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(400, "Email ya registrado")
    import secrets
    temp_pwd = body.temp_password or secrets.token_urlsafe(12)
    user = User(
        email=body.email,
        username=body.email.split("@")[0],
        full_name=body.full_name or body.email,
        password_hash=get_password_hash(temp_pwd),
        platform_role=PlatformRole(body.platform_role),
        is_active=True,
    )
    db.add(user)
    db.flush()
    write_audit(db, actor_user_id=current_user.id, action="INVITE_ADMIN",
                entity_type="USER", entity_id=str(user.id),
                meta={"platform_role": body.platform_role})
    db.commit()
    return {"id": user.id, "email": user.email, "temp_password": temp_pwd, "platform_role": body.platform_role}


@router.post("/admins/manual")
def create_platform_admin_manual(
    body: PlatformAdminManualCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Create a platform admin with a SUPERADMIN-supplied password (no temp password flow)."""
    from app.services.audit_service import write_audit
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede crear admins manualmente")
    if body.platform_role not in ("SUPERADMIN", "SUPPORT"):
        raise HTTPException(422, "platform_role debe ser SUPERADMIN o SUPPORT")
    if (
        len(body.password) < 8
        or not any(c.isalpha() for c in body.password)
        or not any(c.isdigit() for c in body.password)
    ):
        raise HTTPException(
            400,
            "Password inválido: mínimo 8 caracteres, al menos 1 letra y 1 número",
        )
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(422, "Email ya registrado")
    user = User(
        email=body.email,
        username=body.email.split("@")[0],
        full_name=body.full_name or body.email,
        password_hash=get_password_hash(body.password),
        platform_role=PlatformRole(body.platform_role),
        is_active=True,
    )
    db.add(user)
    db.flush()
    write_audit(db, actor_user_id=current_user.id, action="CREATE_ADMIN_MANUAL",
                entity_type="USER", entity_id=str(user.id),
                meta={"platform_role": body.platform_role})
    db.commit()
    return {
        "user_id": user.id,
        "email": user.email,
        "platform_role": body.platform_role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.patch("/admins/{user_id}/role")
def change_admin_role(
    user_id: int,
    body: AdminRoleChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Change platform_role of an admin. Only SUPERADMIN."""
    from app.services.audit_service import write_audit
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede cambiar roles")
    if body.platform_role not in ("SUPERADMIN", "SUPPORT", "NONE"):
        raise HTTPException(400, "platform_role inválido")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    old_role = user.platform_role.value if hasattr(user.platform_role, 'value') else str(user.platform_role)
    user.platform_role = PlatformRole(body.platform_role)
    write_audit(db, actor_user_id=current_user.id, action="CHANGE_ADMIN_ROLE",
                entity_type="USER", entity_id=str(user.id),
                meta={"from": old_role, "to": body.platform_role})
    db.commit()
    return {"id": user.id, "platform_role": body.platform_role}


@router.delete("/admins/{user_id}")
def revoke_platform_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Revoke platform_role (set to NONE). Only SUPERADMIN."""
    from app.services.audit_service import write_audit
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede revocar admins")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.platform_role = PlatformRole.NONE
    write_audit(db, actor_user_id=current_user.id, action="REVOKE_ADMIN",
                entity_type="USER", entity_id=str(user.id))
    db.commit()
    return {"status": "revoked", "id": user.id}
