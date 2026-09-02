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

Despliegue en caliente (ronda de correcciones 1): la tienda cobra en vivo
mientras esto corre. La DDL (ALTER/FK/indice) toma un candado exclusivo sobre
payments que bloquea los INSERT de cobros nuevos hasta el COMMIT. Por eso:

1. Se fija `lock_timeout` antes de la DDL — si el candado no se consigue en
   unos segundos (p.ej. porque hay otra transaccion larga viva sobre
   payments o cash_sessions), el ALTER falla ruidosamente en vez de encolar
   los cobros indefinidamente. La transaccion de DDL se revierte entera y es
   seguro reintentar.
2. El relleno historico corre DESPUES, en su propia transaccion, ya sin el
   candado exclusivo de la DDL. Es seguro partirlo asi porque el UPDATE solo
   toca filas con cash_session_id IS NULL — si se interrumpe a la mitad, un
   reintento retoma exactamente donde quedo, sin duplicar ni pisar nada.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app.core.database import engine

# Unos segundos bastan: en operacion normal el candado se consigue de
# inmediato. Si no, es porque algo mas lo tiene tomado y hay que enterarse
# ya, no encolar cobros detras de una espera indefinida.
LOCK_TIMEOUT = "5s"


def _run_ddl() -> None:
    """ALTER + FK + indice, en su propia transaccion corta.

    Separada del relleno a proposito (ver docstring del modulo): esta es la
    unica parte que toma el candado exclusivo sobre payments.
    """
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            # Falla rapido y ruidoso en vez de encolar los INSERT de cobros
            # nuevos detras de una espera indefinida por el candado.
            conn.execute(text(f"SET lock_timeout = '{LOCK_TIMEOUT}'"))

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


def _run_relleno() -> tuple[int, int]:
    """UPDATE de relleno historico, en su propia transaccion (sin la DDL).

    Nunca pisa una atribucion ya escrita (el WHERE ... IS NULL protege) y es
    idempotente: una corrida a medias se retoma sin duplicar ni danar nada.
    """
    with engine.begin() as conn:
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

    return rellenados, pendientes


def main() -> None:
    try:
        _run_ddl()
    except OperationalError as exc:
        pgcode = getattr(getattr(exc, "orig", None), "pgcode", None)
        if pgcode == "55P03":  # lock_not_available
            print(
                "[migrate] ERROR — no se pudo tomar el candado sobre payments "
                f"en {LOCK_TIMEOUT} (lock_timeout agotado). Probablemente hay "
                "otra transaccion larga viva sobre payments o cash_sessions. "
                "La transaccion de DDL se revirtio por completo: no se "
                "aplico ningun cambio. Es seguro reintentar la migracion "
                "cuando esa transaccion termine.",
                file=sys.stderr,
            )
            raise SystemExit(1) from exc
        raise

    rellenados, pendientes = _run_relleno()

    print(f"[migrate] OK — payments.cash_session_id listo. "
          f"Rellenados: {rellenados}. Sin atribucion (nulo a proposito): {pendientes}.")


if __name__ == "__main__":
    main()
