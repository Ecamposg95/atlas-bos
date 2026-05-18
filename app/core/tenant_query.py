"""Atlas BOS core/tenant_query — multi-tenant query helpers.

Enforces docs/modules/MODULE_GUIDE.md §6: every business query MUST filter
by `organization_id` (or `tenant_id`). These helpers centralize that filter
so routers don't repeat the boilerplate AND don't accidentally skip it.

Usage:

    from app.core.tenant_query import get_tenant_scoped, scoped_query

    # Fetch by id with tenant guard. Raises 404 if not found OR not in tenant.
    sale = get_tenant_scoped(db, SalesDocument, sale_id, current_user)

    # Wrap an existing query with the tenant filter:
    pending = scoped_query(db, SalesDocument, current_user).filter(
        SalesDocument.status == "PENDING"
    ).all()

The helpers refuse models that lack an `organization_id` column (it would
silently no-op). For legitimately tenant-less models (Module, Branch,
Organization, etc.) keep using the regular `db.query(...)` — the audit
script whitelists those.
"""
from typing import Optional, Type, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Query, Session

T = TypeVar("T")


def _tenant_column(model):
    """Return the column to filter on, or None if model is tenant-less."""
    for attr in ("organization_id", "tenant_id"):
        col = getattr(model, attr, None)
        if col is not None:
            return col
    return None


def _resolve_org_id(user) -> Optional[int]:
    """Pick the active org_id from the user.

    Tries `user.organization_id` first (set by some auth flows), falls back to
    the first active `UserOrganization` relation. Returns None if the user
    has no tenant context — caller decides whether that's an error.
    """
    direct = getattr(user, "organization_id", None)
    if direct:
        return direct

    orgs = getattr(user, "organizations", None) or []
    for link in orgs:
        if getattr(link, "is_active", True):
            return getattr(link, "organization_id", None) or getattr(link, "org_id", None)
    return None


def get_tenant_scoped(
    db: Session,
    model: Type[T],
    item_id,
    user,
    *,
    raise_404: bool = True,
    extra_filter=None,
) -> Optional[T]:
    """SELECT by primary key with mandatory tenant filter.

    Returns the row if it exists AND belongs to the user's active org.
    If `raise_404=True` (default), raises HTTPException(404) when missing.
    Returns None instead when `raise_404=False`.

    The model must have an `organization_id` column (or `tenant_id`).
    Calling this on a tenant-less model raises ValueError — that's a
    programming error.
    """
    col = _tenant_column(model)
    if col is None:
        raise ValueError(
            f"{model.__name__} has no organization_id/tenant_id column; "
            f"use db.query(...) directly or add the column."
        )

    org_id = _resolve_org_id(user)
    if org_id is None:
        if raise_404:
            raise HTTPException(status_code=400, detail="No active organization in context")
        return None

    q = db.query(model).filter(model.id == item_id, col == org_id)
    if extra_filter is not None:
        q = q.filter(extra_filter)
    obj = q.first()

    if obj is None and raise_404:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return obj


def scoped_query(db: Session, model: Type[T], user) -> Query:
    """Start a query that's already scoped to the user's active org.

    Lets the caller chain further `.filter()`, `.order_by()`, etc.:

        items = scoped_query(db, Product, current_user) \\
            .filter(Product.is_active == True) \\
            .order_by(Product.name) \\
            .all()

    Refuses tenant-less models (raises ValueError).
    """
    col = _tenant_column(model)
    if col is None:
        raise ValueError(
            f"{model.__name__} has no organization_id/tenant_id column; "
            f"use db.query(...) directly."
        )

    org_id = _resolve_org_id(user)
    if org_id is None:
        raise HTTPException(status_code=400, detail="No active organization in context")

    return db.query(model).filter(col == org_id)
