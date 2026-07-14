from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.pydantic_models import (
    AssignTaskAssigneesRequest,
    AssignmentHistoryListResponse,
    MessageResponse,
    ReassignTaskAssigneeRequest,
    RemoveTaskAssigneeRequest,
    TaskAssigneesResponse,
)
from app.services.task_assignment_service import TaskAssignmentService


router = APIRouter(prefix="/tasks", tags=["tasks"])
task_assignment_service = TaskAssignmentService()


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
    assignees = task_assignment_service.assign_task_assignees(db, task_id, payload, current_user)
    return TaskAssigneesResponse(assignees=assignees)


@router.get("/{task_id}/assignees", response_model=TaskAssigneesResponse)
def get_task_assignees(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAssigneesResponse:
    assignees = task_assignment_service.get_task_assignees(db, task_id, current_user)
    return TaskAssigneesResponse(assignees=assignees)


@router.put("/{task_id}/assignees", response_model=TaskAssigneesResponse)
def reassign_task_assignee(
    task_id: str,
    payload: ReassignTaskAssigneeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAssigneesResponse:
    assignees = task_assignment_service.reassign_task_assignee(db, task_id, payload, current_user)
    return TaskAssigneesResponse(assignees=assignees)


@router.delete("/{task_id}/assignees/{assignee_id}", response_model=MessageResponse)
def remove_task_assignee(
    task_id: str,
    assignee_id: str,
    payload: RemoveTaskAssigneeRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    task_assignment_service.remove_task_assignee(db, task_id, assignee_id, payload, current_user)
    return MessageResponse(message="Assignee removed successfully.")


@router.get("/{task_id}/assignment-history", response_model=AssignmentHistoryListResponse)
def get_task_assignment_history(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignmentHistoryListResponse:
    history = task_assignment_service.get_assignment_history(db, task_id, current_user)
    return AssignmentHistoryListResponse(history=history)
