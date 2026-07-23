from datetime import datetime
import unicodedata

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.task_assignee import TaskAssignee
from app.models.user import User
from app.models.user_preference import UserPreference


SEARCH_ALIASES = (
    (("quan", "quan ly"), ("manage", "management", "admin", "administration")),
    (("cong viec", "viec"), ("task", "tasks", "work")),
    (("nguoi dung", "thanh vien"), ("user", "users", "member", "members")),
    (("thong bao",), ("notification", "notifications", "alert", "alerts")),
    (("khong gian", "du an"), ("space", "spaces", "project", "projects", "workspace")),
    (("bao mat",), ("security", "permission", "permissions")),
    (("kiem tra", "nhat ky"), ("audit", "log", "logs")),
    (("moi",), ("new",)),
    (("dang lam", "dang thuc hien"), ("in_progress", "in progress", "progress")),
    (("kiem thu",), ("in_testing", "testing", "test")),
    (("cho duyet",), ("pending_review", "pending review", "review")),
    (("can sua", "can chinh sua"), ("need_revision", "need revision", "revision")),
    (("hoan thanh", "xong"), ("done", "completed", "complete")),
    (("qua han",), ("overdue",)),
    (("cao",), ("high",)),
    (("trung binh",), ("medium",)),
    (("thap",), ("low",)),
)


def _normalize_search_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return " ".join(without_marks.lower().split())


def _search_terms(query_text: str) -> list[str]:
    raw = (query_text or "").strip()
    normalized = _normalize_search_text(raw)
    terms = {raw, normalized}

    for triggers, aliases in SEARCH_ALIASES:
        if any(trigger in normalized for trigger in triggers):
            terms.update(aliases)

    return [term for term in terms if term]


def _ilike_any(*columns, query_text: str):
    return or_(
        *[
            column.ilike(f"%{term}%")
            for term in _search_terms(query_text)
            for column in columns
        ]
    )


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


def get_user_preference(db: Session, user_id: str) -> UserPreference | None:
    return db.query(UserPreference).filter(UserPreference.user_id == user_id).first()


def create_user_preference(db: Session, *, user_id: str, language: str) -> UserPreference:
    preference = UserPreference(user_id=user_id, language=language)
    db.add(preference)
    return preference


def update_user_preference(preference: UserPreference, *, language: str) -> UserPreference:
    preference.language = language
    preference.updated_at = datetime.utcnow()
    return preference


def search_spaces(db: Session, *, user: User, query_text: str, limit: int) -> list[tuple[Space, int]]:
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
                _ilike_any(
                    Space.space_id,
                    Space.name_space,
                    Space.description,
                    Space.status_space,
                    query_text=query_text,
                ),
                Space.owner.has(_ilike_any(User.full_name, User.email, query_text=query_text)),
            )
        )
    return (
        query.order_by(Space.updated_at.desc(), Space.created_at.desc(), Space.space_id.asc())
        .limit(limit)
        .all()
    )


def search_tasks(db: Session, *, user: User, query_text: str, limit: int, space_id: str | None = None) -> list[Task]:
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
                _ilike_any(
                    Task.task_id,
                    Task.title,
                    Task.description,
                    Task.task_status,
                    Task.priority,
                    query_text=query_text,
                ),
                Task.assignees.any(
                    TaskAssignee.assignee.has(_ilike_any(User.full_name, User.email, query_text=query_text))
                ),
            )
        )
    return (
        query.order_by(Task.updated_at.desc(), Task.created_at.desc(), Task.task_id.asc())
        .limit(limit)
        .all()
    )


def search_users(db: Session, *, query_text: str, limit: int) -> list[User]:
    query = db.query(User).options(
        selectinload(User.owned_spaces),
        selectinload(User.space_memberships).joinedload(SpaceMember.space),
    )
    if query_text:
        query = query.filter(
            _ilike_any(
                User.user_id,
                User.full_name,
                User.email,
                User.status_user,
                User.role,
                query_text=query_text,
            )
        )
    return query.order_by(User.updated_at.desc(), User.created_at.desc(), User.user_id.asc()).limit(limit).all()
