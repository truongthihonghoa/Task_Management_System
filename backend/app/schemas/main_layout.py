from typing import Literal

from pydantic import BaseModel, Field


class MainLayoutPreferencesResponse(BaseModel):
    language: str = "en"


class MainLayoutLanguageRequest(BaseModel):
    language: Literal["en", "vi"]


class SpacePermissionResponse(BaseModel):
    can_view: bool
    can_create_task: bool
    can_update_space: bool
    can_manage_members: bool
    can_assign_task: bool


class SpaceContextResponse(BaseModel):
    space_id: str
    space_name: str
    space_role: str
    permissions: SpacePermissionResponse


class GlobalSearchOwnerItem(BaseModel):
    user_id: str
    full_name: str
    initials: str


class GlobalSearchSpaceItem(BaseModel):
    space_id: str
    name: str
    description: str | None = None
    owner: GlobalSearchOwnerItem
    member_count: int
    status: str
    viewed_at: str | None = None


class GlobalSearchAssigneeItem(BaseModel):
    user_id: str
    full_name: str


class GlobalSearchTaskItem(BaseModel):
    task_id: str
    title: str
    status: str
    priority: str
    space_id: str
    space_name: str
    assignees: list[GlobalSearchAssigneeItem] = Field(default_factory=list)
    viewed_at: str | None = None


class GlobalSearchUserItem(BaseModel):
    user_id: str
    full_name: str
    email: str
    initials: str
    system_role: str
    display_role: str
    status: str
    space_name: str | None = None
    viewed_at: str | None = None


class GlobalSearchResponse(BaseModel):
    query: str
    spaces: list[GlobalSearchSpaceItem] = Field(default_factory=list)
    tasks: list[GlobalSearchTaskItem] = Field(default_factory=list)
    users: list[GlobalSearchUserItem] = Field(default_factory=list)
