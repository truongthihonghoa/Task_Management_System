from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.task_assignee import TaskAssignee


def get_active_space_membership(db: Session, *, space_id: str, user_id: str) -> SpaceMember | None:
    return db.execute(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
    ).scalar_one_or_none()


def count_completed_tasks(db: Session, *, user_id: str, space_id: str | None) -> int:
    query = (
        select(func.count(Task.task_id))
        .join(TaskAssignee, TaskAssignee.task_id == Task.task_id)
        .where(
            TaskAssignee.assignee_id == user_id,
            Task.task_status == "done",
            Task.deleted_at.is_(None),
        )
    )
    if space_id:
        query = query.where(Task.space_id == space_id)
    return int(db.execute(query).scalar() or 0)


def list_assigned_tasks(
    db: Session,
    *,
    user_id: str,
    space_id: str | None,
    limit: int = 10,
) -> list[Task]:
    query = (
        select(Task)
        .join(TaskAssignee, TaskAssignee.task_id == Task.task_id)
        .where(
            TaskAssignee.assignee_id == user_id,
            Task.deleted_at.is_(None),
        )
        .order_by(Task.created_at.desc(), Task.task_id.desc())
        .limit(limit)
    )
    if space_id:
        query = query.where(Task.space_id == space_id)
    return list(db.execute(query).scalars())


def list_notifications(
    db: Session,
    *,
    user_id: str,
    space_id: str | None,
    unread_only: bool = False,
    limit: int = 10,
) -> list[Notification]:
    query = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
        .limit(limit)
    )
    if space_id:
        query = query.where(Notification.space_id == space_id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    return list(db.execute(query).scalars())
