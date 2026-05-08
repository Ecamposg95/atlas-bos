"""
Migration: crea la tabla `platform_announcement` si no existe.
Idempotente — se puede correr múltiples veces.

Uso: python scripts/migrate_add_platform_announcement.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import engine
from app.models.platform import PlatformAnnouncement  # noqa: F401  (registra modelo)


def run() -> None:
    print(f"[migrate] Asegurando tabla platform_announcement en {engine.url.database}...")
    PlatformAnnouncement.__table__.create(bind=engine, checkfirst=True)
    print("[migrate] OK — tabla lista.")


if __name__ == "__main__":
    run()
