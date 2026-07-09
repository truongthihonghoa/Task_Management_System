from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user_token import UserToken
from app.models.verification_token import VerificationToken


EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
PASSWORD_RESET = "PASSWORD_RESET"


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()


def get_verification_token(db: Session, email: str, token_type: str = EMAIL_VERIFICATION) -> VerificationToken | None:
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
    verification_token = get_verification_token(db, email, EMAIL_VERIFICATION)
    now = created_at or datetime.utcnow()

    if verification_token is None:
        verification_token = VerificationToken(
            email=email,
            otp_code=otp_code,
            token_type=EMAIL_VERIFICATION,
            expires_at=expires_at,
            used_at=used_at,
            resend_count=resend_count,
            created_at=now,
        )
        db.add(verification_token)
        return verification_token

    verification_token.otp_code = otp_code
    verification_token.expires_at = expires_at
    verification_token.used_at = used_at
    verification_token.resend_count = resend_count
    verification_token.created_at = now
    return verification_token


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
    verification_token = get_verification_token(db, email, token_type)
    now = created_at or datetime.utcnow()

    if verification_token is None:
        verification_token = VerificationToken(
            email=email,
            otp_code=otp_code,
            token_type=token_type,
            expires_at=expires_at,
            used_at=used_at,
            resend_count=resend_count,
            created_at=now,
        )
        db.add(verification_token)
        return verification_token

    verification_token.otp_code = otp_code
    verification_token.expires_at = expires_at
    verification_token.used_at = used_at
    verification_token.resend_count = resend_count
    verification_token.created_at = now
    return verification_token


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


def reset_resend_window_if_needed(verification_token: VerificationToken, now: datetime) -> None:
    if verification_token.created_at <= now - timedelta(hours=1):
        verification_token.resend_count = 0
        verification_token.created_at = now
