from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.pydantic_models import (
    TaskCommentCreate,
    TaskCommentListResponse,
    TaskCommentResponse,
    TaskCommentUpdate,
)
from app.services import comment_service


router = APIRouter(tags=["comments"])


@router.get("/tasks/{task_id}/comments", response_model=TaskCommentListResponse)
def list_task_comments(
    task_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskCommentListResponse:
    return comment_service.list_task_comments(
        db,
        task_id,
        current_user,
        page=page,
        page_size=page_size,
        include_deleted=include_deleted,
    )


@router.post(
    "/tasks/{task_id}/comments",
    response_model=TaskCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task_comment(
    task_id: str,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskCommentResponse:
    return comment_service.create_task_comment(db, task_id, payload, current_user)


@router.get("/comments/{comment_id}", response_model=TaskCommentResponse)
def get_task_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskCommentResponse:
    return comment_service.get_task_comment(db, comment_id, current_user)


@router.patch("/comments/{comment_id}", response_model=TaskCommentResponse)
def update_task_comment(
    comment_id: str,
    payload: TaskCommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskCommentResponse:
    return comment_service.update_task_comment(db, comment_id, payload, current_user)


@router.delete("/comments/{comment_id}", response_model=TaskCommentResponse)
def delete_task_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskCommentResponse:
    return comment_service.delete_task_comment(db, comment_id, current_user)
