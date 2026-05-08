"""
Feature flag resolver (Sprint 2 · F1).

Deterministic resolution for a (flag_key, org_id) pair using this priority:

  1. Explicit override row in `org_feature_override` (highest priority)
  2. Kill-switch — `is_killed=True` forces the flag off globally
  3. Rollout bucket — `rollout_pct` vs deterministic hash of (org_id, flag_key)
  4. Default — `default_enabled`

`hash()` in Python is NOT stable across interpreter runs; we use `zlib.crc32`
so the same (org, flag) pair always lands in the same bucket until
`rollout_pct` is bumped, then new orgs enter the rollout monotonically.
"""
from __future__ import annotations

import zlib
from typing import Literal, Optional, TypedDict

from sqlalchemy.orm import Session


FlagSource = Literal["override", "killed", "rollout", "default"]


class FlagDecision(TypedDict):
    resolved: bool
    source: FlagSource
    reason: str


def _bucket(org_id: int, flag_key: str) -> int:
    """Deterministic 0..99 bucket for (org_id, flag_key). Stable across processes."""
    token = f"{org_id}:{flag_key}".encode("utf-8")
    return zlib.crc32(token) % 100


def explain_flag(
    flag_key: str,
    org_id: int,
    db: Session,
) -> FlagDecision:
    """Resolve a flag for an org and return the decision plus audit-quality reason."""
    # Lazy import to avoid a circular at module load time.
    from app.models.platform import FeatureFlag, OrgFeatureOverride

    flag = db.query(FeatureFlag).filter(FeatureFlag.key == flag_key).first()
    if not flag:
        return {
            "resolved": False,
            "source": "default",
            "reason": f"flag '{flag_key}' does not exist — defaulting to off",
        }

    override = (
        db.query(OrgFeatureOverride)
        .filter(
            OrgFeatureOverride.organization_id == org_id,
            OrgFeatureOverride.flag_key == flag_key,
        )
        .first()
    )
    if override is not None:
        return {
            "resolved": bool(override.enabled),
            "source": "override",
            "reason": (override.reason or f"explicit override for org {org_id}"),
        }

    if bool(flag.is_killed):
        return {
            "resolved": False,
            "source": "killed",
            "reason": "kill-switch active — flag is force-off globally",
        }

    pct = int(flag.rollout_pct or 0)
    if pct >= 100:
        return {
            "resolved": True,
            "source": "rollout",
            "reason": "rollout_pct=100 — on for all orgs",
        }
    if pct > 0:
        bucket = _bucket(org_id, flag_key)
        if bucket < pct:
            return {
                "resolved": True,
                "source": "rollout",
                "reason": f"rollout bucket {bucket} < rollout_pct {pct}",
            }
        return {
            "resolved": bool(flag.default_enabled),
            "source": "default" if flag.default_enabled else "rollout",
            "reason": (
                f"rollout bucket {bucket} >= rollout_pct {pct} — "
                f"falling back to default_enabled={bool(flag.default_enabled)}"
            ),
        }

    return {
        "resolved": bool(flag.default_enabled),
        "source": "default",
        "reason": f"default_enabled={bool(flag.default_enabled)} (no rollout, no override)",
    }


def resolve_flag(flag_key: str, org_id: int, db: Session) -> bool:
    """Return the boolean resolution of a flag for an org."""
    return explain_flag(flag_key, org_id, db)["resolved"]


def resolve_all_for_org(org_id: int, db: Session) -> dict[str, bool]:
    """Resolve every flag in the catalog for a given org."""
    from app.models.platform import FeatureFlag

    out: dict[str, bool] = {}
    for flag in db.query(FeatureFlag).all():
        out[flag.key] = resolve_flag(flag.key, org_id, db)
    return out


def count_enabled_orgs(flag_key: str, db: Session, org_ids: Optional[list[int]] = None) -> int:
    """How many orgs currently resolve this flag to True.

    If `org_ids` is omitted, scans every organization in the table.
    """
    from app.models.organization import Organization

    if org_ids is None:
        org_ids = [row[0] for row in db.query(Organization.id).all()]
    n = 0
    for oid in org_ids:
        if resolve_flag(flag_key, oid, db):
            n += 1
    return n
