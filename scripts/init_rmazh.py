
import sys
import os
import random
import logging
from datetime import datetime
from decimal import Decimal

# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.security import get_password_hash
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

def init_rmazh():
    """
    RMAZH Client Seeder
    Populates specific Organization 'Rmazh' with real-world branches and users.
    """
    db = SessionLocal()
    try:
        logger.info("🚀 Starting RMAZH Seeding...")

        # ==========================================
        # 1. Organization
        # ==========================================
        org_name = "Rmazh"
        org = db.query(Organization).filter_by(name=org_name).first()
        if not org:
            logger.info(f"Creating Organization: {org_name}")
            org = Organization(
                name=org_name,
                legal_name="Rmazh Comercializadora SA de CV",
                tax_id="XAXX010101000", # Placeholder or Real if provided
                industry_type=IndustryType.RETAIL_CHAIN,
                status="ACTIVE",
                plan="ENTERPRISE",
                is_active=True
            )
            db.add(org)
            db.commit()
            db.refresh(org)

        # ==========================================
        # 2. Branches (Real Locations)
        # ==========================================
        # Format: Name, Address, Lat, Lon, Type
        branches_data = [
            ("Matriz HQ", "San Miguel, La Merced, Centro, Cuauhtémoc, 06080 CDMX", 19.42545603, -99.13138595, BranchType.HQ),
            ("Mesones 144", "Calle de Mesones 144, Centro Histórico, CDMX", 19.42814136, -99.13110861, BranchType.STORE),
            ("Correo", "Calle de Mesones 152-local b, Centro Histórico, CDMX", 19.42813099, -99.130604, BranchType.STORE),
            ("Correo Mayor 92-1", "Calle del Correo Mayor 92-1, Centro, CDMX", 19.42840172, -99.13058336, BranchType.STORE),
            ("Correo Mayor 78-1", "Calle del Correo Mayor 72, Centro, CDMX", 19.42930372, -99.13047739, BranchType.STORE),
            ("Cruces 44", "Regina & Las Cruces, Centro Histórico, CDMX", 19.42699255, -99.12965959, BranchType.STORE),
            ("Jesus Maria 120", "Jesús María 119, Centro Histórico, CDMX", 19.42744727, -99.12862526, BranchType.STORE),
            ("Juárez 109", "Plaza del Centro, Av. Benito Juárez Garcia Sur 109, Toluca", 19.29123778, -99.6544541, BranchType.STORE),
            ("Independencia 301", "Av. Independencia 301, Barrio de Sta Clara, Toluca", -99.6525163, -99.6525163, BranchType.STORE),
        ]

        branch_objs = {}
        for name, address, lat, lon, b_type in branches_data:
            branch = db.query(Branch).filter_by(name=name, organization_id=org.id).first()
            if not branch:
                # logger.info(f"Creating Branch: {name}")
                branch = Branch(
                    name=name,
                    branch_type=b_type,
                    organization_id=org.id,
                    address=address,
                    latitude=lat,
                    longitude=lon,
                    city="CDMX" if "CDMX" in address else "Toluca",
                    country="MX",
                    timezone="America/Mexico_City",
                    is_active=True
                )
                db.add(branch)
                db.commit()
                db.refresh(branch)
            branch_objs[name] = branch

        # ==========================================
        # 3. Users (Specific Rosters)
        # ==========================================
        # Name, P_Last, S_Last, Nationality, DOB, Phone, Email
        users_raw = [
            ("Jorge", "Maya", "Reyes", "Mexicana", None, "5633725660", None),
            ("Astrid Valentina", "Lemus", "Gil", "Venezolana", "30/10/2002", "+52 55 5157 1197", "gilv2519@gmail.com"),
            ("Gisel adriana", "Pérez", "Marquez", "Venezolana", "21/5/2001", "9624853850", "Giselperezmarquez@gmail.com"),
            ("Jordan Michel", "Melo", "Valdez", "Mexicana", "27/5/1999", "5648018379", "melovaldezjordan@gmail.com"),
            ("Ana stella", "Rodríguez", "Fandiño", "Colombiana", "22/2/2026", "9619029152", "fidelinafandino81@gmail.com"),
            ("Kimberly Dayana", "Pérez", "Briceño", "Venezolana", "2/5/1990", "5514922779", "kimperezbrice@gmail.com"),
            ("Chakti Dannai", "Mandujano", "Hernandez", "Mexicana", "25/9/2004", "5630342856", None),
            ("Dulce Claudia", "Flores", "ximello", "Mexicana", "15/1/2001", "5551277793", "floresximellodulce@gmail.com"),
        ]
        
        # Default Branch for them? Let's assign them randomly or to HQ if not specified.
        # Assigning to HQ for now as default.
        default_branch = branch_objs["Matriz HQ"]

        for idx, (first, p_last, s_last, nation, dob, phone, email) in enumerate(users_raw):
            full_name = f"{first} {p_last} {s_last}"
            # Username generation: first.last (lowercase, no accents)
            clean_first = first.split()[0].lower()
            clean_last = p_last.lower()
            username = f"{clean_first}.{clean_last}"
            
            # Uniqueness
            if db.query(User).filter_by(username=username).first():
                username = f"{username}{idx}"

            role = Role.GERENTE if idx == 0 else Role.VENDEDOR # First one Manager
            
            u = db.query(User).filter_by(username=username).first()
            if not u:
                # logger.info(f"Creating User: {username} ({full_name})")
                u = User(
                    username=username,
                    password_hash=get_password_hash("123"),
                    full_name=full_name,
                    role=role,
                    branch_id=default_branch.id,
                    is_active=True,
                    
                    # New Fields
                    nationality=nation,
                    dob=dob,
                    phone=phone,
                    personal_email=email,
                    email=f"{username}@rmazh.com", # System email
                    face_encoding=[0.0]*128 if idx < 3 else None # Dummy encoding for top 3 users
                )
                db.add(u)
                db.flush()
                
                db.add(UserOrganization(
                    user_id=u.id,
                    organization_id=org.id,
                    org_role="MEMBER"
                ))
        
        db.commit()

        # ==========================================
        # 4. Master Data & Products (Generic)
        # ==========================================
        # Just creating a couple of products for functionality
        dept = db.query(Department).filter_by(name="General", organization_id=org.id).first()
        if not dept:
            dept = Department(name="General", organization_id=org.id)
            db.add(dept)
            db.commit()
            
        prod_name = "Producto Demo Rmazh"
        if not db.query(Product).filter_by(name=prod_name, organization_id=org.id).first():
            p = Product(name=prod_name, unit="PZA", department_id=dept.id, has_variants=True, organization_id=org.id, is_active=True)
            db.add(p)
            db.flush()
            
            v = ProductVariant(product_id=p.id, sku="SKU-RMAZH-001", variant_name="Standard", price=100.00, cost=50.00, organization_id=org.id)
            db.add(v)
            db.flush()
            
            # Stock in all branches
            for b in branch_objs.values():
                db.add(ProductBranchStatus(variant_id=v.id, branch_id=b.id, is_active_pos=True, organization_id=org.id))
                db.add(StockOnHand(variant_id=v.id, branch_id=b.id, qty_on_hand=100, organization_id=org.id))
        
        db.commit()

        # ==========================================
        # 5. Customers (Blockchain Ready)
        # ==========================================
        cust_name = "Cliente Blockchain 1"
        if not db.query(Customer).filter_by(name=cust_name, organization_id=org.id).first():
            c = Customer(
                name=cust_name,
                organization_id=org.id,
                has_credit=True,
                blockchain_id="0x123abc...",
                loyalty_tier="GOLD",
                cashback_balance=50.00
            )
            db.add(c)
            db.commit()

        logger.info("✅ RMAZH Seeding Completed Successfully!")

    except Exception as e:
        logger.error(f"❌ Error seeding RMAZH: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_rmazh()
