"""
API key helpers for server-to-server authentication (Sprint 2 · H1).

Full-key format:
    atlas_{prefix8}_{secret32}
      - prefix8 : 8 hex chars, shown in the UI for display/audit purposes
      - secret32: 32 random hex chars, never stored in plaintext

Hashing:
    hashlib.sha256(full_key.encode()).hexdigest()

NOTE: `verify_api_key` is scaffolded for future wiring into a middleware.
It is NOT imported by `main.py` and does NOT affect the active auth flow.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session


def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def generate_api_key() -> Tuple[str, str, str]:
    """Generate a new API key.

    Returns (full_key, prefix, hashed_key).

    The caller is responsible for storing `prefix` + `hashed_key` and
    returning `full_key` to the user exactly once.
    """
    prefix = secrets.token_hex(4)          # 8 hex chars
    secret = secrets.token_hex(16)         # 32 hex chars
    full_key = f"atlas_{prefix}_{secret}"
    hashed = _sha256_hex(full_key)
    return full_key, prefix, hashed


def hash_api_key(raw: str) -> str:
    """Compute the canonical SHA-256 hash for a raw API key string."""
    return _sha256_hex(raw)


def verify_api_key(raw: str, db: Session, client_ip: Optional[str] = None):
    """Validate an API key against the `api_key` table.

    Returns the `ApiKey` row if the key is valid and not revoked, else None.
    Updates `last_used_at` (and optionally `last_used_ip`) atomically so
    callers can observe token usage. Intended for future wiring into a
    FastAPI dependency / middleware — currently NOT imported by main.py.
    """
    if not raw or not isinstance(raw, str):
        return None

    # Defer model import to avoid cycles and to keep this module import-safe
    # even when models haven't been registered yet.
    from app.models.platform import ApiKey

    hashed = _sha256_hex(raw)
    row = (
        db.query(ApiKey)
        .filter(ApiKey.hashed_key == hashed, ApiKey.revoked_at.is_(None))
        .first()
    )
    if not row:
        return None

    # Touch last_used_at / last_used_ip. Failure here should never leak.
    try:
        row.last_used_at = datetime.now(timezone.utc)
        if client_ip:
            row.last_used_ip = client_ip
        db.commit()
    except Exception:
        db.rollback()

    return row
