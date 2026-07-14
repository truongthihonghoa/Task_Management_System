from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.task_assignee import TaskAssignee
from app.models.user import User


def _active_space_filter():
    return Space.deleted_at.is_(None), Space.status_space != "Deleted"


def _active_member_filter(user_id: str):
    return (
        SpaceMember.user_id == user_id,
        SpaceMember.status == "Active",
        SpaceMember.removed_at.is_(None),
    )


def user_can_access_space_condition(user: User):
    if user.role == "SUPER_ADMIN":
        return True
    return or_(
        Space.owner_id == user.user_id,
        Space.members.any(and_(*_active_member_filter(user.user_id))),
    )


def count_visible_tasks(db: Session, user: User) -> int:
    query = (
        db.query(func.count(Task.task_id))
        .join(Space, Task.space_id == Space.space_id)
        .filter(
            Task.deleted_at.is_(None),
            *_active_space_filter(),
        )
    )
    if user.role != "SUPER_ADMIN":
        query = query.filter(user_can_access_space_condition(user))
    return int(query.scalar() or 0)


def get_space_for_context(db: Session, space_id: str) -> Space | None:
    return (
        db.query(Space)
        .options(joinedload(Space.owner))
        .filter(Space.space_id == space_id)
        .first()
    )


def get_active_space_member(db: Session, *, space_id: str, user_id: str) -> SpaceMember | None:
    return (
        db.query(SpaceMember)
        .filter(
            SpaceMember.space_id == space_id,
            *_active_member_filter(user_id),
        )
        .first()
    )


def search_spaces(db: Session, *, user: User, query_text: str, limit: int) -> list[tuple[Space, int]]:
    pattern = f"%{query_text}%"
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
        db.query(Space, func.coalesce(member_counts.c.member_count, 0).label("member_count"))
        .options(joinedload(Space.owner))
        .outerjoin(member_counts, member_counts.c.space_id == Space.space_id)
        .filter(*_active_space_filter())
    )
    if user.role != "SUPER_ADMIN":
        query = query.filter(user_can_access_space_condition(user))
    if query_text:
        query = query.filter(
            or_(
                Space.space_id.ilike(pattern),
                Space.name_space.ilike(pattern),
                Space.description.ilike(pattern),
                Space.owner.has(User.full_name.ilike(pattern)),
            )
        )
    return (
        query.order_by(Space.updated_at.desc(), Space.created_at.desc(), Space.space_id.asc())
        .limit(limit)
        .all()
    )


def search_tasks(db: Session, *, user: User, query_text: str, limit: int, space_id: str | None = None) -> list[Task]:
    pattern = f"%{query_text}%"
    query = (
        db.query(Task)
        .join(Space, Task.space_id == Space.space_id)
        .options(
            joinedload(Task.space),
            selectinload(Task.assignees).joinedload(TaskAssignee.assignee),
        )
        .filter(
            Task.deleted_at.is_(None),
            *_active_space_filter(),
        )
    )
    if user.role != "SUPER_ADMIN":
        query = query.filter(user_can_access_space_condition(user))
    if space_id:
        query = query.filter(Task.space_id == space_id)
    if query_text:
        query = query.filter(
            or_(
                Task.task_id.ilike(pattern),
                Task.title.ilike(pattern),
                Task.description.ilike(pattern),
                Task.task_status.ilike(pattern),
                Task.priority.ilike(pattern),
                Task.assignees.any(TaskAssignee.assignee.has(User.full_name.ilike(pattern))),
            )
        )
    return (
        query.order_by(Task.updated_at.desc(), Task.created_at.desc(), Task.task_id.asc())
        .limit(limit)
        .all()
    )


def search_users(db: Session, *, query_text: str, limit: int) -> list[User]:
    pattern = f"%{query_text}%"
    query = db.query(User).options(
        selectinload(User.owned_spaces),
        selectinload(User.space_memberships).joinedload(SpaceMember.space),
    )
    if query_text:
        query = query.filter(
            or_(
                User.user_id.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                User.status_user.ilike(pattern),
                User.role.ilike(pattern),
            )
        )
    return query.order_by(User.updated_at.desc(), User.created_at.desc(), User.user_id.asc()).limit(limit).all()
