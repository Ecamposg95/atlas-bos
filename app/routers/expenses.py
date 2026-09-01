from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from decimal import Decimal
from datetime import date, timedelta, datetime, timezone
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.tenant_context import get_current_active_organization
from app.core.security import get_current_user
from app.models import User, Branch, Expense

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class ExpenseIn(BaseModel):
    amount: Decimal
    category: str
    description: Optional[str] = None
    branch_id: Optional[int] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _expense_to_dict(e: Expense) -> dict:
    return {
        "id": e.id,
        "amount": float(e.amount),
        "category": e.category,
        "description": e.description,
        "branch_id": e.branch_id,
        "branch_name": e.branch.name if e.branch else None,
        "user_name": (e.user.full_name or e.user.username) if e.user else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_expense_stats(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
):
    today = date.today()
    month_start = today.replace(day=1)
    # `today.replace(day=...)` reventaba con ValueError los dias en que
    # day <= weekday (p.ej. martes 1 de mes): restar los dias es lo correcto.
    week_start = today - timedelta(days=today.weekday())

    base = db.query(Expense).filter(Expense.organization_id == org_id)

    total_month = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.organization_id == org_id,
        cast(Expense.created_at, Date) >= month_start,
    ).scalar()

    total_week = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.organization_id == org_id,
        cast(Expense.created_at, Date) >= week_start,
    ).scalar()

    total_count = base.filter(cast(Expense.created_at, Date) >= month_start).count()

    avg_daily = float(total_month) / max(today.day, 1)

    # Categoría con más gasto este mes
    from sqlalchemy import text
    top_cat_row = db.execute(
        text("""
            SELECT category, SUM(amount) AS total
            FROM expenses
            WHERE organization_id = :org_id
              AND DATE(created_at) >= :month_start
            GROUP BY category
            ORDER BY total DESC
            LIMIT 1
        """),
        {"org_id": org_id, "month_start": month_start.isoformat()}
    ).fetchone()
    top_category = top_cat_row[0] if top_cat_row else "—"

    # Gastos por categoría (para gráfica)
    cats = db.execute(
        text("""
            SELECT category, SUM(amount) AS total
            FROM expenses
            WHERE organization_id = :org_id
              AND DATE(created_at) >= :month_start
            GROUP BY category
            ORDER BY total DESC
        """),
        {"org_id": org_id, "month_start": month_start.isoformat()}
    ).fetchall()

    return {
        "total_month": round(float(total_month), 2),
        "total_week": round(float(total_week), 2),
        "count_month": total_count,
        "avg_daily": round(avg_daily, 2),
        "top_category": top_category,
        "by_category": [{"category": r[0], "total": round(float(r[1]), 2)} for r in cats],
    }


@router.get("/categories")
def get_categories(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
):
    """Categorías únicas usadas en la organización."""
    rows = db.query(Expense.category).filter(
        Expense.organization_id == org_id
    ).distinct().order_by(Expense.category).all()
    used = [r[0] for r in rows]

    defaults = [
        "Limpieza", "Papelería", "Servicios (Luz/Agua/Internet)",
        "Mantenimiento", "Alimentación", "Transporte", "Publicidad", "Otros",
    ]
    merged = sorted(set(defaults) | set(used))
    return merged


@router.get("/")
def list_expenses(
    branch_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    date_start: Optional[date] = Query(None),
    date_end: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
):
    query = db.query(Expense).filter(Expense.organization_id == org_id)

    if branch_id:
        query = query.filter(Expense.branch_id == branch_id)
    if category:
        query = query.filter(Expense.category == category)
    if date_start:
        query = query.filter(cast(Expense.created_at, Date) >= date_start)
    if date_end:
        query = query.filter(cast(Expense.created_at, Date) <= date_end)

    total = query.count()
    items = query.order_by(Expense.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [_expense_to_dict(e) for e in items],
    }


@router.post("", include_in_schema=False)
@router.post("/")
def create_expense(
    payload: ExpenseIn,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
    current_user: User = Depends(get_current_user),
):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero.")
    if not payload.category.strip():
        raise HTTPException(status_code=400, detail="La categoría es requerida.")

    if payload.branch_id:
        branch = db.query(Branch).filter(
            Branch.id == payload.branch_id,
            Branch.organization_id == org_id,
        ).first()
        if not branch:
            raise HTTPException(status_code=400, detail="Sucursal inválida.")

    expense = Expense(
        organization_id=org_id,
        branch_id=payload.branch_id,
        amount=payload.amount,
        category=payload.category.strip(),
        description=payload.description,
        user_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _expense_to_dict(expense)


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
    current_user: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.organization_id == org_id,
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    db.delete(expense)
    db.commit()
    return {"ok": True}
