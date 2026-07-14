from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.task import Task
from app.models.task_comment import TaskComment
from app.models.user import User
from app.repository import comment as comment_repository
from app.schemas.pydantic_models import (
    TaskCommentCreate,
    TaskCommentListResponse,
    TaskCommentResponse,
    TaskCommentUpdate,
)


def _get_active_task_or_404(db: Session, task_id: str) -> Task:
    task = comment_repository.get_task_with_space(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task is deleted")
    if task.space is None or task.space.deleted_at is not None or task.space.status_space != "Active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space must be active")
    return task


def _get_comment_or_404(db: Session, comment_id: str) -> TaskComment:
    comment = comment_repository.get_comment(db, comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    return comment


def _is_space_owner(task: Task, user: User) -> bool:
    return task.space is not None and task.space.owner_id == user.user_id


def _is_active_space_member(db: Session, task: Task, user_id: str) -> bool:
    return comment_repository.get_active_space_member(db, task.space_id, user_id) is not None


def _ensure_can_view_comments(db: Session, task: Task, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if _is_space_owner(task, current_user):
        return
    if _is_active_space_member(db, task, current_user.user_id):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")


def _ensure_can_view_deleted_comments(task: Task, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if _is_space_owner(task, current_user):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")


def _ensure_can_view_deleted_comment(comment: TaskComment, task: Task, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if comment.user_id == current_user.user_id:
        return
    if _is_space_owner(task, current_user):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")


def _ensure_can_create_comment(db: Session, task: Task, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    _ensure_can_view_comments(db, task, current_user)


def _ensure_can_update_comment(comment: TaskComment, current_user: User) -> None:
    if comment.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the comment author can update it")


def _ensure_can_delete_comment(comment: TaskComment, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if comment.user_id == current_user.user_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the comment author can delete it")


def _validate_parent_comment(db: Session, task_id: str, parent_comment_id: str | None) -> None:
    if parent_comment_id is None:
        return
    parent_comment = comment_repository.get_comment(db, parent_comment_id)
    if parent_comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent comment not found")
    if parent_comment.task_id != task_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent comment does not belong to this task",
        )
    if parent_comment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent comment is deleted")


def list_task_comments(
    db: Session,
    task_id: str,
    current_user: User,
    *,
    page: int,
    page_size: int,
    include_deleted: bool,
) -> TaskCommentListResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_can_view_comments(db, task, current_user)
    if include_deleted:
        _ensure_can_view_deleted_comments(task, current_user)

    comments, total = comment_repository.list_comments(
        db,
        task_id=task_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
    )
    return TaskCommentListResponse(
        items=[TaskCommentResponse.model_validate(comment) for comment in comments],
        total=total,
        page=page,
        page_size=page_size,
    )


def create_task_comment(
    db: Session,
    task_id: str,
    payload: TaskCommentCreate,
    current_user: User,
) -> TaskCommentResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_can_create_comment(db, task, current_user)
    _validate_parent_comment(db, task_id, payload.parent_comment_id)

    now = datetime.utcnow()
    comment = TaskComment(
        task_id=task_id,
        user_id=current_user.user_id,
        parent_comment_id=payload.parent_comment_id,
        comment=payload.comment,
        is_edited=False,
        created_at=now,
        updated_at=now,
    )
    comment_repository.create_comment(db, comment)
    return TaskCommentResponse.model_validate(_get_comment_or_404(db, comment.comment_id))


def get_task_comment(db: Session, comment_id: str, current_user: User) -> TaskCommentResponse:
    comment = _get_comment_or_404(db, comment_id)
    task = _get_active_task_or_404(db, comment.task_id)
    _ensure_can_view_comments(db, task, current_user)
    if comment.deleted_at is not None:
        _ensure_can_view_deleted_comment(comment, task, current_user)
    return TaskCommentResponse.model_validate(comment)


def update_task_comment(
    db: Session,
    comment_id: str,
    payload: TaskCommentUpdate,
    current_user: User,
) -> TaskCommentResponse:
    comment = _get_comment_or_404(db, comment_id)
    task = _get_active_task_or_404(db, comment.task_id)
    _ensure_can_create_comment(db, task, current_user)
    _ensure_can_update_comment(comment, current_user)
    if comment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comment is deleted")

    comment.comment = payload.comment
    comment.is_edited = True
    comment.updated_at = datetime.utcnow()
    comment_repository.save_comment(db, comment)
    return TaskCommentResponse.model_validate(_get_comment_or_404(db, comment_id))


def delete_task_comment(db: Session, comment_id: str, current_user: User) -> TaskCommentResponse:
    comment = _get_comment_or_404(db, comment_id)
    _get_active_task_or_404(db, comment.task_id)
    _ensure_can_delete_comment(comment, current_user)
    if comment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comment is already deleted")

    now = datetime.utcnow()
    comment.deleted_at = now
    comment.updated_at = now
    comment_repository.save_comment(db, comment)
    return TaskCommentResponse.model_validate(_get_comment_or_404(db, comment_id))
