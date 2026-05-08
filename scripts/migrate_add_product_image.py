"""
Migration: Add image_url column to products table
Run once: python scripts/migrate_add_product_image.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'image_url'
        """))
        if result.fetchone():
            print("✓ Column 'image_url' already exists in 'products' — nothing to do.")
            return

        conn.execute(text("ALTER TABLE products ADD COLUMN image_url VARCHAR;"))
        conn.commit()
        print("✓ Column 'image_url' added to 'products' table successfully.")

if __name__ == "__main__":
    run()
