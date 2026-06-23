"""Kitchen/KDS module — fire → feed → bump lifecycle."""


def _station(client, headers, branch_id, name="Cocina"):
    r = client.post(
        "/api/kitchen/stations",
        json={"name": name, "branch_id": branch_id},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _fire(client, headers, branch_id, items=None):
    items = items or [{"description": "Tacos al pastor", "qty": 2}]
    r = client.post(
        "/api/kitchen/tickets",
        json={"branch_id": branch_id, "items": items},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_fire_ticket_routes_to_default_station(client, auth_admin, branch_a):
    station = _station(client, auth_admin, branch_a.id)
    ticket = _fire(client, auth_admin, branch_a.id)
    assert ticket["status"] == "NEW"
    assert len(ticket["items"]) == 1
    assert ticket["items"][0]["station_id"] == station["id"]
    assert ticket["age_seconds"] is not None


def test_feed_lists_active_ticket(client, auth_admin, branch_a):
    _station(client, auth_admin, branch_a.id)
    _fire(client, auth_admin, branch_a.id)
    r = client.get(f"/api/kitchen/tickets?branch_id={branch_a.id}", headers=auth_admin)
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_bump_item_progresses_ticket(client, auth_admin, branch_a):
    _station(client, auth_admin, branch_a.id)
    ticket = _fire(client, auth_admin, branch_a.id)
    item_id = ticket["items"][0]["id"]

    # PENDING -> PREPARING: ticket NEW -> IN_PROGRESS
    r = client.post(f"/api/kitchen/items/{item_id}/bump", headers=auth_admin)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "IN_PROGRESS"

    # PREPARING -> READY: single item ready -> ticket READY
    r = client.post(f"/api/kitchen/items/{item_id}/bump", headers=auth_admin)
    assert r.json()["status"] == "READY"
    assert r.json()["ready_at"] is not None


def test_bump_ticket_advances_all_items(client, auth_admin, branch_a):
    _station(client, auth_admin, branch_a.id)
    ticket = _fire(
        client, auth_admin, branch_a.id,
        items=[{"description": "A", "qty": 1}, {"description": "B", "qty": 1}],
    )
    r = client.post(f"/api/kitchen/tickets/{ticket['id']}/bump", headers=auth_admin)
    assert r.status_code == 200
    # All items moved PENDING -> PREPARING
    assert r.json()["status"] == "IN_PROGRESS"
    assert all(i["status"] == "PREPARING" for i in r.json()["items"])


def test_cancel_ticket_drops_from_feed(client, auth_admin, branch_a):
    _station(client, auth_admin, branch_a.id)
    ticket = _fire(client, auth_admin, branch_a.id)
    r = client.post(f"/api/kitchen/tickets/{ticket['id']}/cancel", headers=auth_admin)
    assert r.json()["status"] == "CANCELED"

    feed = client.get(f"/api/kitchen/tickets?branch_id={branch_a.id}", headers=auth_admin)
    assert len(feed.json()) == 0
