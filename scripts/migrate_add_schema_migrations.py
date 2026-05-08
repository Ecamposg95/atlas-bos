"""Crea la tabla schema_migrations para registrar qué scripts migrate_*.py se han aplicado.

Idempotente: si la tabla ya existe, no hace nada.

Uso:
    python scripts/migrate_add_schema_migrations.py

Se puede correr manualmente o como parte del runner scripts/migrate.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.core.database import engine


DDL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_schema_migrations_applied_at
    ON schema_migrations (applied_at DESC);
"""


def main() -> int:
    with engine.begin() as conn:
        conn.execute(text(DDL))
    print("[OK] schema_migrations lista.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
