"""Atlas BOS module - kitchen.

DOMAIN: Cocina / KDS (Stations, Routes, Kitchen tickets, Item bumping)
STATUS: Stable

Used by presets: ATLAS_ONE_RESTAURANT, ATLAS_ONE_CAFE.

Kitchen Display System: the POS/Mesas fires a ticket ("Enviar a cocina"),
items are routed to a station by their product department, and the kitchen
bumps items/tickets through the prep lifecycle.
"""
