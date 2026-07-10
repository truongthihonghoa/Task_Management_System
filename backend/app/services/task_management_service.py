from datetime import datetime
from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import task as task_repository
from app.models.space import Space
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.user import User
from app.schemas.pydantic_models import (
    TaskBoardResponse,
    TaskCreate,
    TaskDetailResponse,
    TaskListItemResponse,
    TaskListResponse,
    TaskUpdate,
)


def _get_space_or_404(db: Session, space_id: str) -> Space:
    space = task_repository.get_space(db, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    return space


def _ensure_space_not_deleted(space: Space) -> None:
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space is deleted")


def _ensure_space_active(space: Space) -> None:
    if space.status_space != "Active" or space.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space must be active")


def _can_view_space_tasks(db: Session, space: Space, user: User) -> bool:
    if user.role == "SUPER_ADMIN":
        return True
    if space.owner_id == user.user_id:
        return True
    return task_repository.get_active_space_member(db, space.space_id, user.user_id) is not None


def _ensure_can_view_space_tasks(db: Session, space: Space, user: User) -> None:
    if not _can_view_space_tasks(db, space, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")


def _ensure_can_modify_space_tasks(db: Session, space: Space, user: User) -> None:
    if user.role == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN cannot modify tasks",
        )
    _ensure_can_view_space_tasks(db, space, user)


def _ensure_space_owner(space: Space, user: User) -> None:
    if space.owner_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the space owner can perform this action",
        )


def _get_sprint_for_space_or_404(db: Session, space_id: str, sprint_id: str) -> Sprint:
    sprint = task_repository.get_sprint(db, sprint_id)
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    if sprint.space_id != space_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint does not belong to this space",
        )
    if sprint.status == "Deleted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sprint is deleted")
    return sprint


def _get_task_or_404(db: Session, task_id: str) -> Task:
    task = task_repository.get_task_with_details(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def _serialize_task_list_items(tasks: Iterable[Task]) -> list[TaskListItemResponse]:
    return [TaskListItemResponse.model_validate(task) for task in tasks]


def _build_task_list_response(tasks: list[Task], total: int, *, page: int, page_size: int) -> TaskListResponse:
    return TaskListResponse(
        items=_serialize_task_list_items(tasks),
        total=total,
        page=page,
        page_size=page_size,
    )


def create_task(db: Session, space_id: str, payload: TaskCreate, current_user: User) -> TaskDetailResponse:
    space = _get_space_or_404(db, space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_tasks(db, space, current_user)
    _get_sprint_for_space_or_404(db, space_id, payload.sprint_id)

    now = datetime.utcnow()
    task = Task(
        space_id=space_id,
        sprint_id=payload.sprint_id,
        title=payload.title,
        description=payload.description,
        creator_id=current_user.user_id,
        priority=payload.priority,
        task_status=payload.task_status,
        story_points=payload.story_points,
        completed_at=payload.completed_at,
        created_at=now,
        updated_at=now,
    )
    task_repository.create_task_record(db, task)
    return TaskDetailResponse.model_validate(_get_task_or_404(db, task.task_id))


def list_tasks(
    db: Session,
    space_id: str,
    current_user: User,
    *,
    page: int,
    page_size: int,
    search: str | None,
    task_status: str | None,
    priority: str | None,
    sort: str,
) -> TaskListResponse:
    space = _get_space_or_404(db, space_id)
    _ensure_space_not_deleted(space)
    _ensure_can_view_space_tasks(db, space, current_user)

    tasks, total = task_repository.list_task_records(
        db,
        space_id=space_id,
        deleted=False,
        page=page,
        page_size=page_size,
        search=search,
        task_status=task_status,
        priority=priority,
        sort=sort,
    )
    return _build_task_list_response(tasks, total, page=page, page_size=page_size)


def list_deleted_tasks(
    db: Session,
    space_id: str,
    current_user: User,
    *,
    page: int,
    page_size: int,
    search: str | None,
    task_status: str | None,
    priority: str | None,
    sort: str,
) -> TaskListResponse:
    space = _get_space_or_404(db, space_id)
    _ensure_space_not_deleted(space)
    _ensure_space_owner(space, current_user)

    tasks, total = task_repository.list_task_records(
        db,
        space_id=space_id,
        deleted=True,
        page=page,
        page_size=page_size,
        search=search,
        task_status=task_status,
        priority=priority,
        sort=sort,
    )
    return _build_task_list_response(tasks, total, page=page, page_size=page_size)


def get_task_board(db: Session, space_id: str, current_user: User) -> TaskBoardResponse:
    space = _get_space_or_404(db, space_id)
    _ensure_space_not_deleted(space)
    _ensure_can_view_space_tasks(db, space, current_user)

    grouped = {task_status: [] for task_status in task_repository.TASK_STATUSES}
    for task in task_repository.list_board_task_records(db, space_id):
        grouped.setdefault(task.task_status, []).append(TaskListItemResponse.model_validate(task))
    return TaskBoardResponse(**grouped)


def get_task_detail(db: Session, task_id: str, current_user: User) -> TaskDetailResponse:
    task = _get_task_or_404(db, task_id)
    space = task.space or _get_space_or_404(db, task.space_id)
    _ensure_space_not_deleted(space)
    _ensure_can_view_space_tasks(db, space, current_user)
    return TaskDetailResponse.model_validate(task)


def update_task(db: Session, task_id: str, payload: TaskUpdate, current_user: User) -> TaskDetailResponse:
    task = _get_task_or_404(db, task_id)
    if task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task is deleted")

    space = task.space or _get_space_or_404(db, task.space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_tasks(db, space, current_user)

    update_data = payload.model_dump(exclude_unset=True)
    if "sprint_id" in update_data:
        _get_sprint_for_space_or_404(db, task.space_id, update_data["sprint_id"])

    for field, value in update_data.items():
        setattr(task, field, value)
    task.updated_at = datetime.utcnow()

    task_repository.save_task(db, task)
    return TaskDetailResponse.model_validate(_get_task_or_404(db, task.task_id))


def delete_task(db: Session, task_id: str, current_user: User) -> TaskDetailResponse:
    task = _get_task_or_404(db, task_id)
    if task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task is already deleted")

    space = task.space or _get_space_or_404(db, task.space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_tasks(db, space, current_user)

    now = datetime.utcnow()
    task.deleted_at = now
    task.updated_at = now
    task_repository.save_task(db, task, refresh=False)
    return TaskDetailResponse.model_validate(_get_task_or_404(db, task.task_id))


def restore_task(db: Session, task_id: str, current_user: User) -> TaskDetailResponse:
    task = _get_task_or_404(db, task_id)
    if task.deleted_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task is not deleted")

    space = task.space or _get_space_or_404(db, task.space_id)
    _ensure_space_active(space)
    _ensure_space_owner(space, current_user)

    task.deleted_at = None
    task.updated_at = datetime.utcnow()
    task_repository.save_task(db, task, refresh=False)
    return TaskDetailResponse.model_validate(_get_task_or_404(db, task.task_id))
