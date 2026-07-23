from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.main_layout import GlobalSearchResponse, SearchRecentDeleteResponse, SearchRecentRequest
from app.services import main_layout_service


router = APIRouter(prefix="/search", tags=["search"])


@router.get("/global", response_model=GlobalSearchResponse)
def global_search(
    q: str | None = Query(default=None, max_length=255),
    types: str | None = Query(default=None),
    limit_per_type: int = Query(default=5, ge=1, le=10),
    space_id: str | None = Query(default=None, max_length=15),
    include_recent: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GlobalSearchResponse:
    return main_layout_service.global_search(
        db,
        user=current_user,
        q=q,
        types=types,
        limit_per_type=limit_per_type,
        space_id=space_id,
        include_recent=include_recent,
    )


@router.post("/recent", status_code=204)
def record_search_recent(
    payload: SearchRecentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    main_layout_service.record_search_recent(
        db,
        user=current_user,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
    )


@router.delete("/recent/{entity_type}/{entity_id}", response_model=SearchRecentDeleteResponse)
def delete_search_recent(
    entity_type: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchRecentDeleteResponse:
    deleted_count = main_layout_service.delete_search_recent(
        db,
        user=current_user,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    return SearchRecentDeleteResponse(deleted_count=deleted_count)
