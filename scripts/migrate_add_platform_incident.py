"""
Migration: crea la tabla `platform_incident` si no existe.
Idempotente — se puede correr múltiples veces.

Uso: python scripts/migrate_add_platform_incident.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import engine
from app.models.platform import PlatformIncident  # noqa: F401  (registra modelo)


def run() -> None:
    print(f"[migrate] Asegurando tabla platform_incident en {engine.url.database}...")
    PlatformIncident.__table__.create(bind=engine, checkfirst=True)
    print("[migrate] OK — tabla lista.")


if __name__ == "__main__":
    run()
