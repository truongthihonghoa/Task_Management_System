from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SpaceCreate(BaseModel):
    name_space: str = Field(..., min_length=1, max_length=255)
    owner_id: str = Field(..., min_length=1, max_length=15)
    description: Optional[str] = None


class SpaceUpdate(BaseModel):
    name_space: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    status_space: Optional[Literal["Active", "Archived"]] = None


class SpaceResponse(BaseModel):
    space_id: str
    name_space: str
    description: Optional[str]
    owner_id: str
    status_space: str
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]


class SpaceMemberResponse(BaseModel):
    space_member_id: str
    space_id: str
    user_id: str
    role: str
    joined_at: datetime
    status: str
    removed_at: Optional[datetime]
