"""Feature flags + per-org overrides (Sprint 2 · F1)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, field_validator
import re as _re

from app.core.database import get_db
from app.models.organization import Organization
from app.models.users import User
from app.modules.platform.dependencies import require_platform_admin, require_superadmin

router = APIRouter()


# 16. FEATURE FLAGS · Sprint 2 · F1
# Flag catalog + per-org overrides with deterministic rollout %.
# Resolution priority: override > kill-switch > rollout > default.
# ─────────────────────────────────────────────────────────────────────────────


_FLAG_KEY_RE = _re.compile(r"^[a-z][a-z0-9_]*$")


class FeatureFlagCreate(BaseModel):
    key: str
    description: Optional[str] = None
    default_enabled: bool = False
    rollout_pct: int = 0

    @field_validator("key")
    @classmethod
    def _key(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if not v:
            raise ValueError("key requerido")
        if len(v) > 80:
            raise ValueError("key máx 80 chars")
        if not _FLAG_KEY_RE.match(v):
            raise ValueError("key debe ser snake_case (solo a-z, 0-9, _; empieza con letra)")
        return v

    @field_validator("rollout_pct")
    @classmethod
    def _pct(cls, v: int) -> int:
        if v is None:
            return 0
        if v < 0 or v > 100:
            raise ValueError("rollout_pct debe estar entre 0 y 100")
        return int(v)

    @field_validator("description")
    @classmethod
    def _desc(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) > 1000:
            raise ValueError("description máx 1000 chars")
        return v


class FeatureFlagUpdate(BaseModel):
    description: Optional[str] = None
    default_enabled: Optional[bool] = None
    rollout_pct: Optional[int] = None
    is_killed: Optional[bool] = None

    @field_validator("rollout_pct")
    @classmethod
    def _pct(cls, v):
        if v is None:
            return v
        if v < 0 or v > 100:
            raise ValueError("rollout_pct debe estar entre 0 y 100")
        return int(v)

    @field_validator("description")
    @classmethod
    def _desc(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) > 1000:
            raise ValueError("description máx 1000 chars")
        return v


class FlagOverrideUpsert(BaseModel):
    enabled: bool
    reason: Optional[str] = None

    @field_validator("reason")
    @classmethod
    def _reason(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) > 500:
            raise ValueError("reason máx 500 chars")
        return v


def _serialize_flag(flag, overrides_count: int = 0, enabled_orgs_count: Optional[int] = None) -> dict:
    return {
        "key": flag.key,
        "description": flag.description,
        "default_enabled": bool(flag.default_enabled),
        "rollout_pct": int(flag.rollout_pct or 0),
        "is_killed": bool(flag.is_killed),
        "overrides_count": int(overrides_count),
        "enabled_orgs_count": enabled_orgs_count,
        "created_at": flag.created_at.isoformat() if flag.created_at else None,
        "updated_at": flag.updated_at.isoformat() if flag.updated_at else None,
    }


@router.get("/flags")
def list_feature_flags(db: Session = Depends(get_db)):
    """List all feature flags with override count + resolved-enabled org count."""
    from sqlalchemy import func as _func
    from app.models.platform import FeatureFlag, OrgFeatureOverride
    from app.services.feature_flags import count_enabled_orgs

    flags = db.query(FeatureFlag).order_by(FeatureFlag.key.asc()).all()
    if not flags:
        return []

    keys = [f.key for f in flags]
    counts_rows = (
        db.query(OrgFeatureOverride.flag_key, _func.count(OrgFeatureOverride.id))
        .filter(OrgFeatureOverride.flag_key.in_(keys))
        .group_by(OrgFeatureOverride.flag_key)
        .all()
    )
    counts_map: dict[str, int] = {k: int(n) for k, n in counts_rows}

    # Pre-load org ids once so we don't re-query per flag.
    org_ids = [row[0] for row in db.query(Organization.id).all()]

    out = []
    for f in flags:
        resolved_on = count_enabled_orgs(f.key, db, org_ids=org_ids)
        out.append(_serialize_flag(f, overrides_count=counts_map.get(f.key, 0),
                                   enabled_orgs_count=resolved_on))
    return out


@router.post("/flags", status_code=status.HTTP_201_CREATED)
def create_feature_flag(
    body: FeatureFlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Register a new flag in the global catalog."""
    from app.models.platform import FeatureFlag
    from app.services.audit_service import write_audit

    existing = db.query(FeatureFlag).filter(FeatureFlag.key == body.key).first()
    if existing:
        raise HTTPException(409, f"El flag '{body.key}' ya existe")

    row = FeatureFlag(
        key=body.key,
        description=body.description,
        default_enabled=bool(body.default_enabled),
        rollout_pct=int(body.rollout_pct),
        is_killed=False,
    )
    db.add(row)
    db.flush()
    write_audit(
        db, actor_user_id=current_user.id, action="CREATE_FLAG",
        entity_type="FEATURE_FLAG", entity_id=row.key,
        meta={
            "key": row.key,
            "default_enabled": bool(row.default_enabled),
            "rollout_pct": int(row.rollout_pct),
        },
    )
    db.commit()
    db.refresh(row)
    return _serialize_flag(row)


@router.patch("/flags/{key}")
def update_feature_flag(
    key: str,
    body: FeatureFlagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Update description / default / rollout / kill-switch with a diff audit."""
    from app.models.platform import FeatureFlag
    from app.services.audit_service import write_audit

    row = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    if not row:
        raise HTTPException(404, f"Flag '{key}' no encontrado")

    before = {
        "description": row.description,
        "default_enabled": bool(row.default_enabled),
        "rollout_pct": int(row.rollout_pct or 0),
        "is_killed": bool(row.is_killed),
    }
    patch = body.model_dump(exclude_unset=True)
    changed: dict[str, dict] = {}
    for field, new_value in patch.items():
        if field not in before:
            continue
        old_value = before[field]
        if old_value != new_value:
            setattr(row, field, new_value)
            changed[field] = {"from": old_value, "to": new_value}

    if changed:
        write_audit(
            db, actor_user_id=current_user.id, action="UPDATE_FLAG",
            entity_type="FEATURE_FLAG", entity_id=row.key,
            meta={"key": row.key, "diff": changed},
        )
    db.commit()
    db.refresh(row)
    return _serialize_flag(row)


@router.delete("/flags/{key}")
def delete_feature_flag(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    """Hard-delete a flag and cascade-delete its overrides. SUPERADMIN only."""
    from app.models.platform import FeatureFlag, OrgFeatureOverride
    from app.services.audit_service import write_audit

    row = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    if not row:
        raise HTTPException(404, f"Flag '{key}' no encontrado")

    overrides_deleted = (
        db.query(OrgFeatureOverride)
        .filter(OrgFeatureOverride.flag_key == key)
        .delete(synchronize_session=False)
    )
    db.delete(row)
    write_audit(
        db, actor_user_id=current_user.id, action="DELETE_FLAG",
        entity_type="FEATURE_FLAG", entity_id=key,
        meta={"key": key, "overrides_deleted": int(overrides_deleted)},
    )
    db.commit()
    return {"deleted": True, "key": key, "overrides_deleted": int(overrides_deleted)}


@router.get("/flags/resolved")
def resolve_all_flags(
    org_id: int = Query(..., description="Organization id to resolve for"),
    db: Session = Depends(get_db),
):
    """Return `{flag_key: bool}` for every flag in the catalog, resolved for `org_id`."""
    from app.services.feature_flags import resolve_all_for_org

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(404, f"Org {org_id} no encontrada")
    return resolve_all_for_org(org_id, db)


@router.get("/flags/{key}/preview")
def preview_feature_flag(
    key: str,
    org_id: int = Query(..., description="Organization id to resolve for"),
    db: Session = Depends(get_db),
):
    """Explain why a flag currently resolves on/off for a given org."""
    from app.models.platform import FeatureFlag
    from app.services.feature_flags import explain_flag

    flag = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    if not flag:
        raise HTTPException(404, f"Flag '{key}' no encontrado")
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(404, f"Org {org_id} no encontrada")

    decision = explain_flag(key, org_id, db)
    return {
        "flag_key": key,
        "organization_id": org_id,
        "organization_name": org.name,
        "resolved": decision["resolved"],
        "source": decision["source"],
        "reason": decision["reason"],
    }


@router.get("/flags/{key}/overrides")
def list_flag_overrides(key: str, db: Session = Depends(get_db)):
    """List explicit overrides for a flag joined with org name."""
    from app.models.platform import FeatureFlag, OrgFeatureOverride

    flag = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    if not flag:
        raise HTTPException(404, f"Flag '{key}' no encontrado")

    rows = (
        db.query(OrgFeatureOverride, Organization.name)
        .outerjoin(Organization, Organization.id == OrgFeatureOverride.organization_id)
        .filter(OrgFeatureOverride.flag_key == key)
        .order_by(Organization.name.asc())
        .all()
    )
    return [
        {
            "id": ov.id,
            "organization_id": ov.organization_id,
            "organization_name": org_name,
            "flag_key": ov.flag_key,
            "enabled": bool(ov.enabled),
            "reason": ov.reason,
            "created_at": ov.created_at.isoformat() if ov.created_at else None,
            "created_by": ov.created_by,
        }
        for ov, org_name in rows
    ]


@router.put("/flags/{key}/overrides/{org_id}")
def upsert_flag_override(
    key: str,
    org_id: int,
    body: FlagOverrideUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Create or update an explicit override for (flag, org)."""
    from app.models.platform import FeatureFlag, OrgFeatureOverride
    from app.services.audit_service import write_audit

    flag = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    if not flag:
        raise HTTPException(404, f"Flag '{key}' no encontrado")
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(404, f"Org {org_id} no encontrada")

    row = (
        db.query(OrgFeatureOverride)
        .filter(
            OrgFeatureOverride.flag_key == key,
            OrgFeatureOverride.organization_id == org_id,
        )
        .first()
    )
    before = None
    if row is None:
        row = OrgFeatureOverride(
            organization_id=org_id,
            flag_key=key,
            enabled=bool(body.enabled),
            reason=body.reason,
            created_by=current_user.id,
        )
        db.add(row)
        action = "SET_FLAG_OVERRIDE"
    else:
        before = {"enabled": bool(row.enabled), "reason": row.reason}
        row.enabled = bool(body.enabled)
        row.reason = body.reason
        row.created_by = current_user.id
        action = "UPDATE_FLAG_OVERRIDE"

    db.flush()
    write_audit(
        db, actor_user_id=current_user.id, action=action,
        entity_type="FEATURE_FLAG_OVERRIDE", entity_id=f"{key}:{org_id}",
        organization_id=org_id,
        meta={
            "flag_key": key,
            "organization_id": org_id,
            "enabled": bool(body.enabled),
            "reason": body.reason,
            "before": before,
        },
    )
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "organization_name": org.name,
        "flag_key": row.flag_key,
        "enabled": bool(row.enabled),
        "reason": row.reason,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "created_by": row.created_by,
    }


@router.delete("/flags/{key}/overrides/{org_id}")
def delete_flag_override(
    key: str,
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Remove an override — flag falls back to kill/rollout/default."""
    from app.models.platform import OrgFeatureOverride
    from app.services.audit_service import write_audit

    row = (
        db.query(OrgFeatureOverride)
        .filter(
            OrgFeatureOverride.flag_key == key,
            OrgFeatureOverride.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(404, "Override no encontrado")

    prior = {"enabled": bool(row.enabled), "reason": row.reason}
    db.delete(row)
    write_audit(
        db, actor_user_id=current_user.id, action="DELETE_FLAG_OVERRIDE",
        entity_type="FEATURE_FLAG_OVERRIDE", entity_id=f"{key}:{org_id}",
        organization_id=org_id,
        meta={"flag_key": key, "organization_id": org_id, "prior": prior},
    )
    db.commit()
    return {"deleted": True, "flag_key": key, "organization_id": org_id}
