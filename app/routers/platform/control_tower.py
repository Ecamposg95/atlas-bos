"""Platform Control Tower endpoints (`/control-tower/*`).

Real-time, cross-tenant operational dashboard for SUPERADMIN/SUPPORT.
All endpoints are read-only and cached in-process (TTL pattern from
``stats.py`` / ``reports.py``).

Auth is enforced at the package level via ``require_platform_admin``
in ``app/routers/platform/__init__.py`` — no per-endpoint check.
"""

import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, cast, Date, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import (
    Branch,
    CashSession,
    CashSessionStatus,
    DocumentStatus,
    Organization,
    SalesDocument,
    User,
)
from app.models.platform import PlatformAlert, PlatformIncident

router = APIRouter()


# ------------------------------------------------------------------ #
# In-process TTL cache (mirror of stats.py / reports.py pattern)     #
# ------------------------------------------------------------------ #

_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str, fn: Callable[[], Any], ttl_seconds: int) -> Any:
    now = time.time()
    cached = _cache.get(key)
    if cached and (now - cached[0]) < ttl_seconds:
        return cached[1]
    result = fn()
    _cache[key] = (now, result)
    return result


# ================================================================== #
# 1. SALES NOW — last 6h bucketed by hour                            #
# ================================================================== #


@router.get("/control-tower/sales-now")
def sales_now(db: Session = Depends(get_db)):
    """Cross-tenant revenue + count bucketed by hour for the last 6h.

    Always returns exactly 6 buckets (oldest to newest); empty hours
    are filled with zeros so the chart never collapses.
    """

    def _run():
        now_utc = datetime.now(timezone.utc)
        # Anchor each bucket at the top of the hour.
        current_hour = now_utc.replace(minute=0, second=0, microsecond=0)
        start = current_hour - timedelta(hours=5)  # 6 buckets total: -5h..0h

        rows = (
            db.query(
                func.date_trunc("hour", SalesDocument.created_at).label("hour"),
                func.coalesce(func.sum(SalesDocument.total_amount), 0).label("revenue"),
                func.count(SalesDocument.id).label("count"),
            )
            .filter(
                SalesDocument.created_at >= start,
                SalesDocument.status != DocumentStatus.CANCELLED,
            )
            .group_by("hour")
            .order_by("hour")
            .all()
        )

        # Build a lookup keyed by (year, month, day, hour) UTC tuple.
        by_hour: dict[tuple, tuple[float, int]] = {}
        for r in rows:
            h = r.hour
            if h is None:
                continue
            # Ensure tz-aware comparison.
            if h.tzinfo is None:
                h = h.replace(tzinfo=timezone.utc)
            key = (h.year, h.month, h.day, h.hour)
            by_hour[key] = (float(r.revenue or 0), int(r.count or 0))

        buckets = []
        total_revenue = 0.0
        total_count = 0
        cur = start
        for _ in range(6):
            key = (cur.year, cur.month, cur.day, cur.hour)
            rev, cnt = by_hour.get(key, (0.0, 0))
            buckets.append(
                {
                    "hour": cur.strftime("%H:00"),
                    "revenue": rev,
                    "count": cnt,
                }
            )
            total_revenue += rev
            total_count += cnt
            cur = cur + timedelta(hours=1)

        return {
            "buckets": buckets,
            "total_revenue": total_revenue,
            "total_count": total_count,
            "window_hours": 6,
        }

    return _cached("sales_now", _run, 30)


# ================================================================== #
# 2. ACTIVE SESSIONS — open cash sessions cross-tenant                #
# ================================================================== #


@router.get("/control-tower/active-sessions")
def active_sessions(db: Session = Depends(get_db)):
    """Counts and lists OPEN cash sessions cross-tenant (first 20)."""

    def _run():
        count = (
            db.query(func.count(CashSession.id))
            .filter(CashSession.status == CashSessionStatus.OPEN)
            .scalar()
        ) or 0

        rows = (
            db.query(
                CashSession.id.label("id"),
                CashSession.branch_id.label("branch_id"),
                CashSession.organization_id.label("organization_id"),
                Organization.name.label("org_name"),
                CashSession.opened_at.label("opened_at"),
            )
            .join(Organization, Organization.id == CashSession.organization_id)
            .filter(CashSession.status == CashSessionStatus.OPEN)
            .order_by(CashSession.opened_at.desc())
            .limit(20)
            .all()
        )

        sessions = [
            {
                "id": r.id,
                "branch_id": r.branch_id,
                "organization_id": r.organization_id,
                "org_name": r.org_name,
                "opened_at": r.opened_at.isoformat() if r.opened_at else None,
            }
            for r in rows
        ]

        return {"count": int(count), "sessions": sessions}

    return _cached("active_sessions", _run, 30)


# ================================================================== #
# 3. DELTAS — period-over-period for revenue/orgs/branches/alerts    #
# ================================================================== #


_DELTA_PERIODS = {"daily": 1, "weekly": 7, "monthly": 30}


def _pct_delta(current: float, prior: float) -> Optional[float]:
    if prior is None or prior == 0:
        return None
    return round((current - prior) / prior * 100.0, 2)


@router.get("/control-tower/deltas")
def deltas(
    period: str = Query("daily"),
    db: Session = Depends(get_db),
):
    """Four KPIs (revenue, new_orgs, new_branches, critical_alerts) with
    period-over-period deltas, plus a 7-day daily revenue sparkline."""
    if period not in _DELTA_PERIODS:
        raise HTTPException(422, f"period inválido: {period}. Permitidos: daily|weekly|monthly")

    def _run():
        period_days = _DELTA_PERIODS[period]
        now_utc = datetime.now(timezone.utc)
        current_start = now_utc - timedelta(days=period_days)
        prior_start = now_utc - timedelta(days=2 * period_days)
        prior_end = current_start

        # --- revenue ---
        cur_rev = float(
            db.query(func.coalesce(func.sum(SalesDocument.total_amount), 0))
            .filter(
                SalesDocument.created_at >= current_start,
                SalesDocument.created_at <= now_utc,
                SalesDocument.status != DocumentStatus.CANCELLED,
            )
            .scalar()
            or 0
        )
        prior_rev = float(
            db.query(func.coalesce(func.sum(SalesDocument.total_amount), 0))
            .filter(
                SalesDocument.created_at >= prior_start,
                SalesDocument.created_at < prior_end,
                SalesDocument.status != DocumentStatus.CANCELLED,
            )
            .scalar()
            or 0
        )

        # --- new orgs ---
        cur_orgs = (
            db.query(func.count(Organization.id))
            .filter(Organization.created_at >= current_start)
            .scalar()
        ) or 0
        prior_orgs = (
            db.query(func.count(Organization.id))
            .filter(
                Organization.created_at >= prior_start,
                Organization.created_at < prior_end,
            )
            .scalar()
        ) or 0

        # --- new branches ---
        # NOTE: Branch model does not have a `created_at` column (only the
        # TenantMixin, no AuditMixin). We cannot compute delta-of-new-branches
        # without one. Returning zeros for both windows so the widget renders
        # "+0 / 0%" instead of crashing the whole deltas endpoint with a 500.
        # TODO: add `created_at` to Branch via a non-disruptive migration and
        # restore the real query (see TenantMixin / AuditMixin patterns in
        # app/models/mixins.py).
        cur_branches = 0
        prior_branches = 0

        # --- critical alerts (open) ---
        cur_alerts = (
            db.query(func.count(PlatformAlert.id))
            .filter(
                PlatformAlert.severity == "critical",
                PlatformAlert.resolved_at.is_(None),
                PlatformAlert.first_seen >= current_start,
            )
            .scalar()
        ) or 0
        prior_alerts = (
            db.query(func.count(PlatformAlert.id))
            .filter(
                PlatformAlert.severity == "critical",
                PlatformAlert.first_seen >= prior_start,
                PlatformAlert.first_seen < prior_end,
            )
            .scalar()
        ) or 0

        items = [
            {
                "key": "revenue",
                "current": cur_rev,
                "prior": prior_rev,
                "delta_abs": cur_rev - prior_rev,
                "delta_pct": _pct_delta(cur_rev, prior_rev),
            },
            {
                "key": "new_orgs",
                "current": int(cur_orgs),
                "prior": int(prior_orgs),
                "delta_abs": int(cur_orgs) - int(prior_orgs),
                "delta_pct": _pct_delta(float(cur_orgs), float(prior_orgs)),
            },
            {
                "key": "new_branches",
                "current": int(cur_branches),
                "prior": int(prior_branches),
                "delta_abs": int(cur_branches) - int(prior_branches),
                "delta_pct": _pct_delta(float(cur_branches), float(prior_branches)),
            },
            {
                "key": "critical_alerts",
                "current": int(cur_alerts),
                "prior": int(prior_alerts),
                "delta_abs": int(cur_alerts) - int(prior_alerts),
                "delta_pct": _pct_delta(float(cur_alerts), float(prior_alerts)),
            },
        ]

        # --- 7-day daily revenue sparkline ---
        spark_start = now_utc - timedelta(days=7)
        spark_rows = (
            db.query(
                cast(SalesDocument.created_at, Date).label("d"),
                func.coalesce(func.sum(SalesDocument.total_amount), 0).label("rev"),
            )
            .filter(
                SalesDocument.created_at >= spark_start,
                SalesDocument.created_at <= now_utc,
                SalesDocument.status != DocumentStatus.CANCELLED,
            )
            .group_by("d")
            .all()
        )
        spark_map = {str(r.d): float(r.rev or 0) for r in spark_rows}

        sparkline = []
        cur_d = spark_start.date()
        for _ in range(7):
            sparkline.append(
                {
                    "date": str(cur_d),
                    "revenue": spark_map.get(str(cur_d), 0.0),
                }
            )
            cur_d = cur_d + timedelta(days=1)

        return {
            "period": period,
            "items": items,
            "sparkline": sparkline,
        }

    return _cached(f"deltas:{period}", _run, 60)


# ================================================================== #
# 4. TOP TENANTS TODAY — top 5 orgs by revenue today vs yesterday     #
# ================================================================== #


@router.get("/control-tower/top-tenants-today")
def top_tenants_today(db: Session = Depends(get_db)):
    """Top 5 orgs by today's revenue, with yesterday comparison."""

    def _run():
        now_utc = datetime.now(timezone.utc)
        today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        yesterday_end = today_start - timedelta(microseconds=1)

        # Top 5 by today's revenue.
        today_rows = (
            db.query(
                Organization.id.label("oid"),
                Organization.name.label("oname"),
                Organization.industry_type.label("industry"),
                func.coalesce(func.sum(SalesDocument.total_amount), 0).label("rev"),
                func.count(SalesDocument.id).label("cnt"),
            )
            .join(SalesDocument, SalesDocument.organization_id == Organization.id)
            .filter(
                SalesDocument.created_at >= today_start,
                SalesDocument.created_at <= now_utc,
                SalesDocument.status != DocumentStatus.CANCELLED,
            )
            .group_by(Organization.id, Organization.name, Organization.industry_type)
            .order_by(func.coalesce(func.sum(SalesDocument.total_amount), 0).desc())
            .limit(5)
            .all()
        )

        if not today_rows:
            return {"items": [], "as_of": now_utc.isoformat()}

        org_ids = [r.oid for r in today_rows]

        # Yesterday revenue for the same set of orgs.
        y_rows = (
            db.query(
                SalesDocument.organization_id.label("oid"),
                func.coalesce(func.sum(SalesDocument.total_amount), 0).label("rev"),
            )
            .filter(
                SalesDocument.organization_id.in_(org_ids),
                SalesDocument.created_at >= yesterday_start,
                SalesDocument.created_at <= yesterday_end,
                SalesDocument.status != DocumentStatus.CANCELLED,
            )
            .group_by(SalesDocument.organization_id)
            .all()
        )
        y_map = {r.oid: float(r.rev or 0) for r in y_rows}

        items = []
        for r in today_rows:
            today_rev = float(r.rev or 0)
            y_rev = y_map.get(r.oid, 0.0)
            industry = r.industry
            if hasattr(industry, "value"):
                industry = industry.value
            items.append(
                {
                    "id": r.oid,
                    "name": r.oname,
                    "industry_type": industry if industry else None,
                    "today_revenue": today_rev,
                    "today_count": int(r.cnt or 0),
                    "yesterday_revenue": y_rev,
                    "delta_pct": _pct_delta(today_rev, y_rev),
                }
            )

        return {"items": items, "as_of": now_utc.isoformat()}

    return _cached("top_tenants_today", _run, 300)


# ================================================================== #
# 5. SYSTEM HEALTH SUMMARY — lightweight badge                        #
# ================================================================== #


@router.get("/control-tower/system-health-summary")
def system_health_summary(db: Session = Depends(get_db)):
    """Lightweight health badge derived from open critical alerts,
    active incidents, and unexpected suspensions."""

    def _run():
        critical_alerts = (
            db.query(func.count(PlatformAlert.id))
            .filter(
                PlatformAlert.severity == "critical",
                PlatformAlert.resolved_at.is_(None),
            )
            .scalar()
        ) or 0

        active_incidents = (
            db.query(func.count(PlatformIncident.id))
            .filter(PlatformIncident.resolved_at.is_(None))
            .scalar()
        ) or 0

        # Orgs that are SUSPENDED but had at least one sale in the prior 7d.
        # Filter SUSPENDED orgs first (small set) → only then scan their sales —
        # avoids full join over sales_documents.
        now_utc = datetime.now(timezone.utc)
        seven_days_ago = now_utc - timedelta(days=7)
        suspended_org_ids = [
            r[0]
            for r in db.query(Organization.id)
            .filter(Organization.status == "SUSPENDED")
            .all()
        ]
        if not suspended_org_ids:
            unexpected = 0
        else:
            unexpected = (
                db.query(func.count(func.distinct(SalesDocument.organization_id)))
                .filter(
                    SalesDocument.organization_id.in_(suspended_org_ids),
                    SalesDocument.created_at >= seven_days_ago,
                    SalesDocument.created_at <= now_utc,
                    SalesDocument.status != DocumentStatus.CANCELLED,
                )
                .scalar()
            ) or 0

        critical_alerts = int(critical_alerts)
        active_incidents = int(active_incidents)
        unexpected = int(unexpected)

        if active_incidents > 0:
            status = "critical"
        elif critical_alerts > 0 or unexpected > 0:
            status = "warning"
        else:
            status = "ok"

        return {
            "status": status,
            "critical_alerts": critical_alerts,
            "active_incidents": active_incidents,
            "unexpected_suspensions": unexpected,
        }

    return _cached("system_health_summary", _run, 60)
