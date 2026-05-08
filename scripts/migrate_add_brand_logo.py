"""
Migration: Add logo_url column to brands table
Run once: python scripts/migrate_add_brand_logo.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'brands' AND column_name = 'logo_url'
        """))
        if result.fetchone():
            print("✓ Column 'logo_url' already exists in 'brands' — nothing to do.")
            return

        conn.execute(text("ALTER TABLE brands ADD COLUMN logo_url VARCHAR;"))
        conn.commit()
        print("✓ Column 'logo_url' added to 'brands' table successfully.")

if __name__ == "__main__":
    run()
