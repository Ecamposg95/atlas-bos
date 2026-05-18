"""Atlas BOS modules/appointments/portal_router — public customer booking.

Auth: customer logs in as User(role=CLIENTE). Register endpoint creates
User + Customer linked by email + organization. Login reuses the
standard /api/auth/login OAuth2PasswordRequestForm flow.

URL prefix: /api/portal/booking/*
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    get_password_hash,
)
from app.models import User
from app.models.users import PlatformRole, Role, UserOrganization
from app.modules.appointments.models import (
    Appointment,
    AppointmentEvent,
    AppointmentEventType,
    AppointmentService as ApptServiceLink,
    AppointmentStatus,
    BookingChannel,
    Professional,
    Service,
)
from app.modules.appointments.services import (
    acquire_professional_lock,
    get_availability,
)
from app.modules.customers.models import Customer
from app.modules.tenants.models import Branch, Organization

router = APIRouter()


# ── Schemas (inline because they're specific to portal) ─────────────────────

class PortalRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    org_slug: str


class PortalLogin(BaseModel):
    email: EmailStr
    password: str
    org_slug: str


class PortalBookingCreate(BaseModel):
    branch_id: int
    professional_id: int
    service_ids: List[int]
    starts_at: datetime


# ── Helpers ─────────────────────────────────────────────────────────────────

def _org_from_slug(db: Session, slug: str) -> Organization:
    org = db.query(Organization).filter(Organization.slug == slug).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def _customer_for_portal_user(db: Session, user: User) -> Customer:
    """Resolve the Customer record linked to a portal User (role=CLIENTE)."""
    if user.role != Role.CLIENTE:
        raise HTTPException(status_code=403, detail="Not a portal customer")
    # The User is linked to ONE active organization through UserOrganization
    org_link = (
        db.query(UserOrganization)
        .filter(UserOrganization.user_id == user.id, UserOrganization.is_active == True)  # noqa: E712
        .first()
    )
    if not org_link:
        raise HTTPException(status_code=400, detail="Portal user has no active org")
    cust = (
        db.query(Customer)
        .filter(
            Customer.organization_id == org_link.organization_id,
            Customer.email == user.username,
        )
        .first()
    )
    if not cust:
        raise HTTPException(status_code=404, detail="Customer record not found for portal user")
    return cust


# ── Auth ────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
def portal_register(payload: PortalRegister, db: Session = Depends(get_db)):
    org = _org_from_slug(db, payload.org_slug)

    # User unique by username (email)
    existing = db.query(User).filter(User.username == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already exists, try login")

    user = User(
        username=payload.email,
        full_name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=get_password_hash(payload.password),
        role=Role.CLIENTE,
        platform_role=PlatformRole.NONE,
        is_active=True,
    )
    db.add(user); db.flush()

    # Link to org
    db.add(UserOrganization(user_id=user.id, organization_id=org.id, is_active=True, org_role="MEMBER"))

    # Create matching Customer
    cust = (
        db.query(Customer)
        .filter(Customer.organization_id == org.id, Customer.email == payload.email)
        .first()
    )
    if cust is None:
        cust = Customer(
            organization_id=org.id,
            name=payload.name,
            email=payload.email,
            phone=payload.phone,
        )
        db.add(cust)

    db.commit()

    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer", "user_id": user.id, "org_id": org.id}


@router.get("/me")
def portal_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != Role.CLIENTE:
        raise HTTPException(status_code=403, detail="Not a portal customer")
    cust = _customer_for_portal_user(db, current_user)
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "customer_id": cust.id,
        "organization_id": cust.organization_id,
        "name": cust.name,
    }


# ── Public discovery (no auth required) ─────────────────────────────────────

@router.get("/branches")
def portal_list_branches(org_slug: str, db: Session = Depends(get_db)):
    org = _org_from_slug(db, org_slug)
    rows = (
        db.query(Branch)
        .filter(Branch.organization_id == org.id, Branch.is_active == True)  # noqa: E712
        .order_by(Branch.name)
        .all()
    )
    return [{"id": b.id, "name": b.name, "city": b.city} for b in rows]


@router.get("/services")
def portal_list_services(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    rows = (
        db.query(Service)
        .filter(
            Service.organization_id == branch.organization_id,
            Service.is_bookable_online == True,  # noqa: E712
        )
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.variant.variant_name if s.variant else None,
            "duration_minutes": s.duration_minutes,
            "price": float(s.variant.price) if s.variant and s.variant.price else None,
        }
        for s in rows
    ]


@router.get("/professionals")
def portal_list_professionals(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    rows = (
        db.query(Professional)
        .filter(
            Professional.organization_id == branch.organization_id,
            Professional.branch_id == branch_id,
            Professional.is_bookable == True,  # noqa: E712
        )
        .all()
    )
    return [
        {"id": p.id, "name": p.user.full_name if p.user else None,
         "bio": p.bio, "photo_url": p.photo_url, "color": p.color}
        for p in rows
    ]


@router.get("/availability")
def portal_availability(
    branch_id: int,
    date: str,
    service_ids: str,
    professional_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    from datetime import date as _date
    try:
        target = _date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
    ids = [int(s) for s in service_ids.split(",") if s.strip()]
    return get_availability(
        db,
        organization_id=branch.organization_id,
        branch_id=branch_id,
        target_date=target,
        service_ids=ids,
        professional_id=professional_id,
    )


# ── Authenticated booking ───────────────────────────────────────────────────

@router.post("/appointments", status_code=status.HTTP_201_CREATED)
def portal_book(
    payload: PortalBookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _customer_for_portal_user(db, current_user)
    org_id = cust.organization_id

    # Verify the branch belongs to the customer's org (multi-tenant data integrity)
    branch = db.query(Branch).filter(
        Branch.id == payload.branch_id, Branch.organization_id == org_id,
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    pro = db.query(Professional).filter(
        Professional.id == payload.professional_id, Professional.organization_id == org_id,
    ).first()
    if not pro:
        raise HTTPException(status_code=404, detail="Professional not found")

    svcs = db.query(Service).filter(
        Service.organization_id == org_id, Service.id.in_(payload.service_ids),
        Service.is_bookable_online == True,  # noqa: E712
    ).all()
    if len(svcs) != len(payload.service_ids):
        raise HTTPException(status_code=422, detail="Service(s) not bookable online")

    total = sum(s.duration_minutes + s.buffer_minutes_after for s in svcs)
    ends_at = payload.starts_at + timedelta(minutes=total)

    acquire_professional_lock(db, payload.professional_id)

    # Conflict check (same logic as backoffice)
    conflict = db.query(Appointment).filter(
        Appointment.organization_id == org_id,
        Appointment.professional_id == payload.professional_id,
        Appointment.starts_at < ends_at,
        Appointment.ends_at > payload.starts_at,
        Appointment.status.in_([
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
        ]),
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Slot no longer available")

    appt = Appointment(
        organization_id=org_id,
        branch_id=payload.branch_id,
        customer_id=cust.id,
        professional_id=payload.professional_id,
        starts_at=payload.starts_at,
        ends_at=ends_at,
        booking_channel=BookingChannel.PORTAL,
        created_by=current_user.id,
    )
    db.add(appt); db.flush()
    for idx, svc in enumerate(svcs):
        db.add(ApptServiceLink(
            organization_id=org_id, appointment_id=appt.id, service_id=svc.id,
            sort_order=idx, duration_minutes=svc.duration_minutes,
        ))
    db.add(AppointmentEvent(
        organization_id=org_id, appointment_id=appt.id,
        event_type=AppointmentEventType.CREATED,
        actor_user_id=current_user.id, payload={"channel": "PORTAL"},
    ))
    db.commit()
    db.refresh(appt)
    return {
        "id": appt.id,
        "status": appt.status.value,
        "booking_channel": appt.booking_channel.value,
        "starts_at": appt.starts_at.isoformat(),
        "ends_at": appt.ends_at.isoformat(),
    }


@router.get("/appointments")
def portal_my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _customer_for_portal_user(db, current_user)
    rows = (
        db.query(Appointment)
        .filter(
            Appointment.organization_id == cust.organization_id,
            Appointment.customer_id == cust.id,
        )
        .order_by(Appointment.starts_at.desc())
        .all()
    )
    return [
        {"id": a.id, "starts_at": a.starts_at.isoformat(), "ends_at": a.ends_at.isoformat(),
         "status": a.status.value, "professional_id": a.professional_id,
         "branch_id": a.branch_id}
        for a in rows
    ]


@router.post("/appointments/{aid}/cancel")
def portal_cancel(
    aid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _customer_for_portal_user(db, current_user)
    appt = (
        db.query(Appointment)
        .filter(
            Appointment.id == aid,
            Appointment.organization_id == cust.organization_id,
            Appointment.customer_id == cust.id,
        )
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.status not in (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED):
        raise HTTPException(status_code=409, detail=f"Cannot cancel from {appt.status.value}")
    # 24h window check — normalize starts_at to UTC-aware since SQLite strips tzinfo
    # from DateTime(timezone=True) columns, which would crash the subtraction below.
    now = datetime.now(timezone.utc)
    starts_at = appt.starts_at if appt.starts_at.tzinfo else appt.starts_at.replace(tzinfo=timezone.utc)
    if starts_at - now < timedelta(hours=24):
        raise HTTPException(status_code=409, detail="Too close to start time (24h policy)")
    appt.status = AppointmentStatus.CANCELED
    db.add(AppointmentEvent(
        organization_id=cust.organization_id, appointment_id=appt.id,
        event_type=AppointmentEventType.CANCELED, actor_user_id=current_user.id,
        payload={"by": "portal"},
    ))
    db.commit()
    return {"id": appt.id, "status": appt.status.value}
