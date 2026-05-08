from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.database import get_db
from app.models import Employee, BranchAssignment, Attendance, User, Branch
from app.schemas.hr import (
    EmployeeCreate, EmployeeRead, EmployeeUpdate, EmployeeSelfUpdate,
    AssignmentCreate, AssignmentRead,
    CheckInRequest, CheckOutRequest, AttendanceRead
)
from app.security import get_current_user
from app.dependencies import get_current_active_organization

router = APIRouter()

# --- Employees Self-Service ---

@router.get("/employees/me", response_model=EmployeeRead)
def get_my_employee_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        first_name = current_user.full_name.split(" ")[0] if current_user.full_name else current_user.username
        last_name = " ".join(current_user.full_name.split(" ")[1:]) if current_user.full_name and " " in current_user.full_name else ""
        # Resolver organization_id desde el branch del usuario (multi-tenancy)
        org_id_derived = None
        if current_user.branch_id:
            br = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
            org_id_derived = br.organization_id if br else None
        emp = Employee(
            organization_id=org_id_derived,
            user_id=current_user.id,
            first_name=first_name,
            last_name=last_name,
            base_branch_id=current_user.branch_id,
            employee_type="FULL_TIME",
            email_personal=current_user.email
        )
        db.add(emp)
        db.commit()
        db.refresh(emp)
    return emp

@router.put("/employees/me", response_model=EmployeeRead)
def update_my_employee_profile(
    emp_update: EmployeeSelfUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(404, "No tienes un perfil de empleado asociado.")
    update_data = emp_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp

# --- Employees ---

def _org_branch_ids(db: Session, org_id: int) -> List[int]:
    """Devuelve los IDs de sucursales que pertenecen a la organización."""
    return [r[0] for r in db.query(Branch.id).filter(Branch.organization_id == org_id).all()]

@router.post("/employees", response_model=EmployeeRead)
def create_employee(
    emp: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    branch_ids = _org_branch_ids(db, org_id)
    if emp.base_branch_id and emp.base_branch_id not in branch_ids:
        raise HTTPException(404, "Sucursal no encontrada")
    if emp.user_id:
        existing = db.query(Employee).filter(Employee.user_id == emp.user_id).first()
        if existing:
            raise HTTPException(400, "Este usuario ya tiene un perfil de empleado asociado.")
    new_emp = Employee(**emp.dict(), organization_id=org_id)
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp

@router.get("/employees", response_model=List[EmployeeRead])
def list_employees(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    branch_ids = _org_branch_ids(db, org_id)
    q = db.query(Employee).filter(Employee.base_branch_id.in_(branch_ids))
    if active_only:
        q = q.filter(Employee.is_active == True)
    return q.offset(skip).limit(limit).all()

@router.get("/employees/{emp_id}", response_model=EmployeeRead)
def get_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    branch_ids = _org_branch_ids(db, org_id)
    emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.base_branch_id.in_(branch_ids)
    ).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    return emp

@router.put("/employees/{emp_id}", response_model=EmployeeRead)
def update_employee(
    emp_id: int,
    emp_update: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    branch_ids = _org_branch_ids(db, org_id)
    emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.base_branch_id.in_(branch_ids)
    ).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    update_data = emp_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp

# --- Assignments ---
@router.post("/employees/{emp_id}/assign", response_model=AssignmentRead)
def assign_employee(
    emp_id: int,
    assignment: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    branch_ids = _org_branch_ids(db, org_id)
    emp = db.query(Employee).filter(
        Employee.id == emp_id,
        Employee.base_branch_id.in_(branch_ids)
    ).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    if assignment.branch_id not in branch_ids:
        raise HTTPException(404, "Sucursal no encontrada")
    new_assign = BranchAssignment(employee_id=emp_id, **assignment.dict())
    db.add(new_assign)
    db.commit()
    db.refresh(new_assign)
    return new_assign

# --- Attendance ---

@router.post("/attendance/check-in", response_model=AttendanceRead)
def check_in(
    req: CheckInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    branch_ids = _org_branch_ids(db, org_id)
    emp = db.query(Employee).filter(
        Employee.id == req.employee_id,
        Employee.base_branch_id.in_(branch_ids)
    ).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    if req.branch_id not in branch_ids:
        raise HTTPException(404, "Sucursal no encontrada")
    open_session = db.query(Attendance).filter(
        Attendance.employee_id == req.employee_id,
        Attendance.check_out == None
    ).first()
    if open_session:
        raise HTTPException(400, "El empleado ya tiene una sesión abierta sin cerrar (Check-out pendiente).")
    new_attendance = Attendance(
        employee_id=req.employee_id,
        branch_id=req.branch_id,
        check_in=datetime.now(),
        notes=req.notes,
        created_by_user_id=current_user.id
    )
    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)
    return new_attendance

@router.post("/attendance/check-out", response_model=AttendanceRead)
def check_out(
    req: CheckOutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    branch_ids = _org_branch_ids(db, org_id)
    attendance = db.query(Attendance).filter(
        Attendance.id == req.attendance_id,
        Attendance.branch_id.in_(branch_ids)
    ).first()
    if not attendance:
        raise HTTPException(404, "Registro de asistencia no encontrado")
    if attendance.check_out:
        raise HTTPException(400, "Este registro ya tiene salida marcada.")
    attendance.check_out = datetime.now()
    if req.notes:
        attendance.notes = (attendance.notes or "") + f" | Salida: {req.notes}"
    db.commit()
    db.refresh(attendance)
    return attendance

@router.get("/attendance/report", response_model=List[AttendanceRead])
def get_attendance_report(
    start_date: date,
    end_date: date,
    branch_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    from sqlalchemy import func
    branch_ids = _org_branch_ids(db, org_id)
    q = db.query(Attendance).filter(
        Attendance.branch_id.in_(branch_ids),
        func.date(Attendance.check_in) >= start_date,
        func.date(Attendance.check_in) <= end_date,
    )
    if branch_id:
        q = q.filter(Attendance.branch_id == branch_id)
    if employee_id:
        q = q.filter(Attendance.employee_id == employee_id)
    return q.order_by(Attendance.check_in.desc()).all()
