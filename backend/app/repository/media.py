from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.task_attachment import TaskAttachment


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


def create_task_attachment(db: Session, attachment: TaskAttachment) -> TaskAttachment:
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def get_task_attachment(db: Session, attachment_id: str) -> TaskAttachment | None:
    return db.execute(
        select(TaskAttachment)
        .options(joinedload(TaskAttachment.task).joinedload(Task.space))
        .where(TaskAttachment.attachment_id == attachment_id)
    ).scalar_one_or_none()


def list_task_attachments(
    db: Session,
    task_id: str,
    *,
    include_deleted: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[TaskAttachment], int]:
    query = db.query(TaskAttachment).filter(TaskAttachment.task_id == task_id)
    if not include_deleted:
        query = query.filter(TaskAttachment.deleted_at.is_(None))

    total = query.count()
    items = (
        query.order_by(TaskAttachment.uploaded_at.desc(), TaskAttachment.attachment_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def save_task_attachment(db: Session, attachment: TaskAttachment) -> TaskAttachment:
    db.commit()
    db.refresh(attachment)
    return attachment
