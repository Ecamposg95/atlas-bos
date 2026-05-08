import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User  # asumiendo que app/models/__init__.py exporta User
from app.models.users import Role, PlatformRole

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


def verify_pin(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales no válidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. Check Header Token
    if not token:
        # 2. Fallback to Cookie
        token = request.cookies.get("access_token")
        if token and token.startswith("Bearer "):
            token = token.split(" ")[1]
            
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        
        # Extract context
        ctx_id = payload.get("ctx_id")
        ctx_type = payload.get("ctx_type")
        
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    # Attach context to request state (more reliable than patching user object)
    request.state.ctx_id = ctx_id
    request.state.ctx_type = ctx_type

    return user



async def get_current_user_from_cookie(request: Request, db: Session = Depends(get_db)):
    """
    Extracts user from HttpOnly cookie for Server-Side Rendering (HTML) routes.
    """
    token = request.cookies.get("access_token")
    if not token:
        # No cookie found -> Redirect to login handled by exception handler or caller
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    # Check "Bearer " prefix
    if token.startswith("Bearer "):
        token = token.split(" ")[1]
        
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales no válidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
            
        # Extract context
        ctx_id = payload.get("ctx_id")
        ctx_type = payload.get("ctx_type")

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    # Attach context to request state
    request.state.ctx_id = ctx_id
    request.state.ctx_type = ctx_type

    return user

async def get_optional_user_from_cookie(request: Request, db: Session = Depends(get_db)):
    """
    Returns user if valid cookie exists, else None.
    Used for public pages or hybrid checks.
    """
    try:
        return await get_current_user_from_cookie(request, db)
    except HTTPException:
        return None

def require_admin_or_owner(current_user=Depends(get_current_user)):
    if current_user.platform_role == PlatformRole.SUPERADMIN:
        return current_user
    if current_user.role not in (Role.ADMINISTRADOR, Role.DUEÑO):
        raise HTTPException(status_code=403, detail="No autorizado")
    return current_user

def require_platform_admin(current_user: User = Depends(get_current_user)):
    """Allow SUPERADMIN or SUPPORT (read-only access in caller). Endpoints destructivos
    deben verificar adicionalmente platform_role == SUPERADMIN dentro del handler."""
    if current_user.platform_role not in (PlatformRole.SUPERADMIN, PlatformRole.SUPPORT):
        raise HTTPException(status_code=403, detail="Requiere Rol de Plataforma (SUPERADMIN o SUPPORT)")
    return current_user


def require_superadmin(current_user: User = Depends(get_current_user)):
    """Strict SUPERADMIN guard for destructive ops."""
    if current_user.platform_role != PlatformRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Requiere SUPERADMIN")
    return current_user
