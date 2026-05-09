"""Phase 2 reverse-shim — body moved to ``app.modules.users.models`` in S1 Phase B.

Kept so that ``from app.models.users import User, Role, PlatformRole,
UserOrganization`` (used by ~15+ consumers across routers, services, scripts,
tests) keeps resolving without each call site having to be rewritten in
the same PR. The mechanical rewrite to the new path will happen in a
follow-up cleanup; until then this shim is the canonical entry-point for
legacy imports.
"""
from app.modules.users.models import (  # noqa: F401
    PlatformRole,
    Role,
    User,
    UserOrganization,
)
