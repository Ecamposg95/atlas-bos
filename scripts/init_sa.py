# scripts/init_sa.py
import sys
import os
import logging

# Add project root to path
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.users import User, Role, PlatformRole, UserOrganization
from app.models.organization import Organization, Branch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_superadmin():
    """
    Minimalist Script: Creates ONLY the Super Admin user
    (and necessary dependencies: Org + Branch).
    """
    db = SessionLocal()
    try:
        logger.info("🛡️ Initializing Super Admin Protocol...")

        # 1. Ensure Default Organization Exists (Dependency)
        org = db.query(Organization).first()
        if not org:
            logger.info("Creating default organization for SA context...")
            org = Organization(
                name="Atlas System Root",
                legal_name="System Root",
                industry_type=None, # Explicitly None to trigger Startup Flow if testing fresh
            )
            db.add(org)
            db.commit()
            db.refresh(org)
        
        # 2. Ensure Default Branch Exists (Dependency for User)
        branch = db.query(Branch).filter(Branch.organization_id == org.id).first()
        if not branch:
            logger.info("Creating default branch for SA context...")
            branch = Branch(
                name="Main Node", 
                address="System", 
                organization_id=org.id,
                is_active=True
            )
            db.add(branch)
            db.commit()
            db.refresh(branch)

        # 3. Create Super Admin User
        username = "superadmin"
        password = "784512" # DEV PASSWORD
        
        sa = db.query(User).filter(User.username == username).first()
        if not sa:
            logger.info(f"Creating User: {username} ...")
            sa = User(
                username=username,
                password_hash=get_password_hash(password),
                full_name="Platform Super Admin",
                role=Role.ADMINISTRADOR,
                platform_role=PlatformRole.SUPERADMIN,
                branch_id=branch.id,
                is_active=True
            )
            db.add(sa)
            db.flush() # Generate ID
            
            # Link to Org as Owner
            db.add(UserOrganization(
                user_id=sa.id,
                organization_id=org.id,
                org_role="OWNER",
                is_active=True
            ))
            
            db.commit()
            logger.info(f"✅ User '{username}' created successfully! Password: '{password}'")
        else:
            logger.info(f"ℹ️ User '{username}' already exists.")
            # [TESTING HELP] Force Reset for Startup Flow
            # Get the first organization link
            assoc = db.query(UserOrganization).filter(UserOrganization.user_id == sa.id).first()
            if assoc:
                org = db.query(Organization).get(assoc.organization_id)
                if org:
                    org.industry_type = None 
                    db.commit()
                    logger.info(f"🔄 Organization '{org.name}' reset to 'Unconfigured' to test Startup Flow.")

    except Exception as e:
        logger.error(f"❌ Error in init_sa: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_superadmin()
