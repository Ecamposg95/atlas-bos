"""Atlas BOS core/security/config — JWT secret, algorithm, password hasher, oauth scheme."""
import os

from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext

_DEFAULT_SECRET = "atlas_erp_secret_key_change_me_in_prod"
SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_SECRET)
if SECRET_KEY == _DEFAULT_SECRET:
    import warnings
    warnings.warn(
        "SECRET_KEY no configurada — usando valor por defecto. "
        "Establece la variable de entorno SECRET_KEY en producción.",
        stacklevel=1,
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__ident="2a")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
