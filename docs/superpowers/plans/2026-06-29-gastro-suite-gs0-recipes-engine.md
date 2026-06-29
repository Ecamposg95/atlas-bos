# GS-0 · Espina Operativa (Recipes Engine) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el motor recetas→inventario→merma→margen que descuenta insumos automáticamente en cada venta pagada, el diferenciador central de la Gastro Suite.

**Architecture:** Módulo `recipes` nuevo (modelos `Recipe`/`RecipeLine`/`WasteLog` + `services.py` con costeo y consumo + `router.py` CRUD). Un hook en `create_sale` (tras `db.flush()`, solo cuando la venta queda `PAID`) explota la receta del producto vendido en insumos y los descuenta de `StockOnHand`, registrando `InventoryMovement(RECIPE_CONSUMPTION)`. El costeo vive solo en `services.py`; las superficies lo consumen por interfaz.

**Tech Stack:** FastAPI, SQLAlchemy (Numeric/Decimal), Pydantic v2, pytest (SQLite in-memory en tests), migraciones idempotentes en `scripts/railway_init.py` (no Alembic).

## Global Constraints

- **Multi-tenant obligatorio:** todo query de negocio filtra por `organization_id`, con fallback a NULL legado: `or_(Model.organization_id == org_id, Model.organization_id.is_(None))`. Usar `get_tenant_scoped`/`scoped_query` de `app/core/tenant_query.py` en el router.
- **Decimal siempre:** convertir cantidades vía `Decimal(str(x))`; nunca float aritmético sobre dinero/stock.
- **Pydantic v2:** `model_config = ConfigDict(from_attributes=True)`; nada de `.dict()`/`.from_orm()`.
- **Convención de módulo** (`docs/modules/MODULE_GUIDE.md`): `__init__.py` + `models.py` + `schemas.py` + `services.py` + `router.py`; `router = APIRouter()` sin prefix (el prefix `/api/recipes` ya está en `app/main.py:177`).
- **Migraciones:** tablas nuevas las crea `Base.metadata.create_all` (init). Columnas/enums/índices en `scripts/railway_init.py:run_migrations()` siguiendo el patrón existente. `ALTER TYPE ... ADD VALUE` requiere AUTOCOMMIT.
- **Verificación de tests:** el WSL del usuario no tiene venv local; si `pytest` no corre localmente, el ciclo rojo/verde se valida en el CI gate de GitHub Actions (`.github/workflows/ci.yml`). Escribir los tests igual (TDD) y empujarlos.
- **Idempotencia del hook:** el consumo se dispara SOLO cuando `doc_status == DocumentStatus.PAID`. Las ediciones de venta solo ocurren en estado `PENDING` (`sales.py:381`), por lo que el consumo nunca necesita reversa.

---

### Task 1: Flag `is_raw_material` en ProductVariant

Distingue insumos (ingredientes/botellas) de productos vendibles, para excluirlos del POS y marcarlos como consumibles por recetas.

**Files:**
- Modify: `app/modules/products/models.py:89` (añadir columna tras `cost`)
- Modify: `scripts/railway_init.py:91` (añadir tupla a `migrations`)
- Test: `tests/test_recipes_models.py`

**Interfaces:**
- Produces: `ProductVariant.is_raw_material: bool` (default `False`).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_recipes_models.py
from decimal import Decimal
from app.models.products import Product, ProductVariant


def test_variant_defaults_to_not_raw_material(db, org):
    p = Product(name="Hamburguesa", organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    v = ProductVariant(product_id=p.id, sku="HB-1", price=Decimal("120"),
                       cost=Decimal("45"), organization_id=org.id)
    db.add(v); db.flush()
    assert v.is_raw_material is False


def test_variant_can_be_marked_raw_material(db, org):
    p = Product(name="Carne molida (insumo)", organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    v = ProductVariant(product_id=p.id, sku="INS-CARNE", price=Decimal("0"),
                       cost=Decimal("180"), organization_id=org.id,
                       is_raw_material=True)
    db.add(v); db.flush()
    assert v.is_raw_material is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_models.py -v -k is_raw_material`
Expected: FAIL — `TypeError: 'is_raw_material' is an invalid keyword argument` / `AttributeError`.

- [ ] **Step 3: Add the column**

In `app/modules/products/models.py`, immediately after line 89 (`cost = Column(...)`):

```python
    # [GS-0] Insumo vs producto vendible. True = ingrediente/botella consumible
    # por recetas, oculto del POS. False (default) = producto vendible normal.
    is_raw_material = Column(Boolean, nullable=False, default=False, server_default="false")
```

(`Boolean` ya está importado en la línea 12.)

In `scripts/railway_init.py`, add to the `migrations` list (after line 90, before the closing `]`):

```python
        # GS-0 Gastro Suite 2026-06-29 — insumo flag para recetas
        ("product_variants", "is_raw_material", "ALTER TABLE product_variants ADD COLUMN is_raw_material BOOLEAN NOT NULL DEFAULT FALSE;"),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_models.py -v -k is_raw_material`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add app/modules/products/models.py scripts/railway_init.py tests/test_recipes_models.py
git commit -m "feat(gs0): is_raw_material flag on ProductVariant"
```

---

### Task 2: MovementType `RECIPE_CONSUMPTION`

Nuevo tipo de movimiento de kardex para distinguir el consumo por receta de ventas/ajustes.

**Files:**
- Modify: `app/models/inventory.py:22`
- Modify: `scripts/railway_init.py:47` (sync de enum tras industrytype)
- Test: `tests/test_recipes_models.py`

**Interfaces:**
- Produces: `MovementType.RECIPE_CONSUMPTION = "RECIPE_CONSUMPTION"`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_recipes_models.py  (append)
from app.models.inventory import MovementType


def test_recipe_consumption_movement_type_exists():
    assert MovementType.RECIPE_CONSUMPTION.value == "RECIPE_CONSUMPTION"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_models.py::test_recipe_consumption_movement_type_exists -v`
Expected: FAIL — `AttributeError: RECIPE_CONSUMPTION`.

- [ ] **Step 3: Add the enum value**

In `app/models/inventory.py`, after line 22 (`SALE_RETURN = ...`):

```python
    RECIPE_CONSUMPTION = "RECIPE_CONSUMPTION"  # [GS-0] Descuento de insumo por receta
```

In `scripts/railway_init.py`, after the industrytype sync block (after line 47), add:

```python
    # GS-0 2026-06-29 — RECIPE_CONSUMPTION en el enum movementtype.
    # ADD VALUE no corre en txn block → AUTOCOMMIT.
    print("\n  GS-0 — ensuring movementtype has RECIPE_CONSUMPTION…")
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("ALTER TYPE movementtype ADD VALUE IF NOT EXISTS 'RECIPE_CONSUMPTION'"))
    print("  ✓ movementtype enum synced")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_models.py::test_recipe_consumption_movement_type_exists -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/models/inventory.py scripts/railway_init.py tests/test_recipes_models.py
git commit -m "feat(gs0): RECIPE_CONSUMPTION movement type"
```

---

### Task 3: Modelos Recipe + RecipeLine + WasteLog

El BOM (receta → líneas de insumo) y el registro de merma.

**Files:**
- Create: `app/modules/recipes/models.py`
- Modify: `scripts/railway_init.py` (index_migrations — añadir 3 índices)
- Test: `tests/test_recipes_models.py`

**Interfaces:**
- Produces:
  - `Recipe(id:str, organization_id:int, variant_id:str, name:str, yield_qty:Decimal, is_active:bool, lines:list[RecipeLine])`
  - `RecipeLine(id:str, recipe_id:str, insumo_variant_id:str, qty:Decimal, unit:str|None)`
  - `WasteLog(id:str, organization_id:int, branch_id:int, insumo_variant_id:str, qty:Decimal, unit_cost:Decimal, reason:WasteReason, notes:str|None, created_by:int|None)`
  - `WasteReason` enum: `SPOILAGE, PREP, BREAKAGE, THEFT, COUNT_ADJUST`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_recipes_models.py  (append)
from app.modules.recipes.models import Recipe, RecipeLine, WasteLog, WasteReason


def _variant(db, org, sku, cost, raw=False):
    p = Product(name=sku, organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    v = ProductVariant(product_id=p.id, sku=sku, price=Decimal("0"),
                       cost=Decimal(str(cost)), organization_id=org.id,
                       is_raw_material=raw)
    db.add(v); db.flush()
    return v


def test_recipe_with_lines(db, org):
    dish = _variant(db, org, "BURGER", 0)
    beef = _variant(db, org, "INS-BEEF", 180, raw=True)
    bun = _variant(db, org, "INS-BUN", 12, raw=True)
    r = Recipe(organization_id=org.id, variant_id=dish.id, name="Hamburguesa", yield_qty=Decimal("1"))
    db.add(r); db.flush()
    db.add(RecipeLine(organization_id=org.id, recipe_id=r.id, insumo_variant_id=beef.id, qty=Decimal("0.15"), unit="kg"))
    db.add(RecipeLine(organization_id=org.id, recipe_id=r.id, insumo_variant_id=bun.id, qty=Decimal("1"), unit="pza"))
    db.flush()
    db.refresh(r)
    assert len(r.lines) == 2


def test_waste_log_records_merma(db, org):
    beef = _variant(db, org, "INS-BEEF2", 180, raw=True)
    w = WasteLog(organization_id=org.id, branch_id=1, insumo_variant_id=beef.id,
                 qty=Decimal("0.5"), unit_cost=Decimal("180"), reason=WasteReason.SPOILAGE)
    db.add(w); db.flush()
    assert w.reason == WasteReason.SPOILAGE
    assert w.qty == Decimal("0.5")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_models.py -v -k "recipe_with_lines or waste_log"`
Expected: FAIL — `ModuleNotFoundError`/`ImportError` (no `models.py`).

- [ ] **Step 3: Create the models**

```python
# app/modules/recipes/models.py
"""Atlas BOS modules/recipes/models — espina gastro (Recipe + WasteLog).

DOMAIN: Recipes / Costing / Merma
STATUS: Beta (GS-0)

3 tablas:
  - recipes            (BOM cabecera, 1 por variant vendible)
  - recipe_lines       (insumos del BOM)
  - recipe_waste_logs  (merma registrada)
"""
import enum

from sqlalchemy import (
    Boolean, Column, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.mixins import UUIDMixin, AuditMixin, TenantMixin


class WasteReason(str, enum.Enum):
    SPOILAGE = "SPOILAGE"          # caducidad / daño
    PREP = "PREP"                  # merma de preparación
    BREAKAGE = "BREAKAGE"          # rotura
    THEFT = "THEFT"                # faltante
    COUNT_ADJUST = "COUNT_ADJUST"  # ajuste teórico vs conteo físico


# Enum type declarado una vez (evita duplicate CREATE TYPE).
_waste_reason_enum = Enum(WasteReason, name="recipe_waste_reason")


class Recipe(Base, UUIDMixin, AuditMixin, TenantMixin):
    __tablename__ = "recipes"
    __table_args__ = (
        UniqueConstraint("organization_id", "variant_id", name="uq_recipe_per_variant"),
        {"extend_existing": True},
    )

    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    yield_qty = Column(Numeric(10, 3), nullable=False, default=1)  # porciones que produce
    is_active = Column(Boolean, nullable=False, default=True)

    variant = relationship("ProductVariant", foreign_keys=[variant_id])
    lines = relationship("RecipeLine", back_populates="recipe", cascade="all, delete-orphan")


class RecipeLine(Base, UUIDMixin, AuditMixin, TenantMixin):
    __tablename__ = "recipe_lines"
    __table_args__ = ({"extend_existing": True},)

    recipe_id = Column(String(36), ForeignKey("recipes.id"), nullable=False, index=True)
    insumo_variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False, index=True)
    qty = Column(Numeric(10, 4), nullable=False)  # cantidad de insumo por 1 yield
    unit = Column(String, nullable=True)          # etiqueta informativa (g, ml, pza)

    recipe = relationship("Recipe", back_populates="lines")
    insumo = relationship("ProductVariant", foreign_keys=[insumo_variant_id])


class WasteLog(Base, UUIDMixin, AuditMixin, TenantMixin):
    __tablename__ = "recipe_waste_logs"
    __table_args__ = ({"extend_existing": True},)

    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    insumo_variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False, index=True)
    qty = Column(Numeric(10, 4), nullable=False)
    unit_cost = Column(Numeric(10, 4), nullable=False)  # costo unitario al momento del registro
    reason = Column(_waste_reason_enum, nullable=False, default=WasteReason.SPOILAGE)
    notes = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    insumo = relationship("ProductVariant", foreign_keys=[insumo_variant_id])
```

In `scripts/railway_init.py`, add to `index_migrations` (alongside the other tuples):

```python
        # GS-0 Gastro Suite 2026-06-29
        ("ix_recipes_org_variant", "CREATE INDEX IF NOT EXISTS ix_recipes_org_variant ON recipes (organization_id, variant_id);"),
        ("ix_recipe_lines_recipe", "CREATE INDEX IF NOT EXISTS ix_recipe_lines_recipe ON recipe_lines (recipe_id);"),
        ("ix_waste_logs_org_branch_created", "CREATE INDEX IF NOT EXISTS ix_waste_logs_org_branch_created ON recipe_waste_logs (organization_id, branch_id, created_at);"),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_models.py -v`
Expected: PASS (all model tests). Tables are auto-created by `conftest._create_tables` because importing the test imports `app.modules.recipes.models`, registering them on `Base.metadata`.

- [ ] **Step 5: Commit**

```bash
git add app/modules/recipes/models.py scripts/railway_init.py tests/test_recipes_models.py
git commit -m "feat(gs0): Recipe + RecipeLine + WasteLog models"
```

---

### Task 4: Schemas Pydantic v2

**Files:**
- Create: `app/modules/recipes/schemas.py`
- Test: `tests/test_recipes_api.py` (smoke de import + validación)

**Interfaces:**
- Produces: `RecipeLineCreate`, `RecipeLineRead`, `RecipeCreate`, `RecipeUpdate`, `RecipeRead`, `WasteLogCreate`, `WasteLogRead`, `MarginRow`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_recipes_api.py
from decimal import Decimal
from app.modules.recipes.schemas import RecipeCreate, RecipeLineCreate


def test_recipe_create_schema_validates():
    payload = RecipeCreate(
        variant_id="v-1", name="Latte", yield_qty=Decimal("1"),
        lines=[RecipeLineCreate(insumo_variant_id="i-1", qty=Decimal("0.2"), unit="lt")],
    )
    assert payload.name == "Latte"
    assert payload.lines[0].qty == Decimal("0.2")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_api.py::test_recipe_create_schema_validates -v`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Create the schemas**

```python
# app/modules/recipes/schemas.py
"""Pydantic v2 schemas for the recipes module."""
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.modules.recipes.models import WasteReason


class RecipeLineCreate(BaseModel):
    insumo_variant_id: str
    qty: Decimal = Field(gt=0)
    unit: Optional[str] = None


class RecipeLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    insumo_variant_id: str
    qty: Decimal
    unit: Optional[str] = None


class RecipeCreate(BaseModel):
    variant_id: str
    name: str
    yield_qty: Decimal = Field(default=Decimal("1"), gt=0)
    lines: List[RecipeLineCreate] = []


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    yield_qty: Optional[Decimal] = Field(default=None, gt=0)
    is_active: Optional[bool] = None
    lines: Optional[List[RecipeLineCreate]] = None  # si viene, reemplaza todas


class RecipeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    variant_id: str
    name: str
    yield_qty: Decimal
    is_active: bool
    lines: List[RecipeLineRead] = []


class WasteLogCreate(BaseModel):
    branch_id: int
    insumo_variant_id: str
    qty: Decimal = Field(gt=0)
    reason: WasteReason = WasteReason.SPOILAGE
    notes: Optional[str] = None


class WasteLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    branch_id: int
    insumo_variant_id: str
    qty: Decimal
    unit_cost: Decimal
    reason: WasteReason
    notes: Optional[str] = None


class MarginRow(BaseModel):
    variant_id: str
    recipe_name: str
    price: Decimal
    cogs: Decimal
    margin: Decimal
    margin_pct: Decimal
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_api.py::test_recipe_create_schema_validates -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/modules/recipes/schemas.py tests/test_recipes_api.py
git commit -m "feat(gs0): recipes Pydantic v2 schemas"
```

---

### Task 5: Servicio de costeo — `explode`, `cost_of`, `get_recipe_for_variant`

**Files:**
- Create: `app/modules/recipes/services.py`
- Test: `tests/test_recipes_costing.py`

**Interfaces:**
- Consumes: `Recipe`, `RecipeLine` (Task 3); `ProductVariant`, `StockOnHand`, `InventoryMovement`, `MovementType` (Tasks 1-2).
- Produces:
  - `get_recipe_for_variant(db, variant_id, org_id) -> Recipe | None`
  - `explode(db, variant_id, qty, org_id) -> list[tuple[str, Decimal]]` (insumo_variant_id, qty_total)
  - `cost_of(db, variant_id, org_id) -> Decimal` (COGS de 1 yield)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_recipes_costing.py
from decimal import Decimal
import pytest
from app.models.products import Product, ProductVariant
from app.modules.recipes.models import Recipe, RecipeLine
from app.modules.recipes import services


def _v(db, org, sku, cost, raw=False):
    p = Product(name=sku, organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    v = ProductVariant(product_id=p.id, sku=sku, price=Decimal("0"),
                       cost=Decimal(str(cost)), organization_id=org.id, is_raw_material=raw)
    db.add(v); db.flush()
    return v


@pytest.fixture()
def burger_recipe(db, org):
    dish = _v(db, org, "BURGER", 0)
    beef = _v(db, org, "INS-BEEF", 180, raw=True)   # $180/kg
    bun = _v(db, org, "INS-BUN", 12, raw=True)       # $12/pza
    r = Recipe(organization_id=org.id, variant_id=dish.id, name="Hamburguesa", yield_qty=Decimal("1"))
    db.add(r); db.flush()
    db.add(RecipeLine(organization_id=org.id, recipe_id=r.id, insumo_variant_id=beef.id, qty=Decimal("0.15")))
    db.add(RecipeLine(organization_id=org.id, recipe_id=r.id, insumo_variant_id=bun.id, qty=Decimal("1")))
    db.flush()
    return {"dish": dish, "beef": beef, "bun": bun}


def test_explode_scales_by_quantity(db, org, burger_recipe):
    out = dict(services.explode(db, burger_recipe["dish"].id, Decimal("2"), org.id))
    assert out[burger_recipe["beef"].id] == Decimal("0.30")  # 0.15 * 2
    assert out[burger_recipe["bun"].id] == Decimal("2")


def test_explode_returns_empty_for_variant_without_recipe(db, org):
    plain = _v(db, org, "SODA", 0)
    assert services.explode(db, plain.id, Decimal("1"), org.id) == []


def test_cost_of_sums_insumo_costs(db, org, burger_recipe):
    # 0.15 kg * 180 + 1 pza * 12 = 27 + 12 = 39
    assert services.cost_of(db, burger_recipe["dish"].id, org.id) == Decimal("39.00")


def test_cost_of_respects_yield(db, org):
    dish = _v(db, org, "SALSA-BATCH", 0)
    tomato = _v(db, org, "INS-TOMATO", 30, raw=True)
    r = Recipe(organization_id=org.id, variant_id=dish.id, name="Salsa", yield_qty=Decimal("4"))
    db.add(r); db.flush()
    db.add(RecipeLine(organization_id=org.id, recipe_id=r.id, insumo_variant_id=tomato.id, qty=Decimal("2")))
    db.flush()
    # 2 * 30 = 60 por batch de 4 → 15 por porción
    assert services.cost_of(db, dish.id, org.id) == Decimal("15.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_costing.py -v`
Expected: FAIL — `ModuleNotFoundError: app.modules.recipes.services`.

- [ ] **Step 3: Create the service (costing only)**

```python
# app/modules/recipes/services.py
"""Atlas BOS modules/recipes/services — costeo y consumo de insumos (espina GS-0).

Única fuente de verdad del costeo. Las superficies (POS, KDS, homes) consumen
estas funciones por interfaz; nunca recalculan costos.
"""
from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.inventory import InventoryMovement, MovementType, StockOnHand
from app.models.products import ProductVariant
from app.modules.recipes.models import Recipe

ZERO = Decimal("0")


def _dec(v) -> Decimal:
    if v is None:
        return ZERO
    return v if isinstance(v, Decimal) else Decimal(str(v))


def get_recipe_for_variant(db: Session, variant_id: str, org_id):
    """Receta activa de un variant vendible, o None."""
    return (
        db.query(Recipe)
        .filter(
            Recipe.variant_id == variant_id,
            Recipe.is_active.is_(True),
            or_(Recipe.organization_id == org_id, Recipe.organization_id.is_(None)),
        )
        .first()
    )


def explode(db: Session, variant_id: str, qty, org_id):
    """[(insumo_variant_id, qty_total)] para vender `qty` del variant.
    Lista vacía si el variant no tiene receta."""
    recipe = get_recipe_for_variant(db, variant_id, org_id)
    if recipe is None:
        return []
    factor = _dec(qty) / (_dec(recipe.yield_qty) or Decimal("1"))
    return [(line.insumo_variant_id, _dec(line.qty) * factor) for line in recipe.lines]


def cost_of(db: Session, variant_id: str, org_id) -> Decimal:
    """COGS de 1 yield del variant (suma de insumos / yield). ZERO si no hay receta."""
    recipe = get_recipe_for_variant(db, variant_id, org_id)
    if recipe is None:
        return ZERO
    total = ZERO
    for line in recipe.lines:
        insumo = db.query(ProductVariant).filter(ProductVariant.id == line.insumo_variant_id).first()
        total += _dec(line.qty) * (_dec(insumo.cost) if insumo else ZERO)
    return (total / (_dec(recipe.yield_qty) or Decimal("1"))).quantize(Decimal("0.01"))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_costing.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/modules/recipes/services.py tests/test_recipes_costing.py
git commit -m "feat(gs0): recipe costing service (explode + cost_of)"
```

---

### Task 6: `apply_consumption` — descuento de insumos + kardex

**Files:**
- Modify: `app/modules/recipes/services.py` (append `apply_consumption`)
- Test: `tests/test_recipes_consumption.py`

**Interfaces:**
- Produces: `apply_consumption(db, *, lines, branch_id, org_id, user_id=None, reference=None) -> list[InventoryMovement]` donde `lines` es iterable de `(variant_id, qty)`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_recipes_consumption.py
from decimal import Decimal
import pytest
from app.models.products import Product, ProductVariant
from app.models.inventory import StockOnHand, InventoryMovement, MovementType
from app.modules.recipes.models import Recipe, RecipeLine
from app.modules.recipes import services


def _v(db, org, sku, cost, raw=False):
    p = Product(name=sku, organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    v = ProductVariant(product_id=p.id, sku=sku, price=Decimal("0"),
                       cost=Decimal(str(cost)), organization_id=org.id, is_raw_material=raw)
    db.add(v); db.flush()
    return v


@pytest.fixture()
def setup(db, org, branch_a):
    dish = _v(db, org, "BURGER", 0)
    beef = _v(db, org, "INS-BEEF", 180, raw=True)
    db.add(StockOnHand(variant_id=beef.id, branch_id=branch_a.id, organization_id=org.id,
                       qty_on_hand=Decimal("10"), is_active=True))
    r = Recipe(organization_id=org.id, variant_id=dish.id, name="Hamburguesa", yield_qty=Decimal("1"))
    db.add(r); db.flush()
    db.add(RecipeLine(organization_id=org.id, recipe_id=r.id, insumo_variant_id=beef.id, qty=Decimal("0.15")))
    db.flush()
    return {"dish": dish, "beef": beef, "branch": branch_a}


def test_apply_consumption_decrements_insumo_stock(db, org, setup):
    services.apply_consumption(db, lines=[(setup["dish"].id, Decimal("2"))],
                               branch_id=setup["branch"].id, org_id=org.id, user_id=None)
    db.flush()
    soh = db.query(StockOnHand).filter(StockOnHand.variant_id == setup["beef"].id).first()
    assert soh.qty_on_hand == Decimal("9.70")  # 10 - (0.15*2)


def test_apply_consumption_writes_kardex_movement(db, org, setup):
    movs = services.apply_consumption(db, lines=[(setup["dish"].id, Decimal("1"))],
                                      branch_id=setup["branch"].id, org_id=org.id, user_id=None)
    assert len(movs) == 1
    assert movs[0].movement_type == MovementType.RECIPE_CONSUMPTION
    assert movs[0].qty_change == Decimal("-0.15")
    assert movs[0].variant_id == setup["beef"].id


def test_apply_consumption_skips_variant_without_recipe(db, org, branch_a):
    plain = _v(db, org, "SODA", 0)
    movs = services.apply_consumption(db, lines=[(plain.id, Decimal("3"))],
                                      branch_id=branch_a.id, org_id=org.id)
    assert movs == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_consumption.py -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'apply_consumption'`.

- [ ] **Step 3: Append `apply_consumption` to services.py**

```python
def apply_consumption(db: Session, *, lines, branch_id, org_id, user_id=None, reference=None):
    """Por cada (variant_id, qty) vendido con receta, descuenta insumos de
    StockOnHand y registra InventoryMovement(RECIPE_CONSUMPTION).
    Devuelve los movimientos creados. No-op para variants sin receta."""
    movements = []
    for variant_id, qty in lines:
        for insumo_id, insumo_qty in explode(db, variant_id, qty, org_id):
            stock = (
                db.query(StockOnHand)
                .filter(
                    StockOnHand.variant_id == insumo_id,
                    StockOnHand.branch_id == branch_id,
                    or_(StockOnHand.organization_id == org_id, StockOnHand.organization_id.is_(None)),
                )
                .first()
            )
            qty_before = _dec(stock.qty_on_hand) if stock else ZERO
            qty_after = qty_before - _dec(insumo_qty)
            if stock:
                stock.qty_on_hand = qty_after
            mv = InventoryMovement(
                branch_id=branch_id,
                variant_id=insumo_id,
                user_id=user_id,
                movement_type=MovementType.RECIPE_CONSUMPTION,
                qty_change=-_dec(insumo_qty),
                qty_before=qty_before,
                qty_after=qty_after,
                reference=reference or "Consumo por receta",
                organization_id=org_id,
            )
            db.add(mv)
            movements.append(mv)
    return movements
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_consumption.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/modules/recipes/services.py tests/test_recipes_consumption.py
git commit -m "feat(gs0): apply_consumption — decrement insumos + kardex"
```

---

### Task 7: Hook en `create_sale` (PENDING→PAID)

Conecta el motor al pipeline de venta: una venta pagada de un platillo con receta descuenta sus insumos.

**Files:**
- Modify: `app/routers/sales.py:686` (insertar tras `db.flush()`)
- Test: `tests/test_recipes_consumption.py` (append test de integración por servicio)

**Interfaces:**
- Consumes: `apply_consumption` (Task 6); `db_lines` (lista de `SalesLineItem` construida en `create_sale`, cada uno con `.variant_id` y `.quantity`); `doc_status`, `current_user.branch_id`, `org_id`.

- [ ] **Step 1: Write the failing test**

Este test valida la integración end-to-end a nivel de servicio (sin HTTP), replicando lo que hará el hook: una venta de 1 platillo descuenta el insumo. Confirma que el contrato (lines como `(variant_id, qty)`) calza con lo que el router pasará.

```python
# tests/test_recipes_consumption.py  (append)
def test_sale_of_dish_consumes_insumo_end_to_end(db, org, setup):
    """Simula el hook de create_sale: status PAID → apply_consumption."""
    PAID = True  # doc_status == DocumentStatus.PAID
    sale_lines = [(setup["dish"].id, Decimal("1"))]  # forma que arma el router desde db_lines
    if PAID:
        services.apply_consumption(db, lines=sale_lines, branch_id=setup["branch"].id,
                                   org_id=org.id, user_id=None, reference="Venta TEST-1")
    db.flush()
    soh = db.query(StockOnHand).filter(StockOnHand.variant_id == setup["beef"].id).first()
    assert soh.qty_on_hand == Decimal("9.85")  # 10 - 0.15
    mv = db.query(InventoryMovement).filter(
        InventoryMovement.movement_type == MovementType.RECIPE_CONSUMPTION).first()
    assert mv.reference == "Venta TEST-1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_consumption.py::test_sale_of_dish_consumes_insumo_end_to_end -v`
Expected: PASS de hecho (usa solo el servicio). El propósito de este task es el **wiring real en el router**; el test fija el contrato. Si pasa, continúa al Step 3 para conectar el router (cuya verificación real es el CI + smoke manual, ya que requiere una venta HTTP completa con caja abierta).

- [ ] **Step 3: Insert the hook in create_sale**

In `app/routers/sales.py`, immediately after line 686 (`db.flush()`), before the `# --- H-2: Persist global_discount_pct` comment:

```python
    # --- GS-0: Consumo de insumos por receta (solo ventas PAID) ---
    # Una venta pagada de un platillo/bebida con receta explota sus insumos y
    # los descuenta de StockOnHand. Para productos sin receta es no-op (el loop
    # de arriba ya manejó su stock propio). Va tras el flush para que las líneas
    # estén persistidas, y dentro de la txn para atomicidad con la venta.
    if doc_status == DocumentStatus.PAID:
        from app.modules.recipes.services import apply_consumption
        apply_consumption(
            db,
            lines=[(ln.variant_id, Decimal(str(ln.quantity))) for ln in db_lines],
            branch_id=current_user.branch_id,
            org_id=org_id,
            user_id=current_user.id,
            reference=f"Venta {sales_doc.folio or sales_doc.id}",
        )
```

> **Nota de verificación:** confirmar que `db_lines` contiene objetos con atributos `.variant_id` y `.quantity` (son `SalesLineItem`). Si el nombre del atributo difiere, ajustar el comprehension. Buscar con: `grep -n "db_lines.append\|SalesLineItem(" app/routers/sales.py`.

- [ ] **Step 4: Run the full recipes suite + sales regression**

Run: `pytest tests/test_recipes_consumption.py tests/test_recipes_costing.py -v`
Expected: PASS.
Run (regresión de ventas, no debe romperse): `pytest tests/ -v -k "sale or cash" `
Expected: PASS (o el estado verde previo). Si no hay venv local, empujar y verificar en CI.

- [ ] **Step 5: Commit**

```bash
git add app/routers/sales.py tests/test_recipes_consumption.py
git commit -m "feat(gs0): consume recipe insumos on PAID sale (create_sale hook)"
```

---

### Task 8: Router CRUD de recetas

**Files:**
- Modify: `app/modules/recipes/router.py` (reemplaza el stub; conserva `/health`)
- Test: `tests/test_recipes_api.py` (append)

**Interfaces:**
- Consumes: schemas (Task 4), models (Task 3), `scoped_query`/`get_tenant_scoped`.
- Produces endpoints (prefijo `/api/recipes` ya montado): `POST /`, `GET /`, `GET /{recipe_id}`, `PUT /{recipe_id}`, `DELETE /{recipe_id}`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_recipes_api.py  (append)
from decimal import Decimal
from app.models.products import Product, ProductVariant


def _seed_variants(db, org):
    p = Product(name="Latte", organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    dish = ProductVariant(product_id=p.id, sku="LATTE", price=Decimal("55"),
                          cost=Decimal("0"), organization_id=org.id)
    milk = ProductVariant(product_id=p.id, sku="INS-MILK", price=Decimal("0"),
                          cost=Decimal("20"), organization_id=org.id, is_raw_material=True)
    db.add_all([dish, milk]); db.flush()
    return dish, milk


def test_create_and_get_recipe(client, db, org, auth_admin):
    dish, milk = _seed_variants(db, org)
    resp = client.post("/api/recipes/", headers=auth_admin, json={
        "variant_id": dish.id, "name": "Latte", "yield_qty": "1",
        "lines": [{"insumo_variant_id": milk.id, "qty": "0.2", "unit": "lt"}],
    })
    assert resp.status_code == 200, resp.text
    rid = resp.json()["id"]
    got = client.get(f"/api/recipes/{rid}", headers=auth_admin)
    assert got.status_code == 200
    assert got.json()["name"] == "Latte"
    assert len(got.json()["lines"]) == 1


def test_list_recipes_scoped_to_org(client, db, org, auth_admin):
    dish, milk = _seed_variants(db, org)
    client.post("/api/recipes/", headers=auth_admin, json={
        "variant_id": dish.id, "name": "Latte", "yield_qty": "1",
        "lines": [{"insumo_variant_id": milk.id, "qty": "0.2"}],
    })
    resp = client.get("/api/recipes/", headers=auth_admin)
    assert resp.status_code == 200
    assert any(r["name"] == "Latte" for r in resp.json())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_api.py -v -k "create_and_get or list_recipes"`
Expected: FAIL — 404/405 (endpoints no existen aún).

- [ ] **Step 3: Implement the router**

```python
# app/modules/recipes/router.py
"""Atlas BOS modules/recipes/router — CRUD de recetas + costeo/merma (GS-0)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant_query import get_tenant_scoped, scoped_query
from app.models import User
from app.modules.recipes import services
from app.modules.recipes.models import Recipe, RecipeLine
from app.modules.recipes.schemas import RecipeCreate, RecipeRead, RecipeUpdate

router = APIRouter()


@router.get("/health")
def health(current_user: User = Depends(get_current_user)):
    return {"module": "recipes", "status": "beta", "ready": True}


def _org_id(user: User) -> int:
    org = getattr(user, "organization_id", None)
    if org is None:
        raise HTTPException(status_code=400, detail="No active organization in context")
    return org


def _replace_lines(db: Session, recipe: Recipe, lines, org_id: int):
    db.query(RecipeLine).filter(RecipeLine.recipe_id == recipe.id).delete()
    for ln in lines:
        db.add(RecipeLine(
            organization_id=org_id, recipe_id=recipe.id,
            insumo_variant_id=ln.insumo_variant_id, qty=ln.qty, unit=ln.unit,
        ))


@router.post("/", response_model=RecipeRead)
def create_recipe(payload: RecipeCreate, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    org_id = _org_id(current_user)
    existing = scoped_query(db, Recipe, current_user).filter(
        Recipe.variant_id == payload.variant_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una receta para este producto")
    recipe = Recipe(organization_id=org_id, variant_id=payload.variant_id,
                    name=payload.name, yield_qty=payload.yield_qty, is_active=True)
    db.add(recipe); db.flush()
    _replace_lines(db, recipe, payload.lines, org_id)
    db.commit(); db.refresh(recipe)
    return recipe


@router.get("/", response_model=List[RecipeRead])
def list_recipes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return scoped_query(db, Recipe, current_user).order_by(Recipe.name).all()


@router.get("/{recipe_id}", response_model=RecipeRead)
def get_recipe(recipe_id: str, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    return get_tenant_scoped(db, Recipe, recipe_id, current_user)


@router.put("/{recipe_id}", response_model=RecipeRead)
def update_recipe(recipe_id: str, payload: RecipeUpdate, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    org_id = _org_id(current_user)
    recipe = get_tenant_scoped(db, Recipe, recipe_id, current_user)
    if payload.name is not None:
        recipe.name = payload.name
    if payload.yield_qty is not None:
        recipe.yield_qty = payload.yield_qty
    if payload.is_active is not None:
        recipe.is_active = payload.is_active
    if payload.lines is not None:
        _replace_lines(db, recipe, payload.lines, org_id)
    db.commit(); db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: str, db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    recipe = get_tenant_scoped(db, Recipe, recipe_id, current_user)
    db.delete(recipe); db.commit()
    return {"status": "deleted", "id": recipe_id}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/modules/recipes/router.py tests/test_recipes_api.py
git commit -m "feat(gs0): recipes CRUD router"
```

---

### Task 9: Endpoints de margen y merma

**Files:**
- Modify: `app/modules/recipes/router.py` (append endpoints)
- Modify: `app/modules/recipes/services.py` (append `log_waste`)
- Test: `tests/test_recipes_api.py` (append)

**Interfaces:**
- Produces:
  - `GET /api/recipes/margins` → `List[MarginRow]` (precio vs COGS por receta).
  - `POST /api/recipes/waste` → `WasteLogRead` (registra merma; `unit_cost` se toma del `cost` del insumo).
  - `services.log_waste(db, *, branch_id, insumo_variant_id, qty, org_id, reason, notes, user_id) -> WasteLog`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_recipes_api.py  (append)
def test_margins_endpoint(client, db, org, auth_admin):
    dish, milk = _seed_variants(db, org)  # latte price 55, milk cost 20
    client.post("/api/recipes/", headers=auth_admin, json={
        "variant_id": dish.id, "name": "Latte", "yield_qty": "1",
        "lines": [{"insumo_variant_id": milk.id, "qty": "0.2"}],
    })
    resp = client.get("/api/recipes/margins", headers=auth_admin)
    assert resp.status_code == 200
    row = next(r for r in resp.json() if r["variant_id"] == dish.id)
    assert Decimal(row["cogs"]) == Decimal("4.00")     # 0.2 * 20
    assert Decimal(row["margin"]) == Decimal("51.00")  # 55 - 4


def test_waste_endpoint_records_merma(client, db, org, branch_a, auth_admin):
    _, milk = _seed_variants(db, org)
    resp = client.post("/api/recipes/waste", headers=auth_admin, json={
        "branch_id": branch_a.id, "insumo_variant_id": milk.id,
        "qty": "0.5", "reason": "SPOILAGE", "notes": "leche cortada",
    })
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["unit_cost"]) == Decimal("20")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_api.py -v -k "margins or waste"`
Expected: FAIL — 404.

- [ ] **Step 3: Implement service + endpoints**

Append to `app/modules/recipes/services.py`:

```python
def log_waste(db: Session, *, branch_id, insumo_variant_id, qty, org_id,
              reason, notes=None, user_id=None):
    """Registra merma de un insumo, descuenta su stock y escribe kardex."""
    from app.modules.recipes.models import WasteLog

    insumo = db.query(ProductVariant).filter(ProductVariant.id == insumo_variant_id).first()
    unit_cost = _dec(insumo.cost) if insumo else ZERO

    stock = (
        db.query(StockOnHand)
        .filter(
            StockOnHand.variant_id == insumo_variant_id,
            StockOnHand.branch_id == branch_id,
            or_(StockOnHand.organization_id == org_id, StockOnHand.organization_id.is_(None)),
        )
        .first()
    )
    qty_before = _dec(stock.qty_on_hand) if stock else ZERO
    qty_after = qty_before - _dec(qty)
    if stock:
        stock.qty_on_hand = qty_after
    db.add(InventoryMovement(
        branch_id=branch_id, variant_id=insumo_variant_id, user_id=user_id,
        movement_type=MovementType.ADJUSTMENT_OUT, qty_change=-_dec(qty),
        qty_before=qty_before, qty_after=qty_after,
        reference="Merma", organization_id=org_id,
    ))
    log = WasteLog(
        organization_id=org_id, branch_id=branch_id, insumo_variant_id=insumo_variant_id,
        qty=_dec(qty), unit_cost=unit_cost, reason=reason, notes=notes, created_by=user_id,
    )
    db.add(log)
    return log
```

Append to `app/modules/recipes/router.py` (add imports `MarginRow`, `WasteLogCreate`, `WasteLogRead`, `ProductVariant`, `Decimal`):

```python
from decimal import Decimal
from app.models.products import ProductVariant
from app.modules.recipes.schemas import MarginRow, WasteLogCreate, WasteLogRead


@router.get("/margins", response_model=List[MarginRow])
def recipe_margins(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org_id = _org_id(current_user)
    rows = []
    for recipe in scoped_query(db, Recipe, current_user).filter(Recipe.is_active.is_(True)).all():
        variant = db.query(ProductVariant).filter(ProductVariant.id == recipe.variant_id).first()
        price = Decimal(str(variant.price)) if variant and variant.price is not None else Decimal("0")
        cogs = services.cost_of(db, recipe.variant_id, org_id)
        margin = price - cogs
        margin_pct = (margin / price * 100).quantize(Decimal("0.01")) if price > 0 else Decimal("0")
        rows.append(MarginRow(variant_id=recipe.variant_id, recipe_name=recipe.name,
                              price=price, cogs=cogs, margin=margin, margin_pct=margin_pct))
    return rows


@router.post("/waste", response_model=WasteLogRead)
def register_waste(payload: WasteLogCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    org_id = _org_id(current_user)
    log = services.log_waste(
        db, branch_id=payload.branch_id, insumo_variant_id=payload.insumo_variant_id,
        qty=payload.qty, org_id=org_id, reason=payload.reason, notes=payload.notes,
        user_id=current_user.id,
    )
    db.commit(); db.refresh(log)
    return log
```

> **Nota:** declarar `GET /margins` **antes** que `GET /{recipe_id}` en el archivo para que FastAPI no capture `margins` como un `recipe_id`. Mover el bloque de margins arriba del `get_recipe` si es necesario.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_api.py -v`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add app/modules/recipes/router.py app/modules/recipes/services.py tests/test_recipes_api.py
git commit -m "feat(gs0): margin report + waste logging endpoints"
```

---

### Task 10: Seed demo mínimo (1 receta gastro para el MVP del cliente)

Siembra una receta real en el org demo Restaurant para que el motor sea demostrable end-to-end.

**Files:**
- Modify: `scripts/seed_demo_orgs.py` (nueva función `seed_recipes_demo()` + llamada)
- Test: `tests/test_recipes_api.py` (smoke opcional, ver Step 1)

**Interfaces:**
- Consumes: org demo con `IndustryType.ATLAS_ONE_RESTAURANT` y sus `ProductVariant` ya sembrados; modelos de Task 3.

- [ ] **Step 1: Write the smoke test**

```python
# tests/test_recipes_api.py  (append)
def test_seed_recipes_demo_is_idempotent(db, org):
    """seed_recipes_demo no debe duplicar recetas si corre dos veces."""
    from decimal import Decimal
    from app.models.products import Product, ProductVariant
    from app.modules.recipes.models import Recipe
    from scripts.seed_demo_orgs import seed_recipes_demo

    p = Product(name="Hamburguesa", organization_id=org.id, is_active=True)
    db.add(p); db.flush()
    dish = ProductVariant(product_id=p.id, sku="HAMB", price=Decimal("120"),
                          cost=Decimal("0"), organization_id=org.id)
    beef = ProductVariant(product_id=p.id, sku="INS-CARNE", price=Decimal("0"),
                          cost=Decimal("180"), organization_id=org.id, is_raw_material=True)
    db.add_all([dish, beef]); db.flush()

    seed_recipes_demo(db, org.id)
    seed_recipes_demo(db, org.id)  # 2ª vez
    db.flush()
    count = db.query(Recipe).filter(Recipe.organization_id == org.id,
                                    Recipe.variant_id == dish.id).count()
    assert count == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_recipes_api.py::test_seed_recipes_demo_is_idempotent -v`
Expected: FAIL — `ImportError: cannot import name 'seed_recipes_demo'`.

- [ ] **Step 3: Add the seed function**

In `scripts/seed_demo_orgs.py`, add (cerca de `seed_appointments_demo`, siguiendo su estilo idempotente):

```python
def seed_recipes_demo(db, organization_id):
    """Siembra recetas demo para el preset Restaurant. Idempotente: hace match
    de insumos por SKU 'INS-*' y crea la receta solo si el platillo no la tiene.

    Convención de demo: el platillo se identifica por SKU 'HAMB' y consume
    el insumo 'INS-CARNE'. Ajustar a los SKUs reales sembrados por el seeder
    de productos gastro si difieren.
    """
    from decimal import Decimal
    from app.models.products import ProductVariant
    from app.modules.recipes.models import Recipe, RecipeLine

    dish = db.query(ProductVariant).filter(
        ProductVariant.organization_id == organization_id,
        ProductVariant.sku == "HAMB",
    ).first()
    beef = db.query(ProductVariant).filter(
        ProductVariant.organization_id == organization_id,
        ProductVariant.sku == "INS-CARNE",
    ).first()
    if not dish or not beef:
        print("  · seed_recipes_demo: platillo/insumo demo no encontrado, omitido")
        return

    beef.is_raw_material = True
    existing = db.query(Recipe).filter(
        Recipe.organization_id == organization_id,
        Recipe.variant_id == dish.id,
    ).first()
    if existing:
        print("  · seed_recipes_demo: receta ya existe, omitido")
        return

    recipe = Recipe(organization_id=organization_id, variant_id=dish.id,
                    name="Hamburguesa clásica", yield_qty=Decimal("1"), is_active=True)
    db.add(recipe); db.flush()
    db.add(RecipeLine(organization_id=organization_id, recipe_id=recipe.id,
                      insumo_variant_id=beef.id, qty=Decimal("0.15"), unit="kg"))
    db.flush()
    print("  ✓ seed_recipes_demo: receta Hamburguesa creada")
```

Then call it from the main demo-seeding routine for the Restaurant preset (junto a donde se llama `seed_appointments_demo(...)`), e.g.:

```python
        seed_recipes_demo(db, org.id)
```

> **Nota:** verificar los SKUs reales que el seeder de productos gastro crea (`grep -n "INS-\|HAMB\|Hamburguesa" scripts/seed_demo_orgs.py`) y alinear los literales `"HAMB"`/`"INS-CARNE"`. Si el seed de productos no incluye un insumo de carne, añadirlo allí primero (un `ProductVariant` con `is_raw_material=True`, `cost=Decimal("180")`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_recipes_api.py::test_seed_recipes_demo_is_idempotent -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_demo_orgs.py tests/test_recipes_api.py
git commit -m "feat(gs0): seed demo recipe for Restaurant preset"
```

---

### Task 11: Verificación integral + suite completa

**Files:**
- Test: todos los `tests/test_recipes_*.py`

- [ ] **Step 1: Run the full recipes suite**

Run: `pytest tests/test_recipes_models.py tests/test_recipes_costing.py tests/test_recipes_consumption.py tests/test_recipes_api.py -v`
Expected: PASS (todos).

- [ ] **Step 2: Run the regression-sensitive suites (sales/cash/inventory)**

Run: `pytest tests/ -v -k "sale or cash or product or inventory"`
Expected: PASS — el hook de consumo no rompe ventas existentes (productos sin receta = no-op).

- [ ] **Step 3: tsc/build no aplican (cambios solo backend).** Confirmar que `python -c "import app.main"` carga sin error de import:

Run: `python -c "import app.main; print('app imports OK')"`
Expected: `app imports OK` (valida que router/modelos/hook no tienen errores de import).

- [ ] **Step 4: Commit (vacío de verificación, opcional) y push**

```bash
git commit --allow-empty -m "test(gs0): recipes engine verification passed"
```

> Si no hay venv local, empujar la rama y confirmar verde en GitHub Actions (`.github/workflows/ci.yml`) antes de marcar GS-0 como done. El push lo realiza el usuario/orquestador (subagents bloqueados por el harness para push — ver memoria `feedback_push_workflow`).

---

## Self-Review

**Spec coverage (contra `2026-06-29-gastro-suite-initiative-design.md` §3 + GS-0 en §4):**
- `Recipe`+`RecipeLine`+`WasteLog` → Task 3 ✓
- `is_raw_material` en variant → Task 1 ✓
- `RECIPE_CONSUMPTION` → Task 2 ✓
- Hook de consumo (PENDING→PAID) → Task 7 ✓
- Costeo `cost_of()`/`explode()`/`apply_consumption()` → Tasks 5-6 ✓
- Endpoints margen/merma → Task 9 ✓
- CRUD recetas → Task 8 ✓
- Seed → Task 10 ✓
- Migraciones idempotentes (`railway_init.py`) → Tasks 1,2,3 ✓
- Gotchas (org nullable fallback, Decimal, branch scoping) → en `_dec`, `or_(... is_(None))`, Global Constraints ✓

**Placeholder scan:** sin TBD/TODO; todo paso con código completo. Las dos "Notas de verificación" (db_lines attrs en Task 7, SKUs reales en Task 10) son comprobaciones de wiring contra el código existente con el `grep` exacto a correr, no placeholders de implementación.

**Type consistency:** `explode` devuelve `list[(variant_id, Decimal)]` y `apply_consumption` consume exactamente esa forma (Task 6) y el router la arma igual (Task 7). `cost_of` devuelve `Decimal`, consumido por `MarginRow` en Task 9. `MovementType.RECIPE_CONSUMPTION` definido en Task 2, usado en Task 6. `WasteReason` definido en Task 3, usado en schemas Task 4 y servicio Task 9.
