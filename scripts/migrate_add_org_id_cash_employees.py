"""Añade organization_id a cash_sessions y employees, con backfill vía Branch.

Multi-tenancy: ambas tablas estaban sin organization_id, obligando a filtrar
por subquery sobre Branch. Este script:

1. ALTER TABLE cash_sessions ADD COLUMN organization_id (nullable, FK).
2. ALTER TABLE employees ADD COLUMN organization_id (nullable, FK).
3. UPDATE cash_sessions.organization_id desde branches.organization_id.
4. UPDATE employees.organization_id desde branches.organization_id (si tienen base_branch_id).
5. CREATE INDEX para queries por organization_id.

Idempotente: usa IF NOT EXISTS / WHERE organization_id IS NULL.

Uso: python scripts/migrate_add_org_id_cash_employees.py
(También se puede invocar desde scripts/migrate.py master runner.)

**No hace la columna NOT NULL** — eso se pospone a Sprint 9 cuando se haya
confirmado que todos los empleados sin base_branch_id fueron resueltos
manualmente.
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
-- 1. cash_sessions.organization_id
ALTER TABLE cash_sessions
    ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organization(id);

-- 2. employees.organization_id
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organization(id);
"""

BACKFILL = """
-- 3. Backfill cash_sessions desde branches
UPDATE cash_sessions cs
SET organization_id = b.organization_id
FROM branches b
WHERE cs.branch_id = b.id
  AND cs.organization_id IS NULL;

-- 4. Backfill employees desde base_branch_id (si existe)
UPDATE employees e
SET organization_id = b.organization_id
FROM branches b
WHERE e.base_branch_id = b.id
  AND e.organization_id IS NULL
  AND e.base_branch_id IS NOT NULL;
"""

INDEXES = """
-- 5. Índices para queries por org
CREATE INDEX IF NOT EXISTS ix_cash_sessions_organization_id
    ON cash_sessions (organization_id);
CREATE INDEX IF NOT EXISTS ix_employees_organization_id
    ON employees (organization_id);
"""


def main() -> int:
    with engine.begin() as conn:
        print("[1/5] ALTER TABLE add column cash_sessions.organization_id + employees.organization_id…")
        conn.execute(text(DDL))

        print("[2/5] Backfill cash_sessions.organization_id desde branches.organization_id…")
        result_cs = conn.execute(text(
            "UPDATE cash_sessions cs "
            "SET organization_id = b.organization_id "
            "FROM branches b "
            "WHERE cs.branch_id = b.id AND cs.organization_id IS NULL "
            "RETURNING cs.id"
        ))
        cs_count = len(result_cs.fetchall())
        print(f"     → {cs_count} cash_sessions actualizadas.")

        print("[3/5] Backfill employees.organization_id desde branches.organization_id…")
        result_emp = conn.execute(text(
            "UPDATE employees e "
            "SET organization_id = b.organization_id "
            "FROM branches b "
            "WHERE e.base_branch_id = b.id "
            "AND e.organization_id IS NULL "
            "AND e.base_branch_id IS NOT NULL "
            "RETURNING e.id"
        ))
        emp_count = len(result_emp.fetchall())
        print(f"     → {emp_count} employees actualizados.")

        # Check employees sin branch asignado (no se pueden backfill-ear)
        orphans = conn.execute(text(
            "SELECT COUNT(*) FROM employees "
            "WHERE organization_id IS NULL"
        )).scalar()
        if orphans:
            print(f"[WARN] {orphans} employees sin organization_id (no tienen base_branch_id). "
                  "Resolver manualmente antes del Sprint 9 (NOT NULL).")

        print("[4/5] Crear índices…")
        conn.execute(text(INDEXES))

    print("[OK] Migración aplicada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
