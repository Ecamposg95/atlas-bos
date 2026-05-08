"""Master runner de migrations para Atlas.

Lista todos los `scripts/migrate_*.py` (excepto este archivo y el propio
migrate_add_schema_migrations.py, que se corre primero), revisa cuáles
aún no están registrados en la tabla `schema_migrations`, y los ejecuta
en orden alfabético. Cada ejecución se registra con el nombre del archivo
como id.

Uso:
    python scripts/migrate.py            # aplica pendientes
    python scripts/migrate.py --status   # solo lista estado
    python scripts/migrate.py --dry-run  # lista lo que correría sin ejecutar

Convenciones:
- Los scripts `migrate_*.py` deben ser idempotentes (IF NOT EXISTS, etc.)
  para que reintentos tras fallos no corrompan.
- El orden es alfabético puro — nombrar con prefijos `migrate_add_...`,
  `migrate_alter_...` para agrupar visualmente.
- Si necesitas forzar reaplicación, borra el row de `schema_migrations`
  y vuelve a correr `python scripts/migrate.py`.
"""
from __future__ import annotations

import argparse
import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT / "scripts"
ARCHIVE_DIR = SCRIPTS_DIR / "archive"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.core.database import engine


BOOTSTRAP_SCRIPT = "migrate_add_schema_migrations.py"
RUNNER_SCRIPT = "migrate.py"


def ensure_bootstrap() -> None:
    """Aplica migrate_add_schema_migrations.py antes de cualquier otra cosa."""
    bootstrap_path = SCRIPTS_DIR / BOOTSTRAP_SCRIPT
    if not bootstrap_path.exists():
        raise FileNotFoundError(
            f"Falta {bootstrap_path}. Es el bootstrap del registry de migrations."
        )
    result = subprocess.run(
        [sys.executable, str(bootstrap_path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise RuntimeError("Bootstrap de schema_migrations falló.")


def applied_ids() -> set[str]:
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id FROM schema_migrations")).all()
    return {r[0] for r in rows}


def discover_migrations() -> list[Path]:
    """Encuentra todos los scripts/migrate_*.py ejecutables (excluye bootstrap, runner y archive)."""
    results: list[Path] = []
    for p in sorted(SCRIPTS_DIR.glob("migrate_*.py")):
        if p.name in (BOOTSTRAP_SCRIPT, RUNNER_SCRIPT):
            continue
        if ARCHIVE_DIR in p.parents:
            continue
        results.append(p)
    return results


def record_applied(migration_id: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO schema_migrations (id) VALUES (:id) "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {"id": migration_id},
        )


def run_script(path: Path) -> None:
    result = subprocess.run(
        [sys.executable, str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    sys.stdout.write(result.stdout)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        raise RuntimeError(f"Migration {path.name} falló con código {result.returncode}.")


def status() -> int:
    applied = applied_ids()
    discovered = discover_migrations()
    print(f"{'STATE':<12} {'MIGRATION'}")
    print("-" * 60)
    for p in discovered:
        mark = "APPLIED" if p.name in applied else "PENDING"
        print(f"{mark:<12} {p.name}")
    pending = [p for p in discovered if p.name not in applied]
    print("-" * 60)
    print(f"Total: {len(discovered)} · Pendientes: {len(pending)}")
    return 0


def apply(dry_run: bool = False) -> int:
    ensure_bootstrap()
    applied = applied_ids()
    discovered = discover_migrations()
    pending = [p for p in discovered if p.name not in applied]

    if not pending:
        print("[OK] Nada pendiente — todas las migrations aplicadas.")
        return 0

    print(f"[INFO] {len(pending)} migrations pendientes:")
    for p in pending:
        print(f"  - {p.name}")

    if dry_run:
        print("[DRY-RUN] No se ejecutaron.")
        return 0

    print()
    for p in pending:
        print(f"[APPLY] {p.name}")
        try:
            run_script(p)
        except Exception as e:
            print(f"[FAIL] {p.name}: {e}")
            return 1
        record_applied(p.name)
        print(f"[OK] {p.name} aplicada y registrada.")

    print()
    print(f"[DONE] {len(pending)} migrations aplicadas correctamente.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Master runner de migrations Atlas.")
    parser.add_argument("--status", action="store_true", help="Solo lista estado, no ejecuta.")
    parser.add_argument("--dry-run", action="store_true", help="Lista pendientes sin ejecutar.")
    args = parser.parse_args()

    if args.status:
        return status()
    return apply(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
