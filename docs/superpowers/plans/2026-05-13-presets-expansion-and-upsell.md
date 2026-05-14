# Atlas One Presets Expansion + Module Upsell System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-13-presets-expansion-design.md`

**Goal:** Alinear el catálogo de presets con la jerarquía Atlas One (7 presets), aligerar ATLAS_POS, y añadir el sistema de upsell de módulos con endpoint + UI.

**Architecture:** Backend agrega columna JSON `upsell_metadata` al modelo `Module` y un endpoint que cruza esa metadata con `OrganizationModule` para generar recomendaciones por org. Frontend consume el endpoint y muestra cards de upsell en `PlatformOrgDetail`. Como `alembic/versions/` está vacío (baseline pendiente), la migración se hace con un script Python idempotente que detecta dialect (Postgres `ALTER TYPE ADD VALUE`, SQLite no-op).

**Tech Stack:** FastAPI · SQLAlchemy 2.x · Postgres (prod) / SQLite (test+dev) · React + Vite + TypeScript · pytest

---

## File structure

**Backend — modificados:**
- `app/models/modules.py` — añadir columna `upsell_metadata` a `Module`
- `app/modules/tenants/models.py` — añadir 5 enum values a `IndustryType`
- `app/schemas/modules.py` — añadir `UpsellRecommendation` + `UpsellResponse` (archivo se crea si no existe)
- `app/routers/platform/organizations.py` — añadir endpoint `GET /platform/organizations/{org_id}/upsell-recommendations`
- `scripts/init_presets_v2.py` — reescribir con 6 módulos nuevos + 7 presets + dict `MODULE_UPSELL`

**Backend — creados:**
- `scripts/migrate_presets_v3.py` — script idempotente: ALTER TABLE modules ADD COLUMN + ALTER TYPE industrytype ADD VALUE (Postgres only)
- `tests/test_upsell_recommendations.py` — tests del nuevo endpoint
- `tests/test_seed_presets.py` — test de idempotencia del seed

**Frontend — modificados:**
- `frontend/src/api/platform.ts` — tipos `UpsellRecommendation`, `UpsellResponse` + función `getUpsellRecommendations`
- `frontend/src/pages/platform/PlatformOrgDetail.tsx` — sección "Módulos disponibles"

---

## Pre-flight check

- [ ] **Step 0.1:** Verify clean working tree

```bash
git status --short
```

Expected: empty output (no uncommitted changes).

- [ ] **Step 0.2:** Verify pytest baseline passes

```bash
pytest tests/ -x --tb=line 2>&1 | tail -20
```

Expected: tests pass (or known-failing tests are unrelated to presets/modules).

- [ ] **Step 0.3:** Verify spec is committed

```bash
git log --oneline -3 docs/superpowers/specs/2026-05-13-presets-expansion-design.md
```

Expected: at least one commit visible.

---

## Task 1: Add `upsell_metadata` column to Module model

**Files:**
- Modify: `app/models/modules.py:16-26` (class `Module`)

- [ ] **Step 1.1: Write failing test**

Create `tests/test_module_upsell_metadata.py`:

```python
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
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
pytest tests/test_module_upsell_metadata.py -v
```

Expected: FAIL with `AttributeError` or `TypeError` indicating `upsell_metadata` is not a valid column.

- [ ] **Step 1.3: Add column to Module model**

Edit `app/models/modules.py` — in class `Module`, after the `status` column:

```python
class Module(Base):
    """
    Catálogo global de módulos disponibles en la plataforma.
    """
    __tablename__ = "modules"

    key = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    scope = Column(Enum(ModuleScope), default=ModuleScope.GLOBAL)
    status = Column(Enum(ModuleStatus), default=ModuleStatus.STABLE)
    upsell_metadata = Column(JSON, nullable=True)
```

- [ ] **Step 1.4: Run test to verify pass**

```bash
pytest tests/test_module_upsell_metadata.py -v
```

Expected: both tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add app/models/modules.py tests/test_module_upsell_metadata.py
git commit -m "$(cat <<'EOF'
feat(models): add upsell_metadata JSON column to Module

Stores per-module metadata for the upsell system: category,
recommended_presets, value_props, upgrade_prompt, icon, sort_hint.
Nullable — modules without metadata are invisible to the upsell flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add 5 enum values to IndustryType

**Files:**
- Modify: `app/modules/tenants/models.py:39-71` (enum `IndustryType`)

- [ ] **Step 2.1: Write failing test**

Create `tests/test_industrytype_atlas_one.py`:

```python
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
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
pytest tests/test_industrytype_atlas_one.py -v
```

Expected: FAIL with `AttributeError: ATLAS_ONE_RETAIL`.

- [ ] **Step 2.3: Add enum values**

Edit `app/modules/tenants/models.py:39-71` — in `class IndustryType`, after the `CUSTOM` line (and BEFORE the closing of the class), add a new section:

```python
class IndustryType(str, enum.Enum):
    # Retail / Comercio
    ATLAS_POS = "ATLAS_POS"
    DISTRIBUTOR_POS = "DISTRIBUTOR_POS"
    RETAIL_CHAIN = "RETAIL_CHAIN"
    ECOMMERCE = "ECOMMERCE"
    WHOLESALE_B2B = "WHOLESALE_B2B"

    # Servicios
    SALON = "SALON"
    CLINIC = "CLINIC"
    DENTAL = "DENTAL"
    PROFESSIONAL_SERVICES = "PROFESSIONAL_SERVICES"

    # Hospitality
    RESTAURANT_QSR = "RESTAURANT_QSR"
    RESTAURANT_FULL = "RESTAURANT_FULL"
    CAFE_BAKERY = "CAFE_BAKERY"

    # Automotriz / Taller
    AUTO_REPAIR_SHOP = "AUTO_REPAIR_SHOP"
    FLEET_SERVICE = "FLEET_SERVICE"

    # Comercial / Ventas
    SALES_DISTRIBUTION = "SALES_DISTRIBUTION"
    B2B_ENTERPRISE = "B2B_ENTERPRISE"

    # Logística / Inventario
    WAREHOUSE_LOGISTICS = "WAREHOUSE_LOGISTICS"
    MANUFACTURING_LIGHT = "MANUFACTURING_LIGHT"

    # Genérico
    CUSTOM = "CUSTOM"

    # Atlas One commercial suite (2026-05-13)
    ATLAS_ONE_RETAIL = "ATLAS_ONE_RETAIL"
    ATLAS_ONE_BEAUTY = "ATLAS_ONE_BEAUTY"
    ATLAS_ONE_GASTRO = "ATLAS_ONE_GASTRO"
    ATLAS_ONE_SERVICES = "ATLAS_ONE_SERVICES"
    ATLAS_ONE_ENTERPRISE = "ATLAS_ONE_ENTERPRISE"
```

- [ ] **Step 2.4: Run test to verify pass**

```bash
pytest tests/test_industrytype_atlas_one.py -v
```

Expected: both tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add app/modules/tenants/models.py tests/test_industrytype_atlas_one.py
git commit -m "$(cat <<'EOF'
feat(enum): add 5 Atlas One values to IndustryType

ATLAS_ONE_RETAIL, ATLAS_ONE_BEAUTY, ATLAS_ONE_GASTRO,
ATLAS_ONE_SERVICES, ATLAS_ONE_ENTERPRISE. Legacy values preserved
for backward compat.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migration script idempotente

**Files:**
- Create: `scripts/migrate_presets_v3.py`

`alembic/versions/` está vacío (baseline pendiente). Este script reemplaza una migración Alembic temporal: detecta dialect y aplica ALTER en Postgres; en SQLite no-op porque conftest recrea tablas con `create_all`.

- [ ] **Step 3.1: Create migration script**

Create `scripts/migrate_presets_v3.py`:

```python
"""
Idempotent migration for Atlas One presets expansion (2026-05-13).

Adds:
1. Column `upsell_metadata JSON` to `modules` table.
2. Five new values to Postgres enum `industrytype`:
   ATLAS_ONE_RETAIL, ATLAS_ONE_BEAUTY, ATLAS_ONE_GASTRO,
   ATLAS_ONE_SERVICES, ATLAS_ONE_ENTERPRISE.

Safe to run multiple times. On SQLite the column ADD is conditional
(SQLite has no IF NOT EXISTS for columns); the enum ALTER is skipped
because SQLite stores enum values as plain strings.
"""
import logging
import os
import sys

sys.path.append(os.getcwd())

from sqlalchemy import inspect, text
from app.core.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NEW_INDUSTRY_VALUES = [
    "ATLAS_ONE_RETAIL",
    "ATLAS_ONE_BEAUTY",
    "ATLAS_ONE_GASTRO",
    "ATLAS_ONE_SERVICES",
    "ATLAS_ONE_ENTERPRISE",
]


def column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def add_upsell_metadata_column(conn):
    if column_exists(conn, "modules", "upsell_metadata"):
        logger.info("modules.upsell_metadata already exists — skipping ADD COLUMN")
        return
    dialect = conn.dialect.name
    if dialect == "postgresql":
        conn.execute(text("ALTER TABLE modules ADD COLUMN upsell_metadata JSON"))
    else:
        conn.execute(text("ALTER TABLE modules ADD COLUMN upsell_metadata JSON"))
    logger.info("Added modules.upsell_metadata")


def add_industrytype_values(conn):
    dialect = conn.dialect.name
    if dialect != "postgresql":
        logger.info(f"Dialect={dialect} — skipping enum ALTER (SQLite stores values as strings)")
        return
    for v in NEW_INDUSTRY_VALUES:
        conn.execute(text(f"ALTER TYPE industrytype ADD VALUE IF NOT EXISTS '{v}'"))
        logger.info(f"Ensured industrytype value: {v}")


def main():
    logger.info(f"Running migration on {engine.url.render_as_string(hide_password=True)}")
    with engine.begin() as conn:
        add_upsell_metadata_column(conn)
    # ALTER TYPE in Postgres cannot run inside a transaction block on some
    # versions; use AUTOCOMMIT.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        add_industrytype_values(conn)
    logger.info("✅ Migration complete")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3.2: Smoke-test the script locally (SQLite)**

```bash
rm -f /tmp/migrate_test.db
DATABASE_URL="sqlite:////tmp/migrate_test.db" python -c "
from app.core.database import engine, Base
import app.models  # register models
Base.metadata.create_all(bind=engine)
"
DATABASE_URL="sqlite:////tmp/migrate_test.db" python scripts/migrate_presets_v3.py
```

Expected output ends with:
```
INFO:__main__:Added modules.upsell_metadata
INFO:__main__:Dialect=sqlite — skipping enum ALTER (SQLite stores values as strings)
INFO:__main__:✅ Migration complete
```

- [ ] **Step 3.3: Verify idempotency — run twice**

```bash
DATABASE_URL="sqlite:////tmp/migrate_test.db" python scripts/migrate_presets_v3.py
```

Expected output ends with:
```
INFO:__main__:modules.upsell_metadata already exists — skipping ADD COLUMN
INFO:__main__:✅ Migration complete
```

- [ ] **Step 3.4: Commit**

```bash
git add scripts/migrate_presets_v3.py
git commit -m "$(cat <<'EOF'
feat(scripts): add idempotent migration for Atlas One presets

Adds upsell_metadata column + 5 IndustryType enum values
(Postgres only — SQLite stores enums as plain strings).
Replaces a proper Alembic migration since alembic/versions/
is empty pending baseline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Pydantic schemas for upsell

**Files:**
- Modify: `app/schemas/modules.py` (create if missing)

- [ ] **Step 4.1: Check if file exists**

```bash
ls app/schemas/modules.py 2>&1 | head -1
```

If "No such file", create it. If exists, append the new classes.

- [ ] **Step 4.2: Write schema**

Create or append to `app/schemas/modules.py`:

```python
"""Pydantic schemas for modules / upsell."""
from typing import List, Optional, Dict
from pydantic import BaseModel


class UpsellRecommendation(BaseModel):
    module_key: str
    module_name: str
    description: Optional[str] = None
    category: Optional[str] = None  # base | advanced | vertical
    status: str  # STABLE | BETA
    in_recommended_preset: bool
    recommended_presets: List[str] = []
    value_props: List[str] = []
    upgrade_prompt: Optional[str] = None
    icon: Optional[str] = None
    sort_hint: int = 100

    class Config:
        from_attributes = True


class UpsellResponse(BaseModel):
    org_id: int
    active_preset: Optional[str] = None
    active_modules: List[str]
    recommendations: List[UpsellRecommendation]
    grouped_by_preset: Dict[str, List[str]]
```

- [ ] **Step 4.3: Quick import smoke-test**

```bash
python -c "from app.schemas.modules import UpsellRecommendation, UpsellResponse; print('OK')"
```

Expected: `OK`.

- [ ] **Step 4.4: Commit**

```bash
git add app/schemas/modules.py
git commit -m "$(cat <<'EOF'
feat(schemas): add UpsellRecommendation + UpsellResponse

Pydantic schemas for the upsell-recommendations endpoint.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Endpoint `GET /platform/organizations/{org_id}/upsell-recommendations`

**Files:**
- Modify: `app/routers/platform/organizations.py` (append after `toggle_org_module` at line ~751)

- [ ] **Step 5.1: Write failing test**

Create `tests/test_upsell_recommendations.py`:

```python
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
    for m in mods:
        db.add(m)
    db.commit()
    return mods


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
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
pytest tests/test_upsell_recommendations.py -v
```

Expected: all 4 tests FAIL with 404 (endpoint doesn't exist).

- [ ] **Step 5.3: Implement endpoint**

In `app/routers/platform/organizations.py`, find the line with `@router.post("/organizations/{org_id}/reset-preset")` and add the new endpoint BEFORE it (or after `toggle_org_module`):

```python
@router.get("/organizations/{org_id}/upsell-recommendations")
def get_upsell_recommendations(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_platform_admin),
):
    """Return modules NOT enabled for this org, with upsell metadata, grouped by recommended preset."""
    from app.models.modules import Module, OrganizationModule
    from app.schemas.modules import UpsellRecommendation, UpsellResponse

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    active_modules = [
        om.module_key
        for om in db.query(OrganizationModule)
        .filter(
            OrganizationModule.organization_id == org_id,
            OrganizationModule.is_enabled == True,  # noqa: E712
        )
        .all()
    ]
    active_preset = org.industry_type.value if org.industry_type else None

    # Modules with metadata, not yet enabled
    candidates = (
        db.query(Module)
        .filter(Module.upsell_metadata.isnot(None))
        .all()
    )

    recommendations = []
    grouped: dict[str, list[str]] = {}

    for mod in candidates:
        if mod.key in active_modules:
            continue
        meta = mod.upsell_metadata or {}
        recommended = meta.get("recommended_presets", []) or []

        rec = UpsellRecommendation(
            module_key=mod.key,
            module_name=mod.name,
            description=mod.description,
            category=meta.get("category"),
            status=mod.status.value if mod.status else "STABLE",
            in_recommended_preset=bool(active_preset and active_preset in recommended),
            recommended_presets=recommended,
            value_props=meta.get("value_props", []) or [],
            upgrade_prompt=meta.get("upgrade_prompt"),
            icon=meta.get("icon"),
            sort_hint=meta.get("sort_hint", 100),
        )
        recommendations.append(rec)

        for preset_key in recommended:
            grouped.setdefault(preset_key, []).append(mod.key)

    recommendations.sort(key=lambda r: (r.sort_hint, r.module_key))

    return UpsellResponse(
        org_id=org_id,
        active_preset=active_preset,
        active_modules=active_modules,
        recommendations=recommendations,
        grouped_by_preset=grouped,
    )
```

- [ ] **Step 5.4: Run tests to verify pass**

```bash
pytest tests/test_upsell_recommendations.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5.5: Verify no regression in existing tests**

```bash
pytest tests/test_platform_security.py -v --tb=short
```

Expected: all platform security tests still pass.

- [ ] **Step 5.6: Commit**

```bash
git add app/routers/platform/organizations.py tests/test_upsell_recommendations.py
git commit -m "$(cat <<'EOF'
feat(platform): add GET /upsell-recommendations endpoint

Cross-references Module.upsell_metadata with OrganizationModule
to return modules an org could activate, grouped by recommended
preset. Requires platform_admin auth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Rewrite seed with 6 new modules + 7 presets + MODULE_UPSELL

**Files:**
- Modify: `scripts/init_presets_v2.py` (full rewrite)

- [ ] **Step 6.1: Write seed-idempotency test**

Create `tests/test_seed_presets.py`:

```python
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
    all_modules = [m.key for m in db.query(Module).all()]
    assert set(enterprise.modules) == set(all_modules)
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
pytest tests/test_seed_presets.py -v
```

Expected: FAIL with ImportError or "ATLAS_ONE_ENTERPRISE preset not found".

- [ ] **Step 6.3: Rewrite the seed**

Replace `scripts/init_presets_v2.py` entirely with:

```python
"""
Atlas One Presets Seed (v3 — 2026-05-13).

Seeds the module catalog (21+ modules) and the 7 Atlas One presets:
ATLAS_POS, ATLAS_ONE_RETAIL, ATLAS_ONE_BEAUTY, ATLAS_ONE_GASTRO,
ATLAS_ONE_SERVICES, ATLAS_ONE_ENTERPRISE, CUSTOM.

Idempotent: upserts by key/industry_type. Does NOT delete legacy
presets (DISTRIBUTOR_POS, RETAIL_CHAIN, RESTAURANT_*, etc.) —
cleanup is manual via SQL.
"""
import logging
import os
import sys

sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.modules import IndustryPreset, Module, ModuleScope, ModuleStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Module catalog ────────────────────────────────────────────────────────────
MODULES_CATALOG = [
    ("core", "Core", "Funcionalidades base del sistema", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("pos", "Punto de Venta", "Ventas mostrador, caja, cortes", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("cash_management", "Gestión de Caja", "Cortes de caja, arqueos, control de efectivo", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("inventory", "Inventario", "Stock, movimientos, kardex", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("catalog", "Catálogo", "Productos, servicios, listas de precio", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("branch_catalog_enablement", "Habilitación de Catálogo por Sucursal", "Control de productos disponibles por sucursal", ModuleScope.BRANCH, ModuleStatus.STABLE),
    ("returns", "Devoluciones", "Gestión de devoluciones y notas de crédito", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("pricing", "Precios", "Gestión de precios y listas de precios", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("promotions", "Promociones", "Descuentos, ofertas y promociones", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("payments", "Pagos", "Métodos de pago y procesamiento", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("crm", "CRM / Clientes", "Gestión de clientes, crédito, fidelidad", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("users", "Usuarios", "Control de acceso y roles", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("finance", "Finanzas", "Cuentas por cobrar/pagar, gastos", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("reports", "Reportes", "Inteligencia de negocios básica", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("quotes", "Cotizaciones", "Generación de presupuestos", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("workshops", "Taller / Servicio", "Órdenes de servicio y reparación", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("kitchen", "Cocina / KDS", "Display de cocina para restaurantes", ModuleScope.BRANCH, ModuleStatus.STABLE),
    ("tables", "Mesas", "Gestión de plano de mesas", ModuleScope.BRANCH, ModuleStatus.STABLE),
    ("logistics", "Logística", "Envíos, rutas, paquetería", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("manufacturing", "Manufactura", "Producción y ensamblaje", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("hr", "Recursos Humanos", "Asistencia, nómina básica", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    # New (2026-05-13)
    ("purchasing", "Compras", "OC, proveedores, recepciones", ModuleScope.GLOBAL, ModuleStatus.STABLE),
    ("appointments", "Agenda", "Citas, disponibilidad, recordatorios", ModuleScope.BRANCH, ModuleStatus.BETA),
    ("commissions", "Comisiones", "Comisiones por servicio o venta", ModuleScope.GLOBAL, ModuleStatus.BETA),
    ("memberships", "Membresías", "Paquetes, créditos y suscripciones", ModuleScope.GLOBAL, ModuleStatus.BETA),
    ("recipes", "Recetas / BOM", "Recetas, ingredientes y costeo por platillo", ModuleScope.GLOBAL, ModuleStatus.BETA),
    ("ai", "Inteligencia Artificial", "Copilotos, predicciones, automatización", ModuleScope.GLOBAL, ModuleStatus.BETA),
]


# ── Per-module upsell metadata ────────────────────────────────────────────────
MODULE_UPSELL = {
    "crm": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_BEAUTY", "ATLAS_ONE_GASTRO", "ATLAS_ONE_SERVICES"],
        "value_props": [
            "Base de datos de clientes",
            "Historial de compras",
            "Crédito y fidelización",
        ],
        "upgrade_prompt": "Activa CRM para conocer y fidelizar a tus clientes.",
        "icon": "fa-users",
        "sort_hint": 10,
    },
    "purchasing": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_GASTRO"],
        "value_props": [
            "Órdenes de compra a proveedores",
            "Recepciones e ingresos a inventario",
            "Cuentas por pagar",
        ],
        "upgrade_prompt": "Controla compras y proveedores desde Atlas One.",
        "icon": "fa-truck",
        "sort_hint": 20,
    },
    "promotions": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL"],
        "value_props": [
            "Descuentos por temporada",
            "Promociones 2x1, combos",
            "Cupones por cliente",
        ],
        "upgrade_prompt": "Vende más con promociones inteligentes.",
        "icon": "fa-tag",
        "sort_hint": 30,
    },
    "quotes": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_SERVICES"],
        "value_props": [
            "Presupuestos en PDF",
            "Seguimiento de oportunidades",
            "Conversión a venta",
        ],
        "upgrade_prompt": "Genera cotizaciones profesionales.",
        "icon": "fa-file-invoice-dollar",
        "sort_hint": 40,
    },
    "branch_catalog_enablement": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL"],
        "value_props": [
            "Catálogo distinto por sucursal",
            "Productos visibles solo donde aplican",
        ],
        "upgrade_prompt": "Personaliza el catálogo de cada sucursal.",
        "icon": "fa-store",
        "sort_hint": 50,
    },
    "appointments": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_BEAUTY", "ATLAS_ONE_SERVICES"],
        "value_props": [
            "Calendario por profesional",
            "Recordatorios automáticos",
            "Bloqueos y disponibilidad",
        ],
        "upgrade_prompt": "Agenda citas y servicios con tus clientes.",
        "icon": "fa-calendar",
        "sort_hint": 60,
    },
    "commissions": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_BEAUTY", "ATLAS_ONE_SERVICES"],
        "value_props": [
            "Comisiones por servicio o venta",
            "Reportes por profesional",
            "Cálculo automático",
        ],
        "upgrade_prompt": "Paga comisiones justas y automáticas.",
        "icon": "fa-percent",
        "sort_hint": 70,
    },
    "memberships": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_BEAUTY"],
        "value_props": [
            "Paquetes y créditos",
            "Renovaciones automáticas",
            "Vencimientos y alertas",
        ],
        "upgrade_prompt": "Vende paquetes y membresías con control.",
        "icon": "fa-id-card",
        "sort_hint": 80,
    },
    "kitchen": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_GASTRO"],
        "value_props": [
            "Pantalla de cocina (KDS)",
            "Comandas digitales",
            "Tiempos por platillo",
        ],
        "upgrade_prompt": "Acelera la cocina con KDS.",
        "icon": "fa-utensils",
        "sort_hint": 90,
    },
    "tables": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_GASTRO"],
        "value_props": [
            "Plano de mesas",
            "Estatus por mesa",
            "Meseros y propinas",
        ],
        "upgrade_prompt": "Gestiona mesas y meseros profesionalmente.",
        "icon": "fa-chair",
        "sort_hint": 100,
    },
    "recipes": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_GASTRO"],
        "value_props": [
            "Recetas con costeo",
            "Consumo automático de insumos",
            "Margen por platillo",
        ],
        "upgrade_prompt": "Conoce el costo real de cada platillo.",
        "icon": "fa-book",
        "sort_hint": 110,
    },
    "workshops": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_SERVICES"],
        "value_props": [
            "Órdenes de trabajo",
            "Estatus por OT",
            "Técnicos asignados",
        ],
        "upgrade_prompt": "Lleva control de órdenes de servicio.",
        "icon": "fa-screwdriver-wrench",
        "sort_hint": 120,
    },
    "logistics": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_ENTERPRISE"],
        "value_props": [
            "Envíos y rutas",
            "Cajas y contenedores",
            "Tracking básico",
        ],
        "upgrade_prompt": "Logística integrada al POS.",
        "icon": "fa-truck-fast",
        "sort_hint": 130,
    },
    "manufacturing": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_ENTERPRISE"],
        "value_props": [
            "Producción y ensamblaje",
            "Consumo de insumos",
            "BOM y costeo",
        ],
        "upgrade_prompt": "Manufactura ligera integrada.",
        "icon": "fa-industry",
        "sort_hint": 140,
    },
    "hr": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_ENTERPRISE"],
        "value_props": [
            "Asistencia",
            "Nómina básica",
            "Vacaciones",
        ],
        "upgrade_prompt": "Recursos Humanos integrado.",
        "icon": "fa-users-gear",
        "sort_hint": 150,
    },
    "finance": {
        "category": "advanced",
        "recommended_presets": ["ATLAS_ONE_RETAIL", "ATLAS_ONE_ENTERPRISE"],
        "value_props": [
            "Cuentas por cobrar y pagar",
            "Gastos",
            "Conciliaciones",
        ],
        "upgrade_prompt": "Lleva las finanzas dentro de Atlas One.",
        "icon": "fa-coins",
        "sort_hint": 160,
    },
    "ai": {
        "category": "vertical",
        "recommended_presets": ["ATLAS_ONE_ENTERPRISE"],
        "value_props": [
            "Copiloto de ventas",
            "Predicciones de demanda",
            "Automatizaciones",
        ],
        "upgrade_prompt": "Agrega IA a tu operación.",
        "icon": "fa-microchip",
        "sort_hint": 170,
    },
}


# ── Preset compositions ───────────────────────────────────────────────────────
ATLAS_POS_MODS = [
    "core", "pos", "cash_management", "catalog", "inventory",
    "returns", "pricing", "payments", "reports",
]

PRESETS = [
    {
        "id": "ATLAS_POS",
        "name": "Atlas POS",
        "desc": "Punto de venta de entrada: ventas, caja, catálogo, inventario, precios, devoluciones y reportes.",
        "mods": ATLAS_POS_MODS,
    },
    {
        "id": "ATLAS_ONE_RETAIL",
        "name": "Atlas One Retail",
        "desc": "Retail multi-sucursal: ferreterías, abarrotes, farmacias, papelerías, refaccionarias.",
        "mods": ATLAS_POS_MODS + ["crm", "branch_catalog_enablement", "purchasing", "promotions", "quotes"],
    },
    {
        "id": "ATLAS_ONE_BEAUTY",
        "name": "Atlas One Beauty",
        "desc": "Barberías, estéticas, spas, estudios de uñas y wellness con agenda, servicios y comisiones.",
        "mods": [
            "core", "users", "catalog", "inventory", "payments",
            "cash_management", "crm", "pos",
            "appointments", "commissions", "memberships",
            "reports",
        ],
    },
    {
        "id": "ATLAS_ONE_GASTRO",
        "name": "Atlas One Gastro",
        "desc": "Cafés, restaurantes pequeños, taquerías, food trucks y dark kitchens con KDS, mesas y recetas.",
        "mods": [
            "core", "users", "catalog", "inventory", "payments",
            "cash_management", "crm", "pos",
            "kitchen", "tables", "recipes",
            "reports",
        ],
    },
    {
        "id": "ATLAS_ONE_SERVICES",
        "name": "Atlas One Services",
        "desc": "Talleres, consultorios, mantenimiento, soporte y operaciones con órdenes de trabajo.",
        "mods": [
            "core", "users", "catalog", "payments", "crm",
            "workshops", "appointments", "quotes", "commissions",
            "reports",
        ],
    },
    {
        "id": "ATLAS_ONE_ENTERPRISE",
        "name": "Atlas One Enterprise",
        "desc": "Implementación completa: multi-sucursal avanzado, IA, integraciones y todos los módulos.",
        "mods": [k for k, *_ in MODULES_CATALOG],
    },
    {
        "id": "CUSTOM",
        "name": "Personalizado",
        "desc": "Configuración manual desde cero. Solo módulos base.",
        "mods": ["core", "users"],
    },
]


def seed_modules_and_presets(db: Session) -> None:
    """Upsert modules (with upsell_metadata) and the 7 Atlas One presets."""
    logger.info("--- Seeding Modules ---")
    for key, name, desc, scope, status in MODULES_CATALOG:
        mod = db.query(Module).filter(Module.key == key).first()
        if not mod:
            mod = Module(key=key, name=name, description=desc, scope=scope, status=status)
            db.add(mod)
            logger.info(f"  + module: {key}")
        else:
            mod.name = name
            mod.description = desc
            mod.status = status
            logger.info(f"  ~ module: {key}")
        mod.upsell_metadata = MODULE_UPSELL.get(key)
    db.commit()

    logger.info(f"--- Seeding {len(PRESETS)} Presets ---")
    for p in PRESETS:
        existing = (
            db.query(IndustryPreset)
            .filter(IndustryPreset.industry_type == p["id"])
            .first()
        )
        if existing:
            existing.display_name = p["name"]
            existing.description = p["desc"]
            existing.modules = p["mods"]
            existing.is_system = True
            logger.info(f"  ~ preset: {p['name']}")
        else:
            db.add(
                IndustryPreset(
                    industry_type=p["id"],
                    display_name=p["name"],
                    description=p["desc"],
                    modules=p["mods"],
                    is_system=True,
                )
            )
            logger.info(f"  + preset: {p['name']}")
    db.commit()


def main():
    db = SessionLocal()
    try:
        logger.info("🚀 Initializing Atlas One Modules & Presets...")
        seed_modules_and_presets(db)
        logger.info("✅ Done")
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 6.4: Run seed tests to verify pass**

```bash
pytest tests/test_seed_presets.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 6.5: Run full backend test suite**

```bash
pytest tests/ -x --tb=line 2>&1 | tail -30
```

Expected: green or only pre-existing failures unrelated to this work.

- [ ] **Step 6.6: Commit**

```bash
git add scripts/init_presets_v2.py tests/test_seed_presets.py
git commit -m "$(cat <<'EOF'
feat(seed): rewrite presets seed for Atlas One hierarchy

- 6 new modules (purchasing, appointments, commissions, memberships,
  recipes, ai) with BETA status where appropriate
- 7 presets: ATLAS_POS (aligerado, sin crm/branch_catalog_enablement),
  ATLAS_ONE_RETAIL/BEAUTY/GASTRO/SERVICES/ENTERPRISE, CUSTOM
- MODULE_UPSELL dict populates upsell_metadata per module
- Idempotent upsert by key/industry_type — legacy presets in DB are
  left untouched for manual cleanup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend types + API client function

**Files:**
- Modify: `frontend/src/api/platform.ts` (insert after `IndustryPreset` interface at line ~236, and after `platformApi.deletePreset` at line ~483)

- [ ] **Step 7.1: Add TypeScript types**

In `frontend/src/api/platform.ts`, after the `IndustryPreset` interface (line ~236), add:

```typescript
// ── Module Upsell System (2026-05-13) ───────────────────────────────────────

export interface UpsellRecommendation {
  module_key: string
  module_name: string
  description: string | null
  category: 'base' | 'advanced' | 'vertical' | null
  status: 'STABLE' | 'BETA'
  in_recommended_preset: boolean
  recommended_presets: string[]
  value_props: string[]
  upgrade_prompt: string | null
  icon: string | null
  sort_hint: number
}

export interface UpsellResponse {
  org_id: number
  active_preset: string | null
  active_modules: string[]
  recommendations: UpsellRecommendation[]
  grouped_by_preset: Record<string, string[]>
}
```

- [ ] **Step 7.2: Add API client function**

In `frontend/src/api/platform.ts`, find the `platformApi` object (somewhere near line ~360 where `applyPreset` and `resetPreset` live) and add:

```typescript
  getUpsellRecommendations: (orgId: number) =>
    client.get<UpsellResponse>(`/platform/organizations/${orgId}/upsell-recommendations`)
      .then((r) => r.data),
```

(Add the method inside the `platformApi` object literal; do not duplicate the surrounding braces.)

- [ ] **Step 7.3: Quick TypeScript build check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new TypeScript errors related to platform.ts.

- [ ] **Step 7.4: Commit**

```bash
git add frontend/src/api/platform.ts
git commit -m "$(cat <<'EOF'
feat(api): add UpsellRecommendation types + getUpsellRecommendations

Frontend client for the new upsell endpoint.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: UI section "Módulos disponibles" in PlatformOrgDetail

**Files:**
- Modify: `frontend/src/pages/platform/PlatformOrgDetail.tsx`

- [ ] **Step 8.1: Locate the orgs detail page structure**

```bash
grep -n "^export function PlatformOrgDetail\|return (\|<PlatformPageShell\|kpis\|modules.length\|enabledModules" frontend/src/pages/platform/PlatformOrgDetail.tsx | head -20
```

Note: the file is ~1000 lines. The render block is large. We'll insert a new collapsible section after the existing "modules" section.

- [ ] **Step 8.2: Add upsell state + fetch**

In `PlatformOrgDetail.tsx`, after the existing `useState` block (near line ~248 where `presets`/`modules` are declared), add:

```typescript
  const [upsell, setUpsell] = useState<UpsellResponse | null>(null)
  const [upsellLoading, setUpsellLoading] = useState(false)
```

Update the import at the top to include `UpsellResponse`:

```typescript
import { platformApi, ..., UpsellResponse } from '../../api/platform'
```

In the data-loading `useEffect` (or whatever function loads org data), add a fetch for upsell. Find the existing fetch pattern (likely `platformApi.getOrg(id)` or similar) and add:

```typescript
  const loadUpsell = async () => {
    setUpsellLoading(true)
    try {
      const data = await platformApi.getUpsellRecommendations(Number(id))
      setUpsell(data)
    } catch {
      setUpsell(null)
    } finally {
      setUpsellLoading(false)
    }
  }
```

Call `loadUpsell()` inside the existing org-load effect.

- [ ] **Step 8.3: Add the UI section**

Find the JSX where the existing modules section ends (search for `{counts.activeModules} de {modules.length} habilitados`, line ~615). After the closing block of that section, insert the new section:

```tsx
{/* Módulos disponibles (upsell) */}
<div style={{
  background: 'var(--p-surface)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  padding: 16,
  marginTop: 16,
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
      <i className="fa-solid fa-arrow-up-right-dots" style={{ marginRight: 8, color: 'var(--p-teal)' }} />
      Módulos disponibles
    </h3>
    <span style={{ fontSize: 11, color: 'var(--p-muted)' }}>
      {upsell ? `${upsell.recommendations.length} disponibles` : '—'}
    </span>
  </div>

  {upsellLoading && (
    <p style={{ fontSize: 12, color: 'var(--p-muted)' }}>Cargando recomendaciones...</p>
  )}

  {!upsellLoading && upsell && upsell.recommendations.length === 0 && (
    <p style={{ fontSize: 12, color: 'var(--p-muted)', fontStyle: 'italic' }}>
      Tu organización tiene todos los módulos recomendados activos.
    </p>
  )}

  {!upsellLoading && upsell && upsell.recommendations.length > 0 && (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 12,
    }}>
      {upsell.recommendations.map(rec => (
        <div
          key={rec.module_key}
          style={{
            background: 'var(--p-bg)',
            border: `1px solid ${rec.in_recommended_preset ? 'var(--p-teal)' : 'var(--p-border)'}`,
            borderRadius: 6,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {rec.icon && <i className={`fa-solid ${rec.icon}`} style={{ color: 'var(--p-cyan)' }} />}
            <span style={{ fontWeight: 700, fontSize: 13 }}>{rec.module_name}</span>
            <span style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: 3,
              fontWeight: 700,
              letterSpacing: '0.04em',
              background: rec.status === 'BETA' ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.15)',
              color: rec.status === 'BETA' ? 'var(--p-warning)' : 'var(--p-success)',
            }}>
              {rec.status}
            </span>
          </div>

          {rec.in_recommended_preset && (
            <span style={{
              fontSize: 10,
              color: 'var(--p-teal)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              <i className="fa-solid fa-star" style={{ marginRight: 4 }} />
              Recomendado para tu plan
            </span>
          )}

          {rec.upgrade_prompt && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--p-muted)', lineHeight: 1.4 }}>
              {rec.upgrade_prompt}
            </p>
          )}

          {rec.value_props.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--p-text)' }}>
              {rec.value_props.map((vp, i) => <li key={i}>{vp}</li>)}
            </ul>
          )}

          <button
            onClick={async () => {
              try {
                await platformApi.toggleModule(Number(id), rec.module_key, true)
                toast.success(`${rec.module_name} activado`)
                loadUpsell()
                load()  // existing load() at line ~286 refreshes the modules grid
              } catch (err: any) {
                toast.error(err?.response?.data?.detail || 'No se pudo activar')
              }
            }}
            style={{
              background: 'var(--p-teal)',
              color: '#000',
              fontWeight: 700,
              border: 'none',
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: 11,
              cursor: 'pointer',
              marginTop: 'auto',
            }}
          >
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />
            Activar
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 8.4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "PlatformOrgDetail|platform\.ts" | head -10
```

Expected: no errors.

- [ ] **Step 8.5: Start dev server and visually verify**

```bash
cd frontend && npm run dev 2>&1 | head -5
```

In a browser, open `http://localhost:5173/platform/orgs/<some-org-id>` (after logging in as platform admin). Verify:
- "Módulos disponibles" section renders below modules.
- Cards appear for each recommendation.
- Clicking "Activar" enables the module and the card disappears.

Kill the dev server when done.

- [ ] **Step 8.6: Commit**

```bash
git add frontend/src/pages/platform/PlatformOrgDetail.tsx frontend/src/api/platform.ts
git commit -m "$(cat <<'EOF'
feat(platform-ui): add 'Módulos disponibles' upsell section

Cards show recommended modules per org, with value props,
upgrade prompt, and an Activar button that calls the existing
toggle endpoint. Highlights modules recommended for the org's
active preset.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Apply local — full end-to-end

- [ ] **Step 9.1: Reset local DB (optional but recommended)**

If a local SQLite exists and you want a clean state:

```bash
rm -f sql_app.db
python -c "from app.core.database import Base, engine; import app.models; Base.metadata.create_all(bind=engine); print('schema created')"
```

If using local Postgres, skip — `create_all` is idempotent.

- [ ] **Step 9.2: Run migration**

```bash
python scripts/migrate_presets_v3.py
```

Expected: ends with `✅ Migration complete`.

- [ ] **Step 9.3: Run seed**

```bash
python scripts/init_presets_v2.py
```

Expected: ends with `✅ Done`. Logs show 27 modules and 7 presets seeded/updated.

- [ ] **Step 9.4: Verify via API**

Start the backend:

```bash
uvicorn app.main:app --reload --port 8000 &
sleep 3
```

Get a platform admin token (use whatever your local login flow is) and curl:

```bash
curl -s http://localhost:8000/api/platform/presets | python -m json.tool | head -50
```

Expected: 7+ presets listed including ATLAS_ONE_RETAIL, ATLAS_ONE_BEAUTY, etc.

```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8000/api/platform/organizations/1/upsell-recommendations \
  | python -m json.tool | head -40
```

Expected: JSON with `recommendations`, `grouped_by_preset`, and `active_preset` for org 1.

Kill the backend: `kill %1`

- [ ] **Step 9.5: Verify via UI**

```bash
cd frontend && npm run dev
```

Browser:
- `/platform/presets` → 7+ presets listed
- `/platform/orgs/<id>` → "Módulos disponibles" section visible with cards

Kill the dev server.

- [ ] **Step 9.6: Run full test suite one more time**

```bash
pytest tests/ --tb=line 2>&1 | tail -10
```

Expected: green (or only unrelated pre-existing failures).

---

## Task 10: Apply to Railway

> ⚠️ **Stop and confirm with the user before this step.** Risky action: touches production DB. Ask explicitly: "About to run migration + seed on Railway with DATABASE_URL from your env. Confirm to proceed?"

- [ ] **Step 10.1: Set Railway DATABASE_URL**

```bash
# Use the same env source you use for Railway access
export DATABASE_URL="postgresql://...railway..."
```

Verify:

```bash
python -c "import os; url=os.environ['DATABASE_URL']; print(url.split('@')[1] if '@' in url else 'no host')"
```

Expected: prints Railway host (e.g., `containers-us-west-XXX.railway.app:5432/railway`).

- [ ] **Step 10.2: Audit existing legacy presets (read-only)**

```bash
python <<'PY'
import os
from sqlalchemy import create_engine, text
e = create_engine(os.environ["DATABASE_URL"])
with e.connect() as c:
    for row in c.execute(text("""
        SELECT industry_type, COUNT(*)
        FROM organization
        WHERE industry_type IS NOT NULL
        GROUP BY industry_type ORDER BY industry_type
    """)):
        print(row)
PY
```

Expected: prints the orgs-per-industry distribution. Note any orgs using legacy values (RESTAURANT_QSR, etc.) — they will keep working but their preset becomes "deprecated" until cleanup.

- [ ] **Step 10.3: Run migration on Railway**

```bash
python scripts/migrate_presets_v3.py
```

Expected: logs show ALTER TABLE + 5x ALTER TYPE for industrytype.

- [ ] **Step 10.4: Run seed on Railway**

```bash
python scripts/init_presets_v2.py
```

Expected: logs show ~27 modules seeded/updated + 7 presets seeded/updated.

- [ ] **Step 10.5: Verify in Railway frontend / production UI**

Open the deployed frontend (Railway domain). Navigate to `/platform/presets`. Expected: 7+ presets visible, including the 5 new Atlas One verticals.

- [ ] **Step 10.6: Document in memory**

Update memory file `project_phase2_inflight.md` with a one-line note that presets were expanded on 2026-05-13. (Not part of this commit — separate memory update.)

---

## Done criteria

- [ ] All TDD tests added in tasks 1, 2, 5, 6 pass.
- [ ] `pytest tests/` green.
- [ ] `/platform/presets` shows 7 Atlas One presets (locally + on Railway).
- [ ] `/platform/orgs/<id>` shows the "Módulos disponibles" section with cards.
- [ ] Activar button on a card enables the module and the card disappears.
- [ ] Legacy orgs (if any) continue to load without 500s.

## Out-of-scope follow-ups (do NOT do as part of this plan)

- Atlas POS tiers (limits on users/branches/accounts) — separate spec.
- Cleanup of legacy presets in DB (`DELETE FROM industry_presets WHERE industry_type IN ...`) — manual SQL, by operator.
- Self-service upsell (org admin activates own modules without platform admin).
- Pricing/billing per module.
- Alembic baseline migration — the entire `alembic/versions/` is empty; baseline is a separate effort.
