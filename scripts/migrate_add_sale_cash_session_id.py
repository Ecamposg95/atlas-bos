"""Track 1 — Añade sales_documents.cash_session_id (FK nullable, indexed).

Vincula cada venta a la sesión de caja OPEN del cajero al momento de
crearla. Permite cortes agrupados por session_id en lugar de filtros
temporales (necesario porque N PCs del mismo cajero comparten una sesión).

Idempotente. Se aplica vía:
    python scripts/migrate_add_sale_cash_session_id.py
o vía el master runner `scripts/migrate.py`.
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
ALTER TABLE sales_documents
    ADD COLUMN IF NOT EXISTS cash_session_id INTEGER REFERENCES cash_sessions(id);

CREATE INDEX IF NOT EXISTS ix_sales_documents_cash_session_id
    ON sales_documents (cash_session_id);
"""


def main() -> int:
    with engine.begin() as conn:
        conn.execute(text(DDL))
    print("[OK] sales_documents.cash_session_id listo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
