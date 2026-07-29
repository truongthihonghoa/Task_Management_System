from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class GuideListItem(BaseModel):
    id: str
    title: str
    slug: str
    description: str
    estimated_read_time: str


class GuideListResponse(BaseModel):
    guides: List[GuideListItem]


class TableOfContentsItem(BaseModel):
    id: str
    title: str


class GuideStep(BaseModel):
    step: int
    title: str
    description: str


class GuideSection(BaseModel):
    id: str
    title: str
    content: str
    steps: Optional[List[GuideStep]] = None
    tip: Optional[str] = None


class RelatedGuide(BaseModel):
    slug: str
    title: str
    description: str


class GuideDetailResponse(BaseModel):
    title: str
    introduction: str
    estimated_read_time: str
    table_of_contents: List[TableOfContentsItem]
    sections: List[GuideSection]
    tips: List[str]
    related_guides: List[RelatedGuide]


class AIChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(..., min_length=1, max_length=4000)


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    current_space_id: Optional[str] = Field(default=None, max_length=15)
    history: List[AIChatMessage] = Field(default_factory=list, max_length=10)


class AIChatResponse(BaseModel):
    reply: str
