"""Phase 2 reverse-shim — body moved to app.modules.customers.models in S2.

Kept for backward-compat with imports like `from app.models.crm import Customer`
and `from .crm import Customer` in app/models/__init__.py.
"""
from app.modules.customers.models import (  # noqa: F401
    Customer,
    CustomerLedgerEntry,
)
