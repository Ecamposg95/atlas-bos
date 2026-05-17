"""Phase 2 reverse-shim — body moved to app.modules.products.router in S2.

Kept for backward-compat with:
- `from app.routers import products` (used by app/main.py)
- `from app.routers.products import list_departments` (used by app/main.py
  for legacy URL aliases)
- `products.router`, `products.departments_router`, `products.brands_router`
  mounts in app/main.py
"""
from app.modules.products.router import *  # noqa: F401, F403
from app.modules.products.router import (  # noqa: F401
    router,
    departments_router,
    brands_router,
    list_departments,
)
