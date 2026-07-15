"""
user_service.py — Business logic for user management and profiles.
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.repository import user as user_repo
from app.schemas.pydantic_models import (
    ChangePasswordRequest,
    UpdateProfileRequest,
    UserManagementListResponse,
    UserManagementResponse,
    UserProfileResponse,
)

SUPPORTED_STATUSES = {"Pending", "Active", "Inactive", "Locked"}
SORT_FIELDS = {"created_at", "full_name", "email", "last_login"}
READ_ONLY_UPDATE_FIELDS = {"email", "full_name", "password_hash"}
ALLOWED_UPDATE_FIELDS = {"status", "is_verified", "failed_login_attempts", "locked_until"}
ACCOUNT_LOCK_MINUTES = int(os.getenv("ACCOUNT_LOCK_MINUTES", "15"))


def _user_response(user: User) -> UserManagementResponse:
    return UserManagementResponse(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        status_user=user.status_user,
        role=user.role,
        avatar_url=user.avatar_url,
        is_verified=user.is_verified,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def get_user_or_404(db: Session, user_id: str) -> User:
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def list_users(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    status_filter: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> tuple[int, list[UserManagementResponse]]:
    if status_filter is not None and status_filter not in SUPPORTED_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status filter")
    if sort_by not in SORT_FIELDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sort field")
    if sort_order not in {"asc", "desc"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sort order")

    total, users = user_repo.list_users(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return total, [_user_response(user) for user in users]


def get_user_details(db: Session, user_id: str) -> UserManagementResponse:
    return _user_response(get_user_or_404(db, user_id))


def validate_update_payload(update_data: dict[str, Any]) -> None:
    read_only_fields = READ_ONLY_UPDATE_FIELDS.intersection(update_data)
    if read_only_fields:
        fields = ", ".join(sorted(read_only_fields))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Read-only fields cannot be modified after registration: {fields}",
        )

    invalid_fields = set(update_data) - ALLOWED_UPDATE_FIELDS - READ_ONLY_UPDATE_FIELDS
    if invalid_fields:
        fields = ", ".join(sorted(invalid_fields))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid update fields: {fields}")

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one field is required")

    if "status" in update_data and update_data["status"] not in SUPPORTED_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status value")

    if "failed_login_attempts" in update_data:
        attempts = update_data["failed_login_attempts"]
        if attempts is not None and (not isinstance(attempts, int) or attempts < 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="failed_login_attempts must be a non-negative integer",
            )


def update_user(db: Session, user_id: str, update_data: dict[str, Any]) -> UserManagementResponse:
    validate_update_payload(update_data)
    user = get_user_or_404(db, user_id)

    db_update = {}
    if "status" in update_data:
        db_update["status_user"] = update_data["status"]
    if "is_verified" in update_data:
        db_update["is_verified"] = update_data["is_verified"]
    if "failed_login_attempts" in update_data:
        db_update["failed_login_attempts"] = update_data["failed_login_attempts"]
    if "locked_until" in update_data:
        db_update["locked_until"] = update_data["locked_until"]

    user_repo.update_user_fields(db, user, db_update)
    return _user_response(user)


def activate_user(db: Session, user_id: str) -> UserManagementResponse:
    user = get_user_or_404(db, user_id)
    user_repo.update_user_fields(db, user, {"status_user": "Active"})
    return _user_response(user)


def deactivate_user(db: Session, user_id: str) -> UserManagementResponse:
    user = get_user_or_404(db, user_id)
    user_repo.update_user_fields(db, user, {"status_user": "Inactive"})
    return _user_response(user)


def lock_user(db: Session, user_id: str) -> UserManagementResponse:
    user = get_user_or_404(db, user_id)
    locked_until = datetime.utcnow() + timedelta(minutes=ACCOUNT_LOCK_MINUTES)
    user_repo.update_user_fields(db, user, {"status_user": "Locked", "locked_until": locked_until})
    return _user_response(user)


def unlock_user(db: Session, user_id: str) -> UserManagementResponse:
    user = get_user_or_404(db, user_id)
    user_repo.update_user_fields(db, user, {"status_user": "Active", "failed_login_attempts": 0, "locked_until": None})
    return _user_response(user)


def get_user_profile(db: Session, user_id: str) -> UserProfileResponse:
    user = get_user_or_404(db, user_id)
    return UserProfileResponse.model_validate(user)


def update_user_profile(db: Session, user_id: str, update_data: UpdateProfileRequest) -> UserProfileResponse:
    user = get_user_or_404(db, user_id)
    user_repo.update_user_fields(db, user, {"full_name": update_data.full_name})
    return UserProfileResponse.model_validate(user)


def update_user_avatar(db: Session, user_id: str, file: UploadFile) -> str:
    user = get_user_or_404(db, user_id)

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image.")
    allowed_formats = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    if file.content_type not in allowed_formats:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image format.")

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds 5 MB limit.")

    avatar_dir = "media/avatars/"
    os.makedirs(avatar_dir, exist_ok=True)

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(avatar_dir, filename).replace("\\", "/")

    with open(filepath, "wb") as f:
        f.write(file.file.read())

    old_avatar = user.avatar_url
    user_repo.update_user_fields(db, user, {"avatar_url": filepath})

    if old_avatar and os.path.exists(old_avatar):
        if not old_avatar.endswith("default.png") and not old_avatar.endswith("default.jpg"):
            try:
                os.remove(old_avatar)
            except OSError:
                pass

    return filepath


def change_user_password(db: Session, user_id: str, password_data: ChangePasswordRequest) -> None:
    user = get_user_or_404(db, user_id)
    if not verify_password(password_data.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect current password.")

    hashed_pw = hash_password(password_data.new_password)
    user_repo.update_user_fields(db, user, {"password_hash": hashed_pw})
    user_repo.revoke_user_tokens(db, user_id)
