"""
Migration: crea las tablas `feature_flag` y `org_feature_override` si no existen.
Idempotente — se puede correr múltiples veces.

Uso: python scripts/migrate_add_feature_flags.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import engine
from app.models.platform import FeatureFlag, OrgFeatureOverride  # noqa: F401  (registra modelos)


def run() -> None:
    print(f"[migrate] Asegurando tablas feature_flag + org_feature_override en {engine.url.database}...")
    FeatureFlag.__table__.create(bind=engine, checkfirst=True)
    OrgFeatureOverride.__table__.create(bind=engine, checkfirst=True)
    print("[migrate] OK — tablas listas.")


if __name__ == "__main__":
    run()
