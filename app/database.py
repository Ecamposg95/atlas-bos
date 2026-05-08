from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

import os
from dotenv import load_dotenv

load_dotenv() # Load variables from .env

# Obtener URL desde variable de entorno (Railway) o usar SQLite por defecto
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# Ajuste para Heroku/Railway que a veces envían postgres:// en lugar de postgresql://
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
# connect_args={"check_same_thread": False} es necesario solo para SQLite
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {"check_same_thread": False}

def _safe_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        # Bad env var value should not crash startup — log via stderr and use default.
        import sys
        print(f"[database] {name}={raw!r} no es entero — usando default {default}", file=sys.stderr)
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

# Habilitar claves foráneas para SQLite
from sqlalchemy import event
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in SQLALCHEMY_DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ESTA es la Base que todos los modelos deben usar
Base = declarative_base()

# Dependencia para obtener la DB en los endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()