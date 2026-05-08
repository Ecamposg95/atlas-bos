# app/routers/setup.py
#
# Sprint final del decomm Jinja2 (post tech-debt roadmap S4):
# - Endpoint SSR `GET /startup` ELIMINADO. La página es ahora React puro
#   en `frontend/src/pages/core/Startup.tsx`, servida por el catch-all SPA.
# - Solo queda el JSON API de inicialización, ahora montado bajo `/api/setup`.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.security import get_current_user
from app.models import User, Organization
from app.models.modules import IndustryPreset
from app.models.organization import IndustryType
from app.dependencies import get_current_active_organization

router = APIRouter()


class SetupInitializeRequest(BaseModel):
    industry_type: str


@router.post("/initialize")
def initialize_preset(
    payload: SetupInitializeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    """
    Aplica el preset seleccionado a la organización del contexto.

    Solo Administradores y Dueños pueden ejecutarlo. La UI vive en
    React (`pages/core/Startup.tsx`) y llama a `POST /api/setup/initialize`.
    """
    if current_user.role not in ("ADMINISTRADOR", "DUEÑO"):
        raise HTTPException(
            status_code=403,
            detail="Solo administradores pueden configurar la organización.",
        )

    preset = (
        db.query(IndustryPreset)
        .filter(IndustryPreset.industry_type == payload.industry_type)
        .first()
    )
    if not preset and payload.industry_type not in IndustryType.__members__:
        raise HTTPException(
            status_code=400,
            detail=f"Preset {payload.industry_type} desconocido.",
        )

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.industry_type = payload.industry_type
    db.commit()

    target_url = "/atlas-pos"
    if payload.industry_type == "ATLAS_POS":
        target_url = "/atlas-pos"
    elif payload.industry_type == "CRM":
        target_url = "/crm"

    return {"status": "success", "redirect_url": target_url}
