"""Platform-wide announcements (Sprint 1 · D4)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, field_validator
import json as _json
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.organization import Organization
from app.models.users import User
from app.modules.platform.dependencies import require_platform_admin, require_superadmin

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# 13. ANNOUNCEMENTS (Sprint 1 · D4)
# SUPERADMIN broadcasts banner messages to tenants. Targeting by industry/plan
# /org_ids or universal (all tenants). The consumer banner in tenant pages is
# deferred — for now only the management UI + `/announcements/active` stub.
# ─────────────────────────────────────────────────────────────────────────────

class AnnouncementTargets(BaseModel):
    industries: Optional[List[str]] = None
    plans: Optional[List[str]] = None
    org_ids: Optional[List[int]] = None


class AnnouncementCreate(BaseModel):
    title: str
    body_md: str
    severity: str = "info"
    targets: Optional[AnnouncementTargets] = None
    expires_at: Optional[datetime] = None
    publish_now: bool = False

    @field_validator("severity")
    @classmethod
    def _sev(cls, v: str) -> str:
        if v not in ("info", "warning", "critical", "success"):
            raise ValueError("severity debe ser info|warning|critical|success")
        return v

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("title requerido")
        if len(v) > 200:
            raise ValueError("title máx 200 chars")
        return v


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    body_md: Optional[str] = None
    severity: Optional[str] = None
    targets: Optional[AnnouncementTargets] = None
    expires_at: Optional[datetime] = None

    @field_validator("severity")
    @classmethod
    def _sev(cls, v):
        if v is not None and v not in ("info", "warning", "critical", "success"):
            raise ValueError("severity debe ser info|warning|critical|success")
        return v


def _serialize_announcement(row) -> dict:
    targets = None
    if row.targets_json:
        try:
            targets = _json.loads(row.targets_json)
        except Exception:
            targets = None
    now = datetime.now(timezone.utc)
    status = "draft"
    if row.published_at:
        pub = row.published_at
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        if pub <= now:
            if row.expires_at:
                exp = row.expires_at
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                status = "expired" if exp <= now else "published"
            else:
                status = "published"
        else:
            status = "draft"
    return {
        "id": row.id,
        "title": row.title,
        "body_md": row.body_md,
        "severity": row.severity or "info",
        "targets": targets,
        "published_at": row.published_at.isoformat() if row.published_at else None,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "status": status,
    }


@router.get("/announcements")
def list_announcements(
    status: Optional[str] = Query(None, description="draft|published|expired|all"),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List announcements with optional status + severity filters.

    `status` is derived from `published_at`/`expires_at`:
      - draft     → published_at is NULL
      - published → published_at <= now and (expires_at is NULL or expires_at > now)
      - expired   → expires_at <= now
    """
    from app.models.platform import PlatformAnnouncement
    q = db.query(PlatformAnnouncement)
    now = datetime.now(timezone.utc)

    if severity:
        q = q.filter(PlatformAnnouncement.severity == severity)

    if status and status != "all":
        if status == "draft":
            q = q.filter(PlatformAnnouncement.published_at.is_(None))
        elif status == "published":
            q = q.filter(
                PlatformAnnouncement.published_at.isnot(None),
                PlatformAnnouncement.published_at <= now,
            ).filter(
                (PlatformAnnouncement.expires_at.is_(None))
                | (PlatformAnnouncement.expires_at > now)
            )
        elif status == "expired":
            q = q.filter(
                PlatformAnnouncement.expires_at.isnot(None),
                PlatformAnnouncement.expires_at <= now,
            )

    rows = q.order_by(PlatformAnnouncement.created_at.desc()).all()
    return [_serialize_announcement(r) for r in rows]


@router.post("/announcements", status_code=status.HTTP_201_CREATED)
def create_announcement(
    body: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Create a new announcement. If `publish_now=true`, sets `published_at=now()`."""
    from app.models.platform import PlatformAnnouncement
    from app.services.audit_service import write_audit

    targets_json = None
    if body.targets:
        targets_dict = body.targets.model_dump(exclude_none=True)
        # Scrub empty arrays so "no filter" stays null semantics.
        targets_dict = {k: v for k, v in targets_dict.items() if v}
        if targets_dict:
            targets_json = _json.dumps(targets_dict)

    row = PlatformAnnouncement(
        title=body.title,
        body_md=body.body_md,
        severity=body.severity,
        targets_json=targets_json,
        published_at=datetime.now(timezone.utc) if body.publish_now else None,
        expires_at=body.expires_at,
        created_by=current_user.id,
    )
    db.add(row)
    db.flush()
    write_audit(
        db, actor_user_id=current_user.id, action="CREATE_ANNOUNCEMENT",
        entity_type="ANNOUNCEMENT", entity_id=str(row.id),
        meta={"title": row.title, "severity": row.severity, "published": bool(row.published_at)},
    )
    db.commit()
    db.refresh(row)
    return _serialize_announcement(row)


@router.get("/announcements/active")
def active_announcements(
    org_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Currently-published announcements matching an org's industry/plan/id or universal.

    Placeholder for tenant banner consumption (Sprint 1 · D4 consumer is deferred).
    """
    from app.models.platform import PlatformAnnouncement
    now = datetime.now(timezone.utc)
    q = db.query(PlatformAnnouncement).filter(
        PlatformAnnouncement.published_at.isnot(None),
        PlatformAnnouncement.published_at <= now,
    ).filter(
        (PlatformAnnouncement.expires_at.is_(None))
        | (PlatformAnnouncement.expires_at > now)
    ).order_by(PlatformAnnouncement.published_at.desc())

    rows = q.all()
    org = None
    if org_id:
        org = db.query(Organization).filter(Organization.id == org_id).first()

    def _matches(row) -> bool:
        if not row.targets_json:
            return True  # universal
        try:
            t = _json.loads(row.targets_json) or {}
        except Exception:
            return True
        industries = t.get("industries") or []
        plans = t.get("plans") or []
        ids = t.get("org_ids") or []
        if not industries and not plans and not ids:
            return True
        if not org:
            return False
        if ids and org.id in ids:
            return True
        if industries and org.industry_type and (
            (org.industry_type.value if hasattr(org.industry_type, "value") else str(org.industry_type)) in industries
        ):
            return True
        if plans and (org.plan or "FREE") in plans:
            return True
        return False

    return [_serialize_announcement(r) for r in rows if _matches(r)]


@router.get("/announcements/{ann_id}")
def get_announcement(ann_id: int, db: Session = Depends(get_db)):
    from app.models.platform import PlatformAnnouncement
    row = db.query(PlatformAnnouncement).filter(PlatformAnnouncement.id == ann_id).first()
    if not row:
        raise HTTPException(404, "Announcement no encontrado")
    return _serialize_announcement(row)


@router.put("/announcements/{ann_id}")
def update_announcement(
    ann_id: int,
    body: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    from app.models.platform import PlatformAnnouncement
    from app.services.audit_service import write_audit
    row = db.query(PlatformAnnouncement).filter(PlatformAnnouncement.id == ann_id).first()
    if not row:
        raise HTTPException(404, "Announcement no encontrado")

    if body.title is not None:
        row.title = body.title.strip()
    if body.body_md is not None:
        row.body_md = body.body_md
    if body.severity is not None:
        row.severity = body.severity
    if body.expires_at is not None:
        row.expires_at = body.expires_at
    if body.targets is not None:
        targets_dict = body.targets.model_dump(exclude_none=True)
        targets_dict = {k: v for k, v in targets_dict.items() if v}
        row.targets_json = _json.dumps(targets_dict) if targets_dict else None

    write_audit(
        db, actor_user_id=current_user.id, action="UPDATE_ANNOUNCEMENT",
        entity_type="ANNOUNCEMENT", entity_id=str(row.id),
    )
    db.commit()
    db.refresh(row)
    return _serialize_announcement(row)


@router.post("/announcements/{ann_id}/publish")
def publish_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    from app.models.platform import PlatformAnnouncement
    from app.services.audit_service import write_audit
    row = db.query(PlatformAnnouncement).filter(PlatformAnnouncement.id == ann_id).first()
    if not row:
        raise HTTPException(404, "Announcement no encontrado")
    row.published_at = datetime.now(timezone.utc)
    write_audit(
        db, actor_user_id=current_user.id, action="PUBLISH_ANNOUNCEMENT",
        entity_type="ANNOUNCEMENT", entity_id=str(row.id),
    )
    db.commit()
    db.refresh(row)
    return _serialize_announcement(row)


@router.post("/announcements/{ann_id}/unpublish")
def unpublish_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    from app.models.platform import PlatformAnnouncement
    from app.services.audit_service import write_audit
    row = db.query(PlatformAnnouncement).filter(PlatformAnnouncement.id == ann_id).first()
    if not row:
        raise HTTPException(404, "Announcement no encontrado")
    row.published_at = None
    write_audit(
        db, actor_user_id=current_user.id, action="UNPUBLISH_ANNOUNCEMENT",
        entity_type="ANNOUNCEMENT", entity_id=str(row.id),
    )
    db.commit()
    db.refresh(row)
    return _serialize_announcement(row)


@router.delete("/announcements/{ann_id}")
def delete_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Hard-delete an announcement. SUPERADMIN-only (stricter than other endpoints)."""
    from app.models.platform import PlatformAnnouncement
    from app.services.audit_service import write_audit
    row = db.query(PlatformAnnouncement).filter(PlatformAnnouncement.id == ann_id).first()
    if not row:
        raise HTTPException(404, "Announcement no encontrado")
    title = row.title
    db.delete(row)
    write_audit(
        db, actor_user_id=current_user.id, action="DELETE_ANNOUNCEMENT",
        entity_type="ANNOUNCEMENT", entity_id=str(ann_id),
        meta={"title": title},
    )
    db.commit()
    return {"deleted": True, "id": ann_id}
