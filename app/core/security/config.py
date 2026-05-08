"""S0.1 shim — JWT config + auth primitives. Body moves in S0.2."""
from app.security import (  # noqa: F401
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
    oauth2_scheme,
    pwd_context,
)
