"""
Migration: Add open_drawer_on_print column to branches.

Run once per environment (dev, QA, prod):
    python scripts/migrate_add_branch_open_drawer.py

Behavior:
  1. Checks information_schema. If column exists, exits as no-op.
  2. Adds `open_drawer_on_print BOOLEAN NOT NULL DEFAULT TRUE` to branches.

IMPORTANT — deploy order:
  Este script DEBE correr en cada ambiente ANTES de desplegar el código ORM
  que declara Branch.open_drawer_on_print; de lo contrario queries contra
  branches fallan con UndefinedColumn.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text


CHECK_QUERY = text("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'open_drawer_on_print'
""")


def run():
    with engine.connect() as conn:
        exists = conn.execute(CHECK_QUERY).fetchone()
        if exists:
            print("✓ branches.open_drawer_on_print already exists — nothing to do.")
            return

        conn.execute(text(
            "ALTER TABLE branches ADD COLUMN open_drawer_on_print BOOLEAN NOT NULL DEFAULT TRUE;"
        ))
        conn.commit()
        print("✓ Added column branches.open_drawer_on_print (BOOLEAN NOT NULL DEFAULT TRUE).")


if __name__ == "__main__":
    run()
