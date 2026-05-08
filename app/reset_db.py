
import sys
import os
import logging
from sqlalchemy import text

# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base
from app.models import * 
# Import the new modular scripts
from app.init_db import init_db
from scripts.init_users import init_users

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_db():
    print("\n🧨  DATABASE RESET TOOL  🧨")
    print("----------------------------")
    print("This script will:")
    print("1. TERMINATE all active connections to the database.")
    print("2. DROP the entire 'public' schema (Cascading).")
    print("3. RECREATE the 'public' schema.")
    print("4. Re-initialize tables (init_db) and Seed default data (init_users).")
    
    confirm = input("\n⚠️  ARE YOU SURE? (y/N): ")
    if confirm.lower() != 'y':
        logger.info("Operation cancelled.")
        return

    logger.info("Killing active connections...")
    try:
        with engine.connect() as connection:
            connection.execution_options(isolation_level="AUTOCOMMIT")
            
            # Kill other connections (PostgreSQL specific)
            try:
                connection.execute(text("""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                    AND pid <> pg_backend_pid()
                    AND state != 'idle';
                """))
                logger.info("Active connections terminated.")
            except Exception as e:
                logger.warning(f"Could not terminate connections (might be SQLite or permissions): {e}")

            logger.info("Dropping Schema 'public'...")
            try:
                connection.execute(text("DROP SCHEMA public CASCADE;"))
                logger.info("Recreating Schema 'public'...")
                connection.execute(text("CREATE SCHEMA public;"))
                
                # Optional: Restore default grants
                connection.execute(text("GRANT ALL ON SCHEMA public TO public;"))
            except Exception as e:
                 logger.warning(f"Schema drop failed (might be SQLite). Falling back to metadata.drop_all: {e}")
                 Base.metadata.drop_all(bind=engine)
            
    except Exception as e:
        logger.error(f"❌ Reset Steps Failed: {e}")
        return

    logger.info("🔄 Re-initializing Database Schema...")
    try:
        init_db() # Create Tables
        init_users() # Seed Data
    except Exception as e:
        logger.error(f"❌ Re-init Failed: {e}")

if __name__ == "__main__":
    reset_db()
