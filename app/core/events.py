import logging
from typing import List, Dict, Type, Callable, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

# Configure logger
logger = logging.getLogger(__name__)

# Registry of event name → class, so the transactional outbox can rehydrate a
# persisted row back into a typed event. Populated by `register_event`.
EVENT_REGISTRY: Dict[str, Type["BaseEvent"]] = {}


def register_event(cls: Type["BaseEvent"]) -> Type["BaseEvent"]:
    """Class decorator: make an event rehydratable by the outbox dispatcher."""
    EVENT_REGISTRY[cls.__name__] = cls
    return cls


class BaseEvent(BaseModel):
    """
    Base class for all system events.
    """
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        arbitrary_types_allowed = True


class EventBus:
    """
    Synchronous, in-process Event Bus.

    Two delivery paths share the same subscriber registry:
      • `enqueue(db, event)` — writes the event to the transactional outbox in
        the caller's session (atomic with the business change). Preferred.
      • `dispatch(event)` — runs every subscriber now and reports failures; used
        by the outbox dispatcher (`app/core/outbox.py`).
      • `publish(event)` — legacy fire-and-forget (dispatch, ignore failures).
    """
    _subscribers: Dict[Type[BaseEvent], List[Callable[[BaseEvent], Any]]] = {}

    @classmethod
    def subscribe(cls, event_type: Type[BaseEvent], handler: Callable[[BaseEvent], Any]):
        """
        Register a handler for a specific event type.
        """
        if event_type not in cls._subscribers:
            cls._subscribers[event_type] = []
        cls._subscribers[event_type].append(handler)
        logger.info(f"Subscribed {handler.__name__} to {event_type.__name__}")

    @classmethod
    def enqueue(cls, db, event: BaseEvent) -> str:
        """
        Persist `event` to the outbox using the caller's session. Does NOT commit
        — the caller's own commit makes the event atomic with its business change.
        Returns the new outbox row id (for an optional immediate drain).
        """
        from app.models.event_outbox import EventOutbox  # local import avoids cycle

        row = EventOutbox(
            event_type=type(event).__name__,
            payload=event.model_dump(mode="json"),
        )
        db.add(row)
        db.flush()  # assign PK without committing the caller's transaction
        return row.id

    @classmethod
    def dispatch(cls, event: BaseEvent) -> List[str]:
        """
        Run every subscriber for `event`. Handlers are isolated: one failing
        handler does not prevent the others from running. Returns a list of
        error strings (empty ⇒ full success), so the outbox can decide whether
        to mark the row PROCESSED or schedule a retry.
        """
        event_type = type(event)
        handlers = cls._subscribers.get(event_type)
        if not handlers:
            logger.debug(f"No subscribers for {event_type.__name__}")
            return []

        errors: List[str] = []
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:  # noqa: BLE001 - handlers are isolated by design
                logger.error(
                    f"Error handling event {event_type.__name__} in {handler.__name__}: {e}",
                    exc_info=True,
                )
                errors.append(f"{handler.__name__}: {e}")
        return errors

    @classmethod
    def publish(cls, event: BaseEvent):
        """
        Legacy synchronous publish (fire-and-forget). Prefer `enqueue` for
        anything whose side effects must not be lost. Kept for callers that
        deliberately want best-effort, non-durable delivery.
        """
        cls.dispatch(event)


@register_event
class SalesDocumentCreated(BaseEvent):
    """
    Event triggered when a sales document is successfully created.
    """
    sales_document_id: str
    items: List[Dict[str, Any]] = []  # Simplified items for subscribers
