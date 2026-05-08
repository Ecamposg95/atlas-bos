"""
Migration: crea la tabla `api_key` si no existe (Sprint 2 · H1).
Idempotente — se puede correr múltiples veces.

Uso: python scripts/migrate_add_api_keys.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import engine
from app.models.platform import ApiKey  # noqa: F401  (registra modelo)


def run() -> None:
    print(f"[migrate] Asegurando tabla api_key en {engine.url.database}...")
    ApiKey.__table__.create(bind=engine, checkfirst=True)
    print("[migrate] OK — tabla lista.")


if __name__ == "__main__":
    run()
