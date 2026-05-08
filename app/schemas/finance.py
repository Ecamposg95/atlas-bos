from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.models.finance import TransactionType

class AccountTransactionBase(BaseModel):
    customer_id: int
    tx_type: TransactionType
    amount: float
    reference: Optional[str] = None
    description: Optional[str] = None

class AccountTransactionCreate(AccountTransactionBase):
    pass

class AccountTransactionRead(AccountTransactionBase):
    id: int
    current_balance: float
    created_at: datetime
    
    class Config:
        from_attributes = True

class CustomerBalance(BaseModel):
    customer_id: int
    current_balance: float
    last_updated: datetime
