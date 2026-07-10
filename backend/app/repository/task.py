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
