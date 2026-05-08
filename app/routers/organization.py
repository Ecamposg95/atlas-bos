# app/routers/organization.py
"""
MOONSHOT_ENGINE: Nucleus
DOMAIN: Organizational / Tenancy
STATUS: Stable
"""
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Body
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
import shutil
import time

from app.core.database import get_db
from app.models.organization import Organization
from app.schemas.organization import OrganizationRead, OrganizationUpdate, OrganizationCreate
from app.core.security import get_current_user
from app.models.users import Role

from app.core.tenant_context import get_current_active_organization

router = APIRouter()

# Domain-owned sub-router: capabilities son info de contexto por usuario
# para su organización activa. `main.py` lo monta en /api/org/capabilities
# para preservar la URL histórica.
capabilities_router = APIRouter()

ADMIN_ROLES = {Role.ADMINISTRADOR, Role.DUEÑO}


def require_admin(current_user):
    from app.models.users import PlatformRole
    if current_user.platform_role == PlatformRole.SUPERADMIN:
        return current_user
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Requiere permisos de administrador")
    return current_user


@router.get("/", response_model=OrganizationRead)
def get_organization(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization) # [HARDENING]
):
    # [HARDENING] Fetch specific to context
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
         raise HTTPException(status_code=404, detail="Organization context not found")
    return org


@router.put("/", response_model=OrganizationRead)
def update_organization(
    org_in: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization) # [HARDENING]
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # [HARDENING] Refined Logic: Check what is ACTUALLY changing
    if current_user.role not in ADMIN_ROLES:
        allowed_subset = {"printer_name", "ticket_header", "ticket_footer", "paper_width_mm"}
        data_to_update = org_in.dict(exclude_unset=True)
        
        for key, new_val in data_to_update.items():
            current_val = getattr(org, key)
            # If value is changing...
            if new_val != current_val:
                # ...and it's not in the whitelist, BLOCK IT.
                if key not in allowed_subset:
                     print(f"[AUTH BLOCK] User {current_user.username} tried to change restricted field '{key}' from '{current_val}' to '{new_val}'")
                     require_admin(current_user)

    for key, value in org_in.dict(exclude_unset=True).items():
        setattr(org, key, value)

    db.commit()
    db.refresh(org)
    return org

# [DEPRECATED] Creation handled via Platform Router
# @router.post("/", ... )


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization) # [HARDENING]
):
    require_admin(current_user)

    # Validar tipo
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes")

    # SVG removed: ESC/POS pipeline rasterizes via Pillow (Image.open),
    # which does not read SVG. Accepting SVG made the upload appear to work
    # but the logo silently disappeared from printed tickets. Use a raster
    # format so the print path matches the upload path.
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Formato no permitido (PNG/JPEG/WEBP)")

    content = await file.read()
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    from app.utils import image_storage
    org.logo_url = image_storage.upload_image(
        content,
        public_id=f"org_{org_id}",
        folder=image_storage.ORG_LOGOS_FOLDER,
        content_type=file.content_type,
    )
    db.commit()
    db.refresh(org)

    return {"status": "success", "logo_url": org.logo_url}


@router.delete("/logo")
def delete_org_logo(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    require_admin(current_user)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    from app.utils import image_storage
    image_storage.delete_image(f"org_{org_id}", folder=image_storage.ORG_LOGOS_FOLDER)
    org.logo_url = None
    db.commit()
    return {"status": "success", "logo_url": None}


# ═════════════════════════════════════════════════════════════════════════════
# CAPABILITIES — consolidado desde app/routers/org_capabilities.py (Fase A).
# El handler devuelve módulos habilitados + nav contextual para el usuario
# actual. main.py lo monta en /api/org/capabilities (URL histórica).
# ═════════════════════════════════════════════════════════════════════════════
from fastapi import Request as _CapabilitiesRequest
from app.services.capabilities_service import get_organization_capabilities as _get_org_caps
from app.ui.nav_registry import get_nav_for_context as _get_nav
from app.schemas.capabilities import OrgCapabilities as _OrgCapabilities
from app.models.organization import IndustryType as _IndustryType


@capabilities_router.get("/", response_model=_OrgCapabilities)
async def get_org_caps(
    request: _CapabilitiesRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns the capabilities (enabled modules + nav) for the current user's organization."""
    org = db.query(Organization).get(current_user.organization_id)
    enabled_mods = _get_org_caps(db, org.id)

    ctx_type = getattr(request.state, "ctx_type", "HQ")
    nav = _get_nav(ctx_type, enabled_mods, current_user.role.value)

    branch_default = "/pos"
    if org.industry_type in [
        _IndustryType.RESTAURANT_QSR,
        _IndustryType.RESTAURANT_FULL,
        _IndustryType.CAFE_BAKERY,
    ]:
        branch_default = "/pos"
    elif org.industry_type == _IndustryType.AUTO_REPAIR_SHOP:
        branch_default = "/service/orders"
    elif org.industry_type == _IndustryType.WAREHOUSE_LOGISTICS:
        branch_default = "/warehouse/dashboard"

    return {
        "organization_id": org.id,
        "industry_type": org.industry_type.value,
        "enabled_modules": enabled_mods,
        "ui_profile": current_user.role.value.lower(),
        "default_routes": {
            "hq": "/command-center",
            "branch": branch_default,
            "warehouse": "/warehouse/dashboard",
        },
        "nav_items": nav,
    }
