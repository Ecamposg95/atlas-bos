"""Atlas BOS core/security — public surface re-export.

Phase 2 (S0.2): owns the auth/security primitives previously scattered in
`app/security/__init__.py`. The legacy `app.security` module remains as a
reverse-shim re-exporting from here to keep the 34+ existing call sites
working until S0.4 rewrites them.
"""
from app.core.security.auth import get_current_user
from app.core.security.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
    oauth2_scheme,
    pwd_context,
)
from app.core.security.guards import require_admin_or_owner
from app.core.security.jwt import create_access_token
from app.core.security.passwords import get_password_hash, verify_pin

__all__ = [
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "ALGORITHM",
    "SECRET_KEY",
    "create_access_token",
    "get_current_user",
    "get_password_hash",
    "oauth2_scheme",
    "pwd_context",
    "require_admin_or_owner",
    "verify_pin",
]
