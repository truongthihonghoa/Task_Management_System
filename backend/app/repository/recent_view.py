from datetime import datetime

from sqlalchemy import and_, func, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.recent_view import RecentView
from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.task_assignee import TaskAssignee
from app.models.user import User


RECENT_ENTITY_TYPES = {"space", "task", "user"}


def _active_space_filter():
    return Space.deleted_at.is_(None), Space.status_space != "Deleted"


def _active_member_filter(user_id: str):
    return (
        SpaceMember.user_id == user_id,
        SpaceMember.status == "Active",
        SpaceMember.removed_at.is_(None),
    )


def _user_can_access_space_condition(user: User):
    if user.role == "SUPER_ADMIN":
        return True
    return or_(
        Space.owner_id == user.user_id,
        Space.members.any(and_(*_active_member_filter(user.user_id))),
    )


def record_recent_view(
    db: Session,
    *,
    user_id: str,
    entity_type: str,
    entity_id: str,
    viewed_at: datetime | None = None,
) -> None:
    if entity_type not in RECENT_ENTITY_TYPES:
        raise ValueError("Invalid recent view entity type.")

    now = viewed_at or datetime.utcnow()
    statement = (
        insert(RecentView)
        .values(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            viewed_at=now,
        )
        .on_conflict_do_update(
            constraint="uq_recent_views_user_entity",
            set_={"viewed_at": now},
        )
    )
    db.execute(statement)
    db.commit()


def list_recent_spaces(db: Session, *, user: User, limit: int) -> list[tuple[Space, int, datetime]]:
    member_counts = (
        db.query(
            SpaceMember.space_id.label("space_id"),
            func.count(SpaceMember.space_member_id).label("member_count"),
        )
        .filter(SpaceMember.status == "Active", SpaceMember.removed_at.is_(None))
        .group_by(SpaceMember.space_id)
        .subquery()
    )
    query = (
        db.query(Space, func.coalesce(member_counts.c.member_count, 0).label("member_count"), RecentView.viewed_at)
        .join(RecentView, and_(RecentView.entity_type == "space", RecentView.entity_id == Space.space_id))
        .outerjoin(member_counts, member_counts.c.space_id == Space.space_id)
        .options(joinedload(Space.owner))
        .filter(RecentView.user_id == user.user_id, *_active_space_filter())
    )
    if user.role != "SUPER_ADMIN":
        query = query.filter(_user_can_access_space_condition(user))
    return query.order_by(RecentView.viewed_at.desc()).limit(limit).all()


def list_recent_tasks(db: Session, *, user: User, limit: int, space_id: str | None = None) -> list[tuple[Task, datetime]]:
    query = (
        db.query(Task, RecentView.viewed_at)
        .join(RecentView, and_(RecentView.entity_type == "task", RecentView.entity_id == Task.task_id))
        .join(Space, Task.space_id == Space.space_id)
        .options(
            joinedload(Task.space),
            selectinload(Task.assignees).joinedload(TaskAssignee.assignee),
        )
        .filter(
            RecentView.user_id == user.user_id,
            Task.deleted_at.is_(None),
            *_active_space_filter(),
        )
    )
    if user.role != "SUPER_ADMIN":
        query = query.filter(_user_can_access_space_condition(user))
    if space_id:
        query = query.filter(Task.space_id == space_id)
    return query.order_by(RecentView.viewed_at.desc()).limit(limit).all()


def list_recent_users(db: Session, *, user: User, limit: int) -> list[tuple[User, datetime]]:
    if user.role != "SUPER_ADMIN":
        return []
    return (
        db.query(User, RecentView.viewed_at)
        .join(RecentView, and_(RecentView.entity_type == "user", RecentView.entity_id == User.user_id))
        .options(
            selectinload(User.owned_spaces),
            selectinload(User.space_memberships).joinedload(SpaceMember.space),
        )
        .filter(RecentView.user_id == user.user_id)
        .order_by(RecentView.viewed_at.desc())
        .limit(limit)
        .all()
    )
