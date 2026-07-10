"""Atlas BOS modules/appointments/router — Backoffice REST API.

Endpoints for staff (require_module + tenant guard). Customer portal
endpoints live in portal_router.py.
"""
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant_query import _resolve_org_id, get_tenant_scoped, scoped_query
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
    # User no tiene columna `organization_id` (solo relación); usar el resolvedor
    # de tenant robusto, igual que los módulos gastro. El getattr previo devolvía
    # None → "No active organization" espurio.
    org = _resolve_org_id(user)
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


# ── Availability ────────────────────────────────────────────────────────────

from datetime import date as _date  # noqa: E402
from typing import List as _List  # noqa: E402

from app.modules.appointments.schemas import (  # noqa: E402
    AvailabilitySlot,
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
    CancelAppointment,
    CompleteAppointment,
)
from app.modules.appointments.services import (  # noqa: E402
    acquire_professional_lock,
    get_availability,
)
from app.modules.appointments.models import (  # noqa: E402
    Appointment,
    AppointmentEvent,
    AppointmentEventType,
    AppointmentService as ApptServiceLink,
    AppointmentStatus,
    BookingChannel,
)


@router.get("/availability", response_model=_List[AvailabilitySlot])
def availability_endpoint(
    branch_id: int,
    date: str,
    service_ids: str = Query(..., description="comma-separated ids: '1,2,3'"),
    professional_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    slot_minutes: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        target = _date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
    ids = [int(s) for s in service_ids.split(",") if s.strip()]
    if not ids:
        raise HTTPException(status_code=422, detail="service_ids required")
    return get_availability(
        db,
        organization_id=_org_id(current_user),
        branch_id=branch_id,
        target_date=target,
        service_ids=ids,
        professional_id=professional_id,
        resource_id=resource_id,
        slot_minutes=slot_minutes,
    )


# ── Appointment CRUD + lifecycle ────────────────────────────────────────────

def _emit(db, appt: Appointment, ev_type: AppointmentEventType, actor_user_id: Optional[int] = None, payload=None):
    db.add(AppointmentEvent(
        organization_id=appt.organization_id,
        appointment_id=appt.id,
        event_type=ev_type,
        actor_user_id=actor_user_id,
        payload=payload,
    ))


def _services_or_422(db, org_id: int, service_ids: List[int]) -> List[Service]:
    svcs = db.query(Service).filter(Service.organization_id == org_id, Service.id.in_(service_ids)).all()
    if len(svcs) != len(service_ids):
        raise HTTPException(status_code=422, detail="Service(s) not found")
    return svcs


def _validate_no_conflict(db, *, org_id, professional_id, resource_id, starts_at, ends_at, exclude_id=None):
    q = db.query(Appointment).filter(
        Appointment.organization_id == org_id,
        Appointment.professional_id == professional_id,
        Appointment.starts_at < ends_at,
        Appointment.ends_at > starts_at,
        Appointment.status.in_([
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
        ]),
    )
    if exclude_id is not None:
        q = q.filter(Appointment.id != exclude_id)
    if q.first():
        raise HTTPException(status_code=409, detail="Professional has a conflicting appointment")
    if resource_id is not None:
        q2 = db.query(Appointment).filter(
            Appointment.organization_id == org_id,
            Appointment.resource_id == resource_id,
            Appointment.starts_at < ends_at,
            Appointment.ends_at > starts_at,
            Appointment.status.in_([
                AppointmentStatus.PENDING,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.IN_PROGRESS,
            ]),
        )
        if exclude_id is not None:
            q2 = q2.filter(Appointment.id != exclude_id)
        if q2.first():
            raise HTTPException(status_code=409, detail="Resource has a conflicting appointment")


@router.get("/appointments", response_model=List[AppointmentRead])
def list_appointments(
    branch_id: Optional[int] = None,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    professional_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, Appointment, current_user)
    if branch_id is not None:
        q = q.filter(Appointment.branch_id == branch_id)
    if professional_id is not None:
        q = q.filter(Appointment.professional_id == professional_id)
    if customer_id is not None:
        q = q.filter(Appointment.customer_id == customer_id)
    if from_:
        q = q.filter(Appointment.starts_at >= from_)
    if to:
        q = q.filter(Appointment.starts_at <= to)
    return q.order_by(Appointment.starts_at).all()


@router.post("/appointments", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _org_id(current_user)
    # Verify professional + customer + branch belong to org
    pro = get_tenant_scoped(db, Professional, payload.professional_id, current_user)
    svcs = _services_or_422(db, org_id, payload.service_ids)

    acquire_professional_lock(db, payload.professional_id)

    total = sum(s.duration_minutes + s.buffer_minutes_after for s in svcs)
    ends_at = payload.starts_at + timedelta(minutes=total)

    _validate_no_conflict(
        db,
        org_id=org_id, professional_id=payload.professional_id,
        resource_id=payload.resource_id,
        starts_at=payload.starts_at, ends_at=ends_at,
    )

    appt = Appointment(
        organization_id=org_id,
        branch_id=payload.branch_id,
        customer_id=payload.customer_id,
        professional_id=payload.professional_id,
        resource_id=payload.resource_id,
        starts_at=payload.starts_at,
        ends_at=ends_at,
        notes=payload.notes,
        booking_channel=BookingChannel.STAFF,
        created_by=current_user.id,
    )
    db.add(appt)
    db.flush()
    for idx, svc in enumerate(svcs):
        db.add(ApptServiceLink(
            organization_id=org_id, appointment_id=appt.id, service_id=svc.id,
            sort_order=idx, duration_minutes=svc.duration_minutes,
        ))
    _emit(db, appt, AppointmentEventType.CREATED, current_user.id)
    db.commit()
    db.refresh(appt)
    return appt


@router.get("/appointments/{aid}", response_model=AppointmentRead)
def get_appointment(
    aid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_tenant_scoped(db, Appointment, aid, current_user)


@router.put("/appointments/{aid}", response_model=AppointmentRead)
def update_appointment(
    aid: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    if appt.status in [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELED, AppointmentStatus.NO_SHOW]:
        raise HTTPException(status_code=409, detail=f"Cannot edit appointment in {appt.status.value}")
    org_id = appt.organization_id
    changed_time = False

    if payload.professional_id is not None:
        appt.professional_id = payload.professional_id
    if payload.resource_id is not None:
        appt.resource_id = payload.resource_id
    if payload.notes is not None:
        appt.notes = payload.notes
    if payload.service_ids is not None:
        svcs = _services_or_422(db, org_id, payload.service_ids)
        db.query(ApptServiceLink).filter(ApptServiceLink.appointment_id == appt.id).delete()
        for idx, svc in enumerate(svcs):
            db.add(ApptServiceLink(
                organization_id=org_id, appointment_id=appt.id, service_id=svc.id,
                sort_order=idx, duration_minutes=svc.duration_minutes,
            ))
        # recompute ends_at from current starts_at
        total = sum(s.duration_minutes + s.buffer_minutes_after for s in svcs)
        appt.ends_at = (payload.starts_at or appt.starts_at) + timedelta(minutes=total)
        changed_time = True
    if payload.starts_at is not None:
        appt.starts_at = payload.starts_at
        if not changed_time:
            # recompute ends_at based on current services snapshot
            durations = (
                db.query(ApptServiceLink.duration_minutes)
                .filter(ApptServiceLink.appointment_id == appt.id)
                .all()
            )
            total = sum(d[0] for d in durations)
            appt.ends_at = appt.starts_at + timedelta(minutes=total)
            changed_time = True

    if changed_time:
        acquire_professional_lock(db, appt.professional_id)
        _validate_no_conflict(
            db, org_id=org_id, professional_id=appt.professional_id,
            resource_id=appt.resource_id, starts_at=appt.starts_at, ends_at=appt.ends_at,
            exclude_id=appt.id,
        )
        _emit(db, appt, AppointmentEventType.RESCHEDULED, current_user.id,
              payload={"new_starts_at": appt.starts_at.isoformat()})

    db.commit()
    db.refresh(appt)
    return appt


def _transition(db, appt: Appointment, new_status: AppointmentStatus, allowed_from: List[AppointmentStatus],
                ev_type: AppointmentEventType, actor_id: int, payload=None):
    if appt.status not in allowed_from:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid transition from {appt.status.value} to {new_status.value}",
        )
    appt.status = new_status
    _emit(db, appt, ev_type, actor_id, payload=payload)
    db.commit()
    db.refresh(appt)


@router.post("/appointments/{aid}/confirm", response_model=AppointmentRead)
def confirm_appointment(aid: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    _transition(db, appt, AppointmentStatus.CONFIRMED, [AppointmentStatus.PENDING],
                AppointmentEventType.CONFIRMED, current_user.id)
    return appt


@router.post("/appointments/{aid}/start", response_model=AppointmentRead)
def start_appointment(aid: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    _transition(db, appt, AppointmentStatus.IN_PROGRESS, [AppointmentStatus.CONFIRMED],
                AppointmentEventType.STARTED, current_user.id)
    return appt


@router.post("/appointments/{aid}/complete", response_model=AppointmentRead)
def complete_appointment(
    aid: int,
    payload: CompleteAppointment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    if appt.status != AppointmentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid transition from {appt.status.value} to COMPLETED",
        )
    if payload.sales_document_id is not None:
        appt.sales_document_id = payload.sales_document_id
    if payload.actual_professional_id is not None:
        appt.actual_professional_id = payload.actual_professional_id
    appt.status = AppointmentStatus.COMPLETED
    _emit(db, appt, AppointmentEventType.COMPLETED, current_user.id,
          payload={"actual_professional_id": appt.actual_professional_id,
                   "sales_document_id": appt.sales_document_id})
    db.commit()
    db.refresh(appt)
    return appt


@router.post("/appointments/{aid}/cancel", response_model=AppointmentRead)
def cancel_appointment(
    aid: int,
    payload: CancelAppointment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    _transition(
        db, appt, AppointmentStatus.CANCELED,
        [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
        AppointmentEventType.CANCELED, current_user.id,
        payload={"reason": payload.reason},
    )
    return appt


@router.post("/appointments/{aid}/no-show", response_model=AppointmentRead)
def no_show_appointment(aid: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    appt = get_tenant_scoped(db, Appointment, aid, current_user)
    _transition(db, appt, AppointmentStatus.NO_SHOW,
                [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING],
                AppointmentEventType.NO_SHOW, current_user.id)
    return appt
