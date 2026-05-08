from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Enum, Date, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.mixins import TenantMixin
import enum

# Enums
class EmployeeType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACTOR = "CONTRACTOR"

class AttendanceType(str, enum.Enum):
    CHECK_IN = "CHECK_IN"
    CHECK_OUT = "CHECK_OUT"

class VerificationMethod(str, enum.Enum):
    MANUAL = "MANUAL"
    FACE_ID = "FACE_ID"
    QR = "QR"
    PIN = "PIN"


class IncidentType(str, enum.Enum):
    LATE = "LATE"
    ABSENCE = "ABSENCE"
    SICK_LEAVE = "SICK_LEAVE"
    VACATION = "VACATION"
    OTHER = "OTHER"

class Employee(Base, TenantMixin):
    __tablename__ = "employees"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True) # Optional link to login user
    
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    
    # --- Identificación ---
    curp = Column(String, unique=True, nullable=True) # ID Personal MX
    rfc = Column(String, unique=True, nullable=True)  # Tax ID MX
    nss = Column(String, nullable=True)               # Social Security
    
    # --- Perfil Personal ---
    birth_date = Column(Date, nullable=True)
    gender = Column(String, nullable=True)
    civil_status = Column(String, nullable=True)
    
    # --- Contacto y Dirección ---
    phone = Column(String, nullable=True)
    email_personal = Column(String, nullable=True)
    address_street = Column(String, nullable=True)
    address_city = Column(String, nullable=True)
    address_state = Column(String, nullable=True)
    address_zip = Column(String, nullable=True)
    
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    
    # --- Info Laboral ---
    employee_type = Column(Enum(EmployeeType), default=EmployeeType.FULL_TIME)
    base_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    hire_date = Column(Date, nullable=True)
    base_salary = Column(Numeric(10, 2), nullable=True)
    bank_name = Column(String, nullable=True)
    bank_account = Column(String, nullable=True)
    clabe = Column(String, nullable=True) # Interbank code MX
    
    user = relationship("User", backref="employee_profile")
    base_branch = relationship("app.models.organization.Branch")
    assignments = relationship("BranchAssignment", back_populates="employee")
    attendances = relationship("Attendance", back_populates="employee")

class BranchAssignment(Base):
    """
    Temporary or scheduled assignment to a branch.
    If no active assignment exists, base_branch_id is assumed.
    """
    __tablename__ = "branch_assignments"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True) # Null = Indefinite/Open
    
    shift_start_time = Column(String, nullable=True) # "09:00"
    shift_end_time = Column(String, nullable=True)   # "18:00"
    
    notes = Column(String, nullable=True)

    employee = relationship("Employee", back_populates="assignments")
    branch = relationship("app.models.organization.Branch")

class Attendance(Base):
    __tablename__ = "attendances"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False) # Actual branch where check-in happened
    
    check_in = Column(DateTime(timezone=True), nullable=False)
    check_out = Column(DateTime(timezone=True), nullable=True)
    
    # Verification
    verification_method = Column(Enum(VerificationMethod), default=VerificationMethod.MANUAL)
    match_confidence = Column(Numeric(5, 4), nullable=True) # e.g. 0.9850
    device_info = Column(String, nullable=True) # "Front Camera / Tablet 1"

    incident_type = Column(Enum(IncidentType), nullable=True)

    notes = Column(String, nullable=True)
    
    # Audit
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Who performed the scan/entry

    employee = relationship("Employee", back_populates="attendances")
    branch = relationship("app.models.organization.Branch")
