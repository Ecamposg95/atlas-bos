#app/models/users.py
import enum
"""
MOONSHOT_ENGINE: Nucleus
DOMAIN: Identity & Access Management
STATUS: Stable
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base 

class Role(str, enum.Enum):
    ADMINISTRADOR = "ADMINISTRADOR"
    GERENTE = "GERENTE"
    CAJERO = "CAJERO"
    DUEÑO = "DUEÑO"
    VENDEDOR = "VENDEDOR"
    SOPORTE_OPERATIVO = "SOPORTE_OPERATIVO"
    CLIENTE = "CLIENTE"

class PlatformRole(str, enum.Enum):
    SUPERADMIN = "SUPERADMIN"
    SUPPORT = "SUPPORT"
    NONE = "NONE"

# --- NOTA: He eliminado la clase Branch de aquí ---
# Como ya existe en 'app/models/organization.py', no debemos repetirla.

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    
    # opcional: si quieres manejar correo del usuario
    email = Column(String, nullable=True) # Official/System email
    personal_email = Column(String, nullable=True)
    
    # Extended Profile
    nationality = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    dob = Column(String, nullable=True) # Leaving as String for flexibility or "dd/mm/yyyy", or user explicitly requested Date? User said "Fecha de nacimiento". Let's stick to String for simplicity in import/export unless strict Date needed. The user input was "30/10/2002".
    
    # Biometrics / FaceID
    face_encoding = Column(JSON, nullable=True) # List of 128 floats from face_recognition lib

    
    password_hash = Column(String, nullable=False)
    
    # create_type=False assumes the type is created externally (by init_db.py)
    role = Column(Enum(Role, name="role", create_type=False), default=Role.CAJERO, nullable=False)
    
    is_active = Column(Boolean, default=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Platform Role (SaaS)
    platform_role = Column(Enum(PlatformRole, name="platform_role", create_type=False), default=PlatformRole.NONE, nullable=False)

    # SQLAlchemy buscará la clase "Branch" automáticamente en el registro
    branch = relationship("Branch", back_populates="users")

    @property
    def branch_name(self) -> str | None:
        return self.branch.name if self.branch else None

    # Multi-tenant relation
    organizations = relationship("UserOrganization", back_populates="user", cascade="all, delete-orphan")
    
class UserOrganization(Base):
    __tablename__ = "user_organizations"
    __table_args__ = {'extend_existing': True}

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    organization_id = Column(Integer, ForeignKey("organization.id"), primary_key=True)
    
    org_role = Column(String, default="MEMBER") # ADMIN, MEMBER, OWNER
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="organizations")
    organization = relationship("Organization", back_populates="users_association")