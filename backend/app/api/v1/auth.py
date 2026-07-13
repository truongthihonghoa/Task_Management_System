"""
auth.py — Authentication router.

Responsibilities: receive requests, validate input (via Pydantic), call
auth_service, return responses. No business logic here.
"""

import os
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.email import send_verification_email
from app.core.security import create_access_token, create_refresh_token, generate_otp, hash_password, verify_password

from app.services.notification_service import NotificationService

from app.services import auth_service
from app.services.auth_service import MAX_FAILED_LOGIN_ATTEMPTS, ACCOUNT_LOCK_MINUTES  
from app.core.security import get_current_user, bearer_scheme

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
    return auth_service.login(db, payload.email, payload.password)


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
    return auth_service.reset_password(db, payload.email, payload.password)


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    return auth_service.register(db, payload)


@router.post("/logout", response_model=MessageResponse, status_code=200)
def logout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> MessageResponse:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return auth_service.logout(db, current_user, credentials.credentials)
