from sqlalchemy.orm import Session
from app.models import Customer
from app.schemas.crm import CustomerCreate

def get_customer(db: Session, customer_id: int, org_id: int | None = None):
    q = db.query(Customer).filter(Customer.id == customer_id)
    if org_id is not None:
        q = q.filter(Customer.organization_id == org_id)
    return q.first()

def get_customer_by_tax_id(db: Session, tax_id: str, org_id: int | None = None):
    q = db.query(Customer).filter(Customer.tax_id == tax_id)
    if org_id is not None:
        q = q.filter(Customer.organization_id == org_id)
    return q.first()

def get_customers(db: Session, org_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(Customer)
        .filter(Customer.organization_id == org_id, Customer.is_active == True)
        .offset(skip)
        .limit(limit)
        .all()
    )

def create_customer(db: Session, customer: CustomerCreate, org_id: int):
    db_customer = Customer(
        organization_id=org_id,
        name=customer.name,
        tax_id=customer.tax_id,
        email=customer.email,
        phone=customer.phone,
        address=customer.address,
        has_credit=customer.has_credit,
        credit_limit=customer.credit_limit,
        credit_days=customer.credit_days
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer