# scripts/reset_db.py
import sys
import os
import logging

# Add project root to path
sys.path.append(os.getcwd())

from app.core.database import engine, Base
import app.models  # Import all models to register them with Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_database():
    """
    DROPS all tables and Re-creates them.
    WARNING: THIS WILL DELETE ALL DATA.
    """
    confirm = input("⚠️  WARNING: This will DELETE ALL DATA in the database. Are you sure? (yes/no): ")
    if confirm.lower() != "yes":
        logger.info("Operation cancelled.")
        return

    try:
        logger.info("🔥 Dropping all tables...")
        # Reflect logic if needed, but drop_all works on registered metadata
        Base.metadata.drop_all(bind=engine)
        logger.info("✅ All tables dropped.")
        
        logger.info("🏗️  Re-creating schema...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Schema re-created successfully.")

    except Exception as e:
        logger.error(f"❌ Error resetting database: {e}")

if __name__ == "__main__":
    reset_database()
