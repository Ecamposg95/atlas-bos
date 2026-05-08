from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from app.models.hr import EmployeeType, IncidentType, AttendanceType

from decimal import Decimal

# --- Employee Schemas ---
class EmployeeBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    # Identificación
    curp: Optional[str] = None
    rfc: Optional[str] = None
    nss: Optional[str] = None
    
    # Perfil Personal
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    civil_status: Optional[str] = None
    
    # Contacto y Dirección
    phone: Optional[str] = None
    email_personal: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    
    # Laboral
    employee_type: Optional[EmployeeType] = EmployeeType.FULL_TIME
    base_branch_id: Optional[int] = None
    hire_date: Optional[date] = None
    base_salary: Optional[Decimal] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    clabe: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    first_name: str # Required for creation
    last_name: str  # Required for creation
    user_id: Optional[int] = None # Link to existing user

class EmployeeUpdate(EmployeeBase):
    pass

class EmployeeSelfUpdate(BaseModel):
    """Fields an employee can update themselves"""
    phone: Optional[str] = None
    email_personal: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    civil_status: Optional[str] = None
    
    # Identification (Allowed for self-completion if missing)
    curp: Optional[str] = None
    rfc: Optional[str] = None
    nss: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    clabe: Optional[str] = None

class EmployeeRead(EmployeeBase):
    id: int
    user_id: Optional[int]
    is_active: bool
    
    class Config:
        from_attributes = True

# --- Assignment Schemas ---
class AssignmentCreate(BaseModel):
    branch_id: int
    start_date: date
    end_date: Optional[date] = None
    shift_start_time: Optional[str] = "09:00"
    shift_end_time: Optional[str] = "18:00"
    notes: Optional[str] = None

class AssignmentRead(AssignmentCreate):
    id: int
    employee_id: int
    
    class Config:
        from_attributes = True

# --- Attendance Schemas ---
class CheckInRequest(BaseModel):
    employee_id: int # Or derived from user
    branch_id: int   # Where are they physically?
    notes: Optional[str] = None

class CheckOutRequest(BaseModel):
    attendance_id: int
    notes: Optional[str] = None

class AttendanceRead(BaseModel):
    id: int
    employee_id: int
    branch_id: int
    check_in: datetime
    check_out: Optional[datetime]
    incident_type: Optional[IncidentType]
    notes: Optional[str]
    employee_name: Optional[str] = None # Calculated field helper
    
    class Config:
        from_attributes = True
