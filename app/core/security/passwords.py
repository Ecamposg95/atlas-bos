"""Atlas BOS core/security/passwords — bcrypt hashing helpers."""
from app.core.security.config import pwd_context


def verify_pin(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)
