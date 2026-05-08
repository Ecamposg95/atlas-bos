from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_active_organization
from app.security import get_current_user
from app.models.users import User
from app.models.organization import Branch
from app.schemas.branch_dashboard import BranchDashboardRead
from app.services.branch_dashboard import BranchDashboardService

router = APIRouter()


@router.get("/dashboard", response_model=BranchDashboardRead)
def get_dashboard(
    x_branch_id: Optional[int] = Header(None, alias="X-Branch-ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: int = Depends(get_current_active_organization),
) -> BranchDashboardRead:
    if current_user.branch_id is not None:
        branch_id = current_user.branch_id
    elif x_branch_id is not None:
        # HQ user must explicitly pick a branch — validate it belongs to the active org
        valid = (
            db.query(Branch.id)
            .filter(Branch.id == x_branch_id, Branch.organization_id == organization_id)
            .first()
        )
        if not valid:
            raise HTTPException(status_code=404, detail="branch not found in active organization")
        branch_id = x_branch_id
    else:
        raise HTTPException(status_code=400, detail="branch context required")

    return BranchDashboardService(db, current_user, organization_id, branch_id).build()
