"""Atlas BOS subscribers/recipes — deduct recipe ingredients on every sale.

Listens to `SalesDocumentCreated` (published by app/routers/sales.py after a
sale is committed). For each sold line that has a recipe, the raw-material
ingredients are drawn down from inventory via RECIPE_CONSUMPTION movements.

Mirrors app/subscribers/abasto.py: own DB session, exceptions are logged and
never bubble up to crash the checkout.
"""
import logging
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.events import EventBus, SalesDocumentCreated
from app.models import SalesDocument
from app.models.inventory import InventoryMovement, MovementType
from app.modules.recipes import services as recipe_services

logger = logging.getLogger(__name__)


def consume_ingredients_on_sale(event: SalesDocumentCreated):
    logger.info(f"Recipes: consuming ingredients for Sale {event.sales_document_id}")

    db: Session = SessionLocal()
    try:
        sale = (
            db.query(SalesDocument)
            .filter(SalesDocument.id == event.sales_document_id)
            .first()
        )
        if sale is None:
            logger.warning(f"Recipes: Sale {event.sales_document_id} not found")
            return

        # Idempotency: if we already consumed for this sale (e.g. on a re-publish
        # from a sale update), don't double-deduct.
        already = (
            db.query(InventoryMovement)
            .filter(
                InventoryMovement.reference == str(sale.id),
                InventoryMovement.movement_type == MovementType.RECIPE_CONSUMPTION,
            )
            .first()
        )
        if already:
            logger.debug(f"Recipes: Sale {sale.id} already consumed — skipping")
            return

        total_movements = 0
        for line in sale.lines:
            if not line.variant_id or not line.quantity:
                continue
            mvs = recipe_services.consume_for_variant(
                db,
                organization_id=sale.organization_id,
                branch_id=sale.branch_id,
                variant_id=line.variant_id,
                qty_sold=Decimal(str(line.quantity)),
                reference=str(sale.id),
                user_id=sale.seller_id,
            )
            total_movements += len(mvs)

        if total_movements:
            db.commit()
            logger.info(f"Recipes: consumed {total_movements} ingredient movements for Sale {sale.id}")
        else:
            logger.debug(f"Recipes: no recipes matched lines of Sale {sale.id}")

    except Exception as e:
        logger.error(f"Recipes: Error consuming ingredients: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def setup_recipe_subscribers():
    EventBus.subscribe(SalesDocumentCreated, consume_ingredients_on_sale)
