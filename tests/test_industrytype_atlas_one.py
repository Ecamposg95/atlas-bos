"""Test that IndustryType has the 5 new Atlas One values."""
from app.modules.tenants.models import IndustryType


def test_atlas_one_industry_types_exist():
    assert IndustryType.ATLAS_ONE_RETAIL.value == "ATLAS_ONE_RETAIL"
    assert IndustryType.ATLAS_ONE_BEAUTY.value == "ATLAS_ONE_BEAUTY"
    assert IndustryType.ATLAS_ONE_GASTRO.value == "ATLAS_ONE_GASTRO"
    assert IndustryType.ATLAS_ONE_SERVICES.value == "ATLAS_ONE_SERVICES"
    assert IndustryType.ATLAS_ONE_ENTERPRISE.value == "ATLAS_ONE_ENTERPRISE"


def test_atlas_pos_still_exists():
    """Backward compat: legacy values must remain."""
    assert IndustryType.ATLAS_POS.value == "ATLAS_POS"
    assert IndustryType.RESTAURANT_QSR.value == "RESTAURANT_QSR"
    assert IndustryType.AUTO_REPAIR_SHOP.value == "AUTO_REPAIR_SHOP"
