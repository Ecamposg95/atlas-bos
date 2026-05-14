"""
Idempotent migration for Atlas One presets expansion (2026-05-13).

Adds:
1. Column `upsell_metadata JSON` to `modules` table.
2. Five new values to Postgres enum `industrytype`:
   ATLAS_ONE_RETAIL, ATLAS_ONE_BEAUTY, ATLAS_ONE_GASTRO,
   ATLAS_ONE_SERVICES, ATLAS_ONE_ENTERPRISE.

Safe to run multiple times. On SQLite the column ADD is conditional
(SQLite has no IF NOT EXISTS for columns); the enum ALTER is skipped
because SQLite stores enum values as plain strings.
"""
import logging
import os
import sys

sys.path.append(os.getcwd())

from sqlalchemy import inspect, text
from app.core.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NEW_INDUSTRY_VALUES = [
    "ATLAS_ONE_RETAIL",
    "ATLAS_ONE_BEAUTY",
    "ATLAS_ONE_GASTRO",
    "ATLAS_ONE_SERVICES",
    "ATLAS_ONE_ENTERPRISE",
]


def column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def add_upsell_metadata_column(conn):
    if column_exists(conn, "modules", "upsell_metadata"):
        logger.info("modules.upsell_metadata already exists — skipping ADD COLUMN")
        return
    dialect = conn.dialect.name
    if dialect == "postgresql":
        conn.execute(text("ALTER TABLE modules ADD COLUMN upsell_metadata JSON"))
    else:
        conn.execute(text("ALTER TABLE modules ADD COLUMN upsell_metadata JSON"))
    logger.info("Added modules.upsell_metadata")


def add_industrytype_values(conn):
    dialect = conn.dialect.name
    if dialect != "postgresql":
        logger.info(f"Dialect={dialect} — skipping enum ALTER (SQLite stores values as strings)")
        return
    for v in NEW_INDUSTRY_VALUES:
        conn.execute(text(f"ALTER TYPE industrytype ADD VALUE IF NOT EXISTS '{v}'"))
        logger.info(f"Ensured industrytype value: {v}")


def main():
    logger.info(f"Running migration on {engine.url.render_as_string(hide_password=True)}")
    with engine.begin() as conn:
        add_upsell_metadata_column(conn)
    # ALTER TYPE in Postgres cannot run inside a transaction block on some
    # versions; use AUTOCOMMIT.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        add_industrytype_values(conn)
    logger.info("✅ Migration complete")


if __name__ == "__main__":
    main()
