from sqlalchemy import Column, String, Integer, Text, DateTime, Enum
from sqlalchemy.sql import func
import enum
from app.database import Base
from app.models.mixins import UUIDMixin, TenantMixin

class PrintJobStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PRINTED = "PRINTED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class PrintJob(Base, UUIDMixin, TenantMixin):
    __tablename__ = "print_jobs"

    printer_name = Column(String(100), nullable=True)
    content = Column(Text, nullable=False) # Base64 encoded raw bytes
    status = Column(Enum(PrintJobStatus), default=PrintJobStatus.PENDING, index=True)
    error_message = Column(Text, nullable=True)

    # Track 4 (POS bug-fix): tracking per-PC para multi-device same-account.
    # device_id es un UUID que el frontend genera y persiste en localStorage
    # de cada PC. device_fingerprint es un hash de UA + screen + tz para
    # detectar PC clonadas (mismo localStorage en navegadores distintos).
    # client_ip se extrae de request.client.host.
    device_id = Column(String(64), nullable=True, index=True)
    device_fingerprint = Column(String(128), nullable=True)
    client_ip = Column(String(64), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
