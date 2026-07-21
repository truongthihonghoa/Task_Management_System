from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.main_layout import (
    MainLayoutLanguageRequest,
    MainLayoutPreferencesResponse,
    SpaceContextResponse,
)
from app.schemas.pydantic_models import UpdateProfileRequest, UserProfileResponse
from app.services import main_layout_service


router = APIRouter(prefix="/main-layout", tags=["main layout"])


@router.get("", response_model=MainLayoutResponse)
def get_main_layout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MainLayoutResponse:
    return main_layout_service.get_main_layout(db, current_user)


@router.get("/sidebar-summary", response_model=SidebarSummaryResponse)
def get_sidebar_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SidebarSummaryResponse:
    return main_layout_service.get_sidebar_summary(db, current_user)


@router.get("/preferences", response_model=MainLayoutPreferencesResponse)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MainLayoutPreferencesResponse:
    return main_layout_service.get_preferences(db, current_user)


@router.put("/preferences/language", response_model=MainLayoutPreferencesResponse)
def update_language(
    payload: MainLayoutLanguageRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MainLayoutPreferencesResponse:
    try:
        response = main_layout_service.update_language(db, user=current_user, language=payload.language)
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


@router.get("/profile", response_model=UserProfileResponse)
def get_profile(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    return main_layout_service.get_profile(current_user)


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    payload: UpdateProfileRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    try:
        response = main_layout_service.update_profile(db, user=current_user, payload=payload)
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


@router.get("/spaces/{space_id}/context", response_model=SpaceContextResponse)
def get_space_context(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SpaceContextResponse:
    return main_layout_service.get_space_context(db, space_id=space_id, user=current_user)
