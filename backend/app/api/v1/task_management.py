from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.pydantic_models import (
    TaskBoardResponse,
    TaskCreate,
    TaskDetailResponse,
    TaskListResponse,
    TaskPriority,
    TaskSort,
    TaskStatus,
    TaskUpdate,
)
from app.services import task_management_service


router = APIRouter(tags=["task-management"])


@router.post(
    "/spaces/{space_id}/tasks",
    response_model=TaskDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    space_id: str,
    title: str = Form(...),
    sprint_id: str = Form(...),
    priority: TaskPriority = Form(...),
    description: str | None = Form(default=None),
    task_status: TaskStatus = Form(default="new"),
    story_points: float = Form(default=0),
    completed_at: datetime | None = Form(default=None),
    attachments: list[UploadFile] = File(default_factory=list),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskDetailResponse:
    payload = TaskCreate(
        title=title,
        description=description,
        sprint_id=sprint_id,
        priority=priority,
        task_status=task_status,
        story_points=story_points,
        completed_at=completed_at,
    )
    return task_management_service.create_task(
        db,
        space_id,
        payload,
        current_user,
        attachments=attachments,
    )


@router.get("/spaces/{space_id}/tasks", response_model=TaskListResponse)
def list_tasks(
    space_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    task_status: TaskStatus | None = Query(default=None),
    priority: TaskPriority | None = Query(default=None),
    sort: TaskSort = Query(default="newest"),
    active_sprint_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskListResponse:
    return task_management_service.list_tasks(
        db,
        space_id,
        current_user,
        page=page,
        page_size=page_size,
        search=search,
        task_status=task_status,
        priority=priority,
        sort=sort,
        active_sprint_only=active_sprint_only,
    )


@router.get("/spaces/{space_id}/tasks/deleted", response_model=TaskListResponse)
def list_deleted_tasks(
    space_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    task_status: TaskStatus | None = Query(default=None),
    priority: TaskPriority | None = Query(default=None),
    sort: TaskSort = Query(default="newest"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskListResponse:
    return task_management_service.list_deleted_tasks(
        db,
        space_id,
        current_user,
        page=page,
        page_size=page_size,
        search=search,
        task_status=task_status,
        priority=priority,
        sort=sort,
    )


@router.get("/spaces/{space_id}/tasks/board", response_model=TaskBoardResponse)
def get_task_board(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskBoardResponse:
    return task_management_service.get_task_board(db, space_id, current_user)


@router.get("/tasks/{task_id}", response_model=TaskDetailResponse)
def get_task_detail(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskDetailResponse:
    return task_management_service.get_task_detail(db, task_id, current_user)


@router.patch("/tasks/{task_id}", response_model=TaskDetailResponse)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskDetailResponse:
    return task_management_service.update_task(db, task_id, payload, current_user)


@router.delete("/tasks/{task_id}", response_model=TaskDetailResponse)
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskDetailResponse:
    return task_management_service.delete_task(db, task_id, current_user)
