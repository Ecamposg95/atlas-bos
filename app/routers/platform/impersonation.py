"""Impersonation endpoints (`/impersonate`, `/impersonate/exit`)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.organization import Organization
from app.models.users import User
from app.security import require_platform_admin

router = APIRouter()


# --- 6. IMPERSONATION (Support) ---

@router.post("/impersonate")
def impersonate_org_admin(
    org_id: int = Query(...),
    reason: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin)
):
    """
    Returns a redirect URL or Token to enter as Org Admin.
    Ideally, this issues a short-lived token scoped to the target org.
    For simplicity in this monolith, we might use a session cookie override mechanism.
    """
    from app.models.platform import PlatformAuditLog
    import json

    target_org = db.query(Organization).filter(Organization.id == org_id).first()
    if not target_org:
        raise HTTPException(404, "Org not found")

    # Audit the access
    db.add(PlatformAuditLog(
        actor_user_id=current_user.id,
        action="IMPERSONATE_START",
        entity_type="ORGANIZATION",
        entity_id=str(org_id),
        payload=json.dumps({"reason": reason, "target_org": target_org.name})
    ))
    db.commit()

    # In a real JWT app, we would issue a new JWT with 'impersonator_id' claim.
    # Here, assuming session/cookie auth, we might set a special cookie or return a magic link.
    # Let's return a success signal that UI can use to SET a cookie 'impersonate_org_id'

    return {
        "status": "success",
        "impersonate_org_id": org_id,
        "redirect_url": "/command-center" # HQ Dashboard
    }

@router.post("/impersonate/exit")
def exit_impersonation(db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    # Simply audit the exit
    from app.models.platform import PlatformAuditLog

    db.add(PlatformAuditLog(
        actor_user_id=current_user.id,
        action="IMPERSONATE_END",
        entity_type="SYSTEM",
        entity_id="0",
        payload="User exited impersonation mode"
    ))
    db.commit()
    return {"status": "cleared"}
