"""Atlas BOS modules/platform/dependencies — SUPERADMIN/SUPPORT auth guards.

These are platform-domain (not transversal): all 26 callers are inside
`app/routers/platform/*`. Owning them here aligns with pack §10.

Phase 2 (S0.3): owns the bodies. The legacy `app.security` module remains
as a reverse-shim re-exporting these symbols for callers not yet rewritten.
"""
from fastapi import Depends, HTTPException

from app.core.security.auth import get_current_user
from app.models.users import PlatformRole, User


def require_platform_admin(current_user: User = Depends(get_current_user)):
    """Allow SUPERADMIN or SUPPORT (read-only). Destructive endpoints must
    additionally check `platform_role == SUPERADMIN` inside the handler."""
    if current_user.platform_role not in (PlatformRole.SUPERADMIN, PlatformRole.SUPPORT):
        raise HTTPException(
            status_code=403,
            detail="Requiere Rol de Plataforma (SUPERADMIN o SUPPORT)",
        )
    return current_user


def require_superadmin(current_user: User = Depends(get_current_user)):
    """Strict SUPERADMIN guard for destructive ops."""
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Requiere SUPERADMIN")
    return current_user
