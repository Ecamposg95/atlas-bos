"""Atlas BOS subscribers/tables — free a dining table when its check is paid.

When a parked ticket (an open table check) converts to a sale, the POS sets
`parked_tickets.converted_to_sale_id`. This subscriber finds the table holding
that ticket and returns it to AVAILABLE automatically on payment.

Own DB session; failures are logged, never crash the checkout.
"""
import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.events import EventBus, SalesDocumentCreated
from app.models import SalesDocument
from app.modules.tables import services as table_services

logger = logging.getLogger(__name__)


def free_table_on_sale(event: SalesDocumentCreated):
    db: Session = SessionLocal()
    try:
        sale = (
            db.query(SalesDocument)
            .filter(SalesDocument.id == event.sales_document_id)
            .first()
        )
        if sale is None:
            return

        # `converted_to_sale_id` is a raw column (added via railway_init), not an
        # ORM attribute — resolve the parked ticket id with a guarded raw query.
        try:
            row = db.execute(
                text("SELECT id FROM parked_tickets WHERE converted_to_sale_id = :sid"),
                {"sid": str(sale.id)},
            ).first()
        except Exception:
            return  # column absent (older schema) — nothing to do

        if not row:
            return

        freed = table_services.free_by_ticket_id(db, sale.organization_id, row[0])
        if freed:
            logger.info(f"Tables: freed table {freed.code} after Sale {sale.id}")

    except Exception as e:
        logger.error(f"Tables: Error freeing table: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def setup_tables_subscribers():
    EventBus.subscribe(SalesDocumentCreated, free_table_on_sale)
