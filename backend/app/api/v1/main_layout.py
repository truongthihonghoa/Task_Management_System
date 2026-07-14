from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.main_layout import MainLayoutResponse, SidebarSummaryResponse, SpaceContextResponse
from app.services import main_layout_service


router = APIRouter(prefix="/main-layout", tags=["Main Layout"])


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


@router.get("/spaces/{space_id}/context", response_model=SpaceContextResponse)
def get_space_context(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SpaceContextResponse:
    return main_layout_service.get_space_context(db, space_id=space_id, user=current_user)
