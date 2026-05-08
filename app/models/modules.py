import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class ModuleScope(str, enum.Enum):
    HQ = "HQ"
    BRANCH = "BRANCH"
    WAREHOUSE = "WAREHOUSE"
    GLOBAL = "GLOBAL"

class ModuleStatus(str, enum.Enum):
    BETA = "BETA"
    STABLE = "STABLE"

class Module(Base):
    """
    Catálogo global de módulos disponibles en la plataforma.
    """
    __tablename__ = "modules"
    
    key = Column(String, primary_key=True, index=True) # ej: pos, warehouse, quotes
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    scope = Column(Enum(ModuleScope), default=ModuleScope.GLOBAL)
    status = Column(Enum(ModuleStatus), default=ModuleStatus.STABLE)

class OrganizationModule(Base):
    """
    Habilitación y configuración de módulos por organización.
    """
    __tablename__ = "organization_modules"
    
    organization_id = Column(Integer, ForeignKey("organization.id"), primary_key=True)
    module_key = Column(String, ForeignKey("modules.key"), primary_key=True)
    
    is_enabled = Column(Boolean, default=True)
    config_json = Column(JSON, nullable=True) # Config específico (límites, toggles internos)

    # Relationships
    organization = relationship("Organization", back_populates="modules_association")
    module = relationship("Module")

class IndustryPreset(Base):
    """
    Presets de módulos por tipo de industria.
    Permite gestión dinámica de qué módulos se habilitan para cada vertical.
    """
    __tablename__ = "industry_presets"
    
    id = Column(Integer, primary_key=True, index=True)
    industry_type = Column(String, unique=True, nullable=False, index=True)  # IndustryType enum value
    display_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    modules = Column(JSON, nullable=False)  # List of module keys
    is_system = Column(Boolean, default=True)  # System presets have warnings when editing
