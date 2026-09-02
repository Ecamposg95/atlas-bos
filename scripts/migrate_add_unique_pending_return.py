"""Indice unico parcial: una sola devolucion PENDING por venta.

El guard en `crud/returns.create_return` es check-then-insert sin bloqueo: dos
peticiones concurrentes leen "no hay PENDING" y ambas insertan. De ahi salen
dos devoluciones por el total que, con la formula R-2 vieja, se aprobaban las
dos y sacaban el dinero dos veces.

La validacion al aprobar ya esta corregida; este indice cierra la puerta antes,
en la base, para que ningun camino futuro la reabra.

Idempotente: usa IF NOT EXISTS.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.core.database import engine

SQL = """
CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_return_pending_per_sale
ON sale_returns (sale_id)
WHERE status = 'PENDING' AND deleted_at IS NULL;
"""


def main() -> None:
    if engine.dialect.name != "postgresql":
        print("[migrate] dialecto no-Postgres; se omite el indice parcial.")
        return
    with engine.begin() as conn:
        duplicados = conn.execute(text("""
            SELECT sale_id, count(*) FROM sale_returns
            WHERE status = 'PENDING' AND deleted_at IS NULL
            GROUP BY sale_id HAVING count(*) > 1
        """)).fetchall()
        if duplicados:
            print("[migrate] HAY VENTAS CON MAS DE UNA DEVOLUCION PENDIENTE:")
            for sale_id, n in duplicados:
                print(f"    venta {sale_id}: {n} pendientes")
            print("[migrate] resuelvelas antes de crear el indice; no se aplica nada.")
            raise SystemExit(1)
        conn.execute(text(SQL))
    print("[migrate] OK — uq_sale_return_pending_per_sale listo.")


if __name__ == "__main__":
    main()
