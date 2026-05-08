"""Platform audit logs endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.core.database import get_db

router = APIRouter()


# --- 7. AUDIT LOGS ---

@router.get("/audit/logs")
def get_audit_logs(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    actor_user_id: Optional[int] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List platform audit logs with optional filters."""
    from app.models.platform import PlatformAuditLog
    q = db.query(PlatformAuditLog)
    if start_date:
        q = q.filter(PlatformAuditLog.created_at >= start_date)
    if end_date:
        q = q.filter(PlatformAuditLog.created_at <= end_date)
    if actor_user_id:
        q = q.filter(PlatformAuditLog.actor_user_id == actor_user_id)
    if action:
        q = q.filter(PlatformAuditLog.action == action)
    if entity_type:
        q = q.filter(PlatformAuditLog.entity_type == entity_type)
    total = q.count()
    items = q.order_by(PlatformAuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}
