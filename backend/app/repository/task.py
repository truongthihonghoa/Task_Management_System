from datetime import datetime

from sqlalchemy import func, or_, select
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
    return db.execute(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
    ).scalar_one_or_none()


def get_sprint(db: Session, sprint_id: str) -> Sprint | None:
    return db.query(Sprint).filter(Sprint.sprint_id == sprint_id).first()


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


def create_task_assignee(db: Session, task_id: str, assignee_id: str) -> TaskAssignee:
    task_assignee = TaskAssignee(task_id=task_id, assignee_id=assignee_id)
    db.add(task_assignee)
    return task_assignee


def delete_task_assignee(db: Session, task_assignee: TaskAssignee) -> None:
    db.delete(task_assignee)


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
    active_sprint_only: bool = False,
) -> tuple[list[Task], int]:
    deleted_filter = Task.deleted_at.isnot(None) if deleted else Task.deleted_at.is_(None)
    query = db.query(Task).options(
        joinedload(Task.sprint),
        joinedload(Task.attachments),
        joinedload(Task.assignees).joinedload(TaskAssignee.assignee),
    ).filter(
        Task.space_id == space_id,
        deleted_filter,
    )
    if active_sprint_only:
        query = query.join(Task.sprint).filter(Sprint.status == "Active")
    query = _apply_task_filters(query, search, task_status, priority)

    total = query.count()
    if sort == "oldest":
        query = query.order_by(Task.created_at.asc(), Task.task_id.asc())
    else:
        query = query.order_by(Task.created_at.desc(), Task.task_id.desc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def list_board_task_records(db: Session, space_id: str, *, active_sprint_only: bool = True) -> list[Task]:
    query = (
        db.query(Task)
        .options(
            joinedload(Task.sprint),
            joinedload(Task.attachments),
            joinedload(Task.assignees).joinedload(TaskAssignee.assignee),
        )
        .filter(Task.space_id == space_id, Task.deleted_at.is_(None))
    )
    if active_sprint_only:
        query = query.join(Task.sprint).filter(Sprint.status == "Active")
    return (
        query
        .order_by(Task.created_at.desc(), Task.task_id.desc())
        .all()
    )


def create_task_record(db: Session, task: Task, *, commit: bool = True) -> Task:
    db.add(task)
    if commit:
        db.commit()
    else:
        db.flush()
    db.refresh(task)
    return task


def save_task(db: Session, task: Task, *, refresh: bool = True) -> Task:
    db.commit()
    if refresh:
        db.refresh(task)
    return task
"""
task_repository.py — Pure database operations for task assignment flows.

No business logic, no HTTPException.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.space_member import SpaceMember
from app.models.task import Task
from app.models.task_assignee import TaskAssignee
from app.models.task_assignment_history import TaskAssignmentHistory


# ---------------------------------------------------------------------------
# Task queries
# ---------------------------------------------------------------------------

def get_task_by_id(db: Session, task_id: str) -> Task | None:
    return db.execute(
        select(Task)
        .options(joinedload(Task.space))
        .where(Task.task_id == task_id)
    ).scalar_one_or_none()


# ---------------------------------------------------------------------------
# TaskAssignee queries & mutations
# ---------------------------------------------------------------------------

def get_task_assignee(db: Session, task_id: str, assignee_id: str) -> TaskAssignee | None:
    return db.execute(
        select(TaskAssignee).where(
            TaskAssignee.task_id == task_id,
            TaskAssignee.assignee_id == assignee_id,
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


def create_task_assignee(db: Session, task_id: str, assignee_id: str) -> TaskAssignee:
    task_assignee = TaskAssignee(task_id=task_id, assignee_id=assignee_id)
    db.add(task_assignee)
    return task_assignee


def delete_task_assignee(db: Session, task_assignee: TaskAssignee) -> None:
    db.delete(task_assignee)


# ---------------------------------------------------------------------------
# TaskAssignmentHistory queries & mutations
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# SpaceMember queries
# ---------------------------------------------------------------------------

def get_active_space_member(db: Session, space_id: str, user_id: str) -> SpaceMember | None:
    return db.execute(
        select(SpaceMember).where(
            SpaceMember.space_id == space_id,
            SpaceMember.user_id == user_id,
            SpaceMember.status == "Active",
            SpaceMember.removed_at.is_(None),
        )
    ).scalar_one_or_none()
