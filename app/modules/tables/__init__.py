"""Atlas BOS module - tables.

DOMAIN: Mesas (Dining areas, tables, floor plan, open checks)
STATUS: Stable

Used by presets: ATLAS_ONE_RESTAURANT, ATLAS_ONE_BAR.

Dine-in floor management. A table holds an open check by referencing the
existing `ParkedTicket` (cuenta abierta = carrito JSONB). When the parked
ticket converts to a sale, `app/subscribers/tables.py` frees the table.
"""
