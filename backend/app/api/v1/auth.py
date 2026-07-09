from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.email import send_verification_email
from app.core.security import create_access_token, create_refresh_token, generate_otp, hash_password
from app.crud.repository import (
    EMAIL_VERIFICATION,
    create_audit_log,
    create_user,
    create_user_token,
    get_user_by_email,
    get_verification_token,
    reset_resend_window_if_needed,
    upsert_email_verification_token,
)
from app.db.session import get_db
from app.schemas.pydantic_models import (
    EmailRequest,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)


router = APIRouter(prefix="/auth", tags=["auth"])

OTP_EXPIRE_MINUTES = 15
MAX_RESENDS_PER_HOUR = 5


def _otp_expires_at(now: datetime) -> datetime:
    return now + timedelta(minutes=OTP_EXPIRE_MINUTES)


@router.post("/check-email", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def check_email(payload: EmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email = payload.email
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
        create_audit_log(
            db,
            action="CHECK_EMAIL",
            label_title="Check email",
            payload={"email": email},
        )
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


@router.post("/verify-email", response_model=VerifyEmailResponse, status_code=status.HTTP_200_OK)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> VerifyEmailResponse:
    email = payload.email
    now = datetime.utcnow()
    verification_token = get_verification_token(db, email)

    if verification_token is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Verification record not found."})
    if verification_token.used_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "OTP has already been used."})
    if verification_token.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "OTP expired."})
    if verification_token.otp_code != payload.otp_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "Invalid OTP."})

    try:
        verification_token.used_at = now
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


@router.post("/resend-verification", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def resend_verification(payload: EmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email = payload.email
    now = datetime.utcnow()
    verification_token = get_verification_token(db, email)

    if verification_token is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": "Verification record not found."})
    if get_user_by_email(db, email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": "Email already exists."})

    reset_resend_window_if_needed(verification_token, now)
    if verification_token.resend_count >= MAX_RESENDS_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"message": "Too many resend attempts. Please try again later."},
        )

    otp_code = generate_otp()

    try:
        verification_token.otp_code = otp_code
        verification_token.expires_at = _otp_expires_at(now)
        verification_token.used_at = None
        verification_token.resend_count += 1
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


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
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
