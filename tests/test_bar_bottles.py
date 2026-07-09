"""Bar module — inventario líquido: open → pour → waste → refill."""


def _open(client, headers, branch_id, **kw):
    payload = {"branch_id": branch_id, "name": "Tequila Don Julio 70", "full_volume_ml": 750, "pour_size_ml": 45}
    payload.update(kw)
    r = client.post("/api/bar/bottles", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_open_bottle_starts_full(client, auth_admin, branch_a):
    b = _open(client, auth_admin, branch_a.id)
    assert b["status"] == "OPEN"
    assert float(b["remaining_ml"]) == 750
    assert b["pct_remaining"] == 100.0


def test_pour_decrements_volume(client, auth_admin, branch_a):
    b = _open(client, auth_admin, branch_a.id)
    # default pour = 45 ml, x2
    r = client.post(f"/api/bar/bottles/{b['id']}/pour", json={"count": 2}, headers=auth_admin)
    assert r.status_code == 200, r.text
    assert float(r.json()["remaining_ml"]) == 750 - 90

    # explicit ml
    r = client.post(f"/api/bar/bottles/{b['id']}/pour", json={"ml": 60}, headers=auth_admin)
    assert float(r.json()["remaining_ml"]) == 750 - 90 - 60


def test_waste_and_empty(client, auth_admin, branch_a):
    b = _open(client, auth_admin, branch_a.id, full_volume_ml=100)
    r = client.post(f"/api/bar/bottles/{b['id']}/waste", json={"ml": 100, "reason": "derrame"}, headers=auth_admin)
    assert r.status_code == 200, r.text
    body = r.json()
    assert float(body["remaining_ml"]) == 0
    assert body["status"] == "EMPTY"


def test_refill_adjusts_and_reopens(client, auth_admin, branch_a):
    b = _open(client, auth_admin, branch_a.id, full_volume_ml=750)
    client.post(f"/api/bar/bottles/{b['id']}/waste", json={"ml": 750}, headers=auth_admin)
    # conteo físico: quedaban 300 ml
    r = client.post(f"/api/bar/bottles/{b['id']}/refill", json={"remaining_ml": 300}, headers=auth_admin)
    assert r.status_code == 200
    body = r.json()
    assert float(body["remaining_ml"]) == 300
    assert body["status"] == "OPEN"
    # no puede exceder el volumen lleno
    r = client.post(f"/api/bar/bottles/{b['id']}/refill", json={"remaining_ml": 9999}, headers=auth_admin)
    assert float(r.json()["remaining_ml"]) == 750


def test_list_excludes_archived(client, auth_admin, branch_a):
    b = _open(client, auth_admin, branch_a.id)
    client.delete(f"/api/bar/bottles/{b['id']}", headers=auth_admin)
    r = client.get(f"/api/bar/bottles?branch_id={branch_a.id}", headers=auth_admin)
    assert r.status_code == 200
    assert all(x["id"] != b["id"] for x in r.json())
