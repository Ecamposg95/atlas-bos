"""Platform-level stats endpoints (`/stats/*`)."""

import logging
import time
from typing import Any, Callable
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.organization import Organization
from app.models.users import User

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Module-level TTL cache for read-only stats endpoints ---

_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str, fn: Callable[[], Any], ttl_seconds: int) -> Any:
    """In-process TTL cache for read-only stats endpoints."""
    now = time.time()
    cached = _cache.get(key)
    if cached and (now - cached[0]) < ttl_seconds:
        return cached[1]
    result = fn()
    _cache[key] = (now, result)
    return result


def _parse_range(range_param: str) -> tuple[datetime, datetime]:
    """Parses '7d', '30d', '90d', 'ytd' into (start, end) datetimes (UTC)."""
    end = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59, microsecond=999999)
    if range_param == "7d":
        start = end - timedelta(days=7)
    elif range_param == "90d":
        start = end - timedelta(days=90)
    elif range_param == "ytd":
        start = datetime(end.year, 1, 1, tzinfo=timezone.utc)
    else:  # default 30d
        start = end - timedelta(days=30)
    return start, end


def _range_days(start: datetime, end: datetime) -> int:
    return max(1, (end.date() - start.date()).days + 1)


# --- Global Stats ---

@router.get("/stats/global")
def get_global_stats(db: Session = Depends(get_db)):
    """High-level platform metrics with deltas vs prior period."""
    from sqlalchemy import func
    from datetime import timedelta
    from app.models.organization import Branch
    from app.models.sales import SalesDocument, DocumentStatus

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    month_start = today_start.replace(day=1)
    last_30d = now - timedelta(days=30)
    last_60d = now - timedelta(days=60)

    total_orgs = db.query(Organization).count()
    active_orgs = db.query(Organization).filter(Organization.status == "ACTIVE").count()
    total_users = db.query(User).count()
    total_branches = db.query(Branch).count()

    new_orgs_this_month = db.query(Organization).filter(Organization.created_at >= month_start).count() if hasattr(Organization, 'created_at') else 0
    orgs_30d_ago = db.query(Organization).filter(Organization.created_at < last_30d).count() if hasattr(Organization, 'created_at') else total_orgs
    total_orgs_delta = total_orgs - orgs_30d_ago

    sales_data = db.query(func.sum(SalesDocument.total_amount), func.count(SalesDocument.id)).first()
    total_revenue = float(sales_data[0] or 0)
    total_sales_count = sales_data[1] or 0

    sales_today = float(
        db.query(func.coalesce(func.sum(SalesDocument.total_amount), 0))
        .filter(SalesDocument.created_at >= today_start,
                SalesDocument.status != DocumentStatus.CANCELLED)
        .scalar() or 0
    )
    sales_yesterday = float(
        db.query(func.coalesce(func.sum(SalesDocument.total_amount), 0))
        .filter(SalesDocument.created_at >= yesterday_start,
                SalesDocument.created_at < today_start,
                SalesDocument.status != DocumentStatus.CANCELLED)
        .scalar() or 0
    )
    sales_today_delta = sales_today - sales_yesterday

    # Activity rate: % de orgs activas con ≥1 venta hoy
    orgs_with_sales_today = (
        db.query(SalesDocument.organization_id)
        .filter(SalesDocument.created_at >= today_start,
                SalesDocument.status != DocumentStatus.CANCELLED)
        .distinct().count()
    )
    activity_rate = (orgs_with_sales_today / active_orgs * 100) if active_orgs > 0 else 0

    return {
        "organizations": {
            "total": total_orgs,
            "active": active_orgs,
            "suspended": total_orgs - active_orgs,
            "new_this_month": new_orgs_this_month,
            "delta_30d": total_orgs_delta,
        },
        "users": total_users,
        "branches": total_branches,
        "sales": {
            "revenue": total_revenue,
            "count": total_sales_count,
            "today": sales_today,
            "today_delta": sales_today_delta,
        },
        "activity_rate": round(activity_rate, 1),
    }

@router.get("/stats/trends")
def get_platform_trends(db: Session = Depends(get_db)):
    """Provides historical trend data for charts."""
    from sqlalchemy import func, cast, Date
    from app.models.organization import Branch
    from app.models.sales import SalesDocument
    from datetime import datetime, timedelta

    # Get last 30 days
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=30)

    # Daily revenue trend
    revenue_trend = db.query(
        cast(SalesDocument.created_at, Date).label('date'),
        func.sum(SalesDocument.total_amount).label('revenue'),
        func.count(SalesDocument.id).label('count')
    ).filter(
        cast(SalesDocument.created_at, Date) >= start_date
    ).group_by(
        cast(SalesDocument.created_at, Date)
    ).order_by('date').all()

    # Organization registrations trend
    org_trend = db.query(
        cast(Organization.created_at, Date).label('date'),
        func.count(Organization.id).label('count')
    ).filter(
        cast(Organization.created_at, Date) >= start_date
    ).group_by(
        cast(Organization.created_at, Date)
    ).order_by('date').all()

    return {
        "revenue_trend": [
            {
                "date": str(r.date),
                "revenue": float(r.revenue or 0),
                "count": r.count
            } for r in revenue_trend
        ],
        "org_registrations": [
            {
                "date": str(o.date),
                "count": o.count
            } for o in org_trend
        ]
    }

@router.get("/stats/industry-distribution")
def get_industry_distribution(db: Session = Depends(get_db)):
    """Returns organization count by industry type."""
    from sqlalchemy import func

    distribution = db.query(
        Organization.industry_type,
        func.count(Organization.id).label('count')
    ).group_by(
        Organization.industry_type
    ).all()

    return [
        {
            "industry": d.industry_type or "UNKNOWN",
            "count": d.count
        } for d in distribution
    ]

@router.get("/stats/top-tenants")
def get_top_tenants(db: Session = Depends(get_db), limit: int = 5):
    """Returns top performing organizations by revenue."""
    from sqlalchemy import func
    from app.models.sales import SalesDocument

    top_orgs = db.query(
        Organization.id,
        Organization.name,
        func.sum(SalesDocument.total_amount).label('total_revenue'),
        func.count(SalesDocument.id).label('transaction_count')
    ).join(
        SalesDocument, SalesDocument.organization_id == Organization.id
    ).group_by(
        Organization.id, Organization.name
    ).order_by(
        func.sum(SalesDocument.total_amount).desc()
    ).limit(limit).all()

    return [
        {
            "id": org.id,
            "name": org.name,
            "revenue": float(org.total_revenue or 0),
            "transactions": org.transaction_count
        } for org in top_orgs
    ]


# --- Extended KPIs / sparklines / multi-series / breakdowns / leaderboards ---

@router.get("/stats/kpis-extended")
def get_kpis_extended(
    range_filter: str = Query("30d", alias="range"),
    db: Session = Depends(get_db),
):
    """Bundle of 8 KPIs with delta_pct (current half vs prior half) and per-day spark.

    NOTE: param renamed `range`→`range_filter` (with alias) to avoid shadowing
    the `range()` builtin used inside the closure. The URL still accepts
    `?range=30d` for the frontend.
    """
    from sqlalchemy import func, cast, Date
    from app.models.organization import Branch
    from app.models.sales import SalesDocument, DocumentStatus

    range_param = range_filter if range_filter in ("7d", "30d", "90d", "ytd") else "30d"

    def compute():
        start, end = _parse_range(range_param)
        days = _range_days(start, end)
        half = days // 2 if days >= 2 else 1
        mid = end - timedelta(days=half)
        prior_start = start - timedelta(days=half)

        # ---------- Helpers ----------
        def daily_revenue_map(s: datetime, e: datetime) -> dict[str, float]:
            rows = db.query(
                cast(SalesDocument.created_at, Date).label("d"),
                func.coalesce(func.sum(SalesDocument.total_amount), 0).label("rev"),
                func.count(SalesDocument.id).label("cnt"),
            ).filter(
                SalesDocument.created_at >= s,
                SalesDocument.created_at <= e,
                SalesDocument.status != DocumentStatus.CANCELLED,
            ).group_by("d").all()
            return {str(r.d): (float(r.rev or 0), int(r.cnt or 0)) for r in rows}

        def fill_spark(day_map: dict[str, tuple[float, int]], idx: int) -> list[float]:
            out: list[float] = []
            cur = start.date()
            for _ in range(days):
                key = str(cur)
                v = day_map.get(key)
                out.append(float(v[idx]) if v else 0.0)
                cur = cur + timedelta(days=1)
            return out

        def pct_delta(current: float, prior: float) -> float | None:
            if prior == 0:
                return None
            return round((current - prior) / prior * 100.0, 2)

        # ---------- Revenue / sales_count / aov ----------
        cur_map = daily_revenue_map(start, end)
        prior_map = daily_revenue_map(prior_start, mid)

        revenue_total = sum(v[0] for v in cur_map.values())
        sales_count_total = sum(v[1] for v in cur_map.values())
        revenue_prior = sum(v[0] for v in prior_map.values())
        sales_count_prior = sum(v[1] for v in prior_map.values())

        # current/prior split for delta on revenue & sales_count
        cur_half_rev = sum(
            v[0] for k, v in cur_map.items()
            if datetime.fromisoformat(k).replace(tzinfo=timezone.utc) >= mid
        )
        prior_half_rev = sum(
            v[0] for k, v in cur_map.items()
            if datetime.fromisoformat(k).replace(tzinfo=timezone.utc) < mid
        )
        cur_half_cnt = sum(
            v[1] for k, v in cur_map.items()
            if datetime.fromisoformat(k).replace(tzinfo=timezone.utc) >= mid
        )
        prior_half_cnt = sum(
            v[1] for k, v in cur_map.items()
            if datetime.fromisoformat(k).replace(tzinfo=timezone.utc) < mid
        )

        revenue_spark = fill_spark(cur_map, 0)
        sales_spark = fill_spark(cur_map, 1)
        aov_spark = [
            (revenue_spark[i] / sales_spark[i]) if sales_spark[i] > 0 else 0.0
            for i in range(days)
        ]
        aov_value = (revenue_total / sales_count_total) if sales_count_total > 0 else 0.0
        aov_prior = (revenue_prior / sales_count_prior) if sales_count_prior > 0 else 0.0

        # ---------- Active tenants (orgs with >=1 sale per day) ----------
        active_tenants_rows = db.query(
            cast(SalesDocument.created_at, Date).label("d"),
            func.count(func.distinct(SalesDocument.organization_id)).label("cnt"),
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).group_by("d").all()
        active_tenants_map = {str(r.d): int(r.cnt or 0) for r in active_tenants_rows}
        active_tenants_spark = []
        cur_d = start.date()
        for _ in range(days):
            active_tenants_spark.append(float(active_tenants_map.get(str(cur_d), 0)))
            cur_d = cur_d + timedelta(days=1)
        active_tenants_value = db.query(
            func.count(func.distinct(SalesDocument.organization_id))
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).scalar() or 0
        active_tenants_prior = db.query(
            func.count(func.distinct(SalesDocument.organization_id))
        ).filter(
            SalesDocument.created_at >= prior_start,
            SalesDocument.created_at < mid,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).scalar() or 0

        # ---------- Active branches (branches with >=1 sale per day) ----------
        active_branches_rows = db.query(
            cast(SalesDocument.created_at, Date).label("d"),
            func.count(func.distinct(SalesDocument.branch_id)).label("cnt"),
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).group_by("d").all()
        active_branches_map = {str(r.d): int(r.cnt or 0) for r in active_branches_rows}
        active_branches_spark = []
        cur_d = start.date()
        for _ in range(days):
            active_branches_spark.append(float(active_branches_map.get(str(cur_d), 0)))
            cur_d = cur_d + timedelta(days=1)
        active_branches_value = db.query(
            func.count(func.distinct(SalesDocument.branch_id))
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).scalar() or 0
        active_branches_prior = db.query(
            func.count(func.distinct(SalesDocument.branch_id))
        ).filter(
            SalesDocument.created_at >= prior_start,
            SalesDocument.created_at < mid,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).scalar() or 0

        # ---------- MRR proxy (trailing 30d revenue, daily) ----------
        mrr_end = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59, microsecond=999999)
        mrr_start = mrr_end - timedelta(days=30)
        mrr_map = daily_revenue_map(mrr_start, mrr_end)
        mrr_value = sum(v[0] for v in mrr_map.values())
        mrr_spark = []
        cur_d = mrr_start.date()
        for _ in range(31):
            v = mrr_map.get(str(cur_d))
            mrr_spark.append(float(v[0]) if v else 0.0)
            cur_d = cur_d + timedelta(days=1)
        # prior trailing 30d for delta
        mrr_prior_end = mrr_start
        mrr_prior_start = mrr_prior_end - timedelta(days=30)
        mrr_prior_value = float(
            db.query(func.coalesce(func.sum(SalesDocument.total_amount), 0))
            .filter(
                SalesDocument.created_at >= mrr_prior_start,
                SalesDocument.created_at < mrr_prior_end,
                SalesDocument.status != DocumentStatus.CANCELLED,
            ).scalar() or 0
        )

        # ---------- Activation rate ----------
        total_active_orgs = db.query(Organization).filter(Organization.status == "ACTIVE").count()
        orgs_with_sale = db.query(
            func.count(func.distinct(SalesDocument.organization_id))
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).scalar() or 0
        activation_rate_value = (
            float(orgs_with_sale) / total_active_orgs * 100.0
            if total_active_orgs > 0 else 0.0
        )
        # daily activation rate spark (orgs with sale that day / active orgs)
        activation_spark = [
            (active_tenants_spark[i] / total_active_orgs * 100.0)
            if total_active_orgs > 0 else 0.0
            for i in range(days)
        ]
        # prior period activation rate
        orgs_with_sale_prior = db.query(
            func.count(func.distinct(SalesDocument.organization_id))
        ).filter(
            SalesDocument.created_at >= prior_start,
            SalesDocument.created_at < mid,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).scalar() or 0
        activation_prior = (
            float(orgs_with_sale_prior) / total_active_orgs * 100.0
            if total_active_orgs > 0 else 0.0
        )

        # ---------- Suspension rate ----------
        total_orgs = db.query(Organization).count()
        suspended_orgs = db.query(Organization).filter(Organization.status != "ACTIVE").count()
        suspension_rate_value = (
            float(suspended_orgs) / total_orgs * 100.0 if total_orgs > 0 else 0.0
        )
        # No historical snapshot — flat spark and null delta.
        suspension_spark = [suspension_rate_value for _ in range(days)]

        return {
            "range": range_param,
            "revenue": {
                "total": float(revenue_total),
                "delta_pct": pct_delta(cur_half_rev, prior_half_rev),
                "spark": revenue_spark,
            },
            "sales_count": {
                "total": int(sales_count_total),
                "delta_pct": pct_delta(cur_half_cnt, prior_half_cnt),
                "spark": sales_spark,
            },
            "aov": {
                "value": float(aov_value),
                "delta_pct": pct_delta(aov_value, aov_prior),
                "spark": aov_spark,
            },
            "active_tenants": {
                "value": int(active_tenants_value),
                "delta_pct": pct_delta(float(active_tenants_value), float(active_tenants_prior)),
                "spark": active_tenants_spark,
            },
            "active_branches": {
                "value": int(active_branches_value),
                "delta_pct": pct_delta(float(active_branches_value), float(active_branches_prior)),
                "spark": active_branches_spark,
            },
            "mrr_proxy": {
                "value": float(mrr_value),
                "delta_pct": pct_delta(mrr_value, mrr_prior_value),
                "spark": mrr_spark,
            },
            "activation_rate": {
                "value": round(activation_rate_value, 2),
                "delta_pct": pct_delta(activation_rate_value, activation_prior),
                "spark": activation_spark,
            },
            "suspension_rate": {
                "value": round(suspension_rate_value, 2),
                "delta_pct": None,
                "spark": suspension_spark,
            },
        }

    return _cached(f"kpis_extended:{range_param}", compute, 600)


@router.get("/stats/trends-multi")
def get_trends_multi(
    range_filter: str = Query("30d", alias="range"),
    series: str = Query("revenue,sales,signups"),
    db: Session = Depends(get_db),
):
    """Multi-series daily trend (revenue / sales / signups) with gap-fill."""
    from sqlalchemy import func, cast, Date
    from app.models.sales import SalesDocument, DocumentStatus

    range_param = range_filter if range_filter in ("7d", "30d", "90d", "ytd") else "30d"
    series_set = {s.strip() for s in series.split(",") if s.strip()}
    if not series_set:
        series_set = {"revenue", "sales", "signups"}
    series_csv = ",".join(sorted(series_set))

    def compute():
        start, end = _parse_range(range_param)
        days = _range_days(start, end)

        sales_rows = db.query(
            cast(SalesDocument.created_at, Date).label("d"),
            func.coalesce(func.sum(SalesDocument.total_amount), 0).label("rev"),
            func.count(SalesDocument.id).label("cnt"),
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).group_by("d").all()
        sales_map = {str(r.d): (float(r.rev or 0), int(r.cnt or 0)) for r in sales_rows}

        signup_rows = db.query(
            cast(Organization.created_at, Date).label("d"),
            func.count(Organization.id).label("cnt"),
        ).filter(
            Organization.created_at >= start,
            Organization.created_at <= end,
        ).group_by("d").all()
        signup_map = {str(r.d): int(r.cnt or 0) for r in signup_rows}

        points = []
        cur = start.date()
        for _ in range(days):
            key = str(cur)
            sm = sales_map.get(key)
            point = {
                "date": key,
                "label": cur.strftime("%d/%m"),
            }
            if "revenue" in series_set:
                point["revenue"] = float(sm[0]) if sm else 0.0
            if "sales" in series_set:
                point["sales"] = int(sm[1]) if sm else 0
            if "signups" in series_set:
                point["signups"] = int(signup_map.get(key, 0))
            points.append(point)
            cur = cur + timedelta(days=1)

        return {"range": range_param, "points": points}

    return _cached(f"trends_multi:{range_param}:{series_csv}", compute, 600)


@router.get("/stats/tenant-size-distribution")
def get_tenant_size_distribution(
    db: Session = Depends(get_db),
):
    """Buckets active orgs by all-time total revenue: S < $10k, M < $100k, L >= $100k."""
    from sqlalchemy import func, case
    from app.models.sales import SalesDocument, DocumentStatus

    def compute():
        # Per-org total revenue (active orgs only)
        org_totals = db.query(
            Organization.id.label("oid"),
            func.coalesce(func.sum(SalesDocument.total_amount), 0).label("rev"),
        ).outerjoin(
            SalesDocument,
            (SalesDocument.organization_id == Organization.id)
            & (SalesDocument.status != DocumentStatus.CANCELLED),
        ).filter(
            Organization.status == "ACTIVE"
        ).group_by(Organization.id).subquery()

        bucket_expr = case(
            (org_totals.c.rev < 10000, "S"),
            (org_totals.c.rev < 100000, "M"),
            else_="L",
        ).label("bucket")

        rows = db.query(
            bucket_expr,
            func.count().label("cnt"),
            func.coalesce(func.sum(org_totals.c.rev), 0).label("rev_total"),
        ).group_by("bucket").all()

        by_bucket = {r.bucket: (int(r.cnt or 0), float(r.rev_total or 0)) for r in rows}
        labels = {"S": "< $10k", "M": "$10k–$100k", "L": ">= $100k"}
        return [
            {
                "bucket": b,
                "label": labels[b],
                "count": by_bucket.get(b, (0, 0.0))[0],
                "revenue_total": by_bucket.get(b, (0, 0.0))[1],
            }
            for b in ("S", "M", "L")
        ]

    return _cached("tenant_size_dist", compute, 600)


@router.get("/stats/branch-distribution")
def get_branch_distribution(
    db: Session = Depends(get_db),
):
    """Counts orgs by active branch count: 1, 2-5, 6-20, 21+."""
    from sqlalchemy import func, case
    from app.models.organization import Branch

    def compute():
        org_counts = db.query(
            Organization.id.label("oid"),
            func.count(Branch.id).label("bcnt"),
        ).outerjoin(
            Branch,
            (Branch.organization_id == Organization.id) & (Branch.is_active == True),  # noqa: E712
        ).group_by(Organization.id).subquery()

        bucket_expr = case(
            (org_counts.c.bcnt <= 1, "1"),
            (org_counts.c.bcnt <= 5, "2-5"),
            (org_counts.c.bcnt <= 20, "6-20"),
            else_="21+",
        ).label("bucket")

        rows = db.query(
            bucket_expr,
            func.count().label("cnt"),
        ).group_by("bucket").all()

        by_bucket = {r.bucket: int(r.cnt or 0) for r in rows}
        labels = {"1": "1 sucursal", "2-5": "2–5", "6-20": "6–20", "21+": "21+"}
        return [
            {"bucket": b, "label": labels[b], "count": by_bucket.get(b, 0)}
            for b in ("1", "2-5", "6-20", "21+")
        ]

    return _cached("branch_dist", compute, 600)


@router.get("/stats/top-branches")
def get_top_branches(
    limit: int = Query(10),
    db: Session = Depends(get_db),
):
    """Top branches cross-tenant by revenue last 30 days."""
    from sqlalchemy import func
    from app.models.organization import Branch
    from app.models.sales import SalesDocument, DocumentStatus

    if limit > 25:
        limit = 25
    if limit < 1:
        limit = 1

    def compute():
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=30)
        rows = db.query(
            Branch.id.label("bid"),
            Branch.name.label("bname"),
            Organization.id.label("oid"),
            Organization.name.label("oname"),
            func.coalesce(func.sum(SalesDocument.total_amount), 0).label("rev"),
            func.count(SalesDocument.id).label("cnt"),
        ).join(
            SalesDocument, SalesDocument.branch_id == Branch.id
        ).join(
            Organization, Organization.id == Branch.organization_id
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).group_by(
            Branch.id, Branch.name, Organization.id, Organization.name
        ).order_by(
            func.sum(SalesDocument.total_amount).desc()
        ).limit(limit).all()

        return [
            {
                "branch_id": r.bid,
                "branch_name": r.bname,
                "org_id": r.oid,
                "org_name": r.oname,
                "revenue_30d": float(r.rev or 0),
                "sales_count_30d": int(r.cnt or 0),
            }
            for r in rows
        ]

    return _cached(f"top_branches:{limit}", compute, 300)


@router.get("/stats/branch-comparison")
def get_branch_comparison(
    limit: int = Query(5),
    range_filter: str = Query("30d", alias="range"),
    db: Session = Depends(get_db),
):
    """Side-by-side branch metrics: revenue, tickets, AOV, peak hour.

    Cross-tenant. Picks top N branches by revenue in the range; for each
    computes AOV (revenue/tickets) and the hour-of-day with most sales.
    """
    from sqlalchemy import func, extract
    from app.models.organization import Branch
    from app.models.sales import SalesDocument, DocumentStatus

    if limit > 20:
        limit = 20
    if limit < 1:
        limit = 1
    range_param = range_filter if range_filter in ("7d", "30d", "90d", "ytd") else "30d"

    def compute():
        start, end = _parse_range(range_param)

        # Top N branches by revenue in range.
        top_rows = db.query(
            Branch.id.label("bid"),
            Branch.name.label("bname"),
            Organization.id.label("oid"),
            Organization.name.label("oname"),
            func.coalesce(func.sum(SalesDocument.total_amount), 0).label("rev"),
            func.count(SalesDocument.id).label("cnt"),
        ).join(
            SalesDocument, SalesDocument.branch_id == Branch.id
        ).join(
            Organization, Organization.id == Branch.organization_id
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).group_by(
            Branch.id, Branch.name, Organization.id, Organization.name
        ).order_by(
            func.sum(SalesDocument.total_amount).desc()
        ).limit(limit).all()

        if not top_rows:
            return {"range": range_param, "items": []}

        branch_ids = [r.bid for r in top_rows]

        # Peak hour per branch: GROUP BY (branch, hour), then pick max in Python.
        hour_rows = db.query(
            SalesDocument.branch_id.label("bid"),
            extract("hour", SalesDocument.created_at).label("hr"),
            func.count(SalesDocument.id).label("cnt"),
        ).filter(
            SalesDocument.branch_id.in_(branch_ids),
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).group_by(
            SalesDocument.branch_id,
            extract("hour", SalesDocument.created_at),
        ).all()

        peak_by_branch: dict[int, tuple[int, int]] = {}  # bid -> (hour, count)
        for hr in hour_rows:
            cur = peak_by_branch.get(hr.bid)
            if cur is None or hr.cnt > cur[1]:
                peak_by_branch[hr.bid] = (int(hr.hr), int(hr.cnt))

        items = []
        for r in top_rows:
            rev = float(r.rev or 0)
            cnt = int(r.cnt or 0)
            peak = peak_by_branch.get(r.bid)
            items.append({
                "branch_id": r.bid,
                "branch_name": r.bname,
                "org_id": r.oid,
                "org_name": r.oname,
                "revenue": rev,
                "sales_count": cnt,
                "aov": (rev / cnt) if cnt > 0 else 0.0,
                "peak_hour": peak[0] if peak else None,
                "peak_hour_count": peak[1] if peak else 0,
            })

        return {"range": range_param, "items": items}

    return _cached(f"branch_comparison:{limit}:{range_param}", compute, 600)


@router.get("/stats/top-products")
def get_top_products(
    limit: int = Query(10),
    range_filter: str = Query("30d", alias="range"),
    db: Session = Depends(get_db),
):
    """Top SKUs cross-tenant by quantity sold."""
    from sqlalchemy import func
    from app.models.sales import SalesDocument, SalesLineItem, DocumentStatus
    from app.models.products import Product, ProductVariant

    if limit > 25:
        limit = 25
    if limit < 1:
        limit = 1
    range_param = range_filter if range_filter in ("7d", "30d", "90d", "ytd") else "30d"

    def compute():
        start, end = _parse_range(range_param)
        rows = db.query(
            Product.id.label("pid"),
            Product.name.label("pname"),
            ProductVariant.id.label("vid"),
            ProductVariant.variant_name.label("vname"),
            ProductVariant.sku.label("sku"),
            func.coalesce(func.sum(SalesLineItem.quantity), 0).label("qty"),
            func.coalesce(func.sum(SalesLineItem.total_line), 0).label("rev"),
            func.count(func.distinct(SalesDocument.organization_id)).label("orgs"),
        ).join(
            SalesDocument, SalesDocument.id == SalesLineItem.document_id
        ).join(
            ProductVariant, ProductVariant.id == SalesLineItem.variant_id
        ).join(
            Product, Product.id == ProductVariant.product_id
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).group_by(
            Product.id, Product.name, ProductVariant.id,
            ProductVariant.variant_name, ProductVariant.sku,
        ).order_by(
            func.sum(SalesLineItem.quantity).desc()
        ).limit(limit).all()

        return [
            {
                "product_id": r.pid,
                "product_name": r.pname,
                "variant_description": r.vname,
                "sku": r.sku,
                "quantity_sold": float(r.qty or 0),
                "revenue": float(r.rev or 0),
                "org_count": int(r.orgs or 0),
            }
            for r in rows
        ]

    return _cached(f"top_products:{limit}:{range_param}", compute, 300)


_PAYMENT_METHOD_LABELS = {
    "CASH": "Efectivo",
    "CARD": "Tarjeta",
    "TRANSFER": "Transferencia",
    "STORE_CREDIT": "Crédito tienda",
    "CHECK": "Cheque",
    "OTHER": "Otro",
}


@router.get("/stats/payment-methods")
def get_payment_methods_breakdown(
    range_filter: str = Query("30d", alias="range"),
    db: Session = Depends(get_db),
):
    """Cross-tenant breakdown of payments by method.

    Aggregates payments on non-cancelled sales within range. We do NOT filter
    by is_deposit: the column was added to the model but never reached prod DB
    via a migration, and the few legacy refund rows are absorbed in the totals.
    """
    from sqlalchemy import func
    from app.models.sales import SalesDocument, DocumentStatus
    # NOTE: import from app.models.sales (the LIVE Payment), NOT app.models.payments
    # — the latter is a legacy module with stale relationships (Branch unresolved)
    # that, once imported, breaks every Payment-touching query in the whole app
    # (create_sale, print, reprint). This is what took beta down on 2026-05-01.
    from app.models.sales import Payment

    range_param = range_filter if range_filter in ("7d", "30d", "90d", "ytd") else "30d"

    def compute():
        start, end = _parse_range(range_param)
        # Use SalesDocument.created_at (always present, indexed) instead of
        # Payment.created_at — Payment has columns added late (is_deposit,
        # created_by_id) that may not exist in older deployments.
        try:
            rows = db.query(
                Payment.method.label("method"),
                func.coalesce(func.sum(Payment.amount), 0).label("revenue"),
                func.count(Payment.id).label("count"),
            ).join(
                SalesDocument, SalesDocument.id == Payment.sales_document_id
            ).filter(
                SalesDocument.created_at >= start,
                SalesDocument.created_at <= end,
                SalesDocument.status != DocumentStatus.CANCELLED,
            ).group_by(Payment.method).all()
        except Exception:
            logger.exception("payment-methods query failed for range=%s", range_param)
            db.rollback()
            return {"range": range_param, "total_revenue": 0.0, "total_count": 0, "items": []}

        items = []
        total_revenue = sum(float(r.revenue or 0) for r in rows)
        for r in rows:
            method_str = r.method.value if hasattr(r.method, "value") else str(r.method)
            rev = float(r.revenue or 0)
            items.append({
                "method": method_str,
                "label": _PAYMENT_METHOD_LABELS.get(method_str, method_str),
                "count": int(r.count or 0),
                "revenue": rev,
                "pct": (rev / total_revenue * 100) if total_revenue > 0 else 0.0,
            })
        items.sort(key=lambda x: x["revenue"], reverse=True)

        return {
            "range": range_param,
            "total_revenue": total_revenue,
            "total_count": sum(it["count"] for it in items),
            "items": items,
        }

    return _cached(f"payment_methods_v2:{range_param}", compute, 300)


@router.get("/stats/cohort-retention")
def get_cohort_retention(
    cohort_period: str = Query("month"),
    db: Session = Depends(get_db),
):
    """% retained at 30/60/90/180 days for orgs by signup month (last 12 months)."""
    from sqlalchemy import func
    from app.models.sales import SalesDocument, DocumentStatus

    def compute():
        now = datetime.now(timezone.utc)
        # Compute 12 months back, anchored to first-of-month
        first_of_this_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

        # Build the 12 cohort windows up front
        windows = []  # (cohort_start, cohort_end, key, label)
        for offset in range(11, -1, -1):
            year = first_of_this_month.year
            month = first_of_this_month.month - offset
            while month <= 0:
                month += 12
                year -= 1
            cohort_start = datetime(year, month, 1, tzinfo=timezone.utc)
            ny, nm = (year + 1, 1) if month == 12 else (year, month + 1)
            cohort_end = datetime(ny, nm, 1, tzinfo=timezone.utc)
            windows.append((
                cohort_start,
                cohort_end,
                cohort_start.strftime("%Y-%m"),
                cohort_start.strftime("%b %Y"),
            ))

        # 1 query: all orgs signed up across the 12-month span
        oldest_start = windows[0][0]
        newest_end = windows[-1][1]
        signup_rows = db.query(
            Organization.id, Organization.created_at
        ).filter(
            Organization.created_at >= oldest_start,
            Organization.created_at < newest_end,
        ).all()

        # Bucket orgs by cohort key
        cohort_orgs: dict[str, list[int]] = {w[2]: [] for w in windows}
        for org_id, created_at in signup_rows:
            for cs, ce, key, _label in windows:
                if cs <= created_at < ce:
                    cohort_orgs[key].append(org_id)
                    break

        all_org_ids = [oid for oid, _ in signup_rows]

        # 1 query: earliest non-cancelled sale per org (across all 12 cohorts)
        first_sale: dict[int, datetime] = {}
        if all_org_ids:
            sale_rows = db.query(
                SalesDocument.organization_id,
                func.min(SalesDocument.created_at).label("first_sale"),
            ).filter(
                SalesDocument.organization_id.in_(all_org_ids),
                SalesDocument.status != DocumentStatus.CANCELLED,
            ).group_by(SalesDocument.organization_id).all()
            first_sale = {r.organization_id: r.first_sale for r in sale_rows}

        cohorts: list[dict] = []
        for cohort_start, cohort_end, key, label in windows:
            org_ids = cohort_orgs[key]
            size = len(org_ids)
            row = {
                "cohort": key,
                "cohort_label": label,
                "size": size,
                "ret_30d": None,
                "ret_60d": None,
                "ret_90d": None,
                "ret_180d": None,
            }
            if size == 0:
                cohorts.append(row)
                continue

            for n_days, slot in ((30, "ret_30d"), (60, "ret_60d"), (90, "ret_90d"), (180, "ret_180d")):
                # Window must have fully elapsed for the entire cohort
                if cohort_end + timedelta(days=n_days) > now:
                    row[slot] = None
                    continue
                cutoff = cohort_end + timedelta(days=n_days)
                retained = sum(
                    1 for oid in org_ids
                    if first_sale.get(oid) is not None and first_sale[oid] <= cutoff
                )
                row[slot] = round(float(retained) / size * 100.0, 2)

            cohorts.append(row)

        return cohorts

    return _cached("cohort_retention:month", compute, 600)


@router.get("/stats/activity-heatmap")
def get_activity_heatmap(
    range_filter: str = Query("30d", alias="range"),
    db: Session = Depends(get_db),
):
    """Sales count grouped by (day-of-week, hour-of-day) for the given range."""
    from sqlalchemy import func
    from app.models.sales import SalesDocument, DocumentStatus

    range_param = range_filter if range_filter in ("7d", "30d", "90d", "ytd") else "30d"

    def compute():
        start, end = _parse_range(range_param)
        rows = db.query(
            func.extract("dow", SalesDocument.created_at).label("dow"),
            func.extract("hour", SalesDocument.created_at).label("hour"),
            func.count(SalesDocument.id).label("cnt"),
        ).filter(
            SalesDocument.created_at >= start,
            SalesDocument.created_at <= end,
            SalesDocument.status != DocumentStatus.CANCELLED,
        ).group_by("dow", "hour").all()

        cells = []
        max_count = 0
        for r in rows:
            c = int(r.cnt or 0)
            if c > max_count:
                max_count = c
            cells.append({"dow": int(r.dow or 0), "hour": int(r.hour or 0), "count": c})

        return {"cells": cells, "max_count": max_count}

    return _cached(f"activity_heatmap:{range_param}", compute, 300)
