"""
auth.py — Authentication router.

Responsibilities: receive requests, validate input (via Pydantic), call
auth_service, return responses. No business logic here.
"""

import os
from app.models.user import User
from fastapi import APIRouter, Depends, File, HTTPException, Request, status, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.email import send_verification_email
from app.core.security import create_access_token, create_refresh_token, generate_otp, hash_password, verify_password


from app.services import auth_service, user_service
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
    UpdateAvatarResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
    TokenRefreshRequest,
)
from app.services import auth_service
from app.services.auth_service import MAX_FAILED_LOGIN_ATTEMPTS, ACCOUNT_LOCK_MINUTES  # noqa: F401 — re-exported for tests

router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/reset-password", response_model=MessageResponse, status_code=200)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    return auth_service.reset_password(db, payload.email, payload.token, payload.password)


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    return auth_service.register(db, payload)


@router.post("/register/avatar", response_model=UpdateAvatarResponse, status_code=200)
def upload_register_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UpdateAvatarResponse:
    try:
        avatar_url = user_service.update_user_avatar(db, current_user.user_id, file)
        create_audit_log(
            db,
            user_id=current_user.user_id,
            action="UPLOAD_REGISTER_AVATAR",
            label_title="Upload registration avatar",
            entity_id=current_user.user_id,
            payload={"avatar_url": avatar_url},
        )
        db.commit()
        return UpdateAvatarResponse(message="Registration avatar uploaded successfully.", avatar_url=avatar_url)
    except Exception:
        db.rollback()
        raise


from fastapi import Response

@router.post("/logout", response_model=MessageResponse, status_code=200)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> MessageResponse:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    result = auth_service.logout(
        db,
        current_user,
        credentials.credentials,
    )

    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        secure=True,
        samesite="lax",
    )

    return result

@router.post("/refresh", response_model=LoginResponse, status_code=200)
def refresh_token(payload: TokenRefreshRequest, db: Session = Depends(get_db)) -> LoginResponse:
    return auth_service.refresh_tokens(db, payload.refresh_token)

