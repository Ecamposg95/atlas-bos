"""Phase 2 reverse-shim — body moved to app.modules.tenants.router in S1."""
from app.modules.tenants.router import *  # noqa: F401, F403
from app.modules.tenants.router import router, capabilities_router  # noqa: F401
