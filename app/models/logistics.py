import enum
from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, JSON, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

from app.models.mixins import TenantMixin

class ContainerType(Base, TenantMixin):
    """
    Standard Shipping Containers (20ft, 40ft, etc) or Custom Trucks.
    """
    __tablename__ = "container_types"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # e.g. "20ft Standard"
    
    # Internal dimensions in cm (or mm, let's assume cm for now and allow float)
    inner_length = Column(Numeric(10, 2), nullable=False)
    inner_width = Column(Numeric(10, 2), nullable=False)
    inner_height = Column(Numeric(10, 2), nullable=False)
    
    max_weight_kg = Column(Numeric(10, 2), nullable=False)
    
    is_active = Column(Boolean, default=True) # Add Boolean import if needed, assuming generic imports available or add specific.

    calculations = relationship("ContainerLoadCalc", back_populates="container_type")

class BoxType(Base, TenantMixin):
    """
    Standard Box Sizes (e.g. 'Master Box A', 'Caja Pequeña')
    Dimensions are EXTERNAL.
    """
    __tablename__ = "box_types"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    outer_length = Column(Numeric(10, 2), nullable=False)
    outer_width = Column(Numeric(10, 2), nullable=False)
    outer_height = Column(Numeric(10, 2), nullable=False)
    
    weight_empty_kg = Column(Numeric(10, 3), default=0.0)
    
    packagings = relationship("ProductPackaging", back_populates="box_type")

class ProductPackaging(Base, TenantMixin):
    """
    Link Product Variant -> Box Type
    """
    __tablename__ = "product_packagings"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False)
    box_type_id = Column(Integer, ForeignKey("box_types.id"), nullable=False)
    
    units_per_box = Column(Integer, nullable=False, default=1)
    
    # User asked for: item_no, box_barcode.
    item_no = Column(String, nullable=True) # "ITEM-001" printed on box
    box_barcode = Column(String, nullable=True) # GTIN-14 etc.
    
    variant = relationship("app.models.products.ProductVariant")
    box_type = relationship("BoxType", back_populates="packagings")

class ContainerLoadCalc(Base, TenantMixin):
    """
    History of calculations.
    """
    __tablename__ = "container_load_calcs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    
    container_type_id = Column(Integer, ForeignKey("container_types.id"), nullable=False)
    box_type_id = Column(Integer, ForeignKey("box_types.id"), nullable=False)
    
    # Input params used
    total_boxes_fit = Column(Integer, nullable=False)
    total_weight_kg = Column(Numeric(10, 2), nullable=False)
    volume_utilization_pct = Column(Numeric(5, 2), nullable=False)
    
    orientation_used = Column(String) # "LxW" or "WxL"
    
    result_json = Column(JSON, nullable=True) # Full structured result details
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    container_type = relationship("ContainerType", back_populates="calculations")
    box_type = relationship("BoxType")

class InboundShipment(Base, TenantMixin):
    """
    Representation of a physical shipment arrival (Entrada de Mercancía).
    Tracks the container/truck and the boxes inside it.
    """
    __tablename__ = "inbound_shipments"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="DRAFT") # DRAFT, RECEIVED, CANCELLED
    
    reference = Column(String, nullable=True) # e.g. "CONT-2023-001", BL Number
    notes = Column(String, nullable=True)
    
    arrival_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Optional: Link to a specific container type if relevant for capacity checks
    container_type_id = Column(Integer, ForeignKey("container_types.id"), nullable=True)
    
    items = relationship("ShipmentItem", back_populates="shipment", cascade="all, delete-orphan")

class ShipmentItem(Base, TenantMixin):
    """
    Specific boxes within a shipment.
    """
    __tablename__ = "shipment_items"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("inbound_shipments.id"), nullable=False)
    
    # What did we receive?
    box_type_id = Column(Integer, ForeignKey("box_types.id"), nullable=True)
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=True)
    
    # Quantities
    quantity_boxes = Column(Integer, default=1)
    units_per_box = Column(Integer, default=1)
    
    # Calculated
    total_units = Column(Integer, default=0) # quantity_boxes * units_per_box
    
    shipment = relationship("InboundShipment", back_populates="items")
    box_type = relationship("BoxType")
    variant = relationship("app.models.products.ProductVariant")

from sqlalchemy import Boolean # ensure imported

class TransferStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    REQUESTED = "REQUESTED"
    PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class TransferOrder(Base, TenantMixin):
    __tablename__ = "transfer_orders"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    requesting_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    status = Column(Enum(TransferStatus), default=TransferStatus.DRAFT, nullable=False)
    
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    requesting_branch = relationship("app.models.organization.Branch")
    lines = relationship("TransferOrderLine", back_populates="transfer", cascade="all, delete-orphan")
    fulfillments = relationship("TransferFulfillment", back_populates="transfer")

class TransferOrderLine(Base, TenantMixin):
    __tablename__ = "transfer_order_lines"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("transfer_orders.id"), nullable=False)
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=False)
    
    qty_requested = Column(Numeric(10, 2), nullable=False)
    qty_received = Column(Numeric(10, 2), default=0)

    transfer = relationship("TransferOrder", back_populates="lines")
    variant = relationship("app.models.products.ProductVariant")

class FulfillmentStatus(str, enum.Enum):
    PREPARED = "PREPARED"
    SHIPPED = "SHIPPED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"

class TransferFulfillment(Base, TenantMixin):
    __tablename__ = "transfer_fulfillments"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("transfer_orders.id"), nullable=False)
    source_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False) # Warehouse
    
    status = Column(Enum(FulfillmentStatus), default=FulfillmentStatus.PREPARED, nullable=False)
    
    shipped_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transfer = relationship("TransferOrder", back_populates="fulfillments")
    source_branch = relationship("app.models.organization.Branch")
    lines = relationship("TransferFulfillmentLine", back_populates="fulfillment", cascade="all, delete-orphan")

class TransferFulfillmentLine(Base, TenantMixin):
    __tablename__ = "transfer_fulfillment_lines"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    fulfillment_id = Column(Integer, ForeignKey("transfer_fulfillments.id"), nullable=False)
    transfer_line_id = Column(Integer, ForeignKey("transfer_order_lines.id"), nullable=False)
    
    qty_fulfilled = Column(Numeric(10, 2), nullable=False)

    fulfillment = relationship("TransferFulfillment", back_populates="lines")
    transfer_line = relationship("TransferOrderLine")


