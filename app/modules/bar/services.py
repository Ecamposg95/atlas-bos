"""Atlas BOS modules/bar/services — lógica de botellas + ledger."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.bar.models import BarBottle, BarBottleEvent, BarEventType, BottleStatus

_ZERO = Decimal("0")


def _dec(v) -> Decimal:
    return Decimal(str(v or 0))


def _record_event(
    db: Session,
    bottle: BarBottle,
    event_type: str,
    old_ml: Decimal,
    *,
    user_id: Optional[int] = None,
    reason: Optional[str] = None,
    count: Optional[int] = None,
) -> None:
    """Anota un movimiento en el ledger. ml_change = firmado (nuevo − viejo)."""
    new_ml = _dec(bottle.remaining_ml)
    db.add(BarBottleEvent(
        organization_id=bottle.organization_id,
        branch_id=bottle.branch_id,
        bottle_id=bottle.id,
        event_type=event_type,
        ml_change=(new_ml - _dec(old_ml)),
        remaining_after=new_ml,
        count=count,
        reason=reason,
        user_id=user_id,
    ))


def record_open(db: Session, bottle: BarBottle, user_id: Optional[int] = None) -> None:
    """Evento OPEN al abrir una botella (ml_change = +volumen inicial)."""
    _record_event(db, bottle, BarEventType.OPEN, _ZERO, user_id=user_id)


def _sync_status(bottle: BarBottle) -> None:
    if bottle.status == BottleStatus.ARCHIVED:
        return
    bottle.status = BottleStatus.EMPTY if Decimal(str(bottle.remaining_ml or 0)) <= 0 else BottleStatus.OPEN


def _lock_bottle(db: Session, bottle_id: int) -> BarBottle:
    """Bloquea la fila de la botella y la refresca. Serializa pours/mermas/ajustes
    concurrentes sobre la misma botella (evita lost-update de remaining_ml).
    No-op en SQLite."""
    return (
        db.query(BarBottle)
        .filter(BarBottle.id == bottle_id)
        .populate_existing()
        .with_for_update()
        .first()
    )


def pour(
    db: Session, bottle: BarBottle, ml: Decimal, count: int = 1,
    user_id: Optional[int] = None,
) -> BarBottle:
    bottle = _lock_bottle(db, bottle.id) or bottle
    if bottle.status == BottleStatus.ARCHIVED:
        raise HTTPException(status_code=400, detail="La botella está archivada")
    old = _dec(bottle.remaining_ml)
    take = Decimal(str(ml)) * count
    bottle.remaining_ml = max(_ZERO, old - take)
    _sync_status(bottle)
    _record_event(db, bottle, BarEventType.POUR, old, user_id=user_id, count=count)
    db.commit()
    db.refresh(bottle)
    return bottle


def waste(
    db: Session, bottle: BarBottle, ml: Decimal,
    reason: Optional[str] = None, user_id: Optional[int] = None,
) -> BarBottle:
    bottle = _lock_bottle(db, bottle.id) or bottle
    old = _dec(bottle.remaining_ml)
    bottle.remaining_ml = max(_ZERO, old - Decimal(str(ml)))
    _sync_status(bottle)
    _record_event(db, bottle, BarEventType.WASTE, old, user_id=user_id, reason=reason)
    db.commit()
    db.refresh(bottle)
    return bottle


def set_remaining(
    db: Session, bottle: BarBottle, remaining_ml: Decimal,
    user_id: Optional[int] = None,
) -> BarBottle:
    bottle = _lock_bottle(db, bottle.id) or bottle
    old = _dec(bottle.remaining_ml)
    full = _dec(bottle.full_volume_ml)
    bottle.remaining_ml = max(_ZERO, min(full, Decimal(str(remaining_ml))))
    _sync_status(bottle)
    # En un reconteo, el delta (conteo − esperado) ES la varianza del turno.
    _record_event(db, bottle, BarEventType.REFILL, old, user_id=user_id)
    db.commit()
    db.refresh(bottle)
    return bottle


def bar_report(
    db: Session, *, organization_id: int, branch_id: Optional[int] = None,
    start: Optional[datetime] = None, end: Optional[datetime] = None,
) -> dict:
    """Corte del bar sobre un rango: por botella y totales, cuánto se sirvió,
    cuánto se mermó y la varianza (suma de reconteos = merma no registrada)."""
    q = db.query(BarBottleEvent).filter(BarBottleEvent.organization_id == organization_id)
    if branch_id is not None:
        q = q.filter(BarBottleEvent.branch_id == branch_id)
    if start is not None:
        q = q.filter(BarBottleEvent.created_at >= start)
    if end is not None:
        q = q.filter(BarBottleEvent.created_at <= end)

    rows: dict = {}
    for ev in q.all():
        r = rows.setdefault(ev.bottle_id, {
            "bottle_id": ev.bottle_id, "name": None,
            "poured_ml": _ZERO, "poured_count": 0, "wasted_ml": _ZERO, "variance_ml": _ZERO,
        })
        change = _dec(ev.ml_change)
        if ev.event_type == BarEventType.POUR:
            r["poured_ml"] += -change
            r["poured_count"] += int(ev.count or 0)
        elif ev.event_type == BarEventType.WASTE:
            r["wasted_ml"] += -change
        elif ev.event_type == BarEventType.REFILL:
            r["variance_ml"] += change

    # Resolver nombres de botella (una query).
    if rows:
        for b in db.query(BarBottle).filter(BarBottle.id.in_(list(rows.keys()))).all():
            rows[b.id]["name"] = b.name

    bottles = sorted(rows.values(), key=lambda x: x["poured_ml"], reverse=True)
    return {
        "poured_ml": sum((r["poured_ml"] for r in bottles), _ZERO),
        "wasted_ml": sum((r["wasted_ml"] for r in bottles), _ZERO),
        "variance_ml": sum((r["variance_ml"] for r in bottles), _ZERO),
        "poured_count": sum(r["poured_count"] for r in bottles),
        "bottles": bottles,
    }
