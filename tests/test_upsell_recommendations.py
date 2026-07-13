"""Tests for GET /platform/organizations/{id}/upsell-recommendations."""
import pytest
from app.models.modules import Module, OrganizationModule
from app.modules.tenants.models import IndustryType


@pytest.fixture
def seeded_modules(db):
    """Seed 3 modules: one without metadata (invisible), two with."""
    mods = [
        Module(key="core", name="Core", description="base"),  # no metadata
        Module(
            key="crm",
            name="CRM / Clientes",
            description="Gestión de clientes",
            upsell_metadata={
                "category": "advanced",
                "recommended_presets": ["ATLAS_ONE_RETAIL"],
                "value_props": ["Clientes", "Crédito"],
                "upgrade_prompt": "Activa CRM",
                "icon": "fa-users",
                "sort_hint": 10,
            },
        ),
        Module(
            key="purchasing",
            name="Compras",
            description="OC y proveedores",
            upsell_metadata={
                "category": "advanced",
                "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_GASTRO"],
                "value_props": ["OC", "Recepciones"],
                "upgrade_prompt": "Controla compras",
                "icon": "fa-truck",
                "sort_hint": 20,
            },
        ),
    ]
    # Idempotente: el startup del app (seed_global_modules) ya siembra estas keys
    # en el SQLite compartido; get-or-create por `key` evita el UNIQUE constraint.
    result = []
    for m in mods:
        existing = db.query(Module).filter(Module.key == m.key).first()
        if existing:
            existing.name = m.name
            existing.description = m.description
            existing.upsell_metadata = m.upsell_metadata
            result.append(existing)
        else:
            db.add(m)
            result.append(m)
    db.commit()
    return result


def test_upsell_returns_modules_not_enabled(client, auth_superadmin, db, org, seeded_modules):
    """Org without active modules → both CRM and purchasing recommended."""
    org.industry_type = IndustryType.ATLAS_POS
    db.commit()

    resp = client.get(
        f"/api/platform/organizations/{org.id}/upsell-recommendations",
        headers=auth_superadmin,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["org_id"] == org.id
    assert data["active_preset"] == "ATLAS_POS"

    keys = [r["module_key"] for r in data["recommendations"]]
    assert "crm" in keys
    assert "purchasing" in keys
    assert "core" not in keys  # no upsell_metadata → invisible


def test_upsell_excludes_already_enabled_modules(
    client, auth_superadmin, db, org, seeded_modules
):
    """If `crm` is enabled for the org, it should NOT appear in recommendations."""
    org.industry_type = IndustryType.ATLAS_POS
    db.add(OrganizationModule(organization_id=org.id, module_key="crm", is_enabled=True))
    db.commit()

    resp = client.get(
        f"/api/platform/organizations/{org.id}/upsell-recommendations",
        headers=auth_superadmin,
    )
    assert resp.status_code == 200
    data = resp.json()

    keys = [r["module_key"] for r in data["recommendations"]]
    assert "crm" not in keys
    assert "purchasing" in keys
    assert "crm" in data["active_modules"]


def test_upsell_grouped_by_preset(client, auth_superadmin, db, org, seeded_modules):
    """grouped_by_preset must list module keys under each preset they recommend."""
    org.industry_type = IndustryType.ATLAS_POS
    db.commit()

    resp = client.get(
        f"/api/platform/organizations/{org.id}/upsell-recommendations",
        headers=auth_superadmin,
    )
    data = resp.json()

    assert "ATLAS_ONE_RETAIL" in data["grouped_by_preset"]
    assert "crm" in data["grouped_by_preset"]["ATLAS_ONE_RETAIL"]
    assert "purchasing" in data["grouped_by_preset"]["ATLAS_ONE_RETAIL"]
    assert "purchasing" in data["grouped_by_preset"].get("ATLAS_ONE_GASTRO", [])


def test_upsell_404_for_missing_org(client, auth_superadmin):
    resp = client.get(
        "/api/platform/organizations/999999/upsell-recommendations",
        headers=auth_superadmin,
    )
    assert resp.status_code == 404
