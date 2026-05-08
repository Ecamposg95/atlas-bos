"""S0.1 shim — platform-only auth guards.

Re-exports `require_platform_admin` and `require_superadmin` so the 26
callers under `app/routers/platform/*` can switch their import path from
`app.security` to `app.modules.platform.dependencies` mechanically. Bodies
move here in S0.3.
"""
from app.security import require_platform_admin, require_superadmin  # noqa: F401
