"""Phase 2 reverse-shim — body moved to ``app.modules.tenants.models`` in S1 Phase B.

Kept so that ``from app.models.organization import Organization, Branch,
BranchType, IndustryType`` (used by routers, services, scripts, tests)
keeps resolving without rewriting every call site in the same PR. Cleanup
to the new path happens later.
"""
from app.modules.tenants.models import (  # noqa: F401
    Branch,
    BranchType,
    IndustryType,
    Organization,
)
