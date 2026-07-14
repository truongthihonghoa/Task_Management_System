# API layer — handles HTTP requests and responses only.
# All business logic is delegated to the Service layer.

from fastapi import APIRouter

from app.schemas.help import GuideDetailResponse, GuideListResponse
from app.services import help_service

router = APIRouter(prefix="/help", tags=["Help"])


@router.get(
    "/guides",
    response_model=GuideListResponse,
    summary="List all help guides",
    description="Returns a summary list of all available help guides.",
)
def list_guides() -> GuideListResponse:
    return help_service.list_guides()


@router.get(
    "/guides/{slug}",
    response_model=GuideDetailResponse,
    summary="Get a help guide by slug",
    description="Returns the full content of a help guide identified by its slug. Returns HTTP 404 if the slug does not match any guide.",
)
def get_guide(slug: str) -> GuideDetailResponse:
    return help_service.get_guide(slug)
