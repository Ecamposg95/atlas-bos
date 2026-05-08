import sys
import os
import logging
from sqlalchemy.exc import ProgrammingError, OperationalError

# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
# Import all models to ensure metadata is populated for create_all
import app.models 
from app.models.users import User, Role, PlatformRole, UserOrganization
from app.models.organization import Organization, Branch, BranchType
from app.models.products import (
    Department, Brand, Product, ProductVariant, 
    ProductPrice, PackagingUnit, ProductBranchStatus
)
from app.models.inventory import StockOnHand
from decimal import Decimal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CONFIGURA TUS DEFAULT VALUES ---
SUPERADMIN_USER = os.getenv("SUPERADMIN_USER", "superadmin")
SUPERADMIN_PASS = os.getenv("SUPERADMIN_PASS", "admin123") # Change in PROD

DEFAULT_ORG_NAME = os.getenv("DEFAULT_ORG_NAME", "Atlas Corp")

def init_users():
    """
    Bootstraps the database with initial state.
    1. Default Organization
    2. HQ Branch & Store Branch
    3. Superadmin User
    4. Operational Users (Admin, Manager, Cashier)
    Idempotent: Checks existence before creating.
    """
    logger.info("🚀 Starting System Bootstrap...")
    
    # Ensure Tables Exist (Safety check)
    if os.getenv("ATLAS_DEV_AUTOCREATE_DB") == "true":
         logger.info("🔧 ATLAS_DEV_AUTOCREATE_DB=true -> Creating tables via SQLAlchemy...")
         Base.metadata.create_all(bind=engine)
    elif len(sys.argv) > 1 and sys.argv[1] == "--create-all":
         logger.info("🔧 --create-all flag detected -> Creating tables via SQLAlchemy...")
         Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # ---------------------------------------------------------
        # 1. CREATE ORGANIZATION
        # ---------------------------------------------------------
        try:
            org = db.query(Organization).filter(Organization.name == DEFAULT_ORG_NAME).first()
        except (ProgrammingError, OperationalError) as e:
            # Detectar error "relation does not exist" (Postgres) o "no such table" (SQLite)
            msg = str(e).lower()
            if "relation" in msg and "does not exist" in msg or "no existe la relación" in msg or "no such table" in msg:
                 logger.error("❌ Database schema not initialized (Table 'organization' missing).")
                 logger.error("💡 SUGGESTION: Run 'alembic upgrade head' to apply migrations.")
                 logger.error("             OR set env ATLAS_DEV_AUTOCREATE_DB=true to force creation.")
                 sys.exit(1)
            else:
                 raise e
        
        if not org:
            logger.info(f"Creating Organization: {DEFAULT_ORG_NAME}")
            org = Organization(
                name=DEFAULT_ORG_NAME,
                plan="ENTERPRISE",
                status="ACTIVE"
            )
            db.add(org)
            db.commit()
            db.refresh(org)
        else:
            logger.info(f"Organization '{DEFAULT_ORG_NAME}' already exists (ID: {org.id}).")

        # ---------------------------------------------------------
        # 2. CREATE BRANCHES (HQ & STORE)
        # ---------------------------------------------------------
        
        # 2.1 HQ
        hq = db.query(Branch).filter(Branch.organization_id == org.id, Branch.branch_type == BranchType.HQ).first()
        if not hq:
            logger.info("Creating HQ Branch...")
            hq = Branch(
                name="Headquarters",
                address="Corporate Office",
                phone="555-HQHQ",
                branch_type=BranchType.HQ,
                can_sell=False,     # HQ usually verifies, doesn't sell
                is_active=True,
                is_headquarters=True,
                organization_id=org.id
            )
            db.add(hq)
            db.commit()
            db.refresh(hq)
        
        # 2.2 Store
        store = db.query(Branch).filter(Branch.organization_id == org.id, Branch.branch_type == BranchType.STORE).first()
        if not store:
            logger.info("Creating Demo Store...")
            store = Branch(
                name="Sucursal Centro",
                address="Av. Reforma 123",
                phone="555-1234",
                branch_type=BranchType.STORE,
                can_sell=True,
                is_active=True,
                is_headquarters=False,
                organization_id=org.id
            )
            db.add(store)
            db.commit()
            db.refresh(store)

        # ---------------------------------------------------------
        # 3. CREATE USERS
        # ---------------------------------------------------------

        # 3.1 Superadmin (Platform Level)
        sa = db.query(User).filter(User.username == SUPERADMIN_USER).first()
        if not sa:
            logger.info(f"Creating Superadmin: {SUPERADMIN_USER}")
            sa = User(
                username=SUPERADMIN_USER,
                full_name="Super Admin",
                password_hash=get_password_hash(SUPERADMIN_PASS),
                role=Role.ADMINISTRADOR,         # Fallback role
                platform_role=PlatformRole.SUPERADMIN,
                is_active=True,
                branch_id=None # Superadmin floats or binds to HQ logic potentially
            )
            db.add(sa)
            db.commit() # Commit to get ID
            db.refresh(sa)
            
            # Link Superadmin to Org as OWNER (optional but good for testing)
            # Check link
            link = db.query(UserOrganization).filter_by(user_id=sa.id, organization_id=org.id).first()
            if not link:
                 db.add(UserOrganization(user_id=sa.id, organization_id=org.id, org_role="OWNER"))
                 db.commit()

        # 3.2 Tenant Users
        users_def = [
            {"username": "admin",   "pwd": "123", "role": Role.ADMINISTRADOR, "branch": hq,    "pt_role": PlatformRole.NONE},
            {"username": "gerente", "pwd": "123", "role": Role.GERENTE,       "branch": store, "pt_role": PlatformRole.NONE},
            {"username": "cajero",  "pwd": "123", "role": Role.CAJERO,        "branch": store, "pt_role": PlatformRole.NONE},
        ]

        for u in users_def:
            user = db.query(User).filter(User.username == u["username"]).first()
            if not user:
                logger.info(f"Creating User: {u['username']} ({u['role']})")
                user = User(
                    username=u["username"],
                    full_name=f"Usuario {u['username'].capitalize()}",
                    password_hash=get_password_hash(u["pwd"]),
                    role=u["role"],
                    platform_role=u["pt_role"],
                    branch_id=u["branch"].id,
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)

                # Link to Organization
                db.add(UserOrganization(
                    user_id=user.id, 
                    organization_id=org.id, 
                    org_role="OWNER" if u["role"] == Role.ADMINISTRADOR else "MEMBER"
                ))
            else:
                logger.info(f"User {u['username']} exists.")

        # ---------------------------------------------------------
        # 4. SEED CATALOG (Departments, Brands, Products)
        # ---------------------------------------------------------
        logger.info("🌱 Seeding Catalog Data...")

        # 4.1 Departments
        depts_data = ["Bebidas", "Abarrotes", "Limpieza", "Farmacia"]
        dept_map = {}
        for d_name in depts_data:
            d = db.query(Department).filter_by(name=d_name, organization_id=org.id).first()
            if not d:
                d = Department(name=d_name, organization_id=org.id)
                db.add(d)
                db.commit()
                db.refresh(d)
            dept_map[d_name] = d

        # 4.2 Brands
        brands_data = ["Coca Cola", "Bimbo", "Sabritas", "Genérico", "Colgate"]
        brand_map = {}
        for b_name in brands_data:
            b = db.query(Brand).filter_by(name=b_name, organization_id=org.id).first()
            if not b:
                b = Brand(name=b_name, organization_id=org.id)
                db.add(b)
                db.commit()
                db.refresh(b)
            brand_map[b_name] = b

        # 4.3 Products
        products_def = [
            {
                "name": "Coca Cola Original 600ml", "dept": "Bebidas", "brand": "Coca Cola",
                "sku": "COCA600", "price": 18.00, "cost": 12.00, "stock": 100,
                "prices": [("Mayoreo", 12, 16.50)], "unit": "pza"
            },
            {
                "name": "Pan Blanco Grande", "dept": "Abarrotes", "brand": "Bimbo",
                "sku": "PAN001", "price": 52.00, "cost": 40.00, "stock": 40,
                "prices": [], "unit": "pza"
            },
            {
                "name": "Papas Sabritas Sal 45g", "dept": "Abarrotes", "brand": "Sabritas",
                "sku": "SAB001", "price": 19.00, "cost": 14.00, "stock": 60,
                "prices": [], "unit": "pza"
            },
            {
                "name": "Cloro 1L", "dept": "Limpieza", "brand": "Genérico",
                "sku": "CLORO1", "price": 15.00, "cost": 8.50, "stock": 200,
                "prices": [("Caja", 12, 12.00)], "unit": "lt"
            },
             {
                "name": "Pasta Dental Total 100ml", "dept": "Farmacia", "brand": "Colgate",
                "sku": "COLG01", "price": 45.00, "cost": 30.00, "stock": 85,
                "prices": [], "unit": "pza"
            }
        ]

        for p_data in products_def:
            # Check by SKU via Variant (globally unique logic per our previous checks, or per org)
            # Actually SKU is unique per org.
            # Let's check by name for simplicity in seed
            p_exist = db.query(Product).filter_by(name=p_data["name"], organization_id=org.id).first()
            
            if not p_exist:
                logger.info(f"Creating Product: {p_data['name']}")
                
                # Create Product
                prod = Product(
                    name=p_data["name"],
                    description=f"Producto de prueba {p_data['name']}",
                    unit=p_data["unit"],
                    brand_id=brand_map[p_data["brand"]].id,
                    department_id=dept_map[p_data["dept"]].id,
                    organization_id=org.id,
                    is_active=True,
                    approval_status='APPROVED'
                )
                db.add(prod)
                db.commit()
                db.refresh(prod)

                # Create Main Variant
                variant = ProductVariant(
                    product_id=prod.id,
                    sku=p_data["sku"],
                    variant_name="Estándar",
                    price=Decimal(p_data["price"]),
                    cost=Decimal(p_data["cost"]),
                    organization_id=org.id
                )
                db.add(variant)
                db.commit()
                db.refresh(variant)

                # Create Extra Prices
                for (pname, minq, price) in p_data["prices"]:
                    pp = ProductPrice(
                        variant_id=variant.id,
                        price_name=pname,
                        min_quantity=minq,
                        unit_price=Decimal(price),
                        organization_id=org.id
                    )
                    db.add(pp)

                # Add Stock to Store Branch
                stock = StockOnHand(
                    branch_id=store.id,
                    variant_id=variant.id,
                    qty_on_hand=Decimal(p_data["stock"]),
                    is_active=True,
                    organization_id=org.id
                )
                db.add(stock)

                # Add Branch Status (Enable in POS)
                pbs = ProductBranchStatus(
                    branch_id=store.id,
                    variant_id=variant.id,
                    is_active_pos=True,
                    is_visible=True,
                    organization_id=org.id
                )
                db.add(pbs)

                db.commit()
        logger.info("✅ Bootstrap Completed Successfully!")

    except Exception as e:
        logger.error(f"❌ Bootstrap Failed: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    init_users()
