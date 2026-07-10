"""Bar Fase 4 — ledger de botellas: cortes de turno + varianza.

Cada pour/merma/reconteo queda en bar_bottle_events; el reporte agrega servido,
merma y varianza (suma de reconteos = merma no registrada / sobre-servido).
"""
from app.modules.bar.models import BarBottleEvent, BarEventType


def _open(client, headers, branch_id, name="Tequila", full=750, pour=45):
    r = client.post(
        "/api/bar/bottles",
        json={"branch_id": branch_id, "name": name, "full_volume_ml": full, "pour_size_ml": pour},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_open_records_open_event(client, auth_admin, db, branch_a):
    b = _open(client, auth_admin, branch_a.id)
    evts = db.query(BarBottleEvent).filter(BarBottleEvent.bottle_id == b["id"]).all()
    assert any(e.event_type == BarEventType.OPEN and float(e.ml_change) == 750 for e in evts)


def test_ledger_records_and_report_aggregates_variance(client, auth_admin, branch_a):
    b = _open(client, auth_admin, branch_a.id)
    bid = b["id"]

    # 2 servidas de 45 ml → 750 - 90 = 660
    r = client.post(f"/api/bar/bottles/{bid}/pour", json={"ml": 45, "count": 2}, headers=auth_admin)
    assert r.status_code == 200, r.text
    # merma 30 ml → 630
    client.post(f"/api/bar/bottles/{bid}/waste", json={"ml": 30, "reason": "derrame"}, headers=auth_admin)
    # reconteo físico a 600 (esperado 630) → varianza -30
    client.post(f"/api/bar/bottles/{bid}/refill", json={"remaining_ml": 600}, headers=auth_admin)

    rep = client.get("/api/bar/report", headers=auth_admin)
    assert rep.status_code == 200, rep.text
    body = rep.json()

    assert float(body["poured_ml"]) == 90
    assert body["poured_count"] == 2
    assert float(body["wasted_ml"]) == 30
    assert float(body["variance_ml"]) == -30, "reconteo bajo esperado = varianza negativa"

    assert len(body["bottles"]) == 1
    row = body["bottles"][0]
    assert row["bottle_id"] == bid
    assert row["name"] == "Tequila"
    assert float(row["poured_ml"]) == 90
    assert float(row["variance_ml"]) == -30


def test_report_scoped_by_branch(client, auth_admin, branch_a, branch_b):
    a = _open(client, auth_admin, branch_a.id, name="A")
    _open(client, auth_admin, branch_b.id, name="B")
    client.post(f"/api/bar/bottles/{a['id']}/pour", json={"ml": 50, "count": 1}, headers=auth_admin)

    rep = client.get(f"/api/bar/report?branch_id={branch_a.id}", headers=auth_admin)
    body = rep.json()
    assert float(body["poured_ml"]) == 50
    assert all(row["bottle_id"] == a["id"] for row in body["bottles"])
