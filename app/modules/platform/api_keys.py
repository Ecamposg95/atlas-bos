"""S0.1 shim — re-exports api_key helpers from legacy app.security.api_keys.

Single consumer is `app/routers/platform/api_keys.py`. Body moves here in S0.3.
"""
from app.security.api_keys import (  # noqa: F401
    _sha256_hex,
    generate_api_key,
    hash_api_key,
    verify_api_key,
)
