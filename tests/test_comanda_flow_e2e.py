"""Comanda flow e2e — reproduce la secuencia que hace la vista móvil de comanda:

    abrir mesa  → POST /api/tables/{id}/open      (crea parked ticket = la cuenta)
    enviar      → POST /api/kitchen/tickets        (comanda a KDS, con table_id + parked_ticket_id)
    acumular    → PATCH /api/sales/parked/{id}      (suma los platillos a la cuenta)  ← endpoint nuevo
    verificar   → GET /api/kitchen/tickets          (KDS muestra la comanda de la mesa)
                  GET /api/sales/parked/{id}         (la cuenta tiene los platillos)

Usa auth_cajero_a (branch_a) para que branch del usuario == branch de la mesa,
requisito de los endpoints de parked.
"""
import pytest

from app.models.modules import Module, OrganizationModule


@pytest.fixture()
def pos_module_enabled(db, org):
    """Habilita el módulo `pos` para el org de prueba (sales router lo exige)."""
    mod = db.query(Module).filter(Module.key == "pos").first()
    if not mod:
        mod = Module(key="pos", name="POS", description="Point of Sale")
        db.add(mod)
        db.flush()
    db.add(OrganizationModule(organization_id=org.id, module_key="pos", is_enabled=True))
    db.flush()


def _setup_floor(client, headers, branch_id):
    area = client.post("/api/tables/areas", json={"name": "Salón", "branch_id": branch_id}, headers=headers)
    assert area.status_code == 201, area.text
    table = client.post(
        "/api/tables/",
        json={"code": "M1", "branch_id": branch_id, "area_id": area.json()["id"], "seats": 4},
        headers=headers,
    )
    assert table.status_code == 201, table.text
    station = client.post("/api/kitchen/stations", json={"name": "Cocina", "branch_id": branch_id}, headers=headers)
    assert station.status_code == 201, station.text
    return table.json()


def test_comanda_full_flow(client, auth_cajero_a, branch_a, pos_module_enabled):
    table = _setup_floor(client, auth_cajero_a, branch_a.id)

    # 1) Abrir la mesa → crea la cuenta (parked ticket)
    opened = client.post(f"/api/tables/{table['id']}/open", json={}, headers=auth_cajero_a)
    assert opened.status_code == 200, opened.text
    body = opened.json()
    assert body["status"] == "OCCUPIED"
    parked_id = body["current_ticket_id"]
    assert parked_id

    # 2) Enviar comanda a cocina (KDS) — como lo hace kitchenApi.fire
    fired = client.post(
        "/api/kitchen/tickets",
        json={
            "branch_id": branch_a.id,
            "table_id": table["id"],
            "parked_ticket_id": parked_id,
            "items": [
                {"description": "Hamburguesa clásica", "qty": 1},
                {"description": "Pizza Margherita", "qty": 2},
            ],
        },
        headers=auth_cajero_a,
    )
    assert fired.status_code == 201, fired.text
    assert fired.json()["table_id"] == table["id"]
    assert len(fired.json()["items"]) == 2

    # 3) Acumular los platillos en la cuenta — como lo hace parkedTicketsApi.update
    cart = {"items": [
        {"product_id": "p1", "sku": "SKU1", "name": "Hamburguesa clásica", "price": 120.0, "quantity": 1, "discount": 0, "subtotal": 120.0},
        {"product_id": "p2", "sku": "SKU2", "name": "Pizza Margherita",   "price": 150.0, "quantity": 2, "discount": 0, "subtotal": 300.0},
    ]}
    patched = client.patch(f"/api/sales/parked/{parked_id}", json={"cart_json": cart}, headers=auth_cajero_a)
    assert patched.status_code == 200, patched.text
    assert len(patched.json()["cart_json"]["items"]) == 2

    # 4a) El KDS muestra la comanda de la mesa
    feed = client.get(f"/api/kitchen/tickets?branch_id={branch_a.id}", headers=auth_cajero_a)
    assert feed.status_code == 200
    assert any(t["table_id"] == table["id"] for t in feed.json())

    # 4b) La cuenta tiene los platillos (total = 420)
    check = client.get(f"/api/sales/parked/{parked_id}", headers=auth_cajero_a)
    assert check.status_code == 200
    items = check.json()["cart_json"]["items"]
    assert sum(i["subtotal"] for i in items) == 420.0


def test_second_comanda_accumulates_on_same_check(client, auth_cajero_a, branch_a, pos_module_enabled):
    """Una segunda comanda debe sumarse a la cuenta existente, no reemplazarla:
    el cliente hace el merge [existentes + nuevos] antes de PATCH."""
    table = _setup_floor(client, auth_cajero_a, branch_a.id)
    parked_id = client.post(f"/api/tables/{table['id']}/open", json={}, headers=auth_cajero_a).json()["current_ticket_id"]

    first = {"items": [{"product_id": "p1", "sku": "S1", "name": "Sopa", "price": 60.0, "quantity": 1, "discount": 0, "subtotal": 60.0}]}
    client.patch(f"/api/sales/parked/{parked_id}", json={"cart_json": first}, headers=auth_cajero_a)

    # segunda ronda: merge en cliente = existentes + nuevo
    merged = {"items": first["items"] + [
        {"product_id": "p2", "sku": "S2", "name": "Postre", "price": 40.0, "quantity": 1, "discount": 0, "subtotal": 40.0},
    ]}
    r = client.patch(f"/api/sales/parked/{parked_id}", json={"cart_json": merged}, headers=auth_cajero_a)
    assert r.status_code == 200, r.text
    items = r.json()["cart_json"]["items"]
    assert len(items) == 2
    assert sum(i["subtotal"] for i in items) == 100.0
