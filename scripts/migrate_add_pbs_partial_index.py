#!/usr/bin/env python
"""
Migración: índice parcial en `product_branch_status` para acelerar
el filtro de visibilidad CAJERO/GERENTE.

Crea `ix_pbs_branch_active_pos` sobre `(branch_id, variant_id) WHERE is_active_pos = true`.
Complementa los índices existentes (`ix_product_branch_status_variant_id`,
`ix_product_branch_status_branch_id`, `uq_variant_branch_status`) — este
índice parcial permite escanear solo los PBS realmente visibles en POS,
que es el caso dominante de `query_visible_products`.

Uso:
    python scripts/migrate_add_pbs_partial_index.py

Idempotente (`CREATE INDEX IF NOT EXISTS`).
"""
from sqlalchemy import text

from app.database import engine

SQL = """
CREATE INDEX IF NOT EXISTS ix_pbs_branch_active_pos
    ON product_branch_status (branch_id, variant_id)
    WHERE is_active_pos = true;
"""


def main() -> None:
    print("→ Creando índice parcial ix_pbs_branch_active_pos...")
    with engine.connect() as conn:
        conn.execute(text(SQL))
        conn.commit()
    print("✓ Índice creado (o ya existía).")


if __name__ == "__main__":
    main()
