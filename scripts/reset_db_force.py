
import sys
import os
import logging

sys.path.append(os.getcwd())
from app.core.database import engine, Base
import app.models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_force():
    try:
        logger.info("🔥 FORCE DROPPING all tables...")
        Base.metadata.drop_all(bind=engine)
        logger.info("✅ All tables dropped.")
        
        logger.info("🏗️  Re-creating schema...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Schema re-created successfully.")
    except Exception as e:
        logger.error(f"❌ Error: {e}")

if __name__ == "__main__":
    reset_force()
