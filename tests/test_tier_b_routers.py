"""
Coverage gap fill for Tier-B routers identified in the beta cleanup audit:
expenses, purchases, printer.

Previously these 3 routers had zero test coverage despite being in active
use. These tests cover the happy path + tenancy/RBAC guards, not every
field in every response.

Uses fixtures from tests/conftest.py.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.models.organization import Branch, BranchType, Organization
from app.models.users import User, UserOrganization, Role, PlatformRole
from app.security import create_access_token


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def _with_org(h, org):
    return {**h, "X-Organization-ID": str(org.id)}


@pytest.fixture()
def foreign_branch(db):
    other = Organization(name="Foreign Tier-B", status="ACTIVE")
    db.add(other); db.flush()
    b = Branch(
        name="Foreign", branch_type=BranchType.STORE,
        can_sell=True, is_active=True, organization_id=other.id,
    )
    db.add(b); db.flush()
    return b


# ── Expenses ─────────────────────────────────────────────────────────────────
class TestExpenses:
    def test_admin_creates_and_lists(
        self, client, admin_user, auth_admin, org, branch_a,
    ):
        r_create = client.post(
            "/api/expenses/",
            json={
                "amount": 250.5,
                "category": "Oficina",
                "description": "Papelería",
                "branch_id": branch_a.id,
            },
            headers=_with_org(auth_admin, org),
        )
        assert r_create.status_code == 200, r_create.text
        created = r_create.json()
        assert created["amount"] == 250.5
        assert created["category"] == "Oficina"

        r_list = client.get("/api/expenses/", headers=_with_org(auth_admin, org))
        assert r_list.status_code == 200
        items = r_list.json()["items"]
        assert any(i["id"] == created["id"] for i in items)

    def test_rejects_zero_amount(
        self, client, admin_user, auth_admin, org,
    ):
        r = client.post(
            "/api/expenses/",
            json={"amount": 0, "category": "Test"},
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 400

    def test_rejects_empty_category(
        self, client, admin_user, auth_admin, org,
    ):
        r = client.post(
            "/api/expenses/",
            json={"amount": 100, "category": "   "},
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 400

    def test_rejects_foreign_branch(
        self, client, admin_user, auth_admin, org, foreign_branch,
    ):
        r = client.post(
            "/api/expenses/",
            json={"amount": 100, "category": "Test", "branch_id": foreign_branch.id},
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 400

    def test_stats_endpoint(
        self, client, admin_user, auth_admin, org,
    ):
        r = client.get("/api/expenses/stats", headers=_with_org(auth_admin, org))
        assert r.status_code == 200
        data = r.json()
        # shape sanity; el endpoint devuelve totales por ventana temporal
        assert isinstance(data, dict)

    def test_delete_removes(
        self, client, admin_user, auth_admin, org, branch_a,
    ):
        r_create = client.post(
            "/api/expenses/",
            json={"amount": 50, "category": "Luz", "branch_id": branch_a.id},
            headers=_with_org(auth_admin, org),
        )
        expense_id = r_create.json()["id"]

        r_del = client.delete(
            f"/api/expenses/{expense_id}",
            headers=_with_org(auth_admin, org),
        )
        assert r_del.status_code == 200

        r_again = client.delete(
            f"/api/expenses/{expense_id}",
            headers=_with_org(auth_admin, org),
        )
        assert r_again.status_code == 404


# ── Purchases ────────────────────────────────────────────────────────────────
class TestPurchases:
    def test_admin_creates_po_with_lines(
        self, client, admin_user, auth_admin, org, branch_a,
    ):
        r = client.post(
            "/api/purchases/",
            json={
                "supplier_name": "Proveedor A",
                "branch_id": branch_a.id,
                "notes": "Test PO",
                "lines": [
                    {"product_name": "Item 1", "qty_ordered": 10, "unit_cost": 5.5},
                    {"product_name": "Item 2", "qty_ordered": 4, "unit_cost": 8.0},
                ],
            },
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["folio"].startswith("OC-")
        assert data["supplier_name"] == "Proveedor A"
        assert data["status"] == "DRAFT"
        assert len(data["lines"]) == 2
        assert data["total"] == 10 * 5.5 + 4 * 8.0

    def test_rejects_empty_lines(
        self, client, admin_user, auth_admin, org,
    ):
        r = client.post(
            "/api/purchases/",
            json={"supplier_name": "Empty", "lines": []},
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 400

    def test_rejects_foreign_branch(
        self, client, admin_user, auth_admin, org, foreign_branch,
    ):
        r = client.post(
            "/api/purchases/",
            json={
                "supplier_name": "Prov Foreign",
                "branch_id": foreign_branch.id,
                "lines": [{"product_name": "x", "qty_ordered": 1, "unit_cost": 1}],
            },
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 400

    def test_list_returns_created_po(
        self, client, admin_user, auth_admin, org, branch_a,
    ):
        client.post(
            "/api/purchases/",
            json={
                "supplier_name": "Listado",
                "branch_id": branch_a.id,
                "lines": [{"product_name": "X", "qty_ordered": 1, "unit_cost": 1}],
            },
            headers=_with_org(auth_admin, org),
        )
        r = client.get("/api/purchases/", headers=_with_org(auth_admin, org))
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["supplier_name"] == "Listado" for i in items)

    def test_folio_is_unique_per_org(
        self, client, admin_user, auth_admin, org, branch_a,
    ):
        r1 = client.post(
            "/api/purchases/",
            json={
                "supplier_name": "Seq",
                "lines": [{"product_name": "X", "qty_ordered": 1, "unit_cost": 1}],
            },
            headers=_with_org(auth_admin, org),
        )
        r2 = client.post(
            "/api/purchases/",
            json={
                "supplier_name": "Seq",
                "lines": [{"product_name": "X", "qty_ordered": 1, "unit_cost": 1}],
            },
            headers=_with_org(auth_admin, org),
        )
        assert r1.json()["folio"] != r2.json()["folio"]


# ── Printer ──────────────────────────────────────────────────────────────────
class TestPrinter:
    def test_printers_list_requires_auth(self, client):
        # Sin Authorization header
        r = client.get("/api/printer/printers")
        assert r.status_code in (401, 403)

    def test_printers_list_with_auth(
        self, client, admin_user, auth_admin, org,
    ):
        r = client.get("/api/printer/printers", headers=_with_org(auth_admin, org))
        # Devuelve lista (vacía en entorno de tests), sin crash
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_test_print_requires_auth(self, client):
        r = client.post("/api/printer/test-print", json={})
        assert r.status_code in (401, 403)
