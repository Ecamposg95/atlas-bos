"""Atlas BOS core/database — SQLAlchemy engine, Base, session, get_db dependency.

Phase 2 modularization (S0.2): this module now OWNS the database primitives.
The legacy `app/database.py` is a reverse-shim that re-exports from here.
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# DB URL: Railway DATABASE_URL or local SQLite fallback.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# Heroku/Railway compat: postgres:// → postgresql://
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "postgres://", "postgresql://", 1
    )

connect_args = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {"check_same_thread": False}


def _safe_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        import sys
        print(
            f"[database] {name}={raw!r} no es entero — usando default {default}",
            file=sys.stderr,
        )
        return default


engine_kwargs = {
    "connect_args": connect_args,
    "pool_pre_ping": True,
}
if "sqlite" not in SQLALCHEMY_DATABASE_URL:
    engine_kwargs.update({
        "pool_size": _safe_int_env("DB_POOL_SIZE", 20),
        "max_overflow": _safe_int_env("DB_MAX_OVERFLOW", 30),
        "pool_recycle": _safe_int_env("DB_POOL_RECYCLE", 1800),
        "pool_timeout": _safe_int_env("DB_POOL_TIMEOUT", 30),
    })

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in SQLALCHEMY_DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        # Espera el lock en vez de fallar con "database is locked" (evita flaky
        # bajo carga cuando varias conexiones comparten el DB en tests).
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
