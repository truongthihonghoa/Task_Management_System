from datetime import datetime

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, aliased, joinedload, selectinload

from app.models.audit_log import AuditLog
from app.models.recent_view import RecentView
from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.task_assignee import TaskAssignee
from app.models.task_assignment_history import TaskAssignmentHistory
from app.models.user import User


def get_user_status_counts(db: Session) -> dict[str, int]:
    rows = db.query(User.status_user, func.count(User.user_id)).group_by(User.status_user).all()
    return {status: int(count or 0) for status, count in rows}


def get_space_status_counts(db: Session) -> dict[str, int]:
    rows = (
        db.query(Space.status_space, func.count(Space.space_id))
        .filter(Space.deleted_at.is_(None), Space.status_space != "Deleted")
        .group_by(Space.status_space)
        .all()
    )
    return {status: int(count or 0) for status, count in rows}


def get_active_space_by_id(db: Session, space_id: str) -> Space | None:
    return (
        db.query(Space)
        .options(joinedload(Space.owner))
        .filter(Space.space_id == space_id, Space.deleted_at.is_(None), Space.status_space != "Deleted")
        .first()
    )


def get_active_space_member(db: Session, space_id: str, user_id: str) -> SpaceMember | None:
    return (
        db.query(SpaceMember)
        .filter(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
        .first()
    )


def list_space_summary_members(db: Session, space_id: str) -> list[tuple[User, str, str, datetime | None, bool]]:
    space = get_active_space_by_id(db, space_id)
    if space is None:
        return []

    rows = (
        db.query(User, SpaceMember.role, SpaceMember.status, SpaceMember.joined_at)
        .join(SpaceMember, SpaceMember.user_id == User.user_id)
        .filter(
            SpaceMember.space_id == space_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
        .order_by(SpaceMember.role.desc(), User.full_name.asc(), User.user_id.asc())
        .all()
    )
    members = [(user, role, member_status, joined_at, user.user_id == space.owner_id) for user, role, member_status, joined_at in rows]
    if space.owner is not None and all(user.user_id != space.owner_id for user, *_ in members):
        members.insert(0, (space.owner, "OWNER", space.owner.status_user, None, True))
    return members


def get_space_member_status_count(db: Session, space_id: str, user_id: str) -> dict[str, int]:
    if user_id == (space.owner_id if (space := get_active_space_by_id(db, space_id)) else None):
        return {space.owner.status_user: 1} if space.owner is not None else {}

    row = (
        db.query(User.status_user)
        .join(SpaceMember, SpaceMember.user_id == User.user_id)
        .filter(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
        .first()
    )
    return {row[0]: 1} if row is not None else {}


def get_task_status_counts(db: Session) -> dict[str, int]:
    rows = (
        db.query(Task.task_status, func.count(Task.task_id))
        .filter(Task.deleted_at.is_(None))
        .group_by(Task.task_status)
        .all()
    )
    return {status: int(count or 0) for status, count in rows}


def get_space_task_status_counts(db: Session, space_id: str) -> dict[str, int]:
    rows = (
        db.query(Task.task_status, func.count(Task.task_id))
        .filter(Task.space_id == space_id, Task.deleted_at.is_(None))
        .group_by(Task.task_status)
        .all()
    )
    return {status: int(count or 0) for status, count in rows}


def get_member_task_status_counts(db: Session, space_id: str, user_id: str) -> dict[str, int]:
    rows = (
        db.query(Task.task_status, func.count(Task.task_id))
        .filter(
            Task.space_id == space_id,
            Task.deleted_at.is_(None),
            or_(Task.creator_id == user_id, Task.assignees.any(TaskAssignee.assignee_id == user_id)),
        )
        .group_by(Task.task_status)
        .all()
    )
    return {status: int(count or 0) for status, count in rows}


def get_task_priority_counts(db: Session) -> dict[str, int]:
    rows = (
        db.query(Task.priority, func.count(Task.task_id))
        .filter(Task.deleted_at.is_(None))
        .group_by(Task.priority)
        .all()
    )
    return {priority: int(count or 0) for priority, count in rows}


def get_space_task_priority_counts(db: Session, space_id: str) -> dict[str, int]:
    rows = (
        db.query(Task.priority, func.count(Task.task_id))
        .filter(Task.space_id == space_id, Task.deleted_at.is_(None))
        .group_by(Task.priority)
        .all()
    )
    return {priority: int(count or 0) for priority, count in rows}


def get_member_task_priority_counts(db: Session, space_id: str, user_id: str) -> dict[str, int]:
    rows = (
        db.query(Task.priority, func.count(Task.task_id))
        .filter(
            Task.space_id == space_id,
            Task.deleted_at.is_(None),
            or_(Task.creator_id == user_id, Task.assignees.any(TaskAssignee.assignee_id == user_id)),
        )
        .group_by(Task.priority)
        .all()
    )
    return {priority: int(count or 0) for priority, count in rows}


def count_overdue_tasks(db: Session, *, now: datetime | None = None) -> int:
    current_time = now or datetime.utcnow()
    return int(
        db.query(func.count(Task.task_id))
        .filter(
            Task.deleted_at.is_(None),
            Task.completed_at.isnot(None),
            func.date(Task.completed_at) < current_time.date(),
            Task.task_status.notin_(("done", "cancelled")),
        )
        .scalar()
        or 0
    )


def count_space_overdue_tasks(db: Session, space_id: str, *, now: datetime | None = None) -> int:
    current_time = now or datetime.utcnow()
    return int(
        db.query(func.count(Task.task_id))
        .filter(
            Task.space_id == space_id,
            Task.deleted_at.is_(None),
            Task.completed_at.isnot(None),
            func.date(Task.completed_at) < current_time.date(),
            Task.task_status.notin_(("done", "cancelled")),
        )
        .scalar()
        or 0
    )


def count_member_overdue_tasks(db: Session, space_id: str, user_id: str, *, now: datetime | None = None) -> int:
    current_time = now or datetime.utcnow()
    return int(
        db.query(func.count(Task.task_id))
        .filter(
            Task.space_id == space_id,
            Task.deleted_at.is_(None),
            or_(Task.creator_id == user_id, Task.assignees.any(TaskAssignee.assignee_id == user_id)),
            Task.completed_at.isnot(None),
            func.date(Task.completed_at) < current_time.date(),
            Task.task_status.notin_(("done", "cancelled")),
        )
        .scalar()
        or 0
    )


def get_space_member_status_counts(db: Session, space_id: str) -> dict[str, int]:
    space = get_active_space_by_id(db, space_id)
    if space is None:
        return {}

    member_rows = (
        db.query(User.user_id, User.status_user)
        .join(SpaceMember, SpaceMember.user_id == User.user_id)
        .filter(
            SpaceMember.space_id == space_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
        .all()
    )
    status_by_user_id = {user_id: status for user_id, status in member_rows}
    if space.owner is not None and space.owner_id not in status_by_user_id:
        status_by_user_id[space.owner_id] = space.owner.status_user

    counts: dict[str, int] = {}
    for status in status_by_user_id.values():
        counts[status] = counts.get(status, 0) + 1
    return counts


def list_activity_spaces(db: Session) -> list[tuple[Space, int, int, int]]:
    member_counts = (
        db.query(
            SpaceMember.space_id.label("space_id"),
            func.count(SpaceMember.space_member_id).label("member_count"),
        )
        .filter(SpaceMember.status == "Active", SpaceMember.removed_at.is_(None))
        .group_by(SpaceMember.space_id)
        .subquery()
    )
    task_counts = (
        db.query(Task.space_id.label("space_id"), func.count(Task.task_id).label("task_count"))
        .filter(Task.deleted_at.is_(None))
        .group_by(Task.space_id)
        .subquery()
    )
    assignment_counts = (
        db.query(Task.space_id.label("space_id"), func.count(TaskAssignmentHistory.assignment_history_id).label("history_count"))
        .join(TaskAssignmentHistory, TaskAssignmentHistory.task_id == Task.task_id)
        .filter(Task.deleted_at.is_(None))
        .group_by(Task.space_id)
        .subquery()
    )

    return (
        db.query(
            Space,
            func.coalesce(member_counts.c.member_count, 0).label("member_count"),
            func.coalesce(task_counts.c.task_count, 0).label("task_count"),
            func.coalesce(assignment_counts.c.history_count, 0).label("history_count"),
        )
        .outerjoin(member_counts, member_counts.c.space_id == Space.space_id)
        .outerjoin(task_counts, task_counts.c.space_id == Space.space_id)
        .outerjoin(assignment_counts, assignment_counts.c.space_id == Space.space_id)
        .filter(Space.deleted_at.is_(None), Space.status_space != "Deleted")
        .order_by(Space.created_at.desc(), Space.space_id.desc())
        .all()
    )


def list_worked_on_tasks(
    db: Session,
    *,
    page: int,
    page_size: int,
    space_id: str | None = None,
    search: str | None = None,
    status_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    user_id: str | None = None,
) -> tuple[list[Task], int]:
    query = (
        db.query(Task)
        .join(Space, Task.space_id == Space.space_id)
        .options(
            joinedload(Task.space),
            joinedload(Task.creator),
            selectinload(Task.assignees).joinedload(TaskAssignee.assignee),
        )
        .filter(Task.deleted_at.is_(None), Space.deleted_at.is_(None), Space.status_space != "Deleted")
    )

    if space_id:
        query = query.filter(Task.space_id == space_id)
    if user_id:
        query = query.filter(or_(Task.creator_id == user_id, Task.assignees.any(TaskAssignee.assignee_id == user_id)))
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Task.task_id.ilike(pattern), Task.title.ilike(pattern), Space.name_space.ilike(pattern)))
    if status_filter and status_filter not in {"All Status", "all"}:
        query = query.filter(Task.task_status == status_filter)
    if date_from:
        query = query.filter(Task.updated_at >= date_from)
    if date_to:
        query = query.filter(Task.updated_at <= date_to)

    total = query.count()
    items = query.order_by(Task.updated_at.desc(), Task.task_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_viewed_activities(
    db: Session,
    *,
    page: int,
    page_size: int,
    space_id: str | None = None,
    search: str | None = None,
    status_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    user_id: str | None = None,
) -> tuple[list[tuple[RecentView, User, Task | None, Space | None, Space | None, User | None]], int]:
    viewer = aliased(User)
    task_space = aliased(Space)
    direct_space = aliased(Space)
    viewed_user = aliased(User)

    query = (
        db.query(RecentView, viewer, Task, task_space, direct_space, viewed_user)
        .join(viewer, RecentView.user_id == viewer.user_id)
        .outerjoin(Task, and_(RecentView.entity_type == "task", RecentView.entity_id == Task.task_id))
        .outerjoin(task_space, Task.space_id == task_space.space_id)
        .outerjoin(direct_space, and_(RecentView.entity_type == "space", RecentView.entity_id == direct_space.space_id))
        .outerjoin(viewed_user, and_(RecentView.entity_type == "user", RecentView.entity_id == viewed_user.user_id))
        .filter(
            or_(
                RecentView.entity_type == "user",
                and_(RecentView.entity_type == "task", Task.deleted_at.is_(None), task_space.deleted_at.is_(None), task_space.status_space != "Deleted"),
                and_(RecentView.entity_type == "space", direct_space.deleted_at.is_(None), direct_space.status_space != "Deleted"),
            )
        )
    )

    if space_id:
        query = query.filter(or_(Task.space_id == space_id, direct_space.space_id == space_id))
    if user_id:
        query = query.filter(RecentView.user_id == user_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                RecentView.entity_id.ilike(pattern),
                viewer.full_name.ilike(pattern),
                viewer.email.ilike(pattern),
                Task.task_id.ilike(pattern),
                Task.title.ilike(pattern),
                task_space.name_space.ilike(pattern),
                direct_space.name_space.ilike(pattern),
                viewed_user.full_name.ilike(pattern),
                viewed_user.email.ilike(pattern),
            )
        )
    if status_filter and status_filter not in {"All Status", "all"}:
        query = query.filter(Task.task_status == status_filter)
    if date_from:
        query = query.filter(RecentView.viewed_at >= date_from)
    if date_to:
        query = query.filter(RecentView.viewed_at <= date_to)

    total = query.count()
    items = query.order_by(RecentView.viewed_at.desc(), RecentView.recent_view_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_assigned_to_me_tasks(
    db: Session,
    *,
    page: int,
    page_size: int,
    space_id: str,
    user_id: str,
    search: str | None = None,
    status_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    current_sprint_only: bool = False,
) -> tuple[list[Task], int]:
    query = (
        db.query(Task)
        .join(Space, Task.space_id == Space.space_id)
        .join(TaskAssignee, TaskAssignee.task_id == Task.task_id)
        .options(
            joinedload(Task.space),
            joinedload(Task.creator),
            selectinload(Task.assignees).joinedload(TaskAssignee.assignee),
        )
        .filter(
            Task.space_id == space_id,
            Task.deleted_at.is_(None),
            Space.deleted_at.is_(None),
            Space.status_space != "Deleted",
            TaskAssignee.assignee_id == user_id,
        )
    )

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Task.task_id.ilike(pattern), Task.title.ilike(pattern), Space.name_space.ilike(pattern)))
    if current_sprint_only:
        query = query.join(Sprint, Task.sprint_id == Sprint.sprint_id).filter(Sprint.status == "Active")
    if status_filter and status_filter not in {"All Status", "all"}:
        query = query.filter(Task.task_status == status_filter)
    if date_from:
        query = query.filter(Task.updated_at >= date_from)
    if date_to:
        query = query.filter(Task.updated_at <= date_to)

    total = query.count()
    items = query.order_by(Task.updated_at.desc(), Task.task_id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_audit_logs(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    event_type: str | None = None,
    label_title: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
) -> tuple[list[AuditLog], int]:
    query = db.query(AuditLog).outerjoin(User, AuditLog.user_id == User.user_id).options(joinedload(AuditLog.user))

    normalized_search = search.strip() if search else None
    if normalized_search:
        pattern = f"%{normalized_search}%"
        query = query.filter(
            or_(
                AuditLog.log_id.ilike(pattern),
                AuditLog.action.ilike(pattern),
                AuditLog.label_title.ilike(pattern),
                AuditLog.entity_id.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    if event_type and event_type not in {"All Events", "all"}:
        query = query.filter(AuditLog.action == event_type)
    if label_title and label_title not in {"All Labels", "all"}:
        query = query.filter(AuditLog.label_title == label_title)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)

    total = query.count()
    if sort_order.lower() == "asc":
        query = query.order_by(AuditLog.created_at.asc(), AuditLog.log_id.asc())
    else:
        query = query.order_by(AuditLog.created_at.desc(), AuditLog.log_id.desc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_task_audit_logs(
    db: Session,
    *,
    page: int,
    page_size: int,
    space_id: str,
    search: str | None = None,
    status_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    user_id: str | None = None,
) -> tuple[list[tuple[AuditLog, Task]], int]:
    query = (
        db.query(AuditLog, Task)
        .join(Task, AuditLog.entity_id == Task.task_id)
        .outerjoin(User, AuditLog.user_id == User.user_id)
        .options(joinedload(AuditLog.user), joinedload(Task.space))
        .filter(
            Task.space_id == space_id,
            Task.deleted_at.is_(None),
        )
    )

    if user_id:
        query = query.filter(or_(Task.creator_id == user_id, Task.assignees.any(TaskAssignee.assignee_id == user_id)))

    normalized_search = search.strip() if search else None
    if normalized_search:
        pattern = f"%{normalized_search}%"
        query = query.filter(
            or_(
                AuditLog.log_id.ilike(pattern),
                AuditLog.action.ilike(pattern),
                AuditLog.label_title.ilike(pattern),
                AuditLog.entity_id.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                Task.task_id.ilike(pattern),
                Task.title.ilike(pattern),
            )
        )

    if status_filter and status_filter not in {"All Status", "all"}:
        query = query.filter(Task.task_status == status_filter)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)

    total = query.count()
    items = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.log_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_audit_log_by_id(db: Session, log_id: str) -> AuditLog | None:
    return (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .filter(AuditLog.log_id == log_id)
        .first()
    )


def get_audit_log_event_type_counts(db: Session) -> list[tuple[str, int]]:
    return (
        db.query(AuditLog.action, func.count(AuditLog.log_id))
        .group_by(AuditLog.action)
        .order_by(AuditLog.action.asc())
        .all()
    )


def get_audit_log_label_title_counts(db: Session) -> list[tuple[str, int]]:
    return (
        db.query(AuditLog.label_title, func.count(AuditLog.log_id))
        .group_by(AuditLog.label_title)
        .order_by(AuditLog.label_title.asc())
        .all()
    )


def list_assignment_history(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    change_status: str | None = None,
    space_id: str | None = None,
    member_id: str | None = None,
    related_user_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    current_sprint_only: bool = False,
) -> tuple[list[TaskAssignmentHistory], int]:
    query = (
        db.query(TaskAssignmentHistory)
        .join(Task, TaskAssignmentHistory.task_id == Task.task_id)
        .outerjoin(Space, Task.space_id == Space.space_id)
        .options(
            joinedload(TaskAssignmentHistory.task).joinedload(Task.space),
            joinedload(TaskAssignmentHistory.previous_assignee),
            joinedload(TaskAssignmentHistory.new_assignee),
            joinedload(TaskAssignmentHistory.changed_by_user),
        )
    )

    normalized_search = search.strip() if search else None
    if normalized_search:
        pattern = f"%{normalized_search}%"
        query = query.filter(
            or_(
                TaskAssignmentHistory.assignment_history_id.ilike(pattern),
                TaskAssignmentHistory.task_id.ilike(pattern),
                Task.title.ilike(pattern),
                Space.name_space.ilike(pattern),
            )
        )

    if change_status and change_status not in {"All Status", "all"}:
        query = query.filter(TaskAssignmentHistory.change_status == change_status)
    if space_id:
        query = query.filter(Task.space_id == space_id)
    if member_id:
        query = query.filter(
            or_(
                TaskAssignmentHistory.previous_assignee_id == member_id,
                TaskAssignmentHistory.new_assignee_id == member_id,
            )
        )
    if related_user_id:
        query = query.filter(
            or_(
                Task.creator_id == related_user_id,
                Task.assignees.any(TaskAssignee.assignee_id == related_user_id),
                TaskAssignmentHistory.previous_assignee_id == related_user_id,
                TaskAssignmentHistory.new_assignee_id == related_user_id,
            )
        )
    if current_sprint_only:
        query = query.join(Sprint, Task.sprint_id == Sprint.sprint_id).filter(Sprint.status == "Active")
    if date_from:
        query = query.filter(TaskAssignmentHistory.changed_at >= date_from)
    if date_to:
        query = query.filter(TaskAssignmentHistory.changed_at <= date_to)

    total = query.count()
    if sort_order.lower() == "asc":
        query = query.order_by(TaskAssignmentHistory.changed_at.asc(), TaskAssignmentHistory.assignment_history_id.asc())
    else:
        query = query.order_by(TaskAssignmentHistory.changed_at.desc(), TaskAssignmentHistory.assignment_history_id.desc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total
