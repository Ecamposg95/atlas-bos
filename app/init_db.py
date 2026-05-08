
import sys
import os
import logging

# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base
# Import all models to ensure they are registered in Base.metadata
from app.models import * 

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    """
    Safe Database Initialization for Production (Railway).
    Only creates tables if they don't exist.
    Does NOT wipe data.
    """
    logger.info("Checking database schema...")
    try:
        # checkfirst=True is default, but explicit for clarity.
        # This will NOT drop anything. It only creates missing tables.
        Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info("✅ Database schema initialized successfully.")
    except Exception as e:
        logger.error(f"❌ Error initializing database schema: {e}")
        raise e

if __name__ == "__main__":
    init_db()