import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import declarative_mixin

@declarative_mixin
class UUIDMixin:
    """
    Mixin that defines a UUID primary key 'id'.
    """
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

@declarative_mixin
class AuditMixin:
    """
    Mixin that adds created_at, updated_at, and deleted_at columns.
    """
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

@declarative_mixin
class TenantMixin:
    """
    Mixin for multi-tenancy support.
    Encapsulates organization_id.
    """
    from sqlalchemy import Integer
    # Initially nullable for migration ease, but logic should enforce it
    organization_id = Column(Integer, ForeignKey("organization.id"), nullable=True, index=True)
