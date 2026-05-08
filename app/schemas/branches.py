# app/schemas/branches.py
from pydantic import BaseModel
from typing import Optional


from app.models.organization import BranchType

class BranchBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    organization_id: Optional[int] = None

    branch_type: BranchType = BranchType.STORE
    can_sell: bool = True

    is_active: bool = True
    is_headquarters: bool = False

    # Maps / Geo (Detailed)
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "MX"

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    maps_url: Optional[str] = None
    place_id: Optional[str] = None
    timezone: Optional[str] = None
    
    # Printer Config
    printer_name: Optional[str] = None
    logo_url: Optional[str] = None
    ticket_header: Optional[str] = None
    ticket_footer: Optional[str] = None
    paper_width_mm: Optional[int] = 80
    open_drawer_on_print: bool = True


class BranchCreate(BranchBase):
    inherit_catalog: bool = False


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

    is_active: Optional[bool] = None
    is_headquarters: Optional[bool] = None
    branch_type: Optional[BranchType] = None
    can_sell: Optional[bool] = None

    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    maps_url: Optional[str] = None
    place_id: Optional[str] = None
    timezone: Optional[str] = None

    printer_name: Optional[str] = None
    logo_url: Optional[str] = None
    ticket_header: Optional[str] = None
    ticket_footer: Optional[str] = None
    paper_width_mm: Optional[int] = None
    open_drawer_on_print: Optional[bool] = None


class BranchRead(BranchBase):
    id: int

    class Config:
        from_attributes = True
