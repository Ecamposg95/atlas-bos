"""Gastro Fase 2 — integridad de cuenta y KDS.

Cubre:
  • máquina de estados de mesa (PATCH /status con transiciones válidas/ inválidas);
  • liberar mesa MANUAL abandona la cuenta abierta + cancela sus comandas KDS;
  • la ruta de PAGO (free_by_ticket_id) solo suelta la mesa, sin abandonar la cuenta;
  • KDS: anular todos los items cancela el ticket (no queda zombie en el tablero);
  • KDS: bump por estación solo avanza los items de esa estación.
"""
from decimal import Decimal

from app.models.sales import ParkedTicket
from app.modules.tables import services as table_services
from app.modules.tables.models import DiningTable, TableStatus


# ── Helpers ───────────────────────────────────────────────────────────────────

def _area(client, headers, branch_id):
    r = client.post("/api/tables/areas", json={"name": "Salón", "branch_id": branch_id}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _table(client, headers, branch_id, area_id, code="M1"):
    r = client.post(
        "/api/tables/",
        json={"code": code, "branch_id": branch_id, "area_id": area_id, "seats": 4},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _station(client, headers, branch_id, name="Cocina"):
    r = client.post("/api/kitchen/stations", json={"name": name, "branch_id": branch_id}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# ── Máquina de estados ────────────────────────────────────────────────────────

def test_status_valid_transitions(client, auth_admin, branch_a):
    area = _area(client, auth_admin, branch_a.id)
    t = _table(client, auth_admin, branch_a.id, area["id"])

    # AVAILABLE → RESERVED → CLEANING → AVAILABLE
    for nxt in ("RESERVED", "CLEANING", "AVAILABLE"):
        r = client.patch(f"/api/tables/{t['id']}/status", json={"status": nxt}, headers=auth_admin)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == nxt


def test_status_rejects_manual_occupy_and_leaking_free(client, auth_admin, branch_a):
    area = _area(client, auth_admin, branch_a.id)
    t = _table(client, auth_admin, branch_a.id, area["id"])

    # No se puede OCUPAR a mano (hay que abrir la mesa).
    r = client.patch(f"/api/tables/{t['id']}/status", json={"status": "OCCUPIED"}, headers=auth_admin)
    assert r.status_code == 409

    # Con cuenta abierta: OCCUPIED → BILL_REQUESTED sí; OCCUPIED → AVAILABLE no (fuga).
    client.post(f"/api/tables/{t['id']}/open", json={}, headers=auth_admin)
    ok = client.patch(f"/api/tables/{t['id']}/status", json={"status": "BILL_REQUESTED"}, headers=auth_admin)
    assert ok.status_code == 200 and ok.json()["status"] == "BILL_REQUESTED"

    leak = client.patch(f"/api/tables/{t['id']}/status", json={"status": "AVAILABLE"}, headers=auth_admin)
    assert leak.status_code == 409, "liberar via /status filtraría la cuenta abierta"


# ── Liberar manual: abandona cuenta + cancela KDS ─────────────────────────────

def test_free_abandons_open_check_and_cancels_kds(client, auth_admin, db, branch_a):
    area = _area(client, auth_admin, branch_a.id)
    t = _table(client, auth_admin, branch_a.id, area["id"])
    _station(client, auth_admin, branch_a.id)

    opened = client.post(f"/api/tables/{t['id']}/open", json={}, headers=auth_admin).json()
    ticket_id = opened["current_ticket_id"]
    assert ticket_id

    # Disparar una comanda a cocina ligada a esta cuenta/mesa.
    fired = client.post(
        "/api/kitchen/tickets",
        json={
            "branch_id": branch_a.id,
            "table_id": t["id"],
            "parked_ticket_id": ticket_id,
            "items": [{"description": "Tacos", "qty": 2}],
        },
        headers=auth_admin,
    )
    assert fired.status_code == 201, fired.text

    # Liberar la mesa SIN cobrar.
    freed = client.post(f"/api/tables/{t['id']}/free", headers=auth_admin)
    assert freed.status_code == 200, freed.text
    assert freed.json()["status"] == "AVAILABLE"
    assert freed.json()["current_ticket_id"] is None

    # La comanda de cocina ya no está viva en el tablero.
    feed = client.get(f"/api/kitchen/tickets?branch_id={branch_a.id}", headers=auth_admin)
    assert feed.status_code == 200
    assert len(feed.json()) == 0, "la comanda quedó viva tras liberar la mesa"

    # La cuenta quedó cerrada (soft-delete) — ya no es un ParkedTicket huérfano ACTIVE.
    pt = db.query(ParkedTicket).filter(ParkedTicket.id == ticket_id).first()
    assert pt is not None and pt.deleted_at is not None, "la cuenta quedó huérfana"


# ── Ruta de pago: solo suelta la mesa, no abandona la cuenta ───────────────────

def test_paid_path_detaches_without_abandoning(db, org, branch_a, admin_user):
    # Construir mesa + cuenta abierta ligada.
    pt = ParkedTicket(
        organization_id=org.id, branch_id=branch_a.id, user_id=admin_user.id,
        cart_json={"items": []}, notes="Mesa X",
    )
    db.add(pt)
    db.flush()
    table = DiningTable(
        organization_id=org.id, branch_id=branch_a.id, code="MX", seats=4,
        status=TableStatus.OCCUPIED, current_ticket_id=pt.id,
    )
    db.add(table)
    db.flush()

    freed = table_services.free_by_ticket_id(db, org.id, pt.id)

    assert freed is not None
    assert freed.status == TableStatus.AVAILABLE
    assert freed.current_ticket_id is None
    # La cuenta pagada NO se soft-borra por esta ruta (la venta ya la consumió).
    db.refresh(pt)
    assert pt.deleted_at is None, "la ruta de pago no debe abandonar/cancelar la cuenta"


# ── KDS: anular todos los items cancela el ticket (no zombie) ──────────────────

def test_void_all_items_cancels_ticket(client, auth_admin, branch_a):
    _station(client, auth_admin, branch_a.id)
    ticket = client.post(
        "/api/kitchen/tickets",
        json={"branch_id": branch_a.id, "items": [{"description": "Solo", "qty": 1}]},
        headers=auth_admin,
    ).json()
    item_id = ticket["items"][0]["id"]

    r = client.post(f"/api/kitchen/items/{item_id}/void", headers=auth_admin)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "CANCELED", "el ticket quedó zombie tras anular su único item"

    feed = client.get(f"/api/kitchen/tickets?branch_id={branch_a.id}", headers=auth_admin)
    assert len(feed.json()) == 0


# ── KDS: bump por estación solo avanza esa estación ───────────────────────────

def test_bump_ticket_by_station_only_advances_that_station(client, auth_admin, branch_a):
    st_a = _station(client, auth_admin, branch_a.id, name="Caliente")
    st_b = _station(client, auth_admin, branch_a.id, name="Barra")

    ticket = client.post(
        "/api/kitchen/tickets",
        json={
            "branch_id": branch_a.id,
            "items": [
                {"description": "Sopa", "qty": 1, "station_id": st_a["id"]},
                {"description": "Cerveza", "qty": 1, "station_id": st_b["id"]},
            ],
        },
        headers=auth_admin,
    ).json()

    # Bump solo de la estación A.
    r = client.post(
        f"/api/kitchen/tickets/{ticket['id']}/bump?station_id={st_a['id']}",
        headers=auth_admin,
    )
    assert r.status_code == 200, r.text
    by_station = {i["station_id"]: i["status"] for i in r.json()["items"]}
    assert by_station[st_a["id"]] == "PREPARING", "la estación A no avanzó"
    assert by_station[st_b["id"]] == "PENDING", "la estación B avanzó por error"
