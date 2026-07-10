"""
auth_service.py — Business logic for all authentication flows.

This layer owns:
- OTP / verification-token lifecycle
- Account status & lock checks
- Password hashing & verification
- JWT token generation
- Rate-limiting for resend flows
- Audit log orchestration
- Email dispatch

It calls auth_repository for all DB reads/writes and raises HTTPException
for any business-rule violation so that the router stays thin.
"""

import os
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.email import send_verification_email
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_otp,
    hash_password,
    verify_password,
)
from app.repository.auth import (
    EMAIL_VERIFICATION,
    PASSWORD_RESET,
    create_audit_log,
    create_user,
    create_user_token,
    get_user_by_email,
    get_verification_token,
    reset_resend_window_if_needed,
    upsert_email_verification_token,
    upsert_verification_token,
)
from app.schemas.pydantic_models import (
    LoginResponse,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    VerifyEmailResponse,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OTP_EXPIRE_MINUTES = 15
MAX_RESENDS_PER_HOUR = 5
MAX_FAILED_LOGIN_ATTEMPTS = int(os.getenv("MAX_FAILED_LOGIN_ATTEMPTS", "5"))
ACCOUNT_LOCK_MINUTES = int(os.getenv("ACCOUNT_LOCK_MINUTES", "15"))


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _otp_expires_at(now: datetime) -> datetime:
    return now + timedelta(minutes=OTP_EXPIRE_MINUTES)


def _account_locked_until(now: datetime) -> datetime:
    return now + timedelta(minutes=ACCOUNT_LOCK_MINUTES)


def _get_valid_verification_token(
    db: Session,
    *,
    email: str,
    code: str,
    token_type: str,
    now: datetime,
):
    """Fetch a verification token and raise 4xx if invalid, expired, or used."""
    token = get_verification_token(db, email, token_type)

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Verification record not found."},
        )
    if token.otp_code != code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "The verification code is incorrect."},
        )
    if token.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "The verification code has expired."},
        )
    if token.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "The verification code is no longer valid."},
        )
    return token


def _get_verified_password_reset_token(db: Session, *, email: str, now: datetime):
    """Fetch a PASSWORD_RESET token that has already been verified (used_at set)."""
    token = get_verification_token(db, email, PASSWORD_RESET)

    if token is None or token.used_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Password reset code must be verified before resetting password."},
        )
    if token.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "The verification code has expired."},
        )
    return token


# ---------------------------------------------------------------------------
# Public service methods — called by the router
# ---------------------------------------------------------------------------

def check_email(db: Session, email: str) -> MessageResponse:
    """Verify email is not taken, generate & send a verification OTP."""
    now = datetime.utcnow()

    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Email already exists."},
        )

    otp_code = generate_otp()

    try:
        upsert_email_verification_token(
            db,
            email=email,
            otp_code=otp_code,
            expires_at=_otp_expires_at(now),
            resend_count=0,
            used_at=None,
            created_at=now,
        )
        create_audit_log(db, action="CHECK_EMAIL", label_title="Check email", payload={"email": email})
        create_audit_log(
            db,
            action="SEND_VERIFICATION_CODE",
            label_title="Send verification code",
            payload={"email": email, "token_type": EMAIL_VERIFICATION},
        )
        send_verification_email(email, otp_code)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return MessageResponse(message="Verification code has been sent.")


def verify_email(db: Session, email: str, otp_code: str) -> VerifyEmailResponse:
    """Validate the EMAIL_VERIFICATION OTP and mark it as used."""
    now = datetime.utcnow()
    token = get_verification_token(db, email)

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Verification record not found."},
        )
    if token.otp_code != otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "The verification code is incorrect."},
        )
    if token.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "The verification code has expired."},
        )
    if token.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "The verification code is no longer valid."},
        )

    try:
        token.used_at = now
        create_audit_log(
            db,
            action="VERIFY_EMAIL",
            label_title="Verify email",
            payload={"email": email, "token_type": EMAIL_VERIFICATION},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return VerifyEmailResponse(verified=True, message="Email verified successfully.")


def resend_verification(db: Session, email: str) -> MessageResponse:
    """Rate-limit and resend the email-verification OTP."""
    now = datetime.utcnow()
    token = get_verification_token(db, email)

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Verification record not found."},
        )
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Email already exists."},
        )

    reset_resend_window_if_needed(token, now)
    if token.resend_count >= MAX_RESENDS_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"message": "Too many resend attempts. Please try again later."},
        )

    otp_code = generate_otp()

    try:
        token.otp_code = otp_code
        token.expires_at = _otp_expires_at(now)
        token.used_at = None
        token.resend_count += 1
        create_audit_log(
            db,
            action="SEND_VERIFICATION_CODE",
            label_title="Resend verification code",
            payload={"email": email, "token_type": EMAIL_VERIFICATION},
        )
        send_verification_email(email, otp_code)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return MessageResponse(message="Verification code has been resent.")


def login(db: Session, email: str, password: str) -> LoginResponse:
    """Authenticate a user and issue JWT access + refresh tokens."""
    now = datetime.utcnow()
    user = get_user_by_email(db, email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Email does not exist."},
        )

    if user.status_user == "Pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": "Please verify your email first."},
        )

    if user.status_user == "Locked":
        if user.locked_until is not None and user.locked_until > now:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"message": "Account temporarily locked."},
            )
        user.failed_login_attempts = 0
        user.locked_until = None
        user.status_user = "Active"
        user.updated_at = now

    if user.status_user == "Inactive":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": "Account has been deactivated."},
        )

    if not verify_password(password, user.password_hash):
        try:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            user.updated_at = now
            if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
                user.status_user = "Locked"
                user.locked_until = _account_locked_until(now)
            db.commit()
        except Exception:
            db.rollback()
            raise
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid email or password."},
        )

    try:
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login = now
        user.updated_at = now

        token_payload = {"user_id": user.user_id, "email": user.email, "role": user.role}
        access_token, access_expires_at = create_access_token(token_payload)
        refresh_token, refresh_expires_at = create_refresh_token(token_payload)
        create_user_token(
            db,
            user_id=user.user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            access_expires_at=access_expires_at,
            refresh_expires_at=refresh_expires_at,
            created_at=now,
        )
        create_audit_log(
            db,
            user_id=user.user_id,
            action="LOGIN",
            label_title="USER",
            entity_id=user.user_id,
            payload={"email": user.email, "role": user.role},
        )
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        user=user,
    )


def forgot_password(db: Session, email: str) -> MessageResponse:
    """Send a PASSWORD_RESET OTP to the user's email."""
    now = datetime.utcnow()
    user = get_user_by_email(db, email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Email does not exist."},
        )

    otp_code = generate_otp()

    try:
        upsert_verification_token(
            db,
            email=email,
            otp_code=otp_code,
            token_type=PASSWORD_RESET,
            expires_at=_otp_expires_at(now),
            resend_count=0,
            used_at=None,
            created_at=now,
        )
        create_audit_log(
            db,
            user_id=user.user_id,
            action="SEND_PASSWORD_RESET_CODE",
            label_title="USER",
            entity_id=user.user_id,
            payload={"email": email, "token_type": PASSWORD_RESET},
        )
        send_verification_email(email, otp_code)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return MessageResponse(message="Verification code sent successfully.")


def verify_reset_code(db: Session, email: str, code: str) -> VerifyEmailResponse:
    """Validate the PASSWORD_RESET OTP and mark it as used."""
    now = datetime.utcnow()
    user = get_user_by_email(db, email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Email does not exist."},
        )

    token = _get_valid_verification_token(
        db, email=email, code=code, token_type=PASSWORD_RESET, now=now
    )

    try:
        token.used_at = now
        create_audit_log(
            db,
            user_id=user.user_id,
            action="VERIFY_PASSWORD_RESET_CODE",
            label_title="USER",
            entity_id=user.user_id,
            payload={"email": email, "token_type": PASSWORD_RESET},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return VerifyEmailResponse(verified=True, message="Password reset code verified successfully.")


def resend_reset_code(db: Session, email: str) -> MessageResponse:
    """Rate-limit and resend the PASSWORD_RESET OTP."""
    now = datetime.utcnow()
    user = get_user_by_email(db, email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Email does not exist."},
        )

    token = get_verification_token(db, email, PASSWORD_RESET)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Verification record not found."},
        )

    reset_resend_window_if_needed(token, now)
    if token.resend_count >= MAX_RESENDS_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"message": "Too many resend attempts. Please try again later."},
        )

    otp_code = generate_otp()

    try:
        token.otp_code = otp_code
        token.expires_at = _otp_expires_at(now)
        token.used_at = None
        token.resend_count += 1
        create_audit_log(
            db,
            user_id=user.user_id,
            action="SEND_PASSWORD_RESET_CODE",
            label_title="USER",
            entity_id=user.user_id,
            payload={"email": email, "token_type": PASSWORD_RESET},
        )
        send_verification_email(email, otp_code)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return MessageResponse(message="Verification code has been resent.")


def reset_password(db: Session, email: str, new_password: str) -> MessageResponse:
    """Hash and save new password after verifying the reset token."""
    now = datetime.utcnow()
    user = get_user_by_email(db, email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Email does not exist."},
        )

    token = _get_verified_password_reset_token(db, email=email, now=now)

    try:
        user.password_hash = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        if user.status_user == "Locked":
            user.status_user = "Active"
        user.updated_at = now
        token.expires_at = now  # invalidate token immediately after use
        create_audit_log(
            db,
            user_id=user.user_id,
            action="RESET_PASSWORD",
            label_title="USER",
            entity_id=user.user_id,
            payload={"email": email},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return MessageResponse(message="Password reset successfully.")


def register(db: Session, payload: RegisterRequest) -> RegisterResponse:
    """Register a new user after email verification, issue tokens."""
    email = payload.email
    now = datetime.utcnow()

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Confirm password mismatch."},
        )

    token = get_verification_token(db, email)
    if token is None or token.used_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Email must be verified before registration."},
        )
    if token.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "OTP expired."},
        )
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Email already exists."},
        )

    try:
        user = create_user(
            db,
            email=email,
            full_name=payload.full_name,
            password_hash=hash_password(payload.password),
            now=now,
        )
        db.flush()

        token_payload = {"user_id": user.user_id, "email": user.email, "role": user.role}
        access_token, access_expires_at = create_access_token(token_payload)
        refresh_token, refresh_expires_at = create_refresh_token(token_payload)
        create_user_token(
            db,
            user_id=user.user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            access_expires_at=access_expires_at,
            refresh_expires_at=refresh_expires_at,
            created_at=now,
        )
        create_audit_log(
            db,
            user_id=user.user_id,
            action="REGISTER_USER",
            label_title="Register user",
            entity_id=user.user_id,
            payload={"email": user.email, "role": user.role},
        )
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Duplicate registration."},
        )
    except Exception:
        db.rollback()
        raise

    return RegisterResponse(
        message="Registration successful.",
        user=user,
        access_token=access_token,
        refresh_token=refresh_token,
    )
