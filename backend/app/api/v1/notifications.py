from datetime import datetime
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.notification_constants import (
    NotificationAudience,
    NotificationReadStatus,
    NotificationType,
    SortOrder,
)
from app.core.security import get_current_user
from app.repository import notification as notification_repository
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationBulkIdsRequest,
    NotificationBulkUpdateResponse,
    NotificationDeleteResponse,
    NotificationListResponse,
    NotificationReadStateRequest,
    NotificationResponse,
    NotificationUnreadCountResponse,
)


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="Get current user's notifications",
    description="Returns paginated notifications belonging to the authenticated user.",
)
def list_notifications(
    status_filter: NotificationReadStatus | None = Query(default=None, alias="status"),
    notification_type: NotificationType | None = Query(default=None, alias="type"),
    audience: NotificationAudience | None = None,
    search: str | None = Query(default=None, max_length=255),
    task_id: str | None = Query(default=None, max_length=15),
    space_id: str | None = Query(default=None, max_length=15),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_order: SortOrder = Query(default=SortOrder.DESC),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    result = notification_repository.list_notifications(
        db,
        user_id=current_user.user_id,
        read_status=status_filter.value if status_filter else None,
        notification_type=notification_type.value if notification_type else None,
        audience=audience.value if audience else None,
        search=search,
        task_id=task_id,
        space_id=space_id,
        page=page,
        page_size=page_size,
        sort_order=sort_order.value,
    )
    return NotificationListResponse(
        items=result.items,
        total=result.total,
        page=page,
        page_size=page_size,
        total_pages=ceil(result.total / page_size) if result.total else 0,
        unread_count=result.unread_count,
    )


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountResponse,
    summary="Get unread notification count",
)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationUnreadCountResponse:
    return NotificationUnreadCountResponse(unread_count=notification_repository.get_unread_count(db, current_user.user_id))


@router.patch(
    "/read-state",
    response_model=NotificationBulkUpdateResponse,
    summary="Update notification read state",
    description="Marks all notifications as read, or selected notifications as read/unread for the authenticated user.",
)
def update_read_state(
    payload: NotificationReadStateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationBulkUpdateResponse:
    try:
        if payload.target == "all":
            updated_count = notification_repository.mark_all_read(
                db,
                user_id=current_user.user_id,
                read_at=datetime.utcnow(),
            )
        else:
            updated_count = notification_repository.bulk_mark_read_state(
                db,
                user_id=current_user.user_id,
                notification_ids=payload.notification_ids or [],
                is_read=payload.is_read,
                read_at=datetime.utcnow() if payload.is_read else None,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return NotificationBulkUpdateResponse(updated_count=updated_count)


@router.delete(
    "/read",
    response_model=NotificationDeleteResponse,
    summary="Delete read notifications",
)
def delete_read_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationDeleteResponse:
    try:
        deleted_count = notification_repository.delete_read_notifications(db, user_id=current_user.user_id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return NotificationDeleteResponse(message="Read notifications deleted.", deleted_count=deleted_count)


@router.delete(
    "",
    response_model=NotificationDeleteResponse,
    summary="Bulk delete notifications",
)
def bulk_delete_notifications(
    payload: NotificationBulkIdsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationDeleteResponse:
    try:
        deleted_count = notification_repository.bulk_delete_notifications(
            db,
            user_id=current_user.user_id,
            notification_ids=payload.notification_ids,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return NotificationDeleteResponse(message="Notifications deleted.", deleted_count=deleted_count)


@router.get(
    "/{notification_id}",
    response_model=NotificationResponse,
    summary="Get notification details",
    responses={404: {"description": "Notification not found"}},
)
def get_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    notification = notification_repository.get_notification_for_user(db, notification_id, current_user.user_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    if not notification.is_read:
        try:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            db.commit()
            db.refresh(notification)
        except Exception:
            db.rollback()
            raise
    return notification


@router.delete(
    "/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a notification",
    responses={404: {"description": "Notification not found"}},
)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        deleted = notification_repository.delete_notification_for_user(
            db,
            notification_id=notification_id,
            user_id=current_user.user_id,
        )
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    return Response(status_code=status.HTTP_204_NO_CONTENT)
