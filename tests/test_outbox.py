"""Transactional outbox — durability of domain-event side effects.

Covers the Phase-1 hardening of the gastro event spine:
  • enqueue persists atomically and the dispatcher delivers to subscribers;
  • a failing handler schedules a retry (backoff) instead of losing the effect;
  • an unknown/undeliverable event is dead-lettered, not retried forever;
  • `_safe_sale_items` never raises on a null-variant line (the old landmine
    that silently skipped ingredient consumption AND table-free).
"""
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.core.events import EventBus, BaseEvent, register_event
from app.core import outbox as outbox_mod
from app.core.outbox import process_outbox_once, MAX_ATTEMPTS
from app.models.event_outbox import EventOutbox, OutboxStatus


@register_event
class _ProbeEvent(BaseEvent):
    tag: str = ""


@pytest.fixture()
def isolated_bus():
    """Snapshot/restore the global subscriber registry so tests don't leak."""
    saved = {k: list(v) for k, v in EventBus._subscribers.items()}
    EventBus._subscribers.setdefault(_ProbeEvent, [])
    EventBus._subscribers[_ProbeEvent] = []
    yield
    EventBus._subscribers = saved


@pytest.fixture()
def commit_as_flush(db, monkeypatch):
    """The dispatcher commits per row; keep it inside the test's outer txn."""
    monkeypatch.setattr(db, "commit", db.flush, raising=False)
    return db


def test_enqueue_persists_and_dispatch_marks_processed(db, commit_as_flush, isolated_bus):
    seen = []
    EventBus.subscribe(_ProbeEvent, lambda e: seen.append(e.tag))

    row_id = EventBus.enqueue(db, _ProbeEvent(tag="hello"))
    row = db.query(EventOutbox).filter(EventOutbox.id == row_id).first()
    assert row is not None and row.status == OutboxStatus.PENDING

    delivered = process_outbox_once(db)

    assert delivered == 1
    assert seen == ["hello"]
    db.refresh(row)
    assert row.status == OutboxStatus.PROCESSED
    assert row.processed_at is not None

    # Second drain is a no-op — the row is no longer PENDING.
    assert process_outbox_once(db) == 0


def test_failing_handler_schedules_retry_then_dead_letters(db, commit_as_flush, isolated_bus):
    def boom(_e):
        raise RuntimeError("downstream unavailable")

    EventBus.subscribe(_ProbeEvent, boom)
    row_id = EventBus.enqueue(db, _ProbeEvent(tag="x"))

    # First attempt fails → still PENDING, attempt counted, retry pushed to the future.
    assert process_outbox_once(db) == 0
    row = db.get(EventOutbox, row_id)
    assert row.status == OutboxStatus.PENDING
    assert row.attempts == 1
    assert "downstream unavailable" in (row.last_error or "")
    assert row.available_at > datetime.utcnow()

    # It's not due yet, so a drain now does nothing.
    assert process_outbox_once(db) == 0
    assert db.get(EventOutbox, row_id).attempts == 1

    # Force the retry window open repeatedly until the budget is exhausted.
    for _ in range(MAX_ATTEMPTS):
        r = db.get(EventOutbox, row_id)
        if r.status != OutboxStatus.PENDING:
            break
        r.available_at = datetime.utcnow() - timedelta(seconds=1)
        db.flush()
        process_outbox_once(db)

    dead = db.get(EventOutbox, row_id)
    assert dead.status == OutboxStatus.FAILED
    assert dead.attempts >= MAX_ATTEMPTS


def test_unknown_event_type_is_dead_lettered(db, commit_as_flush):
    row = EventOutbox(event_type="NoSuchEvent", payload={})
    db.add(row)
    db.flush()

    process_outbox_once(db)

    db.refresh(row)
    assert row.status == OutboxStatus.FAILED
    assert "unknown event_type" in (row.last_error or "")


def test_safe_sale_items_never_raises_on_null_variant():
    from app.routers.sales import _safe_sale_items

    doc = SimpleNamespace(lines=[
        SimpleNamespace(variant=SimpleNamespace(sku="SKU-1"), variant_id="v1", quantity=2),
        SimpleNamespace(variant=None, variant_id=None, quantity=None),  # the old landmine
    ])
    items = _safe_sale_items(doc)

    assert items[0] == {"variant_id": "v1", "quantity": 2.0, "sku": "SKU-1"}
    assert items[1] == {"variant_id": None, "quantity": 0.0, "sku": None}
