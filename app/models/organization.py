"""
MOONSHOT_ENGINE: Nucleus
DOMAIN: Organizational / Tenancy
STATUS: Stable
"""
import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, DateTime, Enum, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


from app.models.mixins import TenantMixin

class BranchType(str, enum.Enum):
    HQ = "HQ"
    STORE = "STORE"
    WAREHOUSE = "WAREHOUSE"
    OFFICE = "OFFICE"

class IndustryType(str, enum.Enum):
    # Retail / Comercio
    ATLAS_POS = "ATLAS_POS"
    DISTRIBUTOR_POS = "DISTRIBUTOR_POS"
    RETAIL_CHAIN = "RETAIL_CHAIN"
    ECOMMERCE = "ECOMMERCE"
    WHOLESALE_B2B = "WHOLESALE_B2B"
    
    # Servicios
    SALON = "SALON"
    CLINIC = "CLINIC"
    DENTAL = "DENTAL"
    PROFESSIONAL_SERVICES = "PROFESSIONAL_SERVICES"
    
    # Hospitality
    RESTAURANT_QSR = "RESTAURANT_QSR"
    RESTAURANT_FULL = "RESTAURANT_FULL"
    CAFE_BAKERY = "CAFE_BAKERY"
    
    # Automotriz / Taller
    AUTO_REPAIR_SHOP = "AUTO_REPAIR_SHOP"
    FLEET_SERVICE = "FLEET_SERVICE"
    
    # Comercial / Ventas
    SALES_DISTRIBUTION = "SALES_DISTRIBUTION"
    B2B_ENTERPRISE = "B2B_ENTERPRISE"
    
    # Logística / Inventario
    WAREHOUSE_LOGISTICS = "WAREHOUSE_LOGISTICS"
    MANUFACTURING_LIGHT = "MANUFACTURING_LIGHT"
    
    # Genérico
    CUSTOM = "CUSTOM"

class Branch(Base, TenantMixin):
    __tablename__ = "branches"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)

    # Datos base
    name = Column(String, index=True, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)

    # Type & Permissions
    branch_type = Column(Enum(BranchType), default=BranchType.STORE, nullable=False)
    can_sell = Column(Boolean, default=True)

    # Flags
    is_active = Column(Boolean, default=True)
    is_headquarters = Column(Boolean, default=False) # Keep for backward compatibility/migration
    
    # Printer Config (Per Branch)
    printer_name = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)       # Overrides Org logo on ticket if set
    ticket_header = Column(String, nullable=True) # Overrides Org global if set
    ticket_footer = Column(String, nullable=True) # Overrides Org global if set
    paper_width_mm = Column(Integer, nullable=True, default=80)  # 58 or 80
    open_drawer_on_print = Column(Boolean, default=True, nullable=False)

    # Cockpit / day-mode (added 2026-04-27)
    daily_sales_goal = Column(Numeric(12, 2), nullable=True)  # Meta del día en MXN, NULL = sin meta
    closing_time = Column(Time, nullable=True)                # Hora de cierre HH:MM, NULL = sin checklist asistido

    # Geolocalización / mapas (Detailed)
    address_line1 = Column(String, nullable=True) # Calle y número
    address_line2 = Column(String, nullable=True) # Interior, Edificio, etc.
    neighborhood = Column(String, nullable=True)  # Colonia
    city = Column(String, nullable=True)          # Ciudad / Municipio
    state = Column(String, nullable=True)         # Estado
    postal_code = Column(String, nullable=True)   # CP
    country = Column(String, default="MX", nullable=True)

    latitude = Column(Numeric(9, 6), nullable=True)   # ej. 19.432608
    longitude = Column(Numeric(9, 6), nullable=True)  # ej. -99.133209
    maps_url = Column(String, nullable=True)          # link directo Google Maps
    place_id = Column(String, nullable=True)          # opcional (Google Places)
    timezone = Column(String, nullable=True)          # ej. America/Mexico_City
    
    # organization_id comes from TenantMixin

    # Relación con usuarios
    users = relationship("User", back_populates="branch")

    # Movimientos de inventario (Tenant Isolation & Logistics)
    outgoing_movements = relationship(
        "InventoryMovement", 
        foreign_keys="InventoryMovement.from_branch_id", 
        back_populates="from_branch"
    )
    incoming_movements = relationship(
        "InventoryMovement", 
        foreign_keys="InventoryMovement.to_branch_id", 
        back_populates="to_branch"
    )

class Organization(Base):
    """
    En instancias separadas normalmente tendrás 1 sola organización por instancia.
    Esta tabla te sirve para ticket, branding, configuración y datos de empresa.
    """
    __tablename__ = "organization"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)

    # Identidad
    name = Column(String, default="Mi Empresa")             # nombre comercial
    legal_name = Column(String, nullable=True)             # razón social
    tax_id = Column(String, nullable=True)                 # RFC
    tax_regime = Column(String, nullable=True)             # régimen fiscal (opcional)

    # Contacto
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)

    # Branding / tickets
    logo_url = Column(String, nullable=True)
    ticket_header = Column(String, nullable=True, default="ATLAS POS - Nota de Venta")
    ticket_footer = Column(String, nullable=True, default="Gracias por su compra!")
    printer_name = Column(String, nullable=True)           # impresora por defecto

    # Geolocalización / mapas (opcional)
    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)
    maps_url = Column(String, nullable=True)
    timezone = Column(String, nullable=True, default="America/Mexico_City")

    # SaaS Fields
    status = Column(String, default="ACTIVE", index=True) # ACTIVE, SUSPENDED
    plan = Column(String, default="FREE") 
    branding_config = Column(String, nullable=True) # JSON storable

    # TASK_PACK: Modular Suite
    industry_type = Column(Enum(IndustryType), nullable=True) # Defaults to None for Startup Flow
    hq_branch_id = Column(Integer, ForeignKey("branches.id", use_alter=True, name="fk_organization_hq_branch"), nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    users_association = relationship("UserOrganization", back_populates="organization")
    modules_association = relationship("OrganizationModule", back_populates="organization")
