"""Phase 2 reverse-shim — body moved to ``app.modules.platform.api_keys`` in S0.3."""
from app.modules.platform.api_keys import (  # noqa: F401
    _sha256_hex,
    generate_api_key,
    hash_api_key,
    verify_api_key,
)
