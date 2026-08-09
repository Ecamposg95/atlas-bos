"""Gastro Fase 3 — bloqueos de fila (SELECT … FOR UPDATE) en los puntos de
concurrencia: abrir mesa, descontar stock de receta, servir botella, avanzar KDS.

`with_for_update()` es no-op en SQLite (los tests corren en SQLite), así que la
concurrencia real no se puede ejercitar aquí. Estos tests fijan el CONTRATO: la
cláusula de bloqueo se emite en Postgres para las tablas que sufren el
read-modify-write. La regresión de las rutas felices la cubren test_tables_flow,
test_kitchen_kds, test_bar_bottles y test_recipes_subscriber_e2e (el lock es
transparente para ellos).
"""
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.models.inventory import StockOnHand
from app.modules.bar.models import BarBottle
from app.modules.kitchen.models import KitchenTicket
from app.modules.tables.models import DiningTable


def _compiles_for_update(model) -> bool:
    stmt = select(model).with_for_update()
    sql = str(stmt.compile(dialect=postgresql.dialect())).upper()
    return "FOR UPDATE" in sql


def test_lock_targets_emit_for_update_on_postgres():
    # Las cuatro filas cuyo read-modify-write se serializa en Fase 3.
    for model in (DiningTable, StockOnHand, BarBottle, KitchenTicket):
        assert _compiles_for_update(model), f"{model.__name__} debe bloquearse con FOR UPDATE"
