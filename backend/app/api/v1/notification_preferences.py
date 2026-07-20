from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.notification_constants import NotificationPreferenceScope
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification_preference import (
    NotificationPreferenceListResponse,
    NotificationPreferencePatchRequest,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdateRequest,
)
from app.services.notification_preference_service import NotificationPreferenceService


router = APIRouter(prefix="/notification-preferences", tags=["notification preferences"])
preference_service = NotificationPreferenceService()


@router.get(
    "",
    response_model=NotificationPreferenceListResponse,
    summary="Get current user's notification preferences",
)
def list_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceListResponse:
    try:
        preferences = preference_service.get_preferences_for_user(db, user=current_user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return NotificationPreferenceListResponse(items=preferences)


@router.get(
    "/{scope}",
    response_model=NotificationPreferenceResponse,
    summary="Get notification preference by scope",
    responses={403: {"description": "Permission denied"}},
)
def get_notification_preference(
    scope: NotificationPreferenceScope,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceResponse:
    try:
        preference = preference_service.get_preference_for_user(db, user=current_user, scope=scope.value)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return preference


@router.put(
    "/{scope}",
    response_model=NotificationPreferenceResponse,
    summary="Update notification preference by scope",
    responses={403: {"description": "Permission denied"}},
)
def update_notification_preference(
    scope: NotificationPreferenceScope,
    payload: NotificationPreferenceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceResponse:
    try:
        preference = preference_service.update_preference(db, user=current_user, scope=scope.value, payload=payload)
        db.commit()
        db.refresh(preference)
    except Exception:
        db.rollback()
        raise
    return preference


@router.patch(
    "/{scope}",
    response_model=NotificationPreferenceResponse,
    summary="Partially update notification preference by scope",
    responses={403: {"description": "Permission denied"}},
)
def patch_notification_preference(
    scope: NotificationPreferenceScope,
    payload: NotificationPreferencePatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceResponse:
    try:
        preference = preference_service.patch_preference(db, user=current_user, scope=scope.value, payload=payload)
        db.commit()
        db.refresh(preference)
    except Exception:
        db.rollback()
        raise
    return preference


@router.post(
    "/{scope}/reset",
    response_model=NotificationPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset notification preference to defaults",
    responses={403: {"description": "Permission denied"}},
)
def reset_notification_preference(
    scope: NotificationPreferenceScope,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceResponse:
    try:
        preference = preference_service.reset_preference(db, user=current_user, scope=scope.value)
        db.commit()
        db.refresh(preference)
    except Exception:
        db.rollback()
        raise
    return preference
