"""
user_repository.py — Database operations and user management business logic.
"""

from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.pydantic_models import UserManagementResponse
from app.services.auth_service import ACCOUNT_LOCK_MINUTES

SUPPORTED_STATUSES = {"Pending", "Active", "Inactive", "Locked"}
SORT_FIELDS = {
    "created_at": User.created_at,
    "full_name": User.full_name,
    "email": User.email,
    "last_login": User.last_login,
}
READ_ONLY_UPDATE_FIELDS = {"email", "full_name", "password_hash"}
ALLOWED_UPDATE_FIELDS = {"status", "is_verified", "failed_login_attempts", "locked_until"}


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
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def create_user_audit_log(
    db: Session,
    *,
    actor_user_id: str,
    action: str,
    entity_id: str | None = None,
    payload: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    audit_payload = payload.copy() if payload else {}
    if ip_address is not None:
        audit_payload["ip_address"] = ip_address

    audit_log = AuditLog(
        user_id=actor_user_id,
        action=action,
        label_title="user",
        entity_id=entity_id,
        payload=audit_payload or None,
    )
    db.add(audit_log)
    return audit_log


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

    query = db.query(User)

    if search:
        normalized_search = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(User.full_name).like(normalized_search),
                func.lower(User.email).like(normalized_search),
            )
        )

    if status_filter:
        query = query.filter(User.status_user == status_filter)

    total = query.count()
    sort_column = SORT_FIELDS[sort_by]
    order_expression = asc(sort_column) if sort_order == "asc" else desc(sort_column)
    users = query.order_by(order_expression).offset((page - 1) * page_size).limit(page_size).all()
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

    if "status" in update_data:
        user.status_user = update_data["status"]
    if "is_verified" in update_data:
        user.is_verified = update_data["is_verified"]
    if "failed_login_attempts" in update_data:
        user.failed_login_attempts = update_data["failed_login_attempts"]
    if "locked_until" in update_data:
        user.locked_until = update_data["locked_until"]

    user.updated_at = datetime.utcnow()
    return _user_response(user)


def activate_user(db: Session, user_id: str) -> UserManagementResponse:
    user = get_user_or_404(db, user_id)
    user.status_user = "Active"
    user.updated_at = datetime.utcnow()
    return _user_response(user)


def deactivate_user(db: Session, user_id: str) -> UserManagementResponse:
    user = get_user_or_404(db, user_id)
    user.status_user = "Inactive"
    user.updated_at = datetime.utcnow()
    return _user_response(user)


def lock_user(db: Session, user_id: str) -> UserManagementResponse:
    user = get_user_or_404(db, user_id)
    now = datetime.utcnow()
    user.status_user = "Locked"
    user.locked_until = now + timedelta(minutes=ACCOUNT_LOCK_MINUTES)
    user.updated_at = now
    return _user_response(user)


def unlock_user(db: Session, user_id: str) -> UserManagementResponse:
    user = get_user_or_404(db, user_id)
    user.status_user = "Active"
    user.failed_login_attempts = 0
    user.locked_until = None
    user.updated_at = datetime.utcnow()
    return _user_response(user)
