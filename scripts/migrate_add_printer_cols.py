"""
Migration: Add printer_cols override column to branches.

Run once per environment (dev, QA, prod): python scripts/migrate_add_printer_cols.py

Behavior:
  1. Checks information_schema for the column. If present, exits as no-op.
  2. Adds `printer_cols INTEGER NULL` to branches. NULL = use PosPrinter default
     based on paper_width_mm.

IMPORTANT — deploy order:
  This migration MUST run on every environment BEFORE the ORM code that
  declares Branch.printer_cols is deployed. Declaring the column in the model
  while it is missing from the DB causes UndefinedColumn errors on every
  query against branches (see revert d678e83).
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text


CHECK_QUERY = text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'printer_cols'
""")


def run():
    with engine.connect() as conn:
        exists = conn.execute(CHECK_QUERY).fetchone()
        if exists:
            print("✓ branches.printer_cols already exists — nothing to do.")
            return

        conn.execute(text("ALTER TABLE branches ADD COLUMN printer_cols INTEGER;"))
        conn.commit()
        print("✓ Added column branches.printer_cols (INTEGER NULL).")


if __name__ == "__main__":
    run()
