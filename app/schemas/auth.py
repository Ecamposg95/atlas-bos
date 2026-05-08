from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    username: str
    pin: str

class UserPayload(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    platform_role: str
    branch_id: Optional[int] = None
    organization_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True

class OrgPayload(BaseModel):
    id: int
    name: str
    industry_type: Optional[str] = None
    hq_branch_id: Optional[int] = None

    class Config:
        from_attributes = True

class BranchPayload(BaseModel):
    id: int
    name: str
    branch_type: str
    is_headquarters: bool

    class Config:
        from_attributes = True

class TokenWithUser(BaseModel):
    access_token: str
    token_type: str
    user: UserPayload
    organization: Optional[OrgPayload] = None
    branch: Optional[BranchPayload] = None