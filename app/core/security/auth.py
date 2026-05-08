"""Atlas BOS core/security/auth — JWT/cookie auth dependency.

`get_current_user` is the canonical FastAPI dependency for authenticated
routes. Reads JWT from Authorization header or `access_token` cookie,
validates against User table, attaches ctx_id/ctx_type to request state.
"""
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security.config import ALGORITHM, SECRET_KEY, oauth2_scheme
from app.models import User


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales no válidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Header token; fallback to cookie.
    if not token:
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

        ctx_id = payload.get("ctx_id")
        ctx_type = payload.get("ctx_type")
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    request.state.ctx_id = ctx_id
    request.state.ctx_type = ctx_type
    return user
