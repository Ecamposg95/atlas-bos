"""Smoke test: seed runs twice without dupes and populates upsell_metadata."""
import pytest
from app.models.modules import Module
from sqlalchemy.orm import Session


def _run_seed(db: Session):
    """Inline the seed logic against the test DB session."""
    from scripts.init_presets_v2 import seed_modules_and_presets

    seed_modules_and_presets(db)


def test_seed_creates_new_modules(db):
    _run_seed(db)
    purchasing = db.query(Module).filter(Module.key == "purchasing").first()
    assert purchasing is not None
    assert purchasing.upsell_metadata is not None
    assert "recommended_presets" in purchasing.upsell_metadata


def test_seed_is_idempotent(db):
    """Running seed twice keeps exactly one row per module key."""
    _run_seed(db)
    _run_seed(db)
    count = db.query(Module).filter(Module.key == "purchasing").count()
    assert count == 1


def test_seed_atlas_pos_is_lightweight(db):
    from app.models.modules import IndustryPreset
    _run_seed(db)
    atlas_pos = (
        db.query(IndustryPreset)
        .filter(IndustryPreset.industry_type == "ATLAS_POS")
        .first()
    )
    assert atlas_pos is not None
    # crm and branch_catalog_enablement should NOT be in ATLAS_POS
    assert "crm" not in atlas_pos.modules
    assert "branch_catalog_enablement" not in atlas_pos.modules
    # Core POS modules must be present
    assert "pos" in atlas_pos.modules
    assert "cash_management" in atlas_pos.modules
    assert "pricing" in atlas_pos.modules


def test_seed_enterprise_includes_all_modules(db):
    from app.models.modules import IndustryPreset
    _run_seed(db)
    enterprise = (
        db.query(IndustryPreset)
        .filter(IndustryPreset.industry_type == "ATLAS_ONE_ENTERPRISE")
        .first()
    )
    # El preset enterprise = TODO el catálogo que define init_presets_v2
    # (MODULES_CATALOG). Comparamos contra ESA fuente, no contra la tabla
    # `modules` global, que en la suite completa también contiene los módulos
    # sembrados por seed_global_modules (customer_portal/kds/invoicing/…) —
    # un segundo catálogo divergente que no gobierna este test.
    from scripts.init_presets_v2 import MODULES_CATALOG
    catalog_keys = {k for k, *_ in MODULES_CATALOG}
    assert set(enterprise.modules) == catalog_keys
