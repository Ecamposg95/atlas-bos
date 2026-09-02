"""Columna `client_uuid` en sales_documents + indice unico por organizacion.

El POS genera un identificador por intento de cobro y lo reenvia igual en cada
reintento (cola offline / boton "Reintentar ahora"). El checkout lo usa para
devolver la venta original en vez de duplicarla.

El indice unico es la garantia dura: aunque dos peticiones concurrentes pasen
a la vez la consulta de idempotencia, solo una podra insertar.

Idempotente: IF NOT EXISTS en ambos pasos.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.core.database import engine


def main() -> None:
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS client_uuid VARCHAR(64)"
        ))
        print("[migrate] columna client_uuid lista.")

        if engine.dialect.name != "postgresql":
            print("[migrate] dialecto no-Postgres; se omite el indice parcial.")
            return

        dup = conn.execute(text("""
            SELECT organization_id, client_uuid, count(*)
            FROM sales_documents
            WHERE client_uuid IS NOT NULL AND deleted_at IS NULL
            GROUP BY organization_id, client_uuid HAVING count(*) > 1
        """)).fetchall()
        if dup:
            print("[migrate] HAY client_uuid REPETIDOS; no se crea el indice:")
            for org, cu, n in dup:
                print(f"    org {org} · {cu}: {n} ventas")
            raise SystemExit(1)

        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_org_client_uuid
            ON sales_documents (organization_id, client_uuid)
            WHERE client_uuid IS NOT NULL AND deleted_at IS NULL
        """))
        print("[migrate] OK — uq_sales_org_client_uuid listo.")


if __name__ == "__main__":
    main()
