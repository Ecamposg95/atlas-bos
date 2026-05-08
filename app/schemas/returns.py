from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from app.models.sales import PaymentMethod
from app.schemas.users import UserRead

class SaleReturnSaleInfo(BaseModel):
    id: str
    series: Optional[str] = None
    folio: Optional[int] = None
    customer_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class VariantInfo(BaseModel):
    id: str
    sku: Optional[str] = None
    name: Optional[str] = None
    
    class Config:
        from_attributes = True

class SaleReturnItemBase(BaseModel):
    variant_id: str
    quantity: Decimal
    refund_amount: Decimal
    is_inventory_reentry: bool = True

class SaleReturnItemCreate(SaleReturnItemBase):
    pass

class SaleReturnItem(SaleReturnItemBase):
    id: str
    return_id: str
    created_at: datetime
    variant: Optional[VariantInfo] = None

    class Config:
        from_attributes = True

class SaleReturnBase(BaseModel):
    sale_id: str
    reason: str
    total_refunded: Decimal
    refund_method: PaymentMethod = PaymentMethod.CASH
    cash_session_id: Optional[int] = None
    supervisor_id: Optional[int] = None

class SaleReturnCreate(SaleReturnBase):
    items: List[SaleReturnItemCreate]

class BranchInfo(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class SaleReturn(SaleReturnBase):
    id: str
    user_id: int
    branch_id: Optional[int] = None
    organization_id: Optional[int] = None
    created_at: datetime
    status: str
    sale: Optional[SaleReturnSaleInfo] = None
    user: Optional[UserRead] = None
    supervisor: Optional[UserRead] = None
    branch: Optional[BranchInfo] = None
    items: List[SaleReturnItem] = []

    class Config:
        from_attributes = True

class SaleReturnSummary(BaseModel):
    id: str
    sale_id: str
    total_refunded: Decimal
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True