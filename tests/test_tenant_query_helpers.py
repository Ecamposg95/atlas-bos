"""Tests for app.core.tenant_query — get_tenant_scoped + scoped_query."""
import pytest
from fastapi import HTTPException

from app.core.tenant_query import (
    _resolve_org_id,
    _tenant_column,
    get_tenant_scoped,
    scoped_query,
)
from app.models.products import Product
from app.modules.tenants.models import Organization


# ── unit tests for internals ────────────────────────────────────────────────


def test_tenant_column_returns_organization_id_for_business_model():
    col = _tenant_column(Product)
    assert col is not None
    assert col.key == "organization_id"


def test_tenant_column_returns_none_for_tenantless_model():
    # Organization itself has no organization_id — it IS the tenant.
    assert _tenant_column(Organization) is None


def test_resolve_org_id_prefers_direct_attribute():
    class FakeUser:
        organization_id = 42
    assert _resolve_org_id(FakeUser()) == 42


def test_resolve_org_id_falls_back_to_organizations_list():
    class Link:
        is_active = True
        organization_id = 7

    class FakeUser:
        organization_id = None
        organizations = [Link()]

    assert _resolve_org_id(FakeUser()) == 7


def test_resolve_org_id_returns_none_when_no_context():
    class FakeUser:
        organization_id = None
        organizations = []

    assert _resolve_org_id(FakeUser()) is None


# ── integration tests for get_tenant_scoped ─────────────────────────────────


def test_get_tenant_scoped_finds_row_in_user_org(db, org, cajero_a):
    p = Product(name="In-org product", organization_id=org.id, unit="pza")
    db.add(p)
    db.commit()

    result = get_tenant_scoped(db, Product, p.id, cajero_a)
    assert result is not None
    assert result.id == p.id


def test_get_tenant_scoped_404_when_row_in_other_org(db, org, cajero_a):
    other = Product(name="Other-org product", organization_id=99999, unit="pza")
    db.add(other)
    db.commit()

    with pytest.raises(HTTPException) as exc:
        get_tenant_scoped(db, Product, other.id, cajero_a)
    assert exc.value.status_code == 404


def test_get_tenant_scoped_returns_none_when_raise_404_false(db, org, cajero_a):
    result = get_tenant_scoped(db, Product, "nonexistent-id", cajero_a, raise_404=False)
    assert result is None


def test_get_tenant_scoped_rejects_tenantless_model(db, cajero_a):
    with pytest.raises(ValueError, match="no organization_id/tenant_id"):
        get_tenant_scoped(db, Organization, 1, cajero_a)


# ── integration tests for scoped_query ──────────────────────────────────────


def test_scoped_query_filters_to_user_org(db, org, cajero_a):
    db.add_all([
        Product(name="P1", organization_id=org.id, unit="pza"),
        Product(name="P2", organization_id=org.id, unit="pza"),
        Product(name="P3-OTHER", organization_id=99999, unit="pza"),
    ])
    db.commit()

    results = scoped_query(db, Product, cajero_a).all()
    names = {p.name for p in results}
    assert "P1" in names
    assert "P2" in names
    assert "P3-OTHER" not in names


def test_scoped_query_chainable(db, org, cajero_a):
    db.add_all([
        Product(name="Active", organization_id=org.id, is_active=True, unit="pza"),
        Product(name="Inactive", organization_id=org.id, is_active=False, unit="pza"),
    ])
    db.commit()

    actives = scoped_query(db, Product, cajero_a).filter(Product.is_active == True).all()  # noqa: E712
    assert len(actives) == 1
    assert actives[0].name == "Active"
