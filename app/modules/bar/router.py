"""Atlas BOS modules/bar/router — inventario líquido REST API."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant_query import _resolve_org_id, get_tenant_scoped, scoped_query
from app.models import User
from app.modules.bar import services
from app.modules.bar.models import BarBottle, BottleStatus
from app.modules.bar.schemas import (
    BarReport,
    BottleCreate,
    BottleRead,
    PourRequest,
    RefillRequest,
    WasteRequest,
)

router = APIRouter()


def _org_id(user: User) -> int:
    org = _resolve_org_id(user)
    if org is None:
        raise HTTPException(status_code=400, detail="No active organization in context")
    return org


@router.get("/bottles", response_model=List[BottleRead])
def list_bottles(
    branch_id: Optional[int] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, BarBottle, current_user)
    if not include_archived:
        q = q.filter(BarBottle.status != BottleStatus.ARCHIVED)
    if branch_id is not None:
        q = q.filter(BarBottle.branch_id == branch_id)
    return q.order_by(BarBottle.status, BarBottle.name).all()


@router.post("/bottles", response_model=BottleRead, status_code=status.HTTP_201_CREATED)
def open_bottle(
    payload: BottleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()
    bottle = BarBottle(
        organization_id=_org_id(current_user),
        remaining_ml=data["full_volume_ml"],
        status=BottleStatus.OPEN,
        **data,
    )
    db.add(bottle)
    db.flush()
    services.record_open(db, bottle, user_id=current_user.id)
    db.commit()
    db.refresh(bottle)
    return bottle


@router.get("/report", response_model=BarReport)
def bar_report(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Corte del bar: servido, merma y varianza por botella en un rango. Para el
    corte de turno, `start` = hora de apertura del turno."""
    return services.bar_report(
        db, organization_id=_org_id(current_user),
        branch_id=branch_id, start=start, end=end,
    )


@router.post("/bottles/{bottle_id}/pour", response_model=BottleRead)
def pour_bottle(
    bottle_id: int,
    payload: PourRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bottle = get_tenant_scoped(db, BarBottle, bottle_id, current_user)
    ml = payload.ml if payload.ml is not None else bottle.pour_size_ml
    return services.pour(db, bottle, ml, payload.count, user_id=current_user.id)


@router.post("/bottles/{bottle_id}/waste", response_model=BottleRead)
def waste_bottle(
    bottle_id: int,
    payload: WasteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bottle = get_tenant_scoped(db, BarBottle, bottle_id, current_user)
    return services.waste(db, bottle, payload.ml, reason=payload.reason, user_id=current_user.id)


@router.post("/bottles/{bottle_id}/refill", response_model=BottleRead)
def refill_bottle(
    bottle_id: int,
    payload: RefillRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bottle = get_tenant_scoped(db, BarBottle, bottle_id, current_user)
    return services.set_remaining(db, bottle, payload.remaining_ml, user_id=current_user.id)


@router.delete("/bottles/{bottle_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_bottle(
    bottle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bottle = get_tenant_scoped(db, BarBottle, bottle_id, current_user)
    bottle.status = BottleStatus.ARCHIVED
    db.commit()
    return None
