
import sys
import os
import random
import logging
from datetime import datetime, timedelta
from decimal import Decimal

# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models import *
from app.models.organization import Organization, Branch, BranchType, IndustryType
from app.models.users import User, Role, PlatformRole, UserOrganization
from app.models.products import (
    Department, Brand, UnitOfMeasure, Product, ProductVariant, 
    ProductPrice, ProductBranchStatus, PackagingUnit
)
from app.models.crm import Customer, CustomerLedgerEntry
from app.models.inventory import StockOnHand, InventoryMovement, MovementType
from app.models.logistics import BoxType, ContainerType, ProductPackaging
from app.models.finance import AccountTransaction, TransactionType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_users():
    """
    Comprehensive QA Seeding Script
    Populates ALL core tables for a robust QA environment.
    """
    db = SessionLocal()
    try:
        logger.info("🚀 Starting Comprehensive QA Seeding...")

        # ==========================================
        # 1. Organization & Branches
        # ==========================================
        org_name = "QA"
        org = db.query(Organization).filter_by(name=org_name).first()
        if not org:
            logger.info(f"Creating Organization: {org_name}")
            org = Organization(
                name=org_name,
                legal_name="QA S.A. de C.V.",
                tax_id="QAX010101QA1",
                industry_type=IndustryType.RETAIL_CHAIN,
                status="ACTIVE",
                plan="ENTERPRISE",
                is_active=True
            )
            db.add(org)
            db.commit()
            db.refresh(org)
        
        # Branches
        branches_data = [
            {"name": "QA1", "type": BranchType.STORE, "qty": 100},
            {"name": "QA2", "type": BranchType.STORE, "qty": 50},
            {"name": "QA3", "type": BranchType.WAREHOUSE, "qty": 500},
        ]
        
        branch_objs = {} # Map name -> obj
        
        for b_data in branches_data:
            branch = db.query(Branch).filter_by(name=b_data["name"], organization_id=org.id).first()
            if not branch:
                logger.info(f"Creating Branch: {b_data['name']}")
                branch = Branch(
                    name=b_data["name"],
                    branch_type=b_data["type"],
                    organization_id=org.id,
                    address=f"Calle {b_data['name']} #100",
                    city="QA City",
                    is_active=True
                )
                db.add(branch)
                db.commit()
                db.refresh(branch)
            branch_objs[b_data["name"]] = branch

        # ==========================================
        # 2. Users (Per Branch)
        # ==========================================
        # Roles to create per branch
        roles_to_seed = [Role.ADMINISTRADOR, Role.GERENTE, Role.CAJERO, Role.VENDEDOR]
        
        for b_name, branch in branch_objs.items():
            for role in roles_to_seed:
                username = f"{role.value.lower()}_{b_name.lower()}" # e.g. cajero_qa1
                user = db.query(User).filter_by(username=username).first()
                if not user:
                    # logger.info(f"Creating User: {username}")
                    user = User(
                        username=username,
                        password_hash=get_password_hash("123"),
                        full_name=f"{role.value.title()} {b_name}",
                        role=role,
                        branch_id=branch.id,
                        is_active=True
                    )
                    db.add(user)
                    db.flush()
                    
                    # Link to Org
                    db.add(UserOrganization(
                        user_id=user.id,
                        organization_id=org.id,
                        org_role="OWNER" if role == Role.ADMINISTRADOR else "MEMBER"
                    ))
        db.commit()

        # Superadmin check
        sa = db.query(User).filter_by(username="superadmin").first()
        if not sa:
            logger.info("Creating Superadmin...")
            sa = User(
                username="superadmin",
                password_hash=get_password_hash("123"),
                full_name="Super Admin",
                role=Role.ADMINISTRADOR,
                platform_role=PlatformRole.SUPERADMIN,
                branch_id=branch_objs["QA1"].id,
                is_active=True
            )
            db.add(sa)
            db.flush()
            db.add(UserOrganization(user_id=sa.id, organization_id=org.id, org_role="OWNER"))
            db.commit()

        # ==========================================
        # 3. Master Data (Catalogues)
        # ==========================================
        # Departments
        depts = ["Electronics", "Groceries", "Clothing", "Home", "Toys"]
        dept_objs = []
        for d in depts:
            dept = db.query(Department).filter_by(name=d, organization_id=org.id).first()
            if not dept:
                dept = Department(name=d, organization_id=org.id)
                db.add(dept)
                db.commit()
                db.refresh(dept)
            dept_objs.append(dept)

        # Brands
        brands = ["Generic", "Sony", "Nike", "Nestle", "Samsung"]
        brand_objs = {}
        for b in brands:
            brand = db.query(Brand).filter_by(name=b, organization_id=org.id).first()
            if not brand:
                brand = Brand(name=b, organization_id=org.id)
                db.add(brand)
                db.commit()
                db.refresh(brand)
            brand_objs[b] = brand
            
        # UOM
        uoms = [("Piece", "PZA"), ("Kilogram", "KG"), ("Liter", "LT"), ("Box", "BOX")]
        for name, code in uoms:
            if not db.query(UnitOfMeasure).filter_by(code=code, organization_id=org.id).first():
                db.add(UnitOfMeasure(name=name, code=code, organization_id=org.id))
        db.commit()

        # Logistics (BoxTypes)
        boxes = [("Master Box", 10, 10, 10), ("Small Packet", 5, 5, 5)]
        box_objs = []
        for name, l, w, h in boxes:
            box = db.query(BoxType).filter_by(name=name, organization_id=org.id).first()
            if not box:
                box = BoxType(
                    name=name, outer_length=l, outer_width=w, outer_height=h, 
                    organization_id=org.id
                )
                db.add(box)
                db.commit()
                db.refresh(box)
            box_objs.append(box)

        # ==========================================
        # 4. Products & Inventory
        # ==========================================
        # Create 20 random products
        for i in range(1, 21):
            p_name = f"QA Product {i}"
            existing_p = db.query(Product).filter_by(name=p_name, organization_id=org.id).first()
            if existing_p:
                continue
                
            dept = random.choice(dept_objs)
            brand = random.choice(list(brand_objs.values()))
            
            prod = Product(
                name=p_name,
                description=f"Description for {p_name}",
                unit="PZA",
                department_id=dept.id,
                brand_id=brand.id,
                has_variants=True,
                is_active=True,
                organization_id=org.id
            )
            db.add(prod)
            db.flush()
            
            # Variant
            sku = f"SKU-QA-{i:03d}"
            variant = ProductVariant(
                product_id=prod.id,
                sku=sku,
                barcode=f"750000{i:04d}",
                variant_name="Standard",
                price=Decimal(random.randint(10, 500)),
                cost=Decimal(random.randint(5, 250)),
                organization_id=org.id,
                has_iva=True
            )
            db.add(variant)
            db.flush()
            
            # Prices (Wholesale)
            db.add(ProductPrice(
                variant_id=variant.id,
                price_name="Wholesale",
                min_quantity=10,
                unit_price=variant.price * Decimal("0.9"),
                organization_id=org.id
            ))
            
            # Packaging
            if box_objs:
                db.add(ProductPackaging(
                    variant_id=variant.id,
                    box_type_id=random.choice(box_objs).id,
                    units_per_box=12,
                    organization_id=org.id
                ))
            
            # Branch Status & Inventory
            for b_name, branch in branch_objs.items():
                # Enable at branch
                db.add(ProductBranchStatus(
                    variant_id=variant.id,
                    branch_id=branch.id,
                    is_active_pos=True,
                    organization_id=org.id
                ))
                
                # Initial Stock
                qty = 100 if branch.branch_type == BranchType.WAREHOUSE else 20
                stock = StockOnHand(
                    branch_id=branch.id,
                    variant_id=variant.id,
                    qty_on_hand=qty,
                    organization_id=org.id
                )
                db.add(stock)
                
                # Movement History
                db.add(InventoryMovement(
                    branch_id=branch.id,
                    variant_id=variant.id,
                    movement_type=MovementType.ADJUSTMENT_IN,
                    qty_change=qty,
                    qty_before=0,
                    qty_after=qty,
                    reference="INIT-QA",
                    organization_id=org.id
                ))

        db.commit()

        # ==========================================
        # 5. CRM & Finance
        # ==========================================
        # Customers
        customers_seed = [
            ("Cliente Mostrador", False), 
            ("Cliente Credito 1", True), 
            ("Cliente VIP", True)
        ]
        
        for name, has_credit in customers_seed:
            cust = db.query(Customer).filter_by(name=name, organization_id=org.id).first()
            if not cust:
                cust = Customer(
                    name=name,
                    tax_id="XAXX010101000",
                    has_credit=has_credit,
                    credit_limit=10000 if has_credit else 0,
                    organization_id=org.id
                )
                db.add(cust)
                db.flush()
                
                # Ledger / Balance
                if has_credit:
                    initial_debt = 1500
                    cust.current_balance = initial_debt
                    
                    # Ledger Entry
                    db.add(CustomerLedgerEntry(
                        customer_id=cust.id,
                        amount=initial_debt,
                        description="Saldo Inicial Migracion",
                        organization_id=org.id
                    ))
                    
                    # Account Transaction
                    db.add(AccountTransaction(
                        customer_id=cust.id,
                        tx_type=TransactionType.CHARGE,
                        amount=initial_debt,
                        current_balance=initial_debt,
                        reference="SALDO-INI",
                        organization_id=org.id
                    ))
        
        db.commit()
        logger.info("✅ Comprehensive QA Seeding Completed Successfully!")

    except Exception as e:
        logger.error(f"❌ Error seeding data: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    init_users()
