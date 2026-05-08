from typing import List, Optional, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models import AccountTransaction, Customer, User, TransactionType, Role, Organization, SalesDocument
from app.schemas.finance import AccountTransactionRead, AccountTransactionCreate, CustomerBalance
from app.core.security import get_current_user

router = APIRouter()

# --- Schemas for Portal ---
from pydantic import BaseModel

class LinkedAccount(BaseModel):
    organization_id: int
    organization_name: str
    customer_id: int
    current_balance: float
    currency: str = "MXN"

class PortalQuote(BaseModel):
    id: str
    date: datetime
    total: float
    status: str
    organization_name: str
    items_count: int

# --- Endpoints ---

@router.get("/accounts", response_model=List[LinkedAccount])
def get_my_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all customer profiles linked to this user's email across different organizations.
    """
    email = current_user.username
    
    # Find all customers with this email
    # Note: TenantMixin usually filters by current context. 
    # For a TRUE multi-tenant view, we might need to bypass tenant filter or Query all.
    # However, since we are in a shared DB schema with tenant_id (organization_id) column (implied by TenantMixin),
    # we can query Customer directly if we disable the filter or if we just query filtering by email.
    
    # If the system uses a strict "SET search_path" or RLS, this is harder. 
    # Assuming "Customer" table has 'organization_id' column and is in 'public' schema or accessible.
    
    # Based on models/crm.py, Customer inherits TenantMixin. 
    # We will try to query generic Customer filtering by email.
    
    customers = db.query(Customer).filter(Customer.email == email).all()
    
    accounts = []
    
    # If Admin testing (no customer profiles found)
    if not customers and current_user.role in [Role.ADMINISTRADOR, Role.DUEÑO, Role.GERENTE]:
        # Return a dummy account using the current context organization
        org = db.query(Organization).get(1) # Fallback to ID 1 or current context
        return [LinkedAccount(
            organization_id=org.id if org else 1,
            organization_name=org.name if org else "Demo Organization",
            customer_id=0,
            current_balance=0.00
        )]

    for c in customers:
        # Fetch Org Name
        # We need to access organization table. Assuming Customer has organization_id.
        # TenantMixin usually adds organization_id.
        org_name = "Unknown Org"
        if hasattr(c, 'organization_id'):
             org = db.query(Organization).filter(Organization.id == c.organization_id).first()
             if org: org_name = org.name
             
        accounts.append(LinkedAccount(
            organization_id=getattr(c, 'organization_id', 0),
            organization_name=org_name,
            customer_id=c.id,
            current_balance=c.current_balance or 0.00
        ))
        
    return accounts

@router.get("/my-account/balance", response_model=CustomerBalance)
def get_my_balance(
    org_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get balance for a specific organization or the aggregated total (if no org_id).
    For MVP, if no org_id, picking the first found or largest debt.
    """
    email = current_user.username
    query = db.query(Customer).filter(Customer.email == email)
    if org_id:
        query = query.filter(Customer.organization_id == org_id)
        
    customers = query.all()
    
    if not customers:
        if current_user.role in [Role.ADMINISTRADOR, Role.DUEÑO]:
             return CustomerBalance(customer_id=0, current_balance=0.00, last_updated=datetime.now())
        raise HTTPException(404, "Perfil no encontrado")
        
    # Aggregate or pick one
    main_customer = customers[0]
    total_balance = sum((c.current_balance or 0) for c in customers)
    
    return CustomerBalance(
        customer_id=main_customer.id,
        current_balance=total_balance,
        last_updated=datetime.now()
    )

@router.get("/quotes", response_model=List[PortalQuote])
def get_my_quotes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent quotes/documents for the user.
    """
    email = current_user.username
    customers = db.query(Customer).filter(Customer.email == email).all()
    
    customer_ids = [c.id for c in customers]
    
    if not customer_ids:
        # Admin test data
        if current_user.role in [Role.ADMINISTRADOR, Role.DUEÑO]:
             return [
                 PortalQuote(
                     id="COT-1001", 
                     date=datetime.now(), 
                     total=1500.00, 
                     status="PENDING", 
                     organization_name="Demo Org",
                     items_count=3
                 )
             ]
        return []
        
    # Fetch Quotes (SalesDocument type=QUOTE)
    # Assuming SalesDocument has customer_id
    quotes = db.query(SalesDocument).filter(
        SalesDocument.customer_id.in_(customer_ids),
        SalesDocument.doc_type.in_(["COTIZACION", "QUOTE"]) # Adjust based on actual Enum
    ).order_by(desc(SalesDocument.created_at)).limit(20).all()
    
    results = []
    for q in quotes:
        # Get Org Name for this quote
        org_name = "Unknown"
        # If document has org_id or we map back via customer
        results.append(PortalQuote(
            id=q.doc_serial or f"ID-{q.id}",
            date=q.created_at,
            total=q.total or 0.00,
            status=q.status,
            organization_name=org_name,
            items_count=len(q.items) if q.items else 0
        ))
        
    return results

@router.get("/my-account/transactions", response_model=List[AccountTransactionRead])
def get_my_transactions(
    org_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    email = current_user.username
    query = db.query(Customer).filter(Customer.email == email)
    if org_id:
        query = query.filter(Customer.organization_id == org_id)
    
    customers = query.all()
    if not customers:
        if current_user.role in [Role.ADMINISTRADOR, Role.DUEÑO]: return []
        raise HTTPException(404, "No Transactions")
        
    customer_ids = [c.id for c in customers]
    
    txs = db.query(AccountTransaction).filter(
        AccountTransaction.customer_id.in_(customer_ids)
    ).order_by(desc(AccountTransaction.created_at)).limit(50).all()
    
    return txs
