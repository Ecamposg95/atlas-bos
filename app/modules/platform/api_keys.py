"""Atlas BOS modules/platform/api_keys — API key helpers (server-to-server).

Full-key format: ``atlas_{prefix8}_{secret32}``. Hashing: SHA-256.

Single consumer is `app/routers/platform/api_keys.py`. The legacy
`app.security.api_keys` module is now a reverse-shim re-exporting from here.
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
    """Generate a new API key. Returns (full_key, prefix, hashed_key)."""
    prefix = secrets.token_hex(4)   # 8 hex chars
    secret = secrets.token_hex(16)  # 32 hex chars
    full_key = f"atlas_{prefix}_{secret}"
    hashed = _sha256_hex(full_key)
    return full_key, prefix, hashed


def hash_api_key(raw: str) -> str:
    """Compute the canonical SHA-256 hash for a raw API key string."""
    return _sha256_hex(raw)


def verify_api_key(raw: str, db: Session, client_ip: Optional[str] = None):
    """Validate an API key against the `api_key` table.

    Returns the `ApiKey` row if valid and not revoked, else None. Updates
    `last_used_at` (and optionally `last_used_ip`). Scaffolded for future
    middleware integration; not yet wired to the active auth flow.
    """
    if not raw or not isinstance(raw, str):
        return None

    # Defer model import to avoid cycles.
    from app.models.platform import ApiKey

    hashed = _sha256_hex(raw)
    row = (
        db.query(ApiKey)
        .filter(ApiKey.hashed_key == hashed, ApiKey.revoked_at.is_(None))
        .first()
    )
    if not row:
        return None

    try:
        row.last_used_at = datetime.now(timezone.utc)
        if client_ip:
            row.last_used_ip = client_ip
        db.commit()
    except Exception:
        db.rollback()

    return row
