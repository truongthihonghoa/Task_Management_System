from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.space import Space
from app.models.space_member import SpaceMember
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.task_assignment_history import TaskAssignmentHistory
from app.models.task_assignee import TaskAssignee
from app.models.task_comment import TaskComment


TASK_STATUSES = (
    "new",
    "in_progress",
    "in_testing",
    "pending_review",
    "need_revision",
    "done",
    "cancelled",
)


def get_space(db: Session, space_id: str) -> Space | None:
    return db.query(Space).filter(Space.space_id == space_id).first()


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


def get_sprint(db: Session, sprint_id: str) -> Sprint | None:
    return db.query(Sprint).filter(Sprint.sprint_id == sprint_id).first()


def task_detail_query(db: Session):
    return db.query(Task).options(
        joinedload(Task.sprint),
        joinedload(Task.creator),
        joinedload(Task.assignees).joinedload(TaskAssignee.assignee),
        joinedload(Task.comments).joinedload(TaskComment.user),
        joinedload(Task.attachments),
        joinedload(Task.assignment_history).joinedload(TaskAssignmentHistory.previous_assignee),
        joinedload(Task.assignment_history).joinedload(TaskAssignmentHistory.new_assignee),
        joinedload(Task.assignment_history).joinedload(TaskAssignmentHistory.changed_by_user),
    )


def get_task_with_details(db: Session, task_id: str) -> Task | None:
    return task_detail_query(db).filter(Task.task_id == task_id).first()


def _apply_task_filters(query, search: str | None, task_status: str | None, priority: str | None):
    if search:
        normalized = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Task.task_id).like(normalized),
                func.lower(Task.title).like(normalized),
            )
        )
    if task_status:
        query = query.filter(Task.task_status == task_status)
    if priority:
        query = query.filter(Task.priority == priority)
    return query


def list_task_records(
    db: Session,
    *,
    space_id: str,
    deleted: bool,
    page: int,
    page_size: int,
    search: str | None,
    task_status: str | None,
    priority: str | None,
    sort: str,
) -> tuple[list[Task], int]:
    deleted_filter = Task.deleted_at.isnot(None) if deleted else Task.deleted_at.is_(None)
    query = db.query(Task).options(joinedload(Task.sprint)).filter(
        Task.space_id == space_id,
        deleted_filter,
    )
    query = _apply_task_filters(query, search, task_status, priority)

    total = query.count()
    if sort == "oldest":
        query = query.order_by(Task.created_at.asc(), Task.task_id.asc())
    else:
        query = query.order_by(Task.created_at.desc(), Task.task_id.desc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_board_task_records(db: Session, space_id: str) -> list[Task]:
    return (
        db.query(Task)
        .options(joinedload(Task.sprint))
        .filter(Task.space_id == space_id, Task.deleted_at.is_(None))
        .order_by(Task.created_at.desc(), Task.task_id.desc())
        .all()
    )


def create_task_record(db: Session, task: Task) -> Task:
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def save_task(db: Session, task: Task, *, refresh: bool = True) -> Task:
    db.commit()
    if refresh:
        db.refresh(task)
    return task
