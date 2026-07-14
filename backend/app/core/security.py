from typing import Optional
import os
from datetime import datetime, timedelta
import secrets
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.repository.auth import get_user_by_id, get_user_token
from app.db.session import get_db
from app.models.user import User

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

bearer_scheme = HTTPBearer(auto_error=False)

bearer_auth = HTTPBearer(
    auto_error=False,
    description="Paste JWT access token here. Use Bearer authentication.",
)

def get_optional_bearer_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_auth),
) -> Optional[str]:
    if not credentials:
        return None
    return credentials.credentials


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    token = credentials.credentials
    user_id: str | None = None
    stored_token = get_user_token(db, token)
    now = datetime.utcnow()

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        token_user_id = payload.get("user_id") or payload.get("sub")
        if (
            payload.get("type") == "access"
            and stored_token is not None
            and stored_token.access_expires_at >= now
            and stored_token.user_id == token_user_id
        ):
            user_id = token_user_id
    except JWTError:
        if stored_token and stored_token.access_expires_at >= now:
            user_id = stored_token.user_id

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated user not found.")
    return user


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def create_access_token(payload: dict[str, Any]) -> tuple[str, datetime]:
    expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {**payload, "type": "access", "exp": expires_at}
    return jwt.encode(token_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM), expires_at


def create_refresh_token(payload: dict[str, Any]) -> tuple[str, datetime]:
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    token_payload = {**payload, "type": "refresh", "exp": expires_at}
    return jwt.encode(token_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM), expires_at
