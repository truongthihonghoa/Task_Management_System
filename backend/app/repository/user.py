"""
user_repository.py — Pure database operations for user management.
"""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user_token import UserToken


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.user_id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get a user by email address."""
    return db.query(User).filter(User.email == email).first()


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
) -> tuple[int, list[User]]:
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
    sort_column = getattr(User, sort_by)
    order_expression = asc(sort_column) if sort_order == "asc" else desc(sort_column)
    users = query.order_by(order_expression).offset((page - 1) * page_size).limit(page_size).all()
    return total, users


def update_user_fields(db: Session, user: User, update_data: dict[str, Any]) -> User:
    for key, value in update_data.items():
        setattr(user, key, value)
    user.updated_at = datetime.utcnow()
    return user


def revoke_user_tokens(db: Session, user_id: str) -> None:
    db.query(UserToken).filter(UserToken.user_id == user_id).delete()
