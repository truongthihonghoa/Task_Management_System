import os
from datetime import datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.crud.repository import get_user_by_id, get_user_token
from app.db.session import get_db
from app.models.user import User


JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    token = credentials.credentials
    user_id: str | None = None

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id") or payload.get("sub")
    except JWTError:
        stored_token = get_user_token(db, token)
        if stored_token and stored_token.access_expires_at >= datetime.utcnow():
            user_id = stored_token.user_id

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated user not found.")
    return user
