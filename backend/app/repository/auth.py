"""
auth_repository.py — Pure database operations for authentication flows.

No business logic, no HTTPException. All functions accept a SQLAlchemy Session
and perform exactly one DB concern.
"""

from datetime import datetime, timedelta
from app.core.timezone import vietnam_now
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user_token import UserToken
from app.models.verification_token import VerificationToken


EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
PASSWORD_RESET = "PASSWORD_RESET"


# ---------------------------------------------------------------------------
# User queries
# ---------------------------------------------------------------------------

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


# ---------------------------------------------------------------------------
# VerificationToken queries
# ---------------------------------------------------------------------------

def get_verification_token(
    db: Session, email: str, token_type: str = EMAIL_VERIFICATION
) -> VerificationToken | None:
    return db.execute(
        select(VerificationToken).where(
            VerificationToken.email == email,
            VerificationToken.token_type == token_type,
        )
    ).scalar_one_or_none()


def upsert_email_verification_token(
    db: Session,
    *,
    email: str,
    otp_code: str,
    expires_at: datetime,
    resend_count: int = 0,
    used_at: datetime | None = None,
    created_at: datetime | None = None,
) -> VerificationToken:
    """Create or update the EMAIL_VERIFICATION token for *email*."""
    token = get_verification_token(db, email, EMAIL_VERIFICATION)
    now = created_at or vietnam_now()

    if token is None:
        token = VerificationToken(
            email=email,
            otp_code=otp_code,
            token_type=EMAIL_VERIFICATION,
            expires_at=expires_at,
            used_at=used_at,
            resend_count=resend_count,
            created_at=now,
        )
        db.add(token)
        return token

    token.otp_code = otp_code
    token.expires_at = expires_at
    token.used_at = used_at
    token.resend_count = resend_count
    token.created_at = now
    return token


def upsert_verification_token(
    db: Session,
    *,
    email: str,
    otp_code: str,
    token_type: str,
    expires_at: datetime,
    resend_count: int = 0,
    used_at: datetime | None = None,
    created_at: datetime | None = None,
) -> VerificationToken:
    """Create or update any verification token (generic)."""
    token = get_verification_token(db, email, token_type)
    now = created_at or vietnam_now()

    if token is None:
        token = VerificationToken(
            email=email,
            otp_code=otp_code,
            token_type=token_type,
            expires_at=expires_at,
            used_at=used_at,
            resend_count=resend_count,
            created_at=now,
        )
        db.add(token)
        return token

    token.otp_code = otp_code
    token.expires_at = expires_at
    token.used_at = used_at
    token.resend_count = resend_count
    token.created_at = now
    return token


def reset_resend_window_if_needed(token: VerificationToken, now: datetime) -> None:
    """Reset the resend counter if the current 1-hour window has elapsed."""
    if token.created_at <= now - timedelta(hours=1):
        token.resend_count = 0
        token.created_at = now


# ---------------------------------------------------------------------------
# User mutations
# ---------------------------------------------------------------------------

def create_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    password_hash: str,
    now: datetime,
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=password_hash,
        status_user="Active",
        role="USER",
        avatar_url=None,
        is_verified=True,
        failed_login_attempts=0,
        locked_until=None,
        last_login=None,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    return user


# ---------------------------------------------------------------------------
# UserToken operations
# ---------------------------------------------------------------------------

def get_user_token(db: Session, access_token: str) -> UserToken | None:
    return db.execute(
        select(UserToken).where(
            UserToken.access_token == access_token,
            UserToken.is_revoked.is_(False),
        )
    ).scalar_one_or_none()


def create_user_token(
    db: Session,
    *,
    user_id: str,
    access_token: str,
    refresh_token: str,
    access_expires_at: datetime,
    refresh_expires_at: datetime,
    created_at: datetime,
) -> UserToken:
    user_token = UserToken(
        user_id=user_id,
        access_token=access_token,
        refresh_token=refresh_token,
        access_expires_at=access_expires_at,
        refresh_expires_at=refresh_expires_at,
        is_revoked=False,
        created_at=created_at,
    )
    db.add(user_token)
    return user_token


def revoke_refresh_token_for_access_token(
    db: Session,
    access_token: str,
    *,
    revoked_at: datetime | None = None,
) -> UserToken | None:
    user_token = get_user_token(db, access_token)
    if user_token is None:
        return None

    user_token.refresh_token = ""
    user_token.refresh_expires_at = revoked_at or vietnam_now()
    user_token.is_revoked = True
    return user_token


def get_user_token_by_refresh_token(db: Session, refresh_token: str) -> UserToken | None:
    return db.execute(
        select(UserToken).where(
            UserToken.refresh_token == refresh_token,
        )
    ).scalar_one_or_none()


def update_user_token(
    db: Session,
    user_token: UserToken,
    *,
    new_access_token: str,
    access_expires_at: datetime,
) -> UserToken:
    user_token.access_token = new_access_token
    user_token.access_expires_at = access_expires_at

    return user_token


def revoke_all_user_tokens(db: Session, user_id: str) -> None:
    db.query(UserToken).filter(
        UserToken.user_id == user_id,
    ).delete(synchronize_session=False)

    db.commit()
# ---------------------------------------------------------------------------
# AuditLog operations
# ---------------------------------------------------------------------------

def create_audit_log(
    db: Session,
    *,
    action: str,
    label_title: str,
    user_id: str | None = None,
    entity_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditLog:
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        label_title=label_title,
        entity_id=entity_id,
        payload=payload,
    )
    db.add(audit_log)
    return audit_log
