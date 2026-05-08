"""Phase 2 reverse-shim — bodies moved in S0.2/S0.3.

- Auth/JWT/passwords/guards → ``app.core.security.*``
- Platform-only auth guards → ``app.modules.platform.dependencies``
- API key helpers           → ``app.modules.platform.api_keys`` (separate file)

Legacy SSR cookie helpers (``get_current_user_from_cookie``,
``get_optional_user_from_cookie``) removed per S0.2 audit — zero external
callers verified by grep across app/, scripts/, tests/.

This shim exists so the 34+ existing call sites (``from app.security import
get_current_user`` etc.) keep working until S0.4 rewrites the imports.
Will be deleted in S0.5.
"""
from app.core.security import (  # noqa: F401
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_current_user,
    get_password_hash,
    oauth2_scheme,
    pwd_context,
    require_admin_or_owner,
    verify_pin,
)
from app.modules.platform.dependencies import (  # noqa: F401
    require_platform_admin,
    require_superadmin,
)
