"""Atlas BOS modules/appointments/router — Backoffice REST API.

Endpoints for staff (require_module + tenant guard). Customer portal
endpoints live in portal_router.py.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant_query import get_tenant_scoped, scoped_query
from app.models import User
from app.modules.appointments.models import (
    Professional,
    ProfessionalBlock,
    ProfessionalSchedule,
    Resource,
    Service,
)
from app.modules.appointments.schemas import (
    BlockCreate,
    BlockRead,
    ProfessionalCreate,
    ProfessionalRead,
    ProfessionalUpdate,
    ResourceCreate,
    ResourceRead,
    ResourceUpdate,
    ScheduleReplaceRequest,
    ServiceFromVariant,
    ServiceRead,
    ServiceUpdate,
)

router = APIRouter()


def _org_id(user: User) -> int:
    org = getattr(user, "organization_id", None)
    if org is None:
        raise HTTPException(status_code=400, detail="No active organization in context")
    return org


# ── Resources ───────────────────────────────────────────────────────────────

@router.get("/resources", response_model=List[ResourceRead])
def list_resources(
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, Resource, current_user).filter(Resource.is_active == True)  # noqa: E712
    if branch_id is not None:
        q = q.filter(Resource.branch_id == branch_id)
    return q.order_by(Resource.name).all()


@router.post("/resources", response_model=ResourceRead, status_code=status.HTTP_201_CREATED)
def create_resource(
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = Resource(organization_id=_org_id(current_user), **payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/resources/{resource_id}", response_model=ResourceRead)
def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = get_tenant_scoped(db, Resource, resource_id, current_user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = get_tenant_scoped(db, Resource, resource_id, current_user)
    r.is_active = False
    db.commit()


# ── Professionals ───────────────────────────────────────────────────────────

@router.get("/professionals", response_model=List[ProfessionalRead])
def list_professionals(
    branch_id: Optional[int] = None,
    only_bookable: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, Professional, current_user)
    if branch_id is not None:
        q = q.filter(Professional.branch_id == branch_id)
    if only_bookable:
        q = q.filter(Professional.is_bookable == True)  # noqa: E712
    results = q.all()
    # Hydrate user_full_name for the UI
    out = []
    for p in results:
        obj = ProfessionalRead.model_validate(p)
        out.append(obj.model_copy(update={"user_full_name": p.user.full_name if p.user else None}))
    return out


@router.post("/professionals", response_model=ProfessionalRead, status_code=status.HTTP_201_CREATED)
def create_professional(
    payload: ProfessionalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = Professional(organization_id=_org_id(current_user), **payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/professionals/{prof_id}", response_model=ProfessionalRead)
def update_professional(
    prof_id: int,
    payload: ProfessionalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = get_tenant_scoped(db, Professional, prof_id, current_user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/professionals/{prof_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_professional(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = get_tenant_scoped(db, Professional, prof_id, current_user)
    p.is_bookable = False
    db.commit()


# ── Schedule ────────────────────────────────────────────────────────────────

@router.get("/professionals/{prof_id}/schedule")
def get_schedule(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_tenant_scoped(db, Professional, prof_id, current_user)  # tenant guard
    rows = (
        db.query(ProfessionalSchedule)
        .filter(
            ProfessionalSchedule.professional_id == prof_id,
            ProfessionalSchedule.organization_id == _org_id(current_user),
        )
        .order_by(ProfessionalSchedule.weekday)
        .all()
    )
    return [
        {"weekday": r.weekday, "start_time": r.start_time.isoformat(), "end_time": r.end_time.isoformat()}
        for r in rows
    ]


@router.put("/professionals/{prof_id}/schedule")
def replace_schedule(
    prof_id: int,
    payload: ScheduleReplaceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_tenant_scoped(db, Professional, prof_id, current_user)
    org_id = _org_id(current_user)
    # Validate ALL slots first — refuse the entire request before any destructive op
    for slot in payload.slots:
        if slot.start_time >= slot.end_time:
            raise HTTPException(status_code=422, detail=f"weekday {slot.weekday}: start_time must be before end_time")
    # Replace atomically: delete current rows then insert new ones
    db.query(ProfessionalSchedule).filter(
        ProfessionalSchedule.professional_id == prof_id,
        ProfessionalSchedule.organization_id == org_id,
    ).delete()
    for slot in payload.slots:
        db.add(ProfessionalSchedule(
            organization_id=org_id, professional_id=prof_id,
            weekday=slot.weekday, start_time=slot.start_time, end_time=slot.end_time,
        ))
    db.commit()
    return {"status": "ok", "slots": len(payload.slots)}


# ── Blocks ──────────────────────────────────────────────────────────────────

@router.get("/professionals/{prof_id}/blocks", response_model=List[BlockRead])
def list_blocks(
    prof_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_tenant_scoped(db, Professional, prof_id, current_user)
    return (
        db.query(ProfessionalBlock)
        .filter(
            ProfessionalBlock.professional_id == prof_id,
            ProfessionalBlock.organization_id == _org_id(current_user),
        )
        .order_by(ProfessionalBlock.starts_at)
        .all()
    )


@router.post("/professionals/{prof_id}/blocks", response_model=BlockRead, status_code=status.HTTP_201_CREATED)
def create_block(
    prof_id: int,
    payload: BlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = get_tenant_scoped(db, Professional, prof_id, current_user)
    if payload.starts_at >= payload.ends_at:
        raise HTTPException(status_code=422, detail="starts_at must be before ends_at")
    blk = ProfessionalBlock(
        organization_id=_org_id(current_user),
        professional_id=prof_id,
        **payload.model_dump(),
    )
    db.add(blk)
    db.commit()
    db.refresh(blk)
    return blk


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    blk = get_tenant_scoped(db, ProfessionalBlock, block_id, current_user)
    db.delete(blk)
    db.commit()


# ── Services ────────────────────────────────────────────────────────────────

@router.get("/services", response_model=List[ServiceRead])
def list_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = scoped_query(db, Service, current_user).all()
    out = []
    for s in rows:
        obj = ServiceRead.model_validate(s)
        out.append(obj.model_copy(update={"variant_name": s.variant.variant_name if s.variant else None}))
    return out


@router.post("/services/from-variant", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def upgrade_variant_to_service(
    payload: ServiceFromVariant,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the variant belongs to the user's org
    from app.models.products import ProductVariant
    variant = (
        db.query(ProductVariant)
        .filter(
            ProductVariant.id == payload.variant_id,
            ProductVariant.organization_id == _org_id(current_user),
        )
        .first()
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    if (
        db.query(Service)
        .filter(Service.product_variant_id == payload.variant_id)
        .first()
    ):
        raise HTTPException(status_code=409, detail="Variant is already a Service")

    s = Service(
        organization_id=_org_id(current_user),
        product_variant_id=payload.variant_id,
        duration_minutes=payload.duration_minutes,
        buffer_minutes_after=payload.buffer_minutes_after,
        requires_resource_type=payload.requires_resource_type,
        is_bookable_online=payload.is_bookable_online,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/services/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = get_tenant_scoped(db, Service, service_id, current_user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = get_tenant_scoped(db, Service, service_id, current_user)
    db.delete(s)
    db.commit()
