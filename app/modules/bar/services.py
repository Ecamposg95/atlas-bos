"""Atlas BOS modules/bar/services — lógica de botellas."""
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.bar.models import BarBottle, BottleStatus


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


def pour(db: Session, bottle: BarBottle, ml: Decimal, count: int = 1) -> BarBottle:
    bottle = _lock_bottle(db, bottle.id) or bottle
    if bottle.status == BottleStatus.ARCHIVED:
        raise HTTPException(status_code=400, detail="La botella está archivada")
    take = Decimal(str(ml)) * count
    remaining = Decimal(str(bottle.remaining_ml or 0)) - take
    bottle.remaining_ml = max(Decimal("0"), remaining)
    _sync_status(bottle)
    db.commit()
    db.refresh(bottle)
    return bottle


def waste(db: Session, bottle: BarBottle, ml: Decimal) -> BarBottle:
    bottle = _lock_bottle(db, bottle.id) or bottle
    remaining = Decimal(str(bottle.remaining_ml or 0)) - Decimal(str(ml))
    bottle.remaining_ml = max(Decimal("0"), remaining)
    _sync_status(bottle)
    db.commit()
    db.refresh(bottle)
    return bottle


def set_remaining(db: Session, bottle: BarBottle, remaining_ml: Decimal) -> BarBottle:
    bottle = _lock_bottle(db, bottle.id) or bottle
    full = Decimal(str(bottle.full_volume_ml or 0))
    bottle.remaining_ml = max(Decimal("0"), min(full, Decimal(str(remaining_ml))))
    _sync_status(bottle)
    db.commit()
    db.refresh(bottle)
    return bottle
