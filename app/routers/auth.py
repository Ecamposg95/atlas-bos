"""Phase 2 reverse-shim — body moved to app.modules.auth.router in S1."""
from app.modules.auth.router import *  # noqa: F401, F403
from app.modules.auth.router import router  # noqa: F401
