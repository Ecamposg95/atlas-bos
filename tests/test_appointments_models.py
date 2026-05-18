"""Tests for appointments models + Organization.slug prereq."""
import pytest
from app.modules.tenants.models import Organization


def test_organization_has_slug_column(db, org):
    """Organization table must expose a `slug` column (nullable, str)."""
    # Smoke: write+read a slug value
    org.slug = "demo-org-slug"
    db.commit()
    db.refresh(org)
    assert org.slug == "demo-org-slug"
