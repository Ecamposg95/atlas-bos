"""Phase 2 reverse-shim — body moved to ``app.core.tenant_context`` in S0.2.

Legacy SSR helpers (``check_view_permission``, ``require_platform_admin_html``)
removed per S0.2 audit — zero external callers verified by grep across
app/, scripts/, tests/. The SSR-specific request.state instrumentation
(``state.nav_items``, ``state.user_json``) was dead since the Sprint 4
React migration.

Will be deleted in S0.5 once the call-site rewrite (S0.4) lands.
"""
from app.core.tenant_context import get_current_active_organization  # noqa: F401
