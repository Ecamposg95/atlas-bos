"""Transactional-outbox dispatcher (Atlas BOS).

Delivers persisted `event_outbox` rows to their in-process subscribers with
retry + exponential-ish backoff, and marks them PROCESSED. Two entry points:

  • `process_outbox_once(db)` — drain one batch of due rows. Pure/testable.
  • `drain_now(ids)` / the background worker — production wiring that opens its
    own session.

Concurrency: each row is claimed with `SELECT … FOR UPDATE SKIP LOCKED` on
Postgres so multiple app replicas never dispatch the same event twice; on SQLite
(local/tests) locking degrades to a plain read, which is fine single-process.
Subscribers remain responsible for their own idempotency (they already are),
because a handler may run again after a partial failure.
"""
import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, SQLALCHEMY_DATABASE_URL
from app.core.events import EventBus, EVENT_REGISTRY
from app.models.event_outbox import EventOutbox, OutboxStatus

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
BACKOFF_BASE_SECONDS = 30      # retry delay grows: base * attempts
BATCH = 50
WORKER_INTERVAL_SECONDS = 2.0

_IS_SQLITE = "sqlite" in (SQLALCHEMY_DATABASE_URL or "")


def _rehydrate(row: EventOutbox):
    cls = EVENT_REGISTRY.get(row.event_type)
    if cls is None:
        return None
    return cls(**(row.payload or {}))


def _due_ids(db: Session, only_ids, limit):
    """Candidate rows: pending and past their retry window, oldest first."""
    q = (
        db.query(EventOutbox.id)
        .filter(
            EventOutbox.status == OutboxStatus.PENDING,
            EventOutbox.available_at <= datetime.utcnow(),
        )
        .order_by(EventOutbox.created_at)
    )
    if only_ids is not None:
        q = q.filter(EventOutbox.id.in_(list(only_ids)))
    return [r[0] for r in q.limit(limit).all()]


def _claim(db: Session, row_id: str):
    """Lock a single pending row for this worker; None if already taken/done."""
    q = db.query(EventOutbox).filter(
        EventOutbox.id == row_id,
        EventOutbox.status == OutboxStatus.PENDING,
    )
    if not _IS_SQLITE:
        q = q.with_for_update(skip_locked=True)
    return q.first()


def _process_one(db: Session, row_id: str) -> bool:
    row = _claim(db, row_id)
    if row is None:
        return False  # claimed by another worker, or no longer pending

    event = _rehydrate(row)
    if event is None:
        row.status = OutboxStatus.FAILED
        row.last_error = f"unknown event_type '{row.event_type}'"
        row.attempts = (row.attempts or 0) + 1
        db.commit()
        logger.error("Outbox: dead-lettered unknown event_type %s (row %s)", row.event_type, row.id)
        return False

    errors = EventBus.dispatch(event)  # subscribers manage their own sessions/txns

    if not errors:
        row.status = OutboxStatus.PROCESSED
        row.processed_at = datetime.utcnow()
        db.commit()
        return True

    row.attempts = (row.attempts or 0) + 1
    row.last_error = " | ".join(errors)[:2000]
    if row.attempts >= MAX_ATTEMPTS:
        row.status = OutboxStatus.FAILED
        logger.error("Outbox: dead-lettered %s after %s attempts (row %s)", row.event_type, row.attempts, row.id)
    else:
        row.available_at = datetime.utcnow() + timedelta(seconds=BACKOFF_BASE_SECONDS * row.attempts)
    db.commit()
    return False


def process_outbox_once(db: Session, only_ids=None, limit: int = BATCH) -> int:
    """Drain one batch. Returns how many rows were delivered successfully."""
    processed = 0
    for row_id in _due_ids(db, only_ids, limit):
        try:
            if _process_one(db, row_id):
                processed += 1
        except Exception:  # noqa: BLE001 - never let one bad row kill the batch
            db.rollback()
            logger.exception("Outbox: unexpected error processing row %s", row_id)
    return processed


def drain_now(ids) -> int:
    """
    Best-effort immediate delivery of specific rows right after their business
    transaction commits (keeps side effects low-latency). The background worker
    is the durable safety net for anything left behind. No-op on SQLite, where a
    second connection would contend with the request's own write lock.
    """
    if _IS_SQLITE or not ids:
        return 0
    db = SessionLocal()
    try:
        return process_outbox_once(db, only_ids=ids)
    finally:
        db.close()


# ── Background worker ─────────────────────────────────────────────────────────
_worker_task: "asyncio.Task | None" = None


async def _worker_loop(interval: float):
    logger.info("Outbox worker started (interval=%.1fs)", interval)
    while True:
        try:
            db = SessionLocal()
            try:
                process_outbox_once(db)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("Outbox worker tick failed")
        await asyncio.sleep(interval)


def start_outbox_worker(interval: float = WORKER_INTERVAL_SECONDS):
    """Launch the retry worker as an asyncio task. Skipped on SQLite (tests)."""
    global _worker_task
    if _IS_SQLITE:
        logger.info("Outbox worker disabled (SQLite backend)")
        return None
    if _worker_task and not _worker_task.done():
        return _worker_task
    _worker_task = asyncio.create_task(_worker_loop(interval))
    return _worker_task


async def stop_outbox_worker():
    global _worker_task
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
    _worker_task = None
