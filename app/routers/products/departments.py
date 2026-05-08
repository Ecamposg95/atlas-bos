"""``GET /api/products/departments`` — list of departments for filter dropdowns.

NOTE: this is the `/departments` endpoint mounted under the `/api/products`
prefix. The legacy `departments_router` (mounted at `/api/departments`)
lives in the package `__init__.py` and is unrelated to this file.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List

from app.core.database import get_db
from app.core.tenant_context import get_current_active_organization
from app.models import Department
from app.schemas.products import DepartmentRead

router = APIRouter()


@router.get("/departments", response_model=List[DepartmentRead])
def get_departments(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization)
):
    """Returns list of departments for filter dropdowns."""
    departments = db.query(Department).filter(
        or_(Department.organization_id == org_id, Department.organization_id == None)
    ).order_by(Department.name).all()
    return departments
