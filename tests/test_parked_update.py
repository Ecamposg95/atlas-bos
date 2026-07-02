"""PATCH /sales/parked/{id} — acumular ítems en la cuenta de una mesa."""


def _park(client, headers):
    r = client.post(
        "/api/sales/parked",
        json={"cart_json": {"items": [{"name": "Taco", "quantity": 1}]}},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_update_parked_replaces_cart(client, auth_cajero_a):
    pid = _park(client, auth_cajero_a)
    new_cart = {"items": [
        {"name": "Taco", "quantity": 1},
        {"name": "Agua", "quantity": 2},
    ]}
    r = client.patch(f"/api/sales/parked/{pid}", json={"cart_json": new_cart}, headers=auth_cajero_a)
    assert r.status_code == 200, r.text
    assert len(r.json()["cart_json"]["items"]) == 2


def test_update_parked_empty_cart_rejected(client, auth_cajero_a):
    pid = _park(client, auth_cajero_a)
    r = client.patch(f"/api/sales/parked/{pid}", json={"cart_json": {}}, headers=auth_cajero_a)
    assert r.status_code == 422


def test_update_parked_not_found(client, auth_cajero_a):
    r = client.patch(
        "/api/sales/parked/does-not-exist",
        json={"cart_json": {"items": [{"name": "X"}]}},
        headers=auth_cajero_a,
    )
    assert r.status_code == 404
