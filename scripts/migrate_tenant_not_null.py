#!/usr/bin/env python
"""
Migración: `organization_id NOT NULL` en tablas de negocio.

Elimina el patrón legacy `OR organization_id IS NULL` que permitía que
filas huérfanas se filtraran en queries multi-tenant. QA validó 0 filas
con `organization_id IS NULL` en las 4 tablas cubiertas aquí.

Tablas afectadas:
    - products
    - departments
    - stock_on_hand
    - packaging_units

Uso:
    python scripts/migrate_tenant_not_null.py

Idempotente: re-ejecutarlo no rompe si las columnas ya son NOT NULL.

Si alguna tabla tiene filas NULL al momento de correr (regresión), la
migración aborta y reporta la tabla ofensora sin aplicar cambios
parciales (cada ALTER va en su propia transacción).
"""
from sqlalchemy import text

from app.core.database import engine

TABLES = ("products", "departments", "stock_on_hand", "packaging_units")


def main() -> None:
    with engine.connect() as conn:
        for table in TABLES:
            null_count = conn.execute(
                text(f"SELECT COUNT(*) FROM {table} WHERE organization_id IS NULL")
            ).scalar() or 0

            if null_count > 0:
                raise RuntimeError(
                    f"ABORT: {table} tiene {null_count} filas con organization_id NULL. "
                    "Limpia los datos antes de aplicar NOT NULL."
                )

            print(f"→ {table}: 0 filas NULL — aplicando NOT NULL...")
            conn.execute(
                text(f"ALTER TABLE {table} ALTER COLUMN organization_id SET NOT NULL")
            )
            conn.commit()
            print(f"✓ {table}.organization_id ahora NOT NULL")

    print("\nMigración completa.")


if __name__ == "__main__":
    main()
