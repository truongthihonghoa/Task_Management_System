from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.repository.auth_repository import create_audit_log
from app.repository.task_repository import (
    create_assignment_history,
    create_task_assignee,
    delete_task_assignee,
    get_active_space_member,
    get_task_assignee,
    get_task_by_id,
    list_assignment_history,
    list_task_assignees,
)
from app.repository.auth_repository import get_user_by_id
from app.db.session import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.pydantic_models import (
    AssignTaskAssigneesRequest,
    AssignmentHistoryListResponse,
    MessageResponse,
    ReassignTaskAssigneeRequest,
    RemoveTaskAssigneeRequest,
    TaskAssigneesResponse,
)


router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_active_task_or_404(db: Session, task_id: str) -> Task:
    task = get_task_by_id(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    if task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task deleted.")
    return task


def _is_space_owner(task: Task, user: User) -> bool:
    return task.space is not None and task.space.owner_id == user.user_id


def _is_active_space_member(db: Session, task: Task, user_id: str) -> bool:
    return get_active_space_member(db, task.space_id, user_id) is not None


def _ensure_can_view_task_assignments(db: Session, task: Task, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if _is_space_owner(task, current_user):
        return
    if _is_active_space_member(db, task, current_user.user_id):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")


def _ensure_can_modify_task_assignments(db: Session, task: Task, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN cannot modify task assignments.",
        )
    _ensure_can_view_task_assignments(db, task, current_user)


def _validate_assignable_user(db: Session, task: Task, user_id: str) -> User:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User not found: {user_id}")
    if user.status_user != "Active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User is inactive: {user_id}")
    if user.locked_until is not None and user.locked_until > datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User is locked: {user_id}")
    if not _is_active_space_member(db, task, user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User is not an active member of the task space: {user_id}",
        )
    return user


@router.post(
    "/{task_id}/assignees",
    response_model=TaskAssigneesResponse,
    status_code=status.HTTP_201_CREATED,
)
def assign_task_assignees(
    task_id: str,
    payload: AssignTaskAssigneesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAssigneesResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_can_modify_task_assignments(db, task, current_user)

    for assignee_id in payload.assignee_ids:
        _validate_assignable_user(db, task, assignee_id)
        if get_task_assignee(db, task_id, assignee_id) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User already assigned: {assignee_id}",
            )

    now = datetime.utcnow()
    try:
        for assignee_id in payload.assignee_ids:
            create_task_assignee(db, task_id, assignee_id)
            create_assignment_history(
                db,
                task_id=task_id,
                previous_assignee_id=None,
                new_assignee_id=assignee_id,
                changed_by=current_user.user_id,
                reason=payload.reason,
                change_status=task.task_status,
                changed_at=now,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return TaskAssigneesResponse(assignees=list_task_assignees(db, task_id))


@router.get("/{task_id}/assignees", response_model=TaskAssigneesResponse)
def get_task_assignees(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAssigneesResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_can_view_task_assignments(db, task, current_user)
    return TaskAssigneesResponse(assignees=list_task_assignees(db, task_id))


@router.put("/{task_id}/assignees", response_model=TaskAssigneesResponse)
def reassign_task_assignee(
    task_id: str,
    payload: ReassignTaskAssigneeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAssigneesResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_can_modify_task_assignments(db, task, current_user)

    current_assignment = get_task_assignee(db, task_id, payload.previous_assignee_id)
    if current_assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Previous assignee not found.")

    if payload.new_assignee_id is not None:
        _validate_assignable_user(db, task, payload.new_assignee_id)
        existing_assignment = get_task_assignee(db, task_id, payload.new_assignee_id)
        if existing_assignment is not None and payload.new_assignee_id != payload.previous_assignee_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User already assigned: {payload.new_assignee_id}",
            )
        if payload.new_assignee_id == payload.previous_assignee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New assignee must be different from previous assignee.",
            )

    now = datetime.utcnow()
    try:
        if payload.new_assignee_id is None:
            delete_task_assignee(db, current_assignment)
        else:
            current_assignment.assignee_id = payload.new_assignee_id

        create_assignment_history(
            db,
            task_id=task_id,
            previous_assignee_id=payload.previous_assignee_id,
            new_assignee_id=payload.new_assignee_id,
            changed_by=current_user.user_id,
            reason=payload.reason,
            change_status=task.task_status,
            changed_at=now,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return TaskAssigneesResponse(assignees=list_task_assignees(db, task_id))


@router.delete("/{task_id}/assignees/{assignee_id}", response_model=MessageResponse)
def remove_task_assignee(
    task_id: str,
    assignee_id: str,
    payload: RemoveTaskAssigneeRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_can_modify_task_assignments(db, task, current_user)

    current_assignment = get_task_assignee(db, task_id, assignee_id)
    if current_assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Previous assignee not found.")

    now = datetime.utcnow()
    try:
        delete_task_assignee(db, current_assignment)
        create_assignment_history(
            db,
            task_id=task_id,
            previous_assignee_id=assignee_id,
            new_assignee_id=None,
            changed_by=current_user.user_id,
            reason=payload.reason if payload else None,
            change_status=task.task_status,
            changed_at=now,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return MessageResponse(message="Assignee removed successfully.")


@router.get("/{task_id}/assignment-history", response_model=AssignmentHistoryListResponse)
def get_task_assignment_history(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignmentHistoryListResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_can_view_task_assignments(db, task, current_user)
    return AssignmentHistoryListResponse(history=list_assignment_history(db, task_id))
