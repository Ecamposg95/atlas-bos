"""Alembic environment for Atlas BOS.

Reads the SQLAlchemy URL + Base from `app.core.database` so migrations target
the same DB the app talks to. Imports `app.models` so every model registers
itself on `Base.metadata` before autogenerate inspects it.
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# ---------------------------------------------------------------------------
# Path bootstrap: alembic/env.py lives one level below the repo root, so we
# need the repo root on sys.path to import the `app` package.
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# ---------------------------------------------------------------------------
# Import application Base + register all models against Base.metadata.
# The `app.models` import has the side-effect of running every model module's
# top-level code, which is what binds them to Base.metadata.
# ---------------------------------------------------------------------------
import app.models  # noqa: F401  (registers all models on Base.metadata)
from app.core.database import SQLALCHEMY_DATABASE_URL, Base

# ---------------------------------------------------------------------------
# Alembic Config object provides access to values within alembic.ini.
# ---------------------------------------------------------------------------
config = context.config

# Inject the runtime DB URL into the config so engine_from_config picks it up.
# This overrides any value (or empty string) in alembic.ini's sqlalchemy.url.
config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)

# Configure Python logging per alembic.ini, if a config file is set.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for 'autogenerate' support.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine; calls to
    context.execute() emit the SQL to the script output instead of the DB.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode with a live Engine + Connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        is_sqlite = connection.dialect.name == "sqlite"
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            # SQLite needs batch mode for ALTER TABLE on most schema changes.
            render_as_batch=is_sqlite,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
