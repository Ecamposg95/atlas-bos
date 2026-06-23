"""Atlas BOS modules/recipes/models — recipe / BOM domain.

DOMAIN: Recetas (Recipe + RecipeIngredient)
STATUS: Stable

2 tables:
  - recipes
  - recipe_ingredients
"""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    # The sellable dish/drink this recipe produces. Unique: one recipe per variant.
    product_variant_id = Column(
        String(36), ForeignKey("product_variants.id"), nullable=False, unique=True, index=True
    )
    name = Column(String, nullable=False)
    yield_qty = Column(Numeric(10, 2), nullable=False, default=1)  # porciones que rinde
    notes = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    variant = relationship("ProductVariant")
    ingredients = relationship(
        "RecipeIngredient",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by=lambda: RecipeIngredient.id,
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=False, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False, index=True)
    # The raw-material product variant consumed (flour, cheese, liquor…).
    ingredient_variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False, index=True)
    qty = Column(Numeric(12, 4), nullable=False)            # cantidad por rendimiento
    unit = Column(String, nullable=True)                   # etiqueta de unidad (g, ml, pza)
    waste_pct = Column(Numeric(5, 2), nullable=False, default=0)  # merma %

    recipe = relationship("Recipe", back_populates="ingredients")
    ingredient_variant = relationship("ProductVariant")
