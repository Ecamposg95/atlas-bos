"""Atlas BOS modules/recipes/router — recipe CRUD + costing REST API."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant_query import _resolve_org_id, get_tenant_scoped, scoped_query
from app.models import User
from app.modules.recipes import services
from app.modules.recipes.models import Recipe, RecipeIngredient
from app.modules.recipes.schemas import (
    IngredientCreate,
    RecipeCost,
    RecipeCreate,
    RecipeRead,
    RecipeUpdate,
)

router = APIRouter()


def _org_id(user: User) -> int:
    org = _resolve_org_id(user)
    if org is None:
        raise HTTPException(status_code=400, detail="No active organization in context")
    return org


def _replace_ingredients(db: Session, recipe: Recipe, ingredients: List[IngredientCreate]) -> None:
    recipe.ingredients.clear()
    db.flush()
    for ing in ingredients:
        db.add(RecipeIngredient(
            organization_id=recipe.organization_id,
            recipe_id=recipe.id,
            **ing.model_dump(),
        ))


@router.get("/", response_model=List[RecipeRead])
def list_recipes(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = scoped_query(db, Recipe, current_user)
    if active_only:
        q = q.filter(Recipe.is_active == True)  # noqa: E712
    return q.order_by(Recipe.name).all()


@router.get("/{recipe_id}", response_model=RecipeRead)
def get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_tenant_scoped(db, Recipe, recipe_id, current_user)


@router.post("/", response_model=RecipeRead, status_code=status.HTTP_201_CREATED)
def create_recipe(
    payload: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = _org_id(current_user)
    existing = (
        scoped_query(db, Recipe, current_user)
        .filter(Recipe.product_variant_id == payload.product_variant_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una receta para este producto")

    data = payload.model_dump(exclude={"ingredients"})
    recipe = Recipe(organization_id=org_id, **data)
    db.add(recipe)
    db.flush()
    _replace_ingredients(db, recipe, payload.ingredients)
    db.commit()
    db.refresh(recipe)
    return recipe


@router.put("/{recipe_id}", response_model=RecipeRead)
def update_recipe(
    recipe_id: int,
    payload: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = get_tenant_scoped(db, Recipe, recipe_id, current_user)
    data = payload.model_dump(exclude_unset=True, exclude={"ingredients"})
    for k, v in data.items():
        setattr(recipe, k, v)
    if payload.ingredients is not None:
        _replace_ingredients(db, recipe, payload.ingredients)
    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = get_tenant_scoped(db, Recipe, recipe_id, current_user)
    recipe.is_active = False
    db.commit()


@router.get("/{recipe_id}/cost", response_model=RecipeCost)
def recipe_cost(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = get_tenant_scoped(db, Recipe, recipe_id, current_user)
    return services.compute_cost(db, recipe)
