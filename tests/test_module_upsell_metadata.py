"""Test that Module model exposes upsell_metadata column."""
from app.models.modules import Module


def test_module_has_upsell_metadata_column(db):
    """Module table should have upsell_metadata as JSON nullable."""
    mod = Module(
        key="test_mod",
        name="Test",
        description="x",
        upsell_metadata={
            "category": "advanced",
            "recommended_presets": ["ATLAS_ONE_RETAIL"],
            "value_props": ["a", "b"],
            "upgrade_prompt": "Activa esto",
            "icon": "fa-test",
            "sort_hint": 10,
        },
    )
    db.add(mod)
    db.commit()

    fetched = db.query(Module).filter(Module.key == "test_mod").one()
    assert fetched.upsell_metadata is not None
    assert fetched.upsell_metadata["category"] == "advanced"
    assert "ATLAS_ONE_RETAIL" in fetched.upsell_metadata["recommended_presets"]


def test_module_upsell_metadata_nullable(db):
    """upsell_metadata defaults to None when not provided."""
    mod = Module(key="bare_mod", name="Bare")
    db.add(mod)
    db.commit()
    fetched = db.query(Module).filter(Module.key == "bare_mod").one()
    assert fetched.upsell_metadata is None
