# Service layer — business logic only.
# Calls the repository for data access, converts raw dicts into response schemas,
# and raises HTTP exceptions when business rules are violated.

from fastapi import HTTPException, status

from app.repository import help as help_repository
from app.schemas.help import (
    GuideDetailResponse,
    GuideListItem,
    GuideListResponse,
    GuideSection,
    GuideStep,
    RelatedGuide,
    TableOfContentsItem,
)


def list_guides() -> GuideListResponse:
    """Return a summary list of all available help guides."""
    raw_guides = help_repository.get_all_guides()
    items = [GuideListItem(**guide) for guide in raw_guides]
    return GuideListResponse(guides=items)


def get_guide(slug: str) -> GuideDetailResponse:
    """
    Return the full content of a single guide by its slug.

    Raises:
        HTTPException 404: If no guide exists for the given slug.
    """
    raw = help_repository.get_guide_by_slug(slug)
    if raw is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": f"Guide '{slug}' not found."},
        )

    table_of_contents = [
        TableOfContentsItem(**item) for item in raw["table_of_contents"]
    ]

    sections = []
    for section_data in raw["sections"]:
        steps = None
        if section_data.get("steps"):
            steps = [GuideStep(**step) for step in section_data["steps"]]

        sections.append(
            GuideSection(
                id=section_data["id"],
                title=section_data["title"],
                content=section_data["content"],
                steps=steps,
                tip=section_data.get("tip"),
            )
        )

    related_guides = [
        RelatedGuide(**related) for related in raw.get("related_guides", [])
    ]

    return GuideDetailResponse(
        title=raw["title"],
        introduction=raw["introduction"],
        estimated_read_time=raw["estimated_read_time"],
        table_of_contents=table_of_contents,
        sections=sections,
        tips=raw.get("tips", []),
        related_guides=related_guides,
    )
