"""Phase 2 reverse-shim — body moved to ``app.core.database`` in S0.2.

Existing callers (``from app.database import get_db`` etc.) keep working
unchanged; this module simply re-exports the canonical surface. Will be
deleted in S0.5 once the bulk import rewrite (S0.4) is merged.
"""
from app.core.database import (  # noqa: F401
    SQLALCHEMY_DATABASE_URL,
    Base,
    SessionLocal,
    engine,
    get_db,
    set_sqlite_pragma,
)
