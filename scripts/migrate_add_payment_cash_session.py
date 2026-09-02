"""Columna `cash_session_id` en payments.

Hasta ahora el efectivo se atribuia por el DOCUMENTO de venta (sales_documents
.cash_session_id). Eso hace que liquidar una venta a credito en otro turno
mueva el efectivo de ayer al corte de hoy, y vacie retroactivamente un corte
ya cerrado. Esta columna permite atribuir el pago a la caja que de verdad
recibio el dinero.

El relleno historico es correcto: hasta este cambio el pago se creaba en la
misma transaccion que la venta, asi que la caja del documento SI era la caja
que recibio el dinero. Los pagos de ventas sin caja (sales_documents.
cash_session_id IS NULL) se quedan en NULL a proposito — no se les inventa
una sesion.
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
        columnas = {c["name"] for c in inspect(conn).get_columns("payments")}
        if "cash_session_id" not in columnas:
            if engine.dialect.name == "postgresql":
                conn.execute(text(
                    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS cash_session_id INTEGER"
                ))
            else:
                conn.execute(text(
                    "ALTER TABLE payments ADD COLUMN cash_session_id INTEGER"
                ))
        if engine.dialect.name == "postgresql":
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE payments
                        ADD CONSTRAINT payments_cash_session_id_fkey
                        FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id);
                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_payments_cash_session_id "
                "ON payments (cash_session_id)"
            ))

        # Relleno historico: la caja del documento era la caja que recibio
        # el dinero, porque el pago se creaba en la misma transaccion que la
        # venta. Solo se rellenan los pagos que aun estan en NULL, para que
        # el script sea idempotente.
        resultado = conn.execute(text("""
            UPDATE payments
            SET cash_session_id = (
                SELECT s.cash_session_id
                FROM sales_documents s
                WHERE s.id = payments.sales_document_id
            )
            WHERE payments.cash_session_id IS NULL
              AND payments.sales_document_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM sales_documents s
                  WHERE s.id = payments.sales_document_id
                    AND s.cash_session_id IS NOT NULL
              )
        """))
        rellenados = resultado.rowcount

        pendientes = conn.execute(text(
            "SELECT COUNT(*) FROM payments WHERE cash_session_id IS NULL"
        )).scalar()

    print(f"[migrate] OK — payments.cash_session_id listo. "
          f"Rellenados: {rellenados}. Sin atribucion (nulo a proposito): {pendientes}.")


if __name__ == "__main__":
    main()
