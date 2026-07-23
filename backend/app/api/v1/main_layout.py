from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.main_layout import (
    MainLayoutLanguageRequest,
    MainLayoutPreferencesResponse,
)
from app.services import main_layout_service


router = APIRouter(prefix="/me", tags=["current user"])


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

