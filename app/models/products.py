"""Phase 2 reverse-shim — body moved to app.modules.products.models in S2.

Kept for backward-compat with imports like `from app.models.products import Product`
and `from .products import Product, ...` in app/models/__init__.py.
"""
from app.modules.products.models import *  # noqa: F401, F403
from app.modules.products.models import (  # noqa: F401
    Department,
    Brand,
    UnitOfMeasure,
    Product,
    ProductVariant,
    ProductPrice,
    PackagingUnit,
    ProductBranchStatus,
)
