from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.task_comment import TaskComment


def get_task_with_space(db: Session, task_id: str) -> Task | None:
    return db.execute(
        select(Task)
        .options(joinedload(Task.space))
        .where(Task.task_id == task_id)
    ).scalar_one_or_none()


def get_active_space_member(db: Session, space_id: str, user_id: str) -> SpaceMember | None:
    return db.execute(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
    ).scalar_one_or_none()


def get_comment(db: Session, comment_id: str) -> TaskComment | None:
    return db.execute(
        select(TaskComment)
        .options(
            joinedload(TaskComment.user),
            joinedload(TaskComment.task).joinedload(Task.space),
        )
        .where(TaskComment.comment_id == comment_id)
    ).scalar_one_or_none()


def list_comments(
    db: Session,
    *,
    task_id: str,
    include_deleted: bool,
    page: int,
    page_size: int,
) -> tuple[list[TaskComment], int]:
    query = (
        db.query(TaskComment)
        .options(joinedload(TaskComment.user))
        .filter(TaskComment.task_id == task_id)
    )
    if not include_deleted:
        query = query.filter(TaskComment.deleted_at.is_(None))

    total = query.count()
    items = (
        query.order_by(TaskComment.created_at.asc(), TaskComment.comment_id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def create_comment(db: Session, comment: TaskComment) -> TaskComment:
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def save_comment(db: Session, comment: TaskComment) -> TaskComment:
    db.commit()
    db.refresh(comment)
    return comment
