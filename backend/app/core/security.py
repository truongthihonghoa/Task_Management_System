import os
import secrets
from datetime import datetime, timedelta
from typing import Any

from jose import jwt
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


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
