import logging
from typing import List, Dict, Type, Callable, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

# Configure logger
logger = logging.getLogger(__name__)

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
    Simple synchronous Event Bus.
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
    def publish(cls, event: BaseEvent):
        """
        Publish an event to all subscribers synchronously.
        Exceptions in handlers are caught and logged to prevent crashing the publisher.
        """
        event_type = type(event)
        if event_type in cls._subscribers:
            for handler in cls._subscribers[event_type]:
                try:
                    handler(event)
                except Exception as e:
                    logger.error(f"Error handling event {event_type.__name__} in {handler.__name__}: {e}", exc_info=True)
        else:
            logger.debug(f"No subscribers for {event_type.__name__}")

class SalesDocumentCreated(BaseEvent):
    """
    Event triggered when a sales document is successfully created.
    """
    sales_document_id: str
    items: List[Dict[str, Any]] = [] # Simplified items for subscribers

