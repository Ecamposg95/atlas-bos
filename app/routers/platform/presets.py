"""Industry Presets dynamic CRUD."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json as _json

from app.core.database import get_db
from app.models.users import User
from app.schemas.presets import IndustryPresetRead
from app.modules.platform.dependencies import require_platform_admin

from ._shared import IndustryPresetCreate, IndustryPresetUpdate, _audit

router = APIRouter()


# --- 9. INDUSTRY PRESETS (Dynamic Management) ---

@router.get("/presets", response_model=List[IndustryPresetRead])
def list_industry_presets(
    include_deprecated: bool = False,
    db: Session = Depends(get_db),
):
    """List industry presets. Deprecated presets are hidden unless explicitly requested."""
    from app.models.modules import IndustryPreset

    q = db.query(IndustryPreset)
    if not include_deprecated:
        # is_deprecated may be NULL on rows created before the column existed → treat as not deprecated.
        q = q.filter(IndustryPreset.is_deprecated.isnot(True))
    presets = q.order_by(IndustryPreset.display_name).all()
    return presets

@router.get("/presets/{preset_id}", response_model=IndustryPresetRead)
def get_industry_preset(preset_id: int, db: Session = Depends(get_db)):
    """Get a specific industry preset by ID."""
    from app.models.modules import IndustryPreset

    preset = db.query(IndustryPreset).filter(IndustryPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset

@router.post("/presets", response_model=IndustryPresetRead, status_code=status.HTTP_201_CREATED)
def create_industry_preset(preset_data: IndustryPresetCreate, db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    """Create a new industry preset."""
    from app.models.modules import IndustryPreset

    existing = db.query(IndustryPreset).filter(
        IndustryPreset.industry_type == preset_data.industry_type
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Preset for industry type '{preset_data.industry_type}' already exists"
        )

    preset = IndustryPreset(
        industry_type=preset_data.industry_type,
        display_name=preset_data.display_name,
        description=preset_data.description,
        modules=preset_data.modules,
        is_system=preset_data.is_system,
    )
    _audit(db, current_user.id, "CREATE_PRESET", "PRESET", preset_data.industry_type,
           _json.dumps({"display_name": preset_data.display_name, "modules": preset_data.modules}))
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset

@router.put("/presets/{preset_id}", response_model=IndustryPresetRead)
def update_industry_preset(preset_id: int, preset_data: IndustryPresetUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    """Update an existing industry preset."""
    from app.models.modules import IndustryPreset

    preset = db.query(IndustryPreset).filter(IndustryPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")

    update_data = preset_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(preset, field, value)

    _audit(db, current_user.id, "UPDATE_PRESET", "PRESET", preset_id,
           _json.dumps(update_data, default=str))
    db.commit()
    db.refresh(preset)
    return preset

@router.delete("/presets/{preset_id}")
def delete_industry_preset(preset_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_platform_admin)):
    """Delete an industry preset."""
    from app.models.modules import IndustryPreset

    preset = db.query(IndustryPreset).filter(IndustryPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")

    # Warning if trying to delete a system preset
    if preset.is_system:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete system presets. Set is_system=false first if you really want to delete it."
        )

    _audit(db, current_user.id, "DELETE_PRESET", "PRESET", preset_id,
           _json.dumps({"display_name": preset.display_name}))
    db.delete(preset)
    db.commit()
    return {"status": "success", "message": f"Preset '{preset.display_name}' deleted"}
