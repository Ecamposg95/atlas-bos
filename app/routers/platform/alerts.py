"""Platform alerts (anomaly detection inbox · Sprint 1 · A3)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import json as _json
from datetime import datetime

from app.database import get_db
from app.models.organization import Organization
from app.models.users import User
from app.security import require_platform_admin

from ._shared import _audit

router = APIRouter()


# =====================================================================
# --- 13. PLATFORM ALERTS (Anomaly detection inbox · Sprint 1 · A3)
# =====================================================================

def _alert_to_dict(alert, org_name: Optional[str] = None) -> dict:
    """Serialize a PlatformAlert row into a JSON-safe dict."""
    return {
        "id": alert.id,
        "organization_id": alert.organization_id,
        "organization_name": org_name,
        "severity": alert.severity,
        "kind": alert.kind,
        "title": alert.title,
        "detail": alert.detail,
        "first_seen": alert.first_seen.isoformat() if alert.first_seen else None,
        "acked_at": alert.acked_at.isoformat() if alert.acked_at else None,
        "acked_by": alert.acked_by,
        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
    }


@router.get("/alerts")
def list_platform_alerts(
    severity: Optional[str] = None,
    kind: Optional[str] = None,
    acked: Optional[bool] = Query(default=None),
    from_: Optional[datetime] = Query(default=None, alias="from"),
    to: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """List platform alerts with filters. Default ordering: active first,
    then by severity (critical > warning > info), then most recent first."""
    from sqlalchemy import case as sql_case
    from app.models.platform import PlatformAlert

    q = db.query(PlatformAlert, Organization.name).outerjoin(
        Organization, Organization.id == PlatformAlert.organization_id
    )

    if severity:
        q = q.filter(PlatformAlert.severity == severity)
    if kind:
        q = q.filter(PlatformAlert.kind == kind)
    if acked is not None:
        if acked:
            q = q.filter(PlatformAlert.acked_at.isnot(None))
        else:
            q = q.filter(PlatformAlert.acked_at.is_(None))
    if from_:
        q = q.filter(PlatformAlert.first_seen >= from_)
    if to:
        q = q.filter(PlatformAlert.first_seen <= to)

    # Ordering: active (not resolved) first, then severity weight, then recent.
    resolved_order = sql_case((PlatformAlert.resolved_at.is_(None), 0), else_=1)
    severity_order = sql_case(
        (PlatformAlert.severity == "critical", 0),
        (PlatformAlert.severity == "warning", 1),
        (PlatformAlert.severity == "info", 2),
        else_=3,
    )

    total = q.count()
    rows = (
        q.order_by(resolved_order, severity_order, PlatformAlert.first_seen.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    items = [_alert_to_dict(alert, org_name) for alert, org_name in rows]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/alerts/counts")
def get_alert_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """KPI badge counts for the alerts inbox."""
    from sqlalchemy import func as sqlfunc, case as sql_case
    from app.models.platform import PlatformAlert

    total_row = db.query(
        sqlfunc.count(PlatformAlert.id).label("total"),
        sqlfunc.sum(sql_case((PlatformAlert.resolved_at.is_(None), 1), else_=0)).label("active"),
        sqlfunc.sum(sql_case((PlatformAlert.severity == "critical", 1), else_=0)).label("critical"),
        sqlfunc.sum(sql_case((PlatformAlert.severity == "warning", 1), else_=0)).label("warning"),
        sqlfunc.sum(sql_case((PlatformAlert.severity == "info", 1), else_=0)).label("info"),
        sqlfunc.sum(sql_case((PlatformAlert.acked_at.isnot(None), 1), else_=0)).label("acked"),
        sqlfunc.sum(sql_case((PlatformAlert.resolved_at.isnot(None), 1), else_=0)).label("resolved"),
    ).one()

    return {
        "active": int(total_row.active or 0),
        "critical": int(total_row.critical or 0),
        "warning": int(total_row.warning or 0),
        "info": int(total_row.info or 0),
        "acked": int(total_row.acked or 0),
        "resolved": int(total_row.resolved or 0),
    }


@router.post("/alerts/scan")
def scan_for_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Trigger anomaly detection across all active orgs.

    Detections:
      - `revenue_drop`: z-score of yesterday's revenue vs. last 30 days baseline.
        Emits `warning` when z < -1.5 and baseline avg > 0; `critical` when z < -2.5.
      - `no_sales_24h`: org had sales in the past 30 days on average but none in
        the last 24h. Emits `warning`.

    De-duplication is enforced by the `uq_alert_org_kind_time` unique constraint
    on (organization_id, kind, first_seen) — if the same kind of alert for the
    same org already exists with the same `first_seen` timestamp, we skip it.
    """
    from math import sqrt
    from datetime import timedelta
    from sqlalchemy import func as sqlfunc
    from sqlalchemy.exc import IntegrityError
    from app.models.platform import PlatformAlert
    from app.models.sales import SalesDocument

    now = datetime.utcnow()
    # Align to the current hour so de-dup dedups per hourly scan.
    first_seen = now.replace(minute=0, second=0, microsecond=0)

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    yesterday_end = today_start
    last_30d_start = yesterday_start - timedelta(days=30)
    last_24h_start = now - timedelta(days=1)

    # Baseline (avg / stddev) for each org over the last 30 days, grouped by day.
    # We aggregate daily revenue per org for last 30 full days and compute
    # mean + stddev in Python per row returned, but keep SQL to one aggregate
    # query per metric (no per-org Python loop hitting the DB).

    # 1) Daily revenue per org for the last 30 days.
    daily_rows = (
        db.query(
            SalesDocument.organization_id.label("org_id"),
            sqlfunc.date(SalesDocument.created_at).label("day"),
            sqlfunc.coalesce(sqlfunc.sum(SalesDocument.total_amount), 0).label("revenue"),
        )
        .filter(SalesDocument.created_at >= last_30d_start)
        .filter(SalesDocument.created_at < yesterday_start)
        .filter(SalesDocument.organization_id.isnot(None))
        .group_by(SalesDocument.organization_id, sqlfunc.date(SalesDocument.created_at))
        .all()
    )

    # 2) Yesterday's revenue per org.
    yesterday_rows = (
        db.query(
            SalesDocument.organization_id.label("org_id"),
            sqlfunc.coalesce(sqlfunc.sum(SalesDocument.total_amount), 0).label("revenue"),
        )
        .filter(SalesDocument.created_at >= yesterday_start)
        .filter(SalesDocument.created_at < yesterday_end)
        .filter(SalesDocument.organization_id.isnot(None))
        .group_by(SalesDocument.organization_id)
        .all()
    )

    # 3) Last-24h revenue per org.
    last24_rows = (
        db.query(
            SalesDocument.organization_id.label("org_id"),
            sqlfunc.coalesce(sqlfunc.sum(SalesDocument.total_amount), 0).label("revenue"),
        )
        .filter(SalesDocument.created_at >= last_24h_start)
        .filter(SalesDocument.organization_id.isnot(None))
        .group_by(SalesDocument.organization_id)
        .all()
    )

    # 4) Active orgs list.
    active_orgs = db.query(Organization.id, Organization.name).filter(
        Organization.status == "ACTIVE"
    ).all()
    active_ids = {row[0]: row[1] for row in active_orgs}

    # Build baseline stats per org from daily_rows.
    baseline: dict[int, list[float]] = {}
    for org_id, _day, revenue in daily_rows:
        if org_id is None:
            continue
        baseline.setdefault(org_id, []).append(float(revenue or 0))

    yesterday_map: dict[int, float] = {
        row.org_id: float(row.revenue or 0) for row in yesterday_rows if row.org_id is not None
    }
    last24_map: dict[int, float] = {
        row.org_id: float(row.revenue or 0) for row in last24_rows if row.org_id is not None
    }

    created = 0
    skipped = 0

    def _try_insert(alert: "PlatformAlert") -> None:
        nonlocal created, skipped
        try:
            db.add(alert)
            db.flush()
            created += 1
        except IntegrityError:
            db.rollback()
            skipped += 1

    for org_id, org_name in active_ids.items():
        daily = baseline.get(org_id, [])
        # Pad with zeros up to 30 days so "no activity" affects the baseline
        # honestly instead of being silently skipped.
        if len(daily) < 30:
            daily = daily + [0.0] * (30 - len(daily))
        n = len(daily)
        mean = sum(daily) / n if n else 0.0
        variance = sum((x - mean) ** 2 for x in daily) / n if n else 0.0
        stddev = sqrt(variance)

        # --- revenue_drop detection ---
        yesterday_rev = yesterday_map.get(org_id, 0.0)
        if mean > 0 and stddev > 0:
            z = (yesterday_rev - mean) / stddev
            if z < -1.5:
                severity = "critical" if z < -2.5 else "warning"
                detail = _json.dumps({
                    "z_score": round(z, 3),
                    "yesterday_revenue": round(yesterday_rev, 2),
                    "baseline_avg_30d": round(mean, 2),
                    "baseline_stddev_30d": round(stddev, 2),
                })
                title = f"Caída de ingresos en {org_name}"
                _try_insert(PlatformAlert(
                    organization_id=org_id,
                    severity=severity,
                    kind="revenue_drop",
                    title=title,
                    detail=detail,
                    first_seen=first_seen,
                ))

        # --- no_sales_24h detection ---
        last24_rev = last24_map.get(org_id, 0.0)
        if mean > 0 and last24_rev == 0:
            detail = _json.dumps({
                "last_24h_revenue": 0,
                "baseline_avg_30d": round(mean, 2),
            })
            title = f"Sin ventas en las últimas 24h · {org_name}"
            _try_insert(PlatformAlert(
                organization_id=org_id,
                severity="warning",
                kind="no_sales_24h",
                title=title,
                detail=detail,
                first_seen=first_seen,
            ))

    # Audit the scan action itself (one entry per scan, not per alert).
    _audit(
        db,
        current_user.id,
        "ALERT_SCAN",
        "PLATFORM",
        0,
        _json.dumps({"created": created, "skipped": skipped}),
    )
    db.commit()
    return {"created": created, "skipped": skipped}


@router.post("/alerts/{alert_id}/ack")
def ack_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Mark an alert as acknowledged."""
    from app.models.platform import PlatformAlert

    alert = db.query(PlatformAlert).filter(PlatformAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    if alert.acked_at is None:
        alert.acked_at = datetime.utcnow()
        alert.acked_by = current_user.id
        _audit(db, current_user.id, "ALERT_ACK", "ALERT", alert.id,
               _json.dumps({"kind": alert.kind, "organization_id": alert.organization_id}))
    db.commit()
    return {"id": alert.id, "acked_at": alert.acked_at.isoformat() if alert.acked_at else None}


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Mark an alert as resolved."""
    from app.models.platform import PlatformAlert

    alert = db.query(PlatformAlert).filter(PlatformAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    if alert.resolved_at is None:
        alert.resolved_at = datetime.utcnow()
        _audit(db, current_user.id, "ALERT_RESOLVE", "ALERT", alert.id,
               _json.dumps({"kind": alert.kind, "organization_id": alert.organization_id}))
    db.commit()
    return {"id": alert.id, "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None}
