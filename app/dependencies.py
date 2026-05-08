from fastapi import Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.security import get_current_user
from app.models.users import User, UserOrganization, PlatformRole, Role

def get_current_active_organization(
    request: Request,
    x_organization_id: Optional[int] = Header(None, alias="X-Organization-ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> int:
    """
    Determines the active organization context.
    1. Checks X-Organization-ID header.
    2. Verifies user membership.
    3. If no header, defaults to first active organization.
    4. Raises 403 if no access or no organizations.
    """
    
    from app.models.organization import Organization

    # 1. Header override or Cookie override (Support Context)
    resolved_org_id = x_organization_id or request.cookies.get("support_org_id")
    
    if resolved_org_id:
        try:
            resolved_org_id = int(resolved_org_id)
        except:
            resolved_org_id = None

    if resolved_org_id:
        # SUPERADMIN bypass: allow if user is platform superadmin
        if current_user.platform_role == PlatformRole.SUPERADMIN:
            return resolved_org_id

        # Verify membership for others
        assoc = db.query(UserOrganization).filter(
            UserOrganization.user_id == current_user.id,
            UserOrganization.organization_id == resolved_org_id,
            UserOrganization.is_active == True
        ).first()
        
        if not assoc:
            raise HTTPException(status_code=403, detail="No access to this organization")
        
        return resolved_org_id
    
    # 2. Check for assigned organizations
    assoc = db.query(UserOrganization).filter(
        UserOrganization.user_id == current_user.id,
        UserOrganization.is_active == True
    ).first()
    
    if assoc:
        return assoc.organization_id
        
    # 3. Fallback for MVP / Dev / Admin bootstrapping
    # If user has NO explicit org, and there is exactly ONE org in the system, auto-context to it.
    # [HARDENING] Only allow this fallback if NOT a multi-tenant environment or specific config.
    # For now, we keep it but log a warning or maybe restrict it.
    # STRICTER: If user is SUPERADMIN, they MUST provide header to act as tenant.
    
    if current_user.platform_role == PlatformRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Superadmin requires X-Organization-ID header for tenant context")

    org_count = db.query(Organization).count()
    if org_count == 1:
        default_org = db.query(Organization).first()
        # Verify user is actually linked to this org? Or auto-link?
        # Safe: Check if user is linked.
        is_linked = db.query(UserOrganization).filter(
            UserOrganization.user_id == current_user.id,
            UserOrganization.organization_id == default_org.id
        ).first()
        
        if is_linked and is_linked.is_active:
            return default_org.id
            
    raise HTTPException(status_code=403, detail="User belongs to no active organizations")

# --- [NEW] HTML View Permission Dependency ---
from fastapi import Request
from app.security import get_current_user_from_cookie
from app.core.role_permissions import can_access_template

def check_view_permission(view_name: str):
    """
    Dependency factory to check if the current user (via Cookie) has access to the named View.
    Also determines the correct Layout based on Context and enforces strict Context Routing.
    """
    async def _check(request: Request, db: Session = Depends(get_db)) -> User:
        # 1. Get User from Cookie
        user = await get_current_user_from_cookie(request, db)
        
        # 2. Role Permission Check
        # can_access_template now handles string/enum conversion internally
        if not can_access_template(user.role, view_name):
            raise HTTPException(status_code=403, detail=f"Role {user.role} cannot access {view_name}")
        
        # 3. Context extraction (From JWT)
        # Assuming JWT payload was injected into user object or we parse it here.
        # Minimalist: we check user.branch_id for default context
        ctx_id = user.branch_id
        ctx_type = "HQ" if ctx_id is None else "BRANCH"
        
        # [NEW] Check for override in request.state (if any previous middleware set it)
        # ctx_id = getattr(request.state, "ctx_id", ctx_id)
        # ctx_type = getattr(request.state, "ctx_type", ctx_type)
        
        # 4. Strict Routing Enforcement
        path = request.url.path
        
        # Robust extraction of role string
        try:
            current_role = user.role.value if hasattr(user.role, "value") else str(user.role)
        except:
            current_role = str(user.role)
        
        # HQ-only routes
        hq_prefixes = [
            "/hq", "/admin", "/command-center", "/organization", "/users", 
            "/purchases", "/expenses", "/brands", "/departments", 
            "/commercial-matrix", "/hr"
        ]
        # Exception: /hr/me is accessible to all employees (self-service)
        if path.startswith("/hr/me"):
            pass  # Allow access regardless of context
        elif any(path.startswith(pre) for pre in hq_prefixes):
            # Allow Admins/Owners to access HQ routes regardless of context
            if current_role not in ["ADMINISTRADOR", "DUEÑO"]:
                if ctx_id is not None or ctx_type != "HQ":
                    raise HTTPException(status_code=403, detail="Esta página solo es accesible desde el Centro de Mando (HQ)")

        # POS-only routes
        if path.startswith("/pos") or path.startswith("/mobile"):
            # Allow Admins/Owners to access POS routes regardless of context
            if current_role not in ["ADMINISTRADOR", "DUEÑO"]:
                if ctx_type not in ["BRANCH", "STORE"]:
                     raise HTTPException(status_code=403, detail="Esta página solo es accesible desde una Sucursal")

        # Warehouse-only routes
        warehouse_prefixes = ["/warehouse", "/logistics", "/boxes"]
        if any(path.startswith(pre) for pre in warehouse_prefixes):
            # Allow Admins/Owners to access Warehouse routes regardless of context
            if current_role not in ["ADMINISTRADOR", "DUEÑO"]:
                if ctx_type != "WAREHOUSE":
                     raise HTTPException(status_code=403, detail="Esta página solo es accesible desde una Bodega")

        # [TASK_PACK] Modular Navigation
        from app.services.capabilities_service import get_organization_capabilities
        from app.ui.nav_registry import get_nav_for_context
        
        # Resolve Org ID Correctly
        mod_org_id = request.cookies.get("support_org_id")
        if mod_org_id:
            try:
                mod_org_id = int(mod_org_id)
            except:
                mod_org_id = None
        
        if not mod_org_id:
            if user.branch_id:
                # Try to use branch's org
                # ensure branch is loaded
                if hasattr(user, 'branch') and user.branch:
                    mod_org_id = user.branch.organization_id
                else:
                    from app.models.organization import Branch
                    br = db.query(Branch).get(user.branch_id)
                    if br:
                        mod_org_id = br.organization_id
            
            if not mod_org_id:
                # Fallback to UserOrganization
                u_org = db.query(UserOrganization).filter(
                    UserOrganization.user_id == user.id,
                    UserOrganization.is_active == True
                ).first()
                if u_org:
                    mod_org_id = u_org.organization_id

        # Inject context into Request State (legacy SSR Jinja2 layout
        # instrumentation removed — dead since Sprint 4 React migration)
        request.state.user = user
        request.state.ctx_id = ctx_id
        request.state.ctx_type = ctx_type

        enabled_mods = get_organization_capabilities(db, mod_org_id) if mod_org_id else ["core"]
        
        # [NEW] DataXPOS Preset Navigation Override
        from app.models.organization import Organization, IndustryType
        from app.core.role_permissions import get_dataxpos_nav
        
        org = db.query(Organization).get(mod_org_id) if mod_org_id else None
        if org and org.industry_type == IndustryType.DATAXPOS:
            nav_items = get_dataxpos_nav(user.role)
        else:
            nav_items = get_nav_for_context(ctx_type, enabled_mods, user.role.value)
            
        request.state.nav_items = nav_items

        import json
        from app.schemas.users import UserRead
        user_data = UserRead.model_validate(user).model_dump_json()
        request.state.user_json = user_data

        return user

    return _check

async def require_platform_admin_html(request: Request, db: Session = Depends(get_db)) -> User:
    user = await get_current_user_from_cookie(request, db)
    if user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Requires Platform Admin")
    request.state.user = user
    return user

