from typing import List, Optional

from pydantic import BaseModel


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
