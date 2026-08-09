"""Recipes module — costing + automatic ingredient consumption."""
from decimal import Decimal

from app.models.inventory import InventoryMovement, MovementType, StockOnHand
from app.models.products import Product, ProductVariant
from app.modules.recipes import services as recipe_services


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


def _make_recipe(client, headers, dish_id, ingredients):
    r = client.post(
        "/api/recipes/",
        json={
            "product_variant_id": dish_id,
            "name": "Tacos al pastor",
            "yield_qty": 1,
            "ingredients": ingredients,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_recipe_cost_and_margin(client, auth_admin, db, org, branch_a):
    dish = _variant(db, org, "Tacos al pastor", "DISH-1", price=100, cost=0)
    tortilla = _variant(db, org, "Tortilla", "ING-1", price=0, cost=10)
    carne = _variant(db, org, "Carne", "ING-2", price=0, cost=5)

    recipe = _make_recipe(client, auth_admin, dish.id, [
        {"ingredient_variant_id": tortilla.id, "qty": 2, "waste_pct": 0},
        {"ingredient_variant_id": carne.id, "qty": 3, "waste_pct": 10},
    ])

    r = client.get(f"/api/recipes/{recipe['id']}/cost", headers=auth_admin)
    assert r.status_code == 200, r.text
    cost = r.json()
    # tortilla 2*10=20 ; carne 3*1.10*5=16.5 ; total=36.5
    assert Decimal(cost["total_cost"]) == Decimal("36.50")
    assert Decimal(cost["cost_per_portion"]) == Decimal("36.50")
    assert Decimal(cost["sale_price"]) == Decimal("100")
    assert Decimal(cost["margin"]) == Decimal("63.50")


def test_duplicate_recipe_for_variant_conflicts(client, auth_admin, db, org):
    dish = _variant(db, org, "Dish", "DISH-X", price=50, cost=0)
    ing = _variant(db, org, "Ing", "ING-X", price=0, cost=2)
    _make_recipe(client, auth_admin, dish.id, [{"ingredient_variant_id": ing.id, "qty": 1}])
    r = client.post(
        "/api/recipes/",
        json={"product_variant_id": dish.id, "name": "dup", "ingredients": []},
        headers=auth_admin,
    )
    assert r.status_code == 409


def test_consume_for_variant_deducts_ingredient_stock(client, auth_admin, db, org, branch_a):
    dish = _variant(db, org, "Tacos", "DISH-2", price=100, cost=0)
    tortilla = _variant(db, org, "Tortilla2", "ING-3", price=0, cost=10)
    carne = _variant(db, org, "Carne2", "ING-4", price=0, cost=5)
    _stock(db, org, branch_a, tortilla, 100)
    _stock(db, org, branch_a, carne, 100)

    _make_recipe(client, auth_admin, dish.id, [
        {"ingredient_variant_id": tortilla.id, "qty": 2, "waste_pct": 0},
        {"ingredient_variant_id": carne.id, "qty": 3, "waste_pct": 10},
    ])

    movements = recipe_services.consume_for_variant(
        db,
        organization_id=org.id,
        branch_id=branch_a.id,
        variant_id=dish.id,
        qty_sold=Decimal("2"),
        reference="SALE-TEST",
    )
    db.commit()

    assert len(movements) == 2
    assert all(m.movement_type == MovementType.RECIPE_CONSUMPTION for m in movements)

    tort_stock = db.query(StockOnHand).filter(StockOnHand.variant_id == tortilla.id).first()
    carne_stock = db.query(StockOnHand).filter(StockOnHand.variant_id == carne.id).first()
    # tortilla: 100 - (2*2) = 96 ; carne: 100 - (3*1.10*2) = 93.4
    assert tort_stock.qty_on_hand == Decimal("96.00")
    assert carne_stock.qty_on_hand == Decimal("93.40")

    mvs = db.query(InventoryMovement).filter(
        InventoryMovement.movement_type == MovementType.RECIPE_CONSUMPTION
    ).all()
    assert len(mvs) == 2


def test_consume_for_variant_without_recipe_is_noop(client, auth_admin, db, org, branch_a):
    plain = _variant(db, org, "Refresco", "DRINK-1", price=20, cost=8)
    movements = recipe_services.consume_for_variant(
        db, organization_id=org.id, branch_id=branch_a.id,
        variant_id=plain.id, qty_sold=Decimal("5"), reference="SALE-NOOP",
    )
    assert movements == []
