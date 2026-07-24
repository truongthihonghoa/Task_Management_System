# API layer — handles HTTP requests and responses only.
# All business logic is delegated to the Service layer.

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.help import AIChatRequest, AIChatResponse, GuideDetailResponse, GuideListResponse
from app.services import help_service
from app.services import help_ai_service

router = APIRouter(prefix="/help", tags=["help"])


@router.get(
    "/guides",
    response_model=GuideListResponse,
    summary="List all help guides",
    description="Returns a summary list of all available help guides.",
)
def list_guides(
    _current_user: User = Depends(get_current_user),
) -> GuideListResponse:
    return help_service.list_guides()


@router.get(
    "/guides/{slug}",
    response_model=GuideDetailResponse,
    summary="Get a help guide by slug",
    description="Returns the full content of a help guide identified by its slug. Returns HTTP 404 if the slug does not match any guide.",
)
def get_guide(
    slug: str,
    _current_user: User = Depends(get_current_user),
) -> GuideDetailResponse:
    return help_service.get_guide(slug)


@router.post(
    "/ai-chat",
    response_model=AIChatResponse,
    summary="Ask TaskFlow AI",
    description="Returns a concise TaskFlow assistant response scoped to the authenticated user.",
)
def ask_taskflow_ai(
    request: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIChatResponse:
    return help_ai_service.answer_chat(db, request, current_user)
