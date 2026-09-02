"""Columna `created_by_user_id` en cash_movements.

Los movimientos no registraban quien los creaba. Las filas historicas quedan
en NULL a proposito: inventarles un autor seria peor que reconocer que no se
sabe.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text

from app.core.database import engine


def main() -> None:
    with engine.begin() as conn:
        # SQLite (usada en pruebas) no soporta la clausula
        # "ADD COLUMN IF NOT EXISTS" — solo Postgres la entiende. Se checa
        # la columna via el inspector para que el script sea idempotente
        # en ambos motores.
        columnas = {c["name"] for c in inspect(conn).get_columns("cash_movements")}
        if "created_by_user_id" not in columnas:
            if engine.dialect.name == "postgresql":
                conn.execute(text(
                    "ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER"
                ))
            else:
                conn.execute(text(
                    "ALTER TABLE cash_movements ADD COLUMN created_by_user_id INTEGER"
                ))
        if engine.dialect.name == "postgresql":
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE cash_movements
                        ADD CONSTRAINT cash_movements_created_by_user_id_fkey
                        FOREIGN KEY (created_by_user_id) REFERENCES users(id);
                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_cash_movements_created_by "
                "ON cash_movements (created_by_user_id)"
            ))
    print("[migrate] OK — cash_movements.created_by_user_id listo.")


if __name__ == "__main__":
    main()
