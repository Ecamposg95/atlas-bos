"""Transactional outbox for domain events (Atlas BOS).

A domain event is written to `event_outbox` inside the SAME database
transaction as the business change that produced it (e.g. a sale). It therefore
persists if and only if that change persists — a side effect (deduct recipe
ingredients, free the table, reorder stock) can no longer be silently lost when
a subscriber throws or the process dies right after commit.

A dispatcher (`app/core/outbox.py`) then delivers each row to its in-process
subscribers with retry + backoff and marks it PROCESSED. Rows that exhaust the
retry budget land in FAILED (a dead-letter you can inspect / replay).
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class OutboxStatus:
    PENDING = "PENDING"      # not yet delivered, or waiting for its retry window
    PROCESSED = "PROCESSED"  # every handler succeeded
    FAILED = "FAILED"        # dead-letter: exceeded max attempts


class EventOutbox(Base):
    __tablename__ = "event_outbox"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type = Column(String(100), nullable=False)   # BaseEvent subclass name
    payload = Column(JSONB, nullable=False)            # event.model_dump(mode="json")

    status = Column(String(20), nullable=False, default=OutboxStatus.PENDING, index=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    available_at = Column(DateTime, nullable=False, default=datetime.utcnow)  # backoff gate
    processed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        # The dispatcher's hot query: pending rows whose retry window has opened.
        Index("ix_event_outbox_due", "status", "available_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<EventOutbox {self.event_type} {self.status} attempts={self.attempts}>"
