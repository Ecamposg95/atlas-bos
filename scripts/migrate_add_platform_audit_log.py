"""
Migration: crea la tabla `platform_audit_log` si no existe.
Idempotente — se puede correr múltiples veces.

Uso: python scripts/migrate_add_platform_audit_log.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import engine, Base
from app.models.platform import PlatformAuditLog  # noqa: F401  (registra modelo)


def run() -> None:
    print(f"[migrate] Asegurando tabla platform_audit_log en {engine.url.database}...")
    PlatformAuditLog.__table__.create(bind=engine, checkfirst=True)
    print("[migrate] OK — tabla lista.")


if __name__ == "__main__":
    run()
