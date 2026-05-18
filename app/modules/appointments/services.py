"""Atlas BOS modules/appointments/services — business logic.

Core algorithm: `get_availability()` — single source of truth for "what
slots can be booked." Used both by backoffice and by the customer portal.

Lifecycle helpers: `transition_appointment_status()` and friends.
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.appointments.models import (
    Appointment,
    AppointmentStatus,
    Professional,
    ProfessionalBlock,
    ProfessionalSchedule,
    Resource,
    Service,
)

ACTIVE_STATUSES = {
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
}


def _combine_utc(d: date, t: time) -> datetime:
    """Combine date + time as UTC. Org-timezone awareness is a follow-up."""
    return datetime(d.year, d.month, d.day, t.hour, t.minute, tzinfo=timezone.utc)


def get_availability(
    db: Session,
    *,
    organization_id: int,
    branch_id: int,
    target_date: date,
    service_ids: List[int],
    professional_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    slot_minutes: int = 15,
) -> List[dict]:
    """Compute available slots for a date.

    Returns a list of dicts: {start, end, professional_id, resource_id}.
    Raises HTTPException(422) if services need a resource type the branch
    doesn't have active.
    """
    # 1. Load services + total duration
    services = (
        db.query(Service)
        .filter(Service.organization_id == organization_id, Service.id.in_(service_ids))
        .all()
    )
    if len(services) != len(service_ids):
        raise HTTPException(status_code=422, detail="One or more services not found")

    total_minutes = sum(s.duration_minutes + s.buffer_minutes_after for s in services)
    total_delta = timedelta(minutes=total_minutes)

    # 2. Validate resource requirement if any
    required_type = next((s.requires_resource_type for s in services if s.requires_resource_type), None)
    if required_type is not None:
        available_resources = (
            db.query(Resource)
            .filter(
                Resource.organization_id == organization_id,
                Resource.branch_id == branch_id,
                Resource.resource_type == required_type,
                Resource.is_active == True,  # noqa: E712
            )
            .count()
        )
        if available_resources == 0:
            raise HTTPException(
                status_code=422,
                detail=f"Branch has no active {required_type.value} resources required by service",
            )

    # 3. Candidate professionals
    pros_q = db.query(Professional).filter(
        Professional.organization_id == organization_id,
        Professional.branch_id == branch_id,
        Professional.is_bookable == True,  # noqa: E712
    )
    if professional_id is not None:
        pros_q = pros_q.filter(Professional.id == professional_id)
    pros = pros_q.all()
    if not pros:
        return []

    weekday = target_date.weekday()
    pro_ids = [p.id for p in pros]

    # 4. Pre-load schedules, blocks, appointments for the day in 3 queries
    schedules = {
        s.professional_id: s
        for s in db.query(ProfessionalSchedule)
        .filter(
            ProfessionalSchedule.organization_id == organization_id,
            ProfessionalSchedule.professional_id.in_(pro_ids),
            ProfessionalSchedule.weekday == weekday,
        )
        .all()
    }

    start_of_day = _combine_utc(target_date, time(0, 0))
    end_of_day = start_of_day + timedelta(days=1)

    blocks_by_pro: dict = {pid: [] for pid in pro_ids}
    for blk in (
        db.query(ProfessionalBlock)
        .filter(
            ProfessionalBlock.organization_id == organization_id,
            ProfessionalBlock.professional_id.in_(pro_ids),
            ProfessionalBlock.starts_at < end_of_day,
            ProfessionalBlock.ends_at > start_of_day,
        )
        .all()
    ):
        blocks_by_pro[blk.professional_id].append(blk)

    appts_by_pro: dict = {pid: [] for pid in pro_ids}
    for ap in (
        db.query(Appointment)
        .filter(
            Appointment.organization_id == organization_id,
            Appointment.branch_id == branch_id,
            Appointment.starts_at < end_of_day,
            Appointment.ends_at > start_of_day,
            Appointment.status.in_(ACTIVE_STATUSES),
        )
        .all()
    ):
        if ap.professional_id in appts_by_pro:
            appts_by_pro[ap.professional_id].append(ap)

    # 5. Resource-specific appointments (if resource_id pinned)
    resource_appts: List[Appointment] = []
    if resource_id is not None:
        resource_appts = (
            db.query(Appointment)
            .filter(
                Appointment.organization_id == organization_id,
                Appointment.resource_id == resource_id,
                Appointment.starts_at < end_of_day,
                Appointment.ends_at > start_of_day,
                Appointment.status.in_(ACTIVE_STATUSES),
            )
            .all()
        )

    slot_delta = timedelta(minutes=slot_minutes)
    out: List[dict] = []

    for pro in pros:
        sched = schedules.get(pro.id)
        if not sched:
            continue
        window_start = _combine_utc(target_date, sched.start_time)
        window_end = _combine_utc(target_date, sched.end_time)

        cursor = window_start
        while cursor + total_delta <= window_end:
            slot_end = cursor + total_delta
            # Conflict checks
            if _overlaps_any(cursor, slot_end, blocks_by_pro.get(pro.id, [])):
                cursor += slot_delta
                continue
            if _overlaps_any(cursor, slot_end, appts_by_pro.get(pro.id, [])):
                cursor += slot_delta
                continue
            if resource_id is not None and _overlaps_any(cursor, slot_end, resource_appts):
                cursor += slot_delta
                continue
            out.append({
                "start": cursor,
                "end": slot_end,
                "professional_id": pro.id,
                "resource_id": resource_id,
            })
            cursor += slot_delta

    out.sort(key=lambda s: (s["start"], s["professional_id"]))
    return out


def _overlaps_any(start: datetime, end: datetime, items) -> bool:
    for it in items:
        it_start = getattr(it, "starts_at", None)
        it_end = getattr(it, "ends_at", None)
        if it_start is None or it_end is None:
            continue
        if it_start < end and it_end > start:
            return True
    return False


def acquire_professional_lock(db: Session, professional_id: int) -> None:
    """Postgres advisory lock to prevent double-booking races.

    No-op on SQLite (tests). Lock is released automatically at COMMIT or
    ROLLBACK of the surrounding transaction.
    """
    if db.bind.dialect.name != "postgresql":
        return
    from sqlalchemy import text
    # Use professional_id directly as the lock key — Python's hash() is
    # randomized per process (PYTHONHASHSEED), which would silently break
    # serialization across gunicorn/uvicorn workers.
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": int(professional_id)})
