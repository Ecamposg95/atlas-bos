"""Atlas BOS core/security/guards — generic role guards (admin, owner)."""
from fastapi import Depends, HTTPException

from app.core.security.auth import get_current_user
from app.models.users import PlatformRole, Role


def require_admin_or_owner(current_user=Depends(get_current_user)):
    if current_user.platform_role == PlatformRole.SUPERADMIN:
        return current_user
    if current_user.role not in (Role.ADMINISTRADOR, Role.DUEÑO):
        raise HTTPException(status_code=403, detail="No autorizado")
    return current_user
