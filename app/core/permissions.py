"""S0.1 shim — cross-cutting permission gates. Bodies move in S0.2.

Aggregates the feature-flag gate (`require_module`) and the legacy role
matrix (`role_permissions`) into the canonical core location. Today these
are still imported from their original homes; consumers can already use
`from app.core.permissions import ...` and migrations are mechanical later.
"""
from app.security.require_module import require_module  # noqa: F401
from app.core import role_permissions  # noqa: F401  (legacy DAXPOS_ROLE_VIEWS lives here)
