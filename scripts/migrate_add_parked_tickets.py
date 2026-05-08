"""Track 2 — Crea tabla parked_tickets para pausados.

Pausados NO son ventas: tabla aparte para que NO consuman folio, NO
descuenten inventario y NO contaminen el historial de ventas. Permite
hand-off entre PCs de la misma sucursal.

Idempotente.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.database import engine


DDL = """
CREATE TABLE IF NOT EXISTS parked_tickets (
    id VARCHAR(36) PRIMARY KEY,
    organization_id INTEGER REFERENCES organization(id),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    customer_id INTEGER REFERENCES customers(id),
    cart_json JSONB NOT NULL,
    notes VARCHAR,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_parked_tickets_branch_id
    ON parked_tickets (branch_id);
CREATE INDEX IF NOT EXISTS ix_parked_tickets_user_id
    ON parked_tickets (user_id);
CREATE INDEX IF NOT EXISTS ix_parked_tickets_organization_id
    ON parked_tickets (organization_id);
CREATE INDEX IF NOT EXISTS ix_parked_tickets_expires_at
    ON parked_tickets (expires_at);
"""


def main() -> int:
    with engine.begin() as conn:
        conn.execute(text(DDL))
    print("[OK] parked_tickets creada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
