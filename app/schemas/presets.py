# app/schemas/presets.py
from pydantic import BaseModel
from typing import List, Optional

class IndustryPresetBase(BaseModel):
    industry_type: str
    display_name: str
    description: Optional[str] = None
    modules: List[str]
    is_system: bool = False

class IndustryPresetCreate(IndustryPresetBase):
    pass

class IndustryPresetUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    modules: Optional[List[str]] = None

class IndustryPresetRead(IndustryPresetBase):
    id: int

    class Config:
        from_attributes = True
