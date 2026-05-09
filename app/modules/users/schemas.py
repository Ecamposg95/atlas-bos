from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# --- DEFINICIÓN DE CLASES (Sin self-imports) ---

class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "CAJERO"
    platform_role: Optional[str] = "NONE"
    branch_id: Optional[int] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    organization_id: Optional[int] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    platform_role: Optional[str] = None
    branch_id: Optional[int] = None
    organization_id: Optional[int] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class UserRead(UserBase):
    id: int
    created_at: Optional[datetime] = None
    organization_id: Optional[int] = None
    branch_name: Optional[str] = None

    class Config:
        from_attributes = True
