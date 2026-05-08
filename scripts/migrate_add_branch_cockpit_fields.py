"""
Migration: Add daily_sales_goal and closing_time to branches table.
Run once: python scripts/migrate_add_branch_cockpit_fields.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine
from sqlalchemy import text


def column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c
    """), {"t": table, "c": column})
    return r.fetchone() is not None


def run() -> None:
    with engine.connect() as conn:
        added = []
        if not column_exists(conn, "branches", "daily_sales_goal"):
            conn.execute(text("ALTER TABLE branches ADD COLUMN daily_sales_goal NUMERIC(12,2);"))
            added.append("daily_sales_goal")
        if not column_exists(conn, "branches", "closing_time"):
            conn.execute(text("ALTER TABLE branches ADD COLUMN closing_time TIME;"))
            added.append("closing_time")
        conn.commit()
        if added:
            print(f"Added columns to branches: {', '.join(added)}.")
        else:
            print("No-op: both columns already exist.")


if __name__ == "__main__":
    run()
