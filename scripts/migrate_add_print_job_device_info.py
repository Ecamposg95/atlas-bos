"""Track 4 — Añade device_id, device_fingerprint, client_ip a print_jobs.

Permite tracking per-PC para el modelo "1 cajero en N PCs, cada PC con
su propia impresora local". Útil para troubleshoot "qué PC imprimió qué".

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
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(128);
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS client_ip VARCHAR(64);
CREATE INDEX IF NOT EXISTS ix_print_jobs_device_id ON print_jobs (device_id);
"""


def main() -> int:
    with engine.begin() as conn:
        conn.execute(text(DDL))
    print("[OK] print_jobs device tracking columns aplicadas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
