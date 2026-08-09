"""Tables module — floor flow: create → open → free."""
from app.models.sales import ParkedTicket
from app.modules.tables.models import DiningTable, TableStatus


def _create_area(client, headers, branch_id):
    r = client.post("/api/tables/areas", json={"name": "Salón", "branch_id": branch_id}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _create_table(client, headers, branch_id, area_id, code="M1"):
    r = client.post(
        "/api/tables/",
        json={"code": code, "branch_id": branch_id, "area_id": area_id, "seats": 4},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_create_area_and_table(client, auth_admin, branch_a):
    area = _create_area(client, auth_admin, branch_a.id)
    table = _create_table(client, auth_admin, branch_a.id, area["id"])
    assert table["status"] == "AVAILABLE"
    assert table["current_ticket_id"] is None

    r = client.get(f"/api/tables/?branch_id={branch_a.id}", headers=auth_admin)
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_open_table_creates_parked_ticket(client, auth_admin, db, branch_a):
    area = _create_area(client, auth_admin, branch_a.id)
    table = _create_table(client, auth_admin, branch_a.id, area["id"])

    r = client.post(f"/api/tables/{table['id']}/open", json={}, headers=auth_admin)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "OCCUPIED"
    assert body["current_ticket_id"] is not None
    assert body["opened_at"] is not None

    # A ParkedTicket was created and linked.
    pt = db.query(ParkedTicket).filter(ParkedTicket.id == body["current_ticket_id"]).first()
    assert pt is not None
    assert pt.branch_id == branch_a.id


def test_open_then_free(client, auth_admin, db, branch_a):
    area = _create_area(client, auth_admin, branch_a.id)
    table = _create_table(client, auth_admin, branch_a.id, area["id"])
    client.post(f"/api/tables/{table['id']}/open", json={}, headers=auth_admin)

    r = client.post(f"/api/tables/{table['id']}/free", headers=auth_admin)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "AVAILABLE"
    assert body["current_ticket_id"] is None


def test_open_occupied_table_conflicts(client, auth_admin, branch_a):
    area = _create_area(client, auth_admin, branch_a.id)
    table = _create_table(client, auth_admin, branch_a.id, area["id"])
    client.post(f"/api/tables/{table['id']}/open", json={}, headers=auth_admin)

    r = client.post(f"/api/tables/{table['id']}/open", json={}, headers=auth_admin)
    assert r.status_code == 409


def test_transfer_table(client, auth_admin, branch_a):
    area = _create_area(client, auth_admin, branch_a.id)
    t1 = _create_table(client, auth_admin, branch_a.id, area["id"], code="M1")
    t2 = _create_table(client, auth_admin, branch_a.id, area["id"], code="M2")
    opened = client.post(f"/api/tables/{t1['id']}/open", json={}, headers=auth_admin).json()

    r = client.post(
        f"/api/tables/{t1['id']}/transfer",
        json={"target_table_id": t2["id"]},
        headers=auth_admin,
    )
    assert r.status_code == 200, r.text
    assert r.json()["current_ticket_id"] == opened["current_ticket_id"]

    src = client.get(f"/api/tables/?branch_id={branch_a.id}", headers=auth_admin).json()
    by_id = {t["id"]: t for t in src}
    assert by_id[t1["id"]]["status"] == "AVAILABLE"
    assert by_id[t2["id"]]["status"] == "OCCUPIED"
