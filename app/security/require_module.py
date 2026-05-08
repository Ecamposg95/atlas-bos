from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.security import get_current_user
from app.models.users import User
from app.models.modules import OrganizationModule

def require_module(module_key: str):
    """
    Dependency factory to ensure a module is enabled for the current organization.
    """
    async def _enforce(
        request: Request, 
        current_user: User = Depends(get_current_user), 
        db: Session = Depends(get_db)
    ):
        from app.dependencies import get_current_active_organization
        from app.models.users import Role

        # -- [NEW] Admin Bypass --
        # Tenant owners/admins should see all modules for their org
        if current_user.role in [Role.ADMINISTRADOR, Role.DUEÑO]:
            return True

        # Resolve org_id using the existing dependency logic
        try:
            org_id = get_current_active_organization(request, None, current_user, db)
        except Exception:
            # Fallback for cases where header is missing but we can attempt to infer from association
            from app.models.users import UserOrganization
            assoc = db.query(UserOrganization).filter(UserOrganization.user_id == current_user.id).first()
            org_id = assoc.organization_id if assoc else None

        if not org_id:
             raise HTTPException(status_code=403, detail="No organization context found")

        # Check if is_enabled=True in organization_modules
        enabled = db.query(OrganizationModule).filter(
            OrganizationModule.organization_id == org_id,
            OrganizationModule.module_key == module_key,
            OrganizationModule.is_enabled == True
        ).first()
        
        if not enabled:
            raise HTTPException(
                status_code=403, 
                detail=f"El módulo '{module_key}' no está habilitado para esta organización."
            )
        return True
        
    return _enforce
