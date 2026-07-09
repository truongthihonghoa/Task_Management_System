from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.task_assignee import TaskAssignee
from app.models.task_assignment_history import TaskAssignmentHistory
from app.models.user import User
from app.models.user_token import UserToken


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def get_task_by_id(db: Session, task_id: str) -> Task | None:
    return db.execute(
        select(Task)
        .options(joinedload(Task.space))
        .where(Task.task_id == task_id)
    ).scalar_one_or_none()


def get_task_assignee(db: Session, task_id: str, assignee_id: str) -> TaskAssignee | None:
    return db.execute(
        select(TaskAssignee).where(
            TaskAssignee.task_id == task_id,
            TaskAssignee.assignee_id == assignee_id,
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


def list_task_assignees(db: Session, task_id: str) -> list[TaskAssignee]:
    return list(
        db.execute(
            select(TaskAssignee)
            .options(joinedload(TaskAssignee.assignee))
            .where(TaskAssignee.task_id == task_id)
            .order_by(TaskAssignee.assignee_at.asc())
        ).scalars()
    )


def list_assignment_history(db: Session, task_id: str) -> list[TaskAssignmentHistory]:
    return list(
        db.execute(
            select(TaskAssignmentHistory)
            .options(
                joinedload(TaskAssignmentHistory.previous_assignee),
                joinedload(TaskAssignmentHistory.new_assignee),
                joinedload(TaskAssignmentHistory.changed_by_user),
            )
            .where(TaskAssignmentHistory.task_id == task_id)
            .order_by(TaskAssignmentHistory.changed_at.desc())
        ).scalars()
    )


def get_active_space_member(db: Session, space_id: str, user_id: str) -> SpaceMember | None:
    return db.execute(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
    ).scalar_one_or_none()


def get_user_token(db: Session, access_token: str) -> UserToken | None:
    return db.execute(
        select(UserToken).where(
            UserToken.access_token == access_token,
            UserToken.is_revoked.is_(False),
        )
    ).scalar_one_or_none()


def create_task_assignee(db: Session, task_id: str, assignee_id: str) -> TaskAssignee:
    task_assignee = TaskAssignee(task_id=task_id, assignee_id=assignee_id)
    db.add(task_assignee)
    return task_assignee


def delete_task_assignee(db: Session, task_assignee: TaskAssignee) -> None:
    db.delete(task_assignee)


def create_assignment_history(
    db: Session,
    *,
    task_id: str,
    previous_assignee_id: str | None,
    new_assignee_id: str | None,
    changed_by: str,
    reason: str | None,
    change_status: str,
    changed_at: datetime,
) -> TaskAssignmentHistory:
    history = TaskAssignmentHistory(
        task_id=task_id,
        previous_assignee_id=previous_assignee_id,
        new_assignee_id=new_assignee_id,
        changed_by=changed_by,
        reason=reason,
        change_status=change_status,
        changed_at=changed_at,
    )
    db.add(history)
    return history
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
