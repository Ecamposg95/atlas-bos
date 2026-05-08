"""Atlas BOS core/security — auth, JWT, password hashing, role guards.

S0.1 shim package: re-exports the public surface of legacy `app.security`
so consumers can already write `from app.core.security import get_current_user`.
Bodies move into the submodules below in S0.2.
"""
from app.security import (  # noqa: F401
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    pwd_context,
    oauth2_scheme,
    verify_pin,
    get_password_hash,
    create_access_token,
    get_current_user,
    require_admin_or_owner,
)
