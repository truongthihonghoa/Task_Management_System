from datetime import datetime
from app.core.timezone import vietnam_now
from typing import Iterable
import logging

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.repository import recent_view as recent_view_repository
from app.repository import task as task_repository
from app.services import media_service, sprint_service
from app.models.space import Space
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.user import User
from app.schemas.pydantic_models import (
    AssignTaskAssigneesRequest,
    TaskCreate,
    TaskDetailResponse,
    TaskListItemResponse,
    TaskListResponse,
    TaskUpdate,
)
from app.services.notification_service import NotificationService


logger = logging.getLogger(__name__)
notification_service = NotificationService()


def _get_space_or_404(db: Session, space_id: str) -> Space:
    space = task_repository.get_space(db, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    return space


def _ensure_space_not_deleted(space: Space) -> None:
    if space.status_space == "Deleted" or space.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space is deleted")


def _ensure_space_active(space: Space) -> None:
    if space.status_space == "Archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space is archived")
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


def _validate_task_assignees_for_space(db: Session, space_id: str, assignee_ids: Iterable[str]) -> None:
    for assignee_id in assignee_ids:
        user = db.get(User, assignee_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User not found: {assignee_id}")
        if user.status_user != "Active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User is inactive: {assignee_id}")
        if user.locked_until is not None and user.locked_until > vietnam_now():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User is locked: {assignee_id}")
        if task_repository.get_active_space_member(db, space_id, assignee_id) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User is not an active member of the task space: {assignee_id}",
            )


def _create_task_record_for_flow(db: Session, task: Task) -> Task:
    try:
        return task_repository.create_task_record(db, task, commit=False)
    except TypeError:
        return task_repository.create_task_record(db, task)


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
    if sprint.status == "Completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Completed sprint is read-only")
    return sprint


def _ensure_task_sprint_mutable(task: Task) -> None:
    if getattr(getattr(task, "sprint", None), "status", None) == "Completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Completed sprint is read-only")


def _get_task_or_404(db: Session, task_id: str) -> Task:
    task = task_repository.get_task_with_details(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def _is_task_overdue(task: Task, *, now: datetime | None = None) -> bool:
    if task.completed_at is None:
        return False
    if task.task_status in {"done", "cancelled"}:
        return False

    current_time = now or vietnam_now()
    return task.completed_at.date() < current_time.date()


def _is_task_due_today(task: Task, *, now: datetime | None = None) -> bool:
    if task.completed_at is None:
        return False
    if task.task_status in {"done", "cancelled"}:
        return False

    current_time = now or vietnam_now()
    return task.completed_at.date() == current_time.date()


def _apply_task_date_flags(response: TaskListItemResponse, task: Task) -> TaskListItemResponse:
    response.is_overdue = _is_task_overdue(task)
    response.is_due_today = _is_task_due_today(task)
    return response


def _build_task_list_item_response(task: Task) -> TaskListItemResponse:
    response = TaskListItemResponse.model_validate(task)
    _apply_task_date_flags(response, task)
    response.assignees = sorted(response.assignees, key=lambda assignee: assignee.assignee_at)
    response.attachments = sorted(
        [
            attachment
            for attachment in response.attachments
            if attachment.deleted_at is None and attachment.usage == "attachment"
        ],
        key=lambda attachment: attachment.uploaded_at,
        reverse=True,
    )
    return response


def _serialize_task_list_items(tasks: Iterable[Task]) -> list[TaskListItemResponse]:
    return [_build_task_list_item_response(task) for task in tasks]


def _task_assignee_ids(task: Task) -> list[str]:
    return [assignee.assignee_id for assignee in (getattr(task, "assignees", None) or []) if assignee.assignee_id]


def _notify_task_assignees(
    db: Session,
    task: Task,
    *,
    current_user: User,
    notification_type: str,
    title: str,
    message: str,
    metadata: dict | None = None,
) -> None:
    try:
        notification_service.create_notifications_for_users(
            db,
            user_ids=_task_assignee_ids(task),
            actor_id=current_user.user_id,
            task_id=task.task_id,
            space_id=task.space_id,
            notification_type=notification_type,
            title=title,
            message=message,
            audience="USER",
            metadata={
                "task_title": task.title,
                "sprint_name": getattr(getattr(task, "sprint", None), "name", None),
                "space_name": task.space.name_space if task.space else None,
                **(metadata or {}),
            },
        )
    except Exception:
        logger.exception("Unable to create task notification.")


def _build_task_list_response(tasks: list[Task], total: int, *, page: int, page_size: int) -> TaskListResponse:
    return TaskListResponse(
        items=_serialize_task_list_items(tasks),
        total=total,
        page=page,
        page_size=page_size,
    )


def _build_task_detail_response(task: Task) -> TaskDetailResponse:
    response = TaskDetailResponse.model_validate(task)
    _apply_task_date_flags(response, task)
    response.task_status_label = task.task_status.replace("_", " ").upper()
    response.sprint_name = task.sprint.name if task.sprint else None
    response.creator_name = task.creator.full_name if task.creator else None
    response.assignees = sorted(response.assignees, key=lambda assignee: assignee.assignee_at)
    response.primary_assignee = response.assignees[0] if response.assignees else None
    response.comments = sorted(
        [comment for comment in response.comments if comment.deleted_at is None],
        key=lambda comment: comment.created_at,
    )
    response.attachments = [
        attachment
        for attachment in response.attachments
        if attachment.deleted_at is None and attachment.usage == "attachment"
    ]
    response.attachments = sorted(response.attachments, key=lambda attachment: attachment.uploaded_at, reverse=True)
    response.assignment_history = sorted(
        response.assignment_history,
        key=lambda history: history.changed_at,
        reverse=True,
    )
    return response


def create_task(
    db: Session,
    space_id: str,
    payload: TaskCreate,
    current_user: User,
    *,
    attachments: Iterable[UploadFile] | None = None,
    assignee_ids: Iterable[str] | None = None,
) -> TaskDetailResponse:
    space = _get_space_or_404(db, space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_tasks(db, space, current_user)
    _get_sprint_for_space_or_404(db, space_id, payload.sprint_id)
    normalized_assignee_ids = list(
        dict.fromkeys(
            assignee_id.strip()
            for assignee_id in assignee_ids or []
            if assignee_id and assignee_id.strip()
        )
    )
    _validate_task_assignees_for_space(db, space_id, normalized_assignee_ids)
    valid_attachments = [attachment for attachment in attachments or [] if attachment.filename]
    for attachment in valid_attachments:
        media_service.validate_task_media_upload("attachment", attachment)

    now = vietnam_now()
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
    try:
        _create_task_record_for_flow(db, task)
        for attachment in valid_attachments:
            media_service.upload_task_media(
                db,
                task.task_id,
                usage="attachment",
                file=attachment,
                current_user=current_user,
            )
        if normalized_assignee_ids:
            from app.services.task_assignment_service import TaskAssignmentService

            TaskAssignmentService().assign_task_assignees(
                db,
                task.task_id,
                AssignTaskAssigneesRequest(
                    assignee_ids=normalized_assignee_ids,
                    reason="Assigned while creating task",
                ),
                current_user,
            )
        sprint_service.apply_sprint_automation(db, space_id)
        if hasattr(db, "commit"):
            db.commit()
        return _build_task_detail_response(_get_task_or_404(db, task.task_id))
    except Exception:
        if hasattr(db, "rollback"):
            db.rollback()
        raise


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
    active_sprint_only: bool = True,
) -> TaskListResponse:
    space = _get_space_or_404(db, space_id)
    _ensure_space_not_deleted(space)
    _ensure_can_view_space_tasks(db, space, current_user)
    sprint_service.apply_sprint_automation(db, space_id)

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
        active_sprint_only=active_sprint_only,
    )
    return _build_task_list_response(tasks, total, page=page, page_size=page_size)


def get_task_detail(db: Session, task_id: str, current_user: User) -> TaskDetailResponse:
    task = _get_task_or_404(db, task_id)
    space = task.space or _get_space_or_404(db, task.space_id)
    _ensure_space_not_deleted(space)
    _ensure_can_view_space_tasks(db, space, current_user)
    recent_view_repository.record_recent_view(
        db,
        user_id=current_user.user_id,
        entity_type="task",
        entity_id=task.task_id,
    )
    return _build_task_detail_response(task)


def update_task(db: Session, task_id: str, payload: TaskUpdate, current_user: User) -> TaskDetailResponse:
    task = _get_task_or_404(db, task_id)
    if task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task is deleted")
    _ensure_task_sprint_mutable(task)

    space = task.space or _get_space_or_404(db, task.space_id)
    _ensure_space_active(space)
    _ensure_can_modify_space_tasks(db, space, current_user)

    update_data = payload.model_dump(exclude_unset=True)
    if "sprint_id" in update_data:
        _get_sprint_for_space_or_404(db, task.space_id, update_data["sprint_id"])

    previous_status = task.task_status
    previous_priority = task.priority
    previous_completed_at = task.completed_at

    for field, value in update_data.items():
        setattr(task, field, value)
    task.updated_at = vietnam_now()

    task_repository.save_task(db, task)
    sprint_service.apply_sprint_automation(db, task.space_id)
    if update_data:
        if "task_status" in update_data and previous_status != task.task_status:
            _notify_task_assignees(
                db,
                task,
                current_user=current_user,
                notification_type="status_changed",
                title="Task status updated",
                message=f"{current_user.full_name} changed {task.title} status to {task.task_status}.",
                metadata={"previous_status": previous_status, "new_status": task.task_status},
            )
        elif "priority" in update_data and previous_priority != task.priority:
            _notify_task_assignees(
                db,
                task,
                current_user=current_user,
                notification_type="priority_changed",
                title="Task priority updated",
                message=f"{current_user.full_name} changed {task.title} priority to {task.priority}.",
                metadata={"previous_priority": previous_priority, "new_priority": task.priority},
            )
        elif "completed_at" in update_data and previous_completed_at != task.completed_at:
            _notify_task_assignees(
                db,
                task,
                current_user=current_user,
                notification_type="due_date_changed",
                title="Task due date updated",
                message=f"{current_user.full_name} changed the due date for {task.title}.",
                metadata={
                    "previous_due_date": previous_completed_at.isoformat() if previous_completed_at else None,
                    "new_due_date": task.completed_at.isoformat() if task.completed_at else None,
                },
            )
        else:
            _notify_task_assignees(
                db,
                task,
                current_user=current_user,
                notification_type="task_updated",
                title="Task updated",
                message=f"{current_user.full_name} updated {task.title}.",
                metadata={"updated_fields": sorted(update_data)},
            )
    return _build_task_detail_response(_get_task_or_404(db, task.task_id))


def delete_task(db: Session, task_id: str, current_user: User) -> TaskDetailResponse:
    task = _get_task_or_404(db, task_id)
    if task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task is already deleted")
    _ensure_task_sprint_mutable(task)

    space = task.space or _get_space_or_404(db, task.space_id)
    _ensure_space_active(space)
    _ensure_space_owner(space, current_user)

    now = vietnam_now()
    task.deleted_at = now
    task.updated_at = now
    task_repository.save_task(db, task, refresh=False)
    _notify_task_assignees(
        db,
        task,
        current_user=current_user,
        notification_type="task_deleted",
        title="Task deleted",
        message=f"{current_user.full_name} deleted {task.title}.",
        metadata={"deleted_at": now.isoformat()},
    )
    return _build_task_detail_response(_get_task_or_404(db, task.task_id))
