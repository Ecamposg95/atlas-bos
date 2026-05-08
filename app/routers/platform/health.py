"""Cross-tenant health matrix (Sprint 1 · A2)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from app.database import get_db
from app.models.organization import Organization
from app.models.users import UserOrganization

router = APIRouter()


# --- 14. HEALTH MATRIX (Sprint 1 · A2) ---

@router.get("/health/matrix")
def get_health_matrix(db: Session = Depends(get_db)):
    """Cross-tenant health snapshot, one row per active organization.

    All aggregates are computed with GROUP BY queries to avoid N+1 — each
    metric touches the DB at most once regardless of how many orgs exist.
    """
    from sqlalchemy import func, case, distinct
    from datetime import timedelta
    from app.models.organization import Branch
    from app.models.sales import SalesDocument, DocumentStatus
    from app.models.modules import Module, OrganizationModule

    now = datetime.utcnow()
    last_7d = now - timedelta(days=7)
    last_30d = now - timedelta(days=30)

    # Active orgs (is_active=True)
    orgs = (
        db.query(Organization)
        .filter(Organization.is_active.is_(True))
        .order_by(Organization.id.asc())
        .all()
    )
    if not orgs:
        return []

    org_ids = [o.id for o in orgs]

    # --- Sales aggregates: last_sale, 7d count+revenue, 30d count+revenue,
    # distinct active users last 7d. Single GROUP BY per metric.
    sales_agg = dict(
        (r.organization_id, r) for r in db.query(
            SalesDocument.organization_id.label("organization_id"),
            func.max(SalesDocument.created_at).label("last_sale_at"),
            func.count(case((SalesDocument.created_at >= last_7d, 1))).label("count_7d"),
            func.count(case((SalesDocument.created_at >= last_30d, 1))).label("count_30d"),
            func.coalesce(
                func.sum(case((SalesDocument.created_at >= last_7d, SalesDocument.total_amount))),
                0,
            ).label("revenue_7d"),
            func.coalesce(
                func.sum(case((SalesDocument.created_at >= last_30d, SalesDocument.total_amount))),
                0,
            ).label("revenue_30d"),
        )
        .filter(
            SalesDocument.organization_id.in_(org_ids),
            SalesDocument.status != DocumentStatus.CANCELLED,
        )
        .group_by(SalesDocument.organization_id)
        .all()
    )

    # Distinct active users in last 7d — separate query, per-org distinct count.
    active_users_rows = (
        db.query(
            SalesDocument.organization_id.label("organization_id"),
            func.count(distinct(SalesDocument.seller_id)).label("active_users_7d"),
        )
        .filter(
            SalesDocument.organization_id.in_(org_ids),
            SalesDocument.created_at >= last_7d,
            SalesDocument.status != DocumentStatus.CANCELLED,
        )
        .group_by(SalesDocument.organization_id)
        .all()
    )
    active_users_map = {r.organization_id: int(r.active_users_7d or 0) for r in active_users_rows}

    # Total users per org (via UserOrganization)
    users_rows = (
        db.query(
            UserOrganization.organization_id.label("organization_id"),
            func.count(UserOrganization.user_id).label("total_users"),
        )
        .filter(UserOrganization.organization_id.in_(org_ids))
        .group_by(UserOrganization.organization_id)
        .all()
    )
    users_map = {r.organization_id: int(r.total_users or 0) for r in users_rows}

    # Total branches per org
    branches_rows = (
        db.query(
            Branch.organization_id.label("organization_id"),
            func.count(Branch.id).label("total_branches"),
        )
        .filter(
            Branch.organization_id.in_(org_ids),
            Branch.is_active.is_(True),
        )
        .group_by(Branch.organization_id)
        .all()
    )
    branches_map = {r.organization_id: int(r.total_branches or 0) for r in branches_rows}

    # Modules enabled per org
    modules_rows = (
        db.query(
            OrganizationModule.organization_id.label("organization_id"),
            func.count(OrganizationModule.module_key).label("modules_enabled"),
        )
        .filter(
            OrganizationModule.organization_id.in_(org_ids),
            OrganizationModule.is_enabled.is_(True),
        )
        .group_by(OrganizationModule.organization_id)
        .all()
    )
    modules_map = {r.organization_id: int(r.modules_enabled or 0) for r in modules_rows}

    # Global module catalog size (same for every org)
    modules_total = db.query(func.count(Module.key)).scalar() or 0

    # --- Build response rows ---
    out: List[dict] = []
    for org in orgs:
        sa = sales_agg.get(org.id)
        last_sale_at = getattr(sa, "last_sale_at", None) if sa else None
        count_7d = int(getattr(sa, "count_7d", 0) or 0) if sa else 0
        count_30d = int(getattr(sa, "count_30d", 0) or 0) if sa else 0
        revenue_7d = float(getattr(sa, "revenue_7d", 0) or 0) if sa else 0.0
        revenue_30d = float(getattr(sa, "revenue_30d", 0) or 0) if sa else 0.0

        if last_sale_at is not None:
            try:
                delta = now - last_sale_at.replace(tzinfo=None) if last_sale_at.tzinfo else now - last_sale_at
                days_since_last_sale = max(0, int(delta.total_seconds() // 86400))
            except Exception:
                days_since_last_sale = None
        else:
            days_since_last_sale = None

        active_users_7d = active_users_map.get(org.id, 0)
        total_users = users_map.get(org.id, 0)
        total_branches = branches_map.get(org.id, 0)
        modules_enabled = modules_map.get(org.id, 0)
        modules_ratio = (modules_enabled / modules_total) if modules_total > 0 else 0

        # --- Health score heuristic ---
        score = 0
        if days_since_last_sale is not None and days_since_last_sale < 2:
            score += 40
        elif days_since_last_sale is not None and days_since_last_sale < 7:
            score += 20
        elif days_since_last_sale is not None and days_since_last_sale < 30:
            score += 10
        if count_7d > 0:
            score += 20
        if active_users_7d >= 2:
            score += 20
        elif active_users_7d >= 1:
            score += 10
        if modules_ratio >= 0.3:
            score += 10
        if org.is_active:
            score += 10
        score = max(0, min(100, score))

        industry_value = org.industry_type.value if hasattr(org.industry_type, "value") else (org.industry_type or None)

        # Last-sale ISO string with UTC hint for frontend parsing.
        if last_sale_at is not None:
            if last_sale_at.tzinfo is None:
                last_sale_iso = last_sale_at.replace(tzinfo=timezone.utc).isoformat()
            else:
                last_sale_iso = last_sale_at.astimezone(timezone.utc).isoformat()
        else:
            last_sale_iso = None

        out.append({
            "organization_id": org.id,
            "name": org.name,
            "industry_type": industry_value,
            "is_active": bool(org.is_active),
            "last_sale_at": last_sale_iso,
            "days_since_last_sale": days_since_last_sale,
            "sales_count_7d": count_7d,
            "sales_count_30d": count_30d,
            "revenue_7d": revenue_7d,
            "revenue_30d": revenue_30d,
            "active_users_7d": active_users_7d,
            "total_users": total_users,
            "total_branches": total_branches,
            "modules_enabled": modules_enabled,
            "modules_total": int(modules_total),
            "errors_24h": 0,
            "health_score": score,
        })

    return out
