"""Incident mode (Sprint 2 · D3): kill-switch with snapshot/restore."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, field_validator
import json as _json
from datetime import datetime, timezone

from app.database import get_db
from app.models.organization import Organization
from app.models.users import User, PlatformRole
from app.security import require_platform_admin

from ._shared import _audit

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# 16. INCIDENT MODE · Sprint 2 · D3
# Kill-switch temporal que suspende orgs por scope (industry / plan /
# org_ids / all). Guarda un snapshot del estado previo para restaurar en
# un click. Solo SUPERADMIN puede iniciar o resolver un incidente.
# ─────────────────────────────────────────────────────────────────────────────


class IncidentCreate(BaseModel):
    title: str
    reason: Optional[str] = None
    scope_type: str
    scope_value: Optional[str] = None
    banner_html: Optional[str] = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("title requerido")
        if len(v) > 200:
            raise ValueError("title máx 200 chars")
        return v

    @field_validator("reason")
    @classmethod
    def _reason(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) < 10:
            raise ValueError("reason debe tener al menos 10 caracteres")
        return v

    @field_validator("scope_type")
    @classmethod
    def _scope(cls, v: str) -> str:
        if v not in ("industry", "plan", "org_ids", "all"):
            raise ValueError("scope_type debe ser industry|plan|org_ids|all")
        return v


def _resolve_incident_scope(
    db: Session, scope_type: str, scope_value: Optional[str]
) -> list[Organization]:
    """Resolve the scope of an incident to a list of Organization rows.

    Only ACTIVE orgs are returned — already-suspended orgs are not touched
    by an incident (they would produce a no-op in `affected_org_snapshot`).
    """
    q = db.query(Organization).filter(Organization.is_active.is_(True))
    if scope_type == "all":
        return q.all()
    if scope_type == "industry":
        if not scope_value:
            raise HTTPException(400, "scope_value requerido para industry")
        return q.filter(Organization.industry_type == scope_value).all()
    if scope_type == "plan":
        if not scope_value:
            raise HTTPException(400, "scope_value requerido para plan")
        return q.filter(Organization.plan == scope_value).all()
    if scope_type == "org_ids":
        if not scope_value:
            raise HTTPException(400, "scope_value requerido para org_ids")
        try:
            ids = [int(x.strip()) for x in scope_value.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(400, "scope_value debe ser lista de enteros separados por coma")
        if not ids:
            raise HTTPException(400, "scope_value no contiene ids válidos")
        return q.filter(Organization.id.in_(ids)).all()
    raise HTTPException(400, f"scope_type desconocido: {scope_type}")


def _serialize_incident(row, affected: Optional[List[dict]] = None) -> dict:
    snapshot = None
    if row.affected_org_snapshot:
        try:
            snapshot = _json.loads(row.affected_org_snapshot)
        except Exception:
            snapshot = None
    affected_count = len(snapshot) if isinstance(snapshot, list) else 0
    return {
        "id": row.id,
        "title": row.title,
        "reason": row.reason,
        "scope_type": row.scope_type,
        "scope_value": row.scope_value,
        "banner_html": row.banner_html,
        "started_at": row.started_at.isoformat() if row.started_at else None,
        "started_by": row.started_by,
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
        "resolved_by": row.resolved_by,
        "affected_count": affected_count,
        "affected_snapshot": snapshot,
        "affected": affected,
        "is_active": row.resolved_at is None,
    }


@router.get("/incidents")
def list_incidents(
    status: Optional[str] = Query("active", description="active|resolved|all"),
    db: Session = Depends(get_db),
):
    """List incidents. Default shows active first, most recent."""
    from app.models.platform import PlatformIncident
    q = db.query(PlatformIncident)
    status_val = (status or "active").lower()
    if status_val == "active":
        q = q.filter(PlatformIncident.resolved_at.is_(None))
    elif status_val == "resolved":
        q = q.filter(PlatformIncident.resolved_at.isnot(None))
    # "all" → no filter
    rows = q.order_by(
        PlatformIncident.resolved_at.is_(None).desc(),
        PlatformIncident.started_at.desc(),
    ).all()
    return [_serialize_incident(r) for r in rows]


@router.post("/incidents", status_code=status.HTTP_201_CREATED)
def create_incident(
    body: IncidentCreate,
    force: bool = Query(False, description="Required when scope=all and >100 orgs affected"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Start a new incident: suspend orgs matching the scope and record a
    snapshot of their previous state so resolution can restore it.

    SUPERADMIN-only (extra check on top of router-level platform_admin)."""
    from app.models.platform import PlatformIncident
    if getattr(current_user, "platform_role", None) != PlatformRole.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede iniciar un incidente")

    orgs = _resolve_incident_scope(db, body.scope_type, body.scope_value)

    # Safety: refuse massive `all` scope without explicit confirmation.
    if body.scope_type == "all" and len(orgs) > 100 and not force:
        raise HTTPException(
            400,
            f"Scope `all` afectaría {len(orgs)} orgs activas. Repite con ?force=true para confirmar.",
        )

    # Build snapshot + flip orgs that are currently active.
    snapshot: list[dict] = []
    for org in orgs:
        was_active = bool(org.is_active)
        was_status = org.status or "ACTIVE"
        if was_active:  # only flip if currently active — don't touch already-suspended
            org.is_active = False
            org.status = "SUSPENDED"
            snapshot.append({
                "id": org.id,
                "name": org.name,
                "was_active": was_active,
                "was_status": was_status,
            })

    row = PlatformIncident(
        title=body.title,
        reason=body.reason,
        scope_type=body.scope_type,
        scope_value=body.scope_value,
        banner_html=body.banner_html,
        started_by=current_user.id,
        affected_org_snapshot=_json.dumps(snapshot) if snapshot else _json.dumps([]),
    )
    db.add(row)
    db.flush()

    _audit(
        db, current_user.id, "INCIDENT_START", "INCIDENT", row.id,
        _json.dumps({
            "title": row.title,
            "scope_type": row.scope_type,
            "scope_value": row.scope_value,
            "affected_count": len(snapshot),
        }),
    )
    db.commit()
    db.refresh(row)

    affected = [{"id": s["id"], "name": s["name"]} for s in snapshot]
    return _serialize_incident(row, affected=affected)


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Detail view with full snapshot + joined org names (current)."""
    from app.models.platform import PlatformIncident
    row = db.query(PlatformIncident).filter(PlatformIncident.id == incident_id).first()
    if not row:
        raise HTTPException(404, "Incident no encontrado")

    affected: list[dict] = []
    if row.affected_org_snapshot:
        try:
            snapshot = _json.loads(row.affected_org_snapshot) or []
        except Exception:
            snapshot = []
        ids = [int(s["id"]) for s in snapshot if isinstance(s, dict) and s.get("id") is not None]
        current_map: dict[int, Organization] = {}
        if ids:
            current_map = {
                o.id: o for o in db.query(Organization).filter(Organization.id.in_(ids)).all()
            }
        for entry in snapshot:
            oid = int(entry.get("id"))
            current_org = current_map.get(oid)
            affected.append({
                "id": oid,
                "name": (current_org.name if current_org else entry.get("name") or f"Org #{oid}"),
                "was_active": bool(entry.get("was_active")),
                "was_status": entry.get("was_status") or "ACTIVE",
                "current_status": (current_org.status if current_org else None),
                "current_is_active": (bool(current_org.is_active) if current_org else None),
            })

    return _serialize_incident(row, affected=affected)


@router.post("/incidents/{incident_id}/resolve")
def resolve_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Resolve an incident: restore the is_active/status of each org in the
    snapshot, but only if it is still SUSPENDED (skip orgs that were
    re-activated manually by another admin).

    SUPERADMIN-only."""
    from app.models.platform import PlatformIncident
    if getattr(current_user, "platform_role", None) != PlatformRole.SUPERADMIN:
        raise HTTPException(403, "Solo SUPERADMIN puede resolver un incidente")

    row = db.query(PlatformIncident).filter(PlatformIncident.id == incident_id).first()
    if not row:
        raise HTTPException(404, "Incident no encontrado")
    if row.resolved_at is not None:
        raise HTTPException(400, "Este incidente ya está resuelto")

    snapshot: list[dict] = []
    if row.affected_org_snapshot:
        try:
            snapshot = _json.loads(row.affected_org_snapshot) or []
        except Exception:
            snapshot = []

    ids = [int(s["id"]) for s in snapshot if isinstance(s, dict) and s.get("id") is not None]
    orgs_by_id: dict[int, Organization] = {}
    if ids:
        orgs_by_id = {
            o.id: o for o in db.query(Organization).filter(Organization.id.in_(ids)).all()
        }

    restored = 0
    skipped = 0
    for entry in snapshot:
        try:
            oid = int(entry.get("id"))
        except (TypeError, ValueError):
            continue
        org = orgs_by_id.get(oid)
        if not org:
            skipped += 1
            continue
        # Only restore if org is currently SUSPENDED and inactive — if another
        # admin already toggled it back, leave as-is.
        if (org.status or "ACTIVE") != "SUSPENDED" or bool(org.is_active):
            skipped += 1
            continue
        org.is_active = bool(entry.get("was_active", True))
        org.status = entry.get("was_status") or "ACTIVE"
        restored += 1

    row.resolved_at = datetime.now(timezone.utc)
    row.resolved_by = current_user.id

    _audit(
        db, current_user.id, "INCIDENT_RESOLVE", "INCIDENT", row.id,
        _json.dumps({
            "title": row.title,
            "restored": restored,
            "skipped": skipped,
        }),
    )
    db.commit()
    db.refresh(row)
    return {"id": row.id, "restored": restored, "skipped": skipped,
            "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None}
