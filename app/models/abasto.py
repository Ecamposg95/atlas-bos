from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, DateTime, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.mixins import UUIDMixin, AuditMixin, TenantMixin
import enum

class RecommendationStatus(str, enum.Enum):
    PENDING = "PENDING"     # System generated, waiting for review
    APPROVED = "APPROVED"   # User approved -> converted to Order
    REJECTED = "REJECTED"   # User ignored
    ORDERED = "ORDERED"     # Already processed

class PurchaseRecommendation(Base, UUIDMixin, AuditMixin, TenantMixin):
    """
    Stores system-generated recommendations for purchasing/reordering products
    based on low stock events.
    Part of the "Control by Exception" philosophy.
    """
    __tablename__ = "purchase_recommendations"
    __table_args__ = {'extend_existing': True}

    # Which variant needs reordering?
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False) # Where is the need?

    # Why?
    trigger_event_id = Column(String(36), nullable=True) # ID of SalesDocumentCreated or InventoryMovement
    reason = Column(String(255), nullable=True) # e.g. "Stock (2) < Min (5)"

    # Quantity suggested
    suggested_qty = Column(Numeric(10, 2), nullable=False)
    
    status = Column(Enum(RecommendationStatus), default=RecommendationStatus.PENDING, index=True)
    
    notes = Column(Text, nullable=True) # User comments
    
    # Relationships
    variant = relationship("app.models.products.ProductVariant")
    branch = relationship("app.models.organization.Branch")
