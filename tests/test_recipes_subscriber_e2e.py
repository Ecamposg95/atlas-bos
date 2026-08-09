"""Recipes spine — end-to-end wiring of the sales event → subscriber → consumption.

The costing tests exercise `consume_for_variant` directly. This file closes the
remaining gap: the `SalesDocumentCreated` → `consume_ingredients_on_sale` path
and the subscriber's idempotency guard (no double-deduction on event re-publish).

The subscriber opens its own `SessionLocal()`; here it is monkeypatched onto the
test session so it operates against the same SQLite data the fixtures created.
"""
from decimal import Decimal

from app.core.events import SalesDocumentCreated
from app.models.inventory import InventoryMovement, MovementType, StockOnHand
from app.models.products import Product, ProductVariant
from app.models.sales import SalesDocument, DocumentStatus, SalesLineItem
from app.subscribers import recipes as recipes_sub


def _variant(db, org, name, sku, price, cost):
    p = Product(name=name, organization_id=org.id, is_active=True)
    db.add(p)
    db.flush()
    v = ProductVariant(
        product_id=p.id, sku=sku, price=Decimal(str(price)),
        cost=Decimal(str(cost)), organization_id=org.id,
    )
    db.add(v)
    db.flush()
    return v


def _stock(db, org, branch, variant, qty):
    soh = StockOnHand(
        variant_id=variant.id, branch_id=branch.id,
        organization_id=org.id, qty_on_hand=Decimal(str(qty)), is_active=True,
    )
    db.add(soh)
    db.flush()
    return soh


def _make_recipe(client, headers, dish_id, ingredients, name="Plato"):
    r = client.post(
        "/api/recipes/",
        json={
            "product_variant_id": dish_id,
            "name": name,
            "yield_qty": 1,
            "ingredients": ingredients,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _sale_with_dish(db, org, branch, seller, dish, qty):
    sale = SalesDocument(
        seller_id=seller.id,
        branch_id=branch.id,
        organization_id=org.id,
        total_amount=Decimal(str(dish.price)) * Decimal(str(qty)),
        subtotal=Decimal(str(dish.price)) * Decimal(str(qty)),
        tax_amount=Decimal("0"),
        status=DocumentStatus.PAID,
    )
    db.add(sale)
    db.flush()
    line = SalesLineItem(
        document_id=sale.id,
        variant_id=dish.id,
        quantity=float(qty),
        unit_price=Decimal(str(dish.price)),
        total_line=Decimal(str(dish.price)) * Decimal(str(qty)),
        organization_id=org.id,
    )
    db.add(line)
    db.flush()
    return sale


def test_event_consumes_ingredients_and_is_idempotent(
    client, auth_admin, db, org, branch_a, admin_user, monkeypatch
):
    # Subscriber uses its own SessionLocal(); point it at the test session so it
    # sees fixture data. Neutralize .close() so it doesn't drop the shared session.
    monkeypatch.setattr(recipes_sub, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "close", lambda: None, raising=False)
    monkeypatch.setattr(db, "commit", db.flush, raising=False)

    dish = _variant(db, org, "Tacos al pastor", "E2E-DISH", price=100, cost=0)
    tortilla = _variant(db, org, "Tortilla", "E2E-ING1", price=0, cost=10)
    carne = _variant(db, org, "Carne", "E2E-ING2", price=0, cost=5)
    _stock(db, org, branch_a, tortilla, 100)
    _stock(db, org, branch_a, carne, 100)

    _make_recipe(client, auth_admin, dish.id, [
        {"ingredient_variant_id": tortilla.id, "qty": 2, "waste_pct": 0},
        {"ingredient_variant_id": carne.id, "qty": 3, "waste_pct": 10},
    ], name="Tacos al pastor")

    sale = _sale_with_dish(db, org, branch_a, admin_user, dish, qty=2)

    event = SalesDocumentCreated(
        sales_document_id=str(sale.id),
        items=[{"variant_id": str(dish.id), "quantity": 2.0, "sku": dish.sku}],
    )

    # First publish → ingredients deducted.
    recipes_sub.consume_ingredients_on_sale(event)

    tort = db.query(StockOnHand).filter(StockOnHand.variant_id == tortilla.id).first()
    car = db.query(StockOnHand).filter(StockOnHand.variant_id == carne.id).first()
    # tortilla: 100 - (2*2) = 96 ; carne: 100 - (3*1.10*2) = 93.4
    assert tort.qty_on_hand == Decimal("96.00")
    assert car.qty_on_hand == Decimal("93.40")

    mvs = db.query(InventoryMovement).filter(
        InventoryMovement.movement_type == MovementType.RECIPE_CONSUMPTION,
        InventoryMovement.reference == str(sale.id),
    ).all()
    assert len(mvs) == 2

    # Second publish (re-delivery) → idempotency guard must prevent double-deduct.
    recipes_sub.consume_ingredients_on_sale(event)

    tort = db.query(StockOnHand).filter(StockOnHand.variant_id == tortilla.id).first()
    car = db.query(StockOnHand).filter(StockOnHand.variant_id == carne.id).first()
    assert tort.qty_on_hand == Decimal("96.00"), "double-deducted on re-publish"
    assert car.qty_on_hand == Decimal("93.40"), "double-deducted on re-publish"

    mvs = db.query(InventoryMovement).filter(
        InventoryMovement.movement_type == MovementType.RECIPE_CONSUMPTION,
        InventoryMovement.reference == str(sale.id),
    ).all()
    assert len(mvs) == 2, "idempotency guard failed — duplicate movements"
