from dataclasses import dataclass

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.notification_constants import SortOrder
from app.models.notification import Notification


@dataclass
class NotificationListResult:
    items: list[Notification]
    total: int
    unread_count: int


def get_notification_for_user(db: Session, notification_id: str, user_id: str) -> Notification | None:
    return db.execute(
        select(Notification)
        .options(joinedload(Notification.actor))
        .where(
            Notification.notification_id == notification_id,
            Notification.user_id == user_id,
        )
    ).scalar_one_or_none()


def get_unread_count(db: Session, user_id: str) -> int:
    return int(
        db.execute(
            select(func.count(Notification.notification_id)).where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
        ).scalar_one()
    )


def list_notifications(
    db: Session,
    *,
    user_id: str,
    read_status: str | None = None,
    notification_type: str | None = None,
    audience: str | None = None,
    search: str | None = None,
    task_id: str | None = None,
    space_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort_order: str = SortOrder.DESC.value,
) -> NotificationListResult:
    query = db.query(Notification).options(joinedload(Notification.actor)).filter(Notification.user_id == user_id)

    if read_status == "read":
        query = query.filter(Notification.is_read.is_(True))
    elif read_status == "unread":
        query = query.filter(Notification.is_read.is_(False))
    if notification_type:
        query = query.filter(Notification.type == notification_type)
    if audience:
        query = query.filter(Notification.audience == audience)
    if task_id:
        query = query.filter(Notification.task_id == task_id)
    if space_id:
        query = query.filter(Notification.space_id == space_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Notification.title.ilike(pattern), Notification.message.ilike(pattern)))

    total = query.count()
    if sort_order == SortOrder.ASC.value:
        query = query.order_by(Notification.created_at.asc(), Notification.notification_id.asc())
    else:
        query = query.order_by(Notification.created_at.desc(), Notification.notification_id.desc())

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    return NotificationListResult(items=items, total=total, unread_count=get_unread_count(db, user_id))


def create_notification(db: Session, **values) -> Notification:
    notification = Notification(**values)
    db.add(notification)
    db.flush()
    return notification


def mark_notification_read_state(
    db: Session,
    *,
    notification_id: str,
    user_id: str,
    is_read: bool,
    read_at,
) -> Notification | None:
    notification = get_notification_for_user(db, notification_id, user_id)
    if notification is None:
        return None
    notification.is_read = is_read
    notification.read_at = read_at
    db.flush()
    return notification


def mark_all_read(db: Session, *, user_id: str, read_at) -> int:
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .update({Notification.is_read: True, Notification.read_at: read_at}, synchronize_session=False)
    )
    db.flush()
    return int(updated)


def bulk_mark_read(db: Session, *, user_id: str, notification_ids: list[str], read_at) -> int:
    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.notification_id.in_(notification_ids),
            Notification.is_read.is_(False),
        )
        .update({Notification.is_read: True, Notification.read_at: read_at}, synchronize_session=False)
    )
    db.flush()
    return int(updated)


def bulk_mark_read_state(
    db: Session,
    *,
    user_id: str,
    notification_ids: list[str],
    is_read: bool,
    read_at,
) -> int:
    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.notification_id.in_(notification_ids),
            Notification.is_read.is_(not is_read),
        )
        .update({Notification.is_read: is_read, Notification.read_at: read_at}, synchronize_session=False)
    )
    db.flush()
    return int(updated)


def delete_notification_for_user(db: Session, *, notification_id: str, user_id: str) -> bool:
    notification = get_notification_for_user(db, notification_id, user_id)
    if notification is None:
        return False
    db.delete(notification)
    db.flush()
    return True


def delete_read_notifications(db: Session, *, user_id: str) -> int:
    deleted = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(True))
        .delete(synchronize_session=False)
    )
    db.flush()
    return int(deleted)


def bulk_delete_notifications(db: Session, *, user_id: str, notification_ids: list[str]) -> int:
    deleted = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.notification_id.in_(notification_ids))
        .delete(synchronize_session=False)
    )
    db.flush()
    return int(deleted)
