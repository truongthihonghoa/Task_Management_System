from datetime import datetime, timedelta
from app.core.timezone import vietnam_now
from sqlalchemy.orm import Session
from app.models.user_token import UserToken
from app.core.config import settings


def create_user_token(db: Session, user_id: str, access_token: str, refresh_token: str) -> UserToken:
    """Create a new user token with access and refresh tokens."""
    access_expires_at = vietnam_now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_expires_at = vietnam_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    user_token = UserToken(
        user_id=user_id,
        access_token=access_token,
        refresh_token=refresh_token,
        access_expires_at=access_expires_at,
        refresh_expires_at=refresh_expires_at,
        is_revoked=False,
        created_at=vietnam_now()
    )
    db.add(user_token)
    db.commit()
    db.refresh(user_token)
    return user_token


def revoke_user_tokens(db: Session, user_id: str) -> int:
    """Revoke all tokens for a user."""
    count = db.query(UserToken).filter(
        UserToken.user_id == user_id,
        UserToken.is_revoked == False
    ).count()
    db.query(UserToken).filter(
        UserToken.user_id == user_id,
        UserToken.is_revoked == False
    ).update({"is_revoked": True})
    db.commit()
    return count


def get_valid_token(db: Session, access_token: str) -> UserToken:
    """Get a valid, non-revoked token."""
    return db.query(UserToken).filter(
        UserToken.access_token == access_token,
        UserToken.is_revoked == False,
        UserToken.access_expires_at > vietnam_now()
    ).first()
