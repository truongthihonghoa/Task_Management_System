"""
auth.py — Authentication router.

Responsibilities: receive requests, validate input (via Pydantic), call
auth_service, return responses. No business logic here.
"""

import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.email import send_verification_email
from app.core.security import create_access_token, create_refresh_token, generate_otp, hash_password, verify_password
from app.repository.repository import (
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
from app.db.session import get_db
from app.schemas.pydantic_models import (
    EmailRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    VerifyEmailRequest,
    VerifyEmailResponse,
    VerifyResetCodeRequest,
)
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/auth", tags=["auth"])
notification_service = NotificationService()


@router.post("/check-email", response_model=MessageResponse, status_code=200)
def check_email(payload: EmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    return auth_service.check_email(db, payload.email)


@router.post("/verify-email", response_model=VerifyEmailResponse, status_code=200)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> VerifyEmailResponse:
    return auth_service.verify_email(db, payload.email, payload.otp_code)


@router.post("/resend-verification", response_model=MessageResponse, status_code=200)
def resend_verification(payload: EmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    return auth_service.resend_verification(db, payload.email)


@router.post("/login", response_model=LoginResponse, status_code=200)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    email = payload.email
    now = datetime.utcnow()
    user = get_user_by_email(db, email)

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Email does not exist."})

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

    if not verify_password(payload.password, user.password_hash):
        try:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            user.updated_at = now
            if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
                user.status_user = "Locked"
                user.locked_until = _account_locked_until(now)
                notification_service.create_super_admin_notification(
                    db,
                    notification_type="account_locked",
                    title="Account locked",
                    message=f"Account {user.email} was locked after failed login attempts.",
                    metadata={
                        "user_id": user.user_id,
                        "email": user.email,
                        "failed_login_attempts": user.failed_login_attempts,
                        "locked_until": user.locked_until.isoformat() if user.locked_until else None,
                    },
                )
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


@router.post("/forgot-password", response_model=MessageResponse, status_code=200)
def forgot_password(payload: EmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    return auth_service.forgot_password(db, payload.email)


@router.post("/verify-reset-code", response_model=VerifyEmailResponse, status_code=200)
def verify_reset_code(payload: VerifyResetCodeRequest, db: Session = Depends(get_db)) -> VerifyEmailResponse:
    return auth_service.verify_reset_code(db, payload.email, payload.code)


@router.post("/resend-reset-code", response_model=MessageResponse, status_code=200)
def resend_reset_code(payload: EmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    return auth_service.resend_reset_code(db, payload.email)


@router.post("/reset-password", response_model=MessageResponse, status_code=200)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email = payload.email
    now = datetime.utcnow()
    user = get_user_by_email(db, email)

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Email does not exist."})

    verification_token = _get_verified_password_reset_token(db, email=email, now=now)

    try:
        user.password_hash = hash_password(payload.password)
        user.failed_login_attempts = 0
        user.locked_until = None
        was_locked = user.status_user == "Locked"
        if user.status_user == "Locked":
            user.status_user = "Active"
        user.updated_at = now
        verification_token.expires_at = now
        create_audit_log(
            db,
            user_id=user.user_id,
            action="RESET_PASSWORD",
            label_title="USER",
            entity_id=user.user_id,
            payload={"email": email},
        )
        if was_locked:
            notification_service.create_super_admin_notification(
                db,
                notification_type="user_verified",
                title="Locked account restored",
                message=f"Account {user.email} reset password and was restored to Active.",
                metadata={"user_id": user.user_id, "email": user.email},
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return MessageResponse(message="Password reset successfully.")


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    email = payload.email
    now = datetime.utcnow()

    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "Confirm password mismatch."})

    verification_token = get_verification_token(db, email)
    if verification_token is None or verification_token.used_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Email must be verified before registration."},
        )
    if verification_token.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "OTP expired."})
    if get_user_by_email(db, email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Email already exists."})

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
        notification_service.create_super_admin_notification(
            db,
            notification_type="user_registered",
            title="New user registered",
            message=f"{user.full_name} registered a new account.",
            metadata={"user_id": user.user_id, "email": user.email, "role": user.role},
        )
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Duplicate registration."})
    except Exception:
        db.rollback()
        raise

    return RegisterResponse(
        message="Registration successful.",
        user=user,
        access_token=access_token,
        refresh_token=refresh_token,
    )
