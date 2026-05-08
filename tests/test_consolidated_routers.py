"""
Regression safety net para la Fase A de consolidación (PRs #61, #62, #63).

Verifica que los endpoints consolidados siguen respondiendo en sus paths
históricos, con el mismo shape de respuesta:
  - /api/departments/*     (handler ahora en products.departments_router)
  - /api/brands/*          (handler ahora en products.brands_router)
  - /api/org/capabilities/ (handler ahora en organization.capabilities_router)

Usa fixtures de tests/conftest.py.
"""
from __future__ import annotations

import pytest

from app.models.products import Department, Brand, Product
from app.models.organization import IndustryType
from app.models.modules import Module, OrganizationModule
from app.core.security import create_access_token


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def _with_org(h, org):
    return {**h, "X-Organization-ID": str(org.id)}


# ── Departments ──────────────────────────────────────────────────────────────
class TestDepartmentsConsolidated:
    def test_list_empty(self, client, admin_user, auth_admin, org):
        r = client.get("/api/departments/", headers=_with_org(auth_admin, org))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_and_list(self, client, db, admin_user, auth_admin, org):
        r_create = client.post(
            "/api/departments/",
            json={"name": "Bebidas", "description": "Líquidos varios"},
            headers=_with_org(auth_admin, org),
        )
        assert r_create.status_code == 200, r_create.text
        data = r_create.json()
        assert data["name"] == "Bebidas"

        r_list = client.get("/api/departments/", headers=_with_org(auth_admin, org))
        assert any(d["id"] == data["id"] for d in r_list.json())

    def test_update(self, client, db, admin_user, auth_admin, org):
        dept = Department(name="Abarrotes", organization_id=org.id)
        db.add(dept); db.flush()

        r = client.put(
            f"/api/departments/{dept.id}",
            json={"name": "Abarrotes generales"},
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Abarrotes generales"

    def test_delete(self, client, db, admin_user, auth_admin, org):
        dept = Department(name="Temporal", organization_id=org.id)
        db.add(dept); db.flush()

        r = client.delete(
            f"/api/departments/{dept.id}",
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 200

        r_again = client.put(
            f"/api/departments/{dept.id}",
            json={"name": "X"},
            headers=_with_org(auth_admin, org),
        )
        assert r_again.status_code == 404


# ── Brands ───────────────────────────────────────────────────────────────────
class TestBrandsConsolidated:
    def test_list_empty(self, client, admin_user, auth_admin, org):
        r = client.get("/api/brands/", headers=_with_org(auth_admin, org))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_returns_shape(self, client, admin_user, auth_admin, org):
        r = client.post(
            "/api/brands/",
            json={"name": "Coca-Cola", "logo_url": "https://ex/logo.png"},
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Coca-Cola"
        assert data["logo_url"] == "https://ex/logo.png"
        assert data["product_count"] == 0

    def test_list_includes_product_count(
        self, client, db, admin_user, auth_admin, org,
    ):
        brand = Brand(name="Marca Test", organization_id=org.id)
        db.add(brand); db.flush()

        # Seed 2 products asociados
        p1 = Product(name="p1", organization_id=org.id, is_active=True, brand_id=brand.id)
        p2 = Product(name="p2", organization_id=org.id, is_active=True, brand_id=brand.id)
        db.add_all([p1, p2]); db.flush()

        r = client.get("/api/brands/", headers=_with_org(auth_admin, org))
        assert r.status_code == 200
        entry = next((b for b in r.json() if b["id"] == str(brand.id)), None)
        assert entry is not None
        assert entry["product_count"] == 2

    def test_update(self, client, db, admin_user, auth_admin, org):
        brand = Brand(name="Original", organization_id=org.id)
        db.add(brand); db.flush()

        r = client.put(
            f"/api/brands/{brand.id}",
            json={"name": "Renombrada"},
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Renombrada"

    def test_delete(self, client, db, admin_user, auth_admin, org):
        brand = Brand(name="Efímera", organization_id=org.id)
        db.add(brand); db.flush()

        r = client.delete(
            f"/api/brands/{brand.id}",
            headers=_with_org(auth_admin, org),
        )
        assert r.status_code == 200


# ── Org Capabilities ─────────────────────────────────────────────────────────
class TestOrgCapabilitiesConsolidated:
    @pytest.fixture()
    def org_with_industry(self, db, org):
        org.industry_type = IndustryType.DATAXPOS
        db.flush()
        return org

    def test_response_shape(
        self, client, db, admin_user, auth_admin, org_with_industry,
    ):
        # Seed un module mínimo para que enabled_modules no crashee.
        mod = db.query(Module).filter(Module.key == "core").first()
        if not mod:
            mod = Module(key="core", name="Core")
            db.add(mod); db.flush()
        db.add(OrganizationModule(
            organization_id=org_with_industry.id,
            module_key="core",
            is_enabled=True,
        ))
        db.flush()

        r = client.get(
            "/api/org/capabilities/",
            headers=_with_org(auth_admin, org_with_industry),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for key in (
            "organization_id",
            "industry_type",
            "enabled_modules",
            "ui_profile",
            "default_routes",
            "nav_items",
        ):
            assert key in data
        assert data["organization_id"] == org_with_industry.id
        assert data["industry_type"] == "DATAXPOS"
        assert isinstance(data["enabled_modules"], list)
        assert isinstance(data["nav_items"], list)
        # default_routes debe contener las 3 claves
        for route_key in ("hq", "branch", "warehouse"):
            assert route_key in data["default_routes"]
