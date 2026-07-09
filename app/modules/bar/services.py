"""Atlas BOS modules/bar/services — lógica de botellas."""
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.bar.models import BarBottle, BottleStatus


def _sync_status(bottle: BarBottle) -> None:
    if bottle.status == BottleStatus.ARCHIVED:
        return
    bottle.status = BottleStatus.EMPTY if Decimal(str(bottle.remaining_ml or 0)) <= 0 else BottleStatus.OPEN


def pour(db: Session, bottle: BarBottle, ml: Decimal, count: int = 1) -> BarBottle:
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
    remaining = Decimal(str(bottle.remaining_ml or 0)) - Decimal(str(ml))
    bottle.remaining_ml = max(Decimal("0"), remaining)
    _sync_status(bottle)
    db.commit()
    db.refresh(bottle)
    return bottle


def set_remaining(db: Session, bottle: BarBottle, remaining_ml: Decimal) -> BarBottle:
    full = Decimal(str(bottle.full_volume_ml or 0))
    bottle.remaining_ml = max(Decimal("0"), min(full, Decimal(str(remaining_ml))))
    _sync_status(bottle)
    db.commit()
    db.refresh(bottle)
    return bottle
