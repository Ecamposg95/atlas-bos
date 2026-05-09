# app/schemas/organization.py
from pydantic import BaseModel
from typing import Optional
from app.models.organization import IndustryType


class OrganizationBase(BaseModel):
    name: str = "Mi Empresa"
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    tax_regime: Optional[str] = None

    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

    logo_url: Optional[str] = None
    ticket_header: Optional[str] = "ATLAS POS - Nota de Venta"
    ticket_footer: Optional[str] = "Gracias por su compra!"
    printer_name: Optional[str] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    maps_url: Optional[str] = None
    timezone: Optional[str] = "America/Mexico_City"

    # SaaS Fields
    status: Optional[str] = "ACTIVE"
    plan: Optional[str] = "FREE"
    branding_config: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    # Default ATLAS_POS — preset se aplica automáticamente al crear (ver router).
    industry_type: Optional[IndustryType] = IndustryType.ATLAS_POS

    model_config = {"extra": "ignore"}


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    tax_regime: Optional[str] = None

    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

    logo_url: Optional[str] = None
    ticket_header: Optional[str] = None
    ticket_footer: Optional[str] = None
    printer_name: Optional[str] = None

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    maps_url: Optional[str] = None
    timezone: Optional[str] = None

    # SaaS Fields
    status: Optional[str] = None
    plan: Optional[str] = None
    branding_config: Optional[str] = None
    industry_type: Optional[IndustryType] = None
    is_active: Optional[bool] = None

    model_config = {"extra": "ignore"}


class OrganizationRead(OrganizationBase):
    id: int
    is_active: Optional[bool] = True
    industry_type: Optional[str] = None

    class Config:
        from_attributes = True
