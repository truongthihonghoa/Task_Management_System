from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.notification_constants import NotificationAudience, NotificationType
from app.schemas.pydantic_models import UserSummaryResponse


class NotificationResponse(BaseModel):
    notification_id: str
    user_id: str
    actor_id: str | None = None
    task_id: str | None = None
    space_id: str | None = None
    type: NotificationType
    title: str
    message: str
    audience: NotificationAudience
    metadata: dict[str, Any] | None = Field(default=None, validation_alias="metadata_")
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime
    actor: UserSummaryResponse | None = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    unread_count: int


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int


class NotificationBulkIdsRequest(BaseModel):
    notification_ids: list[str] = Field(..., min_length=1, max_length=100)

    @field_validator("notification_ids")
    @classmethod
    def validate_notification_ids(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value if item and item.strip()]
        if not normalized:
            raise ValueError("At least one notification id is required.")
        return list(dict.fromkeys(normalized))


class NotificationReadStateRequest(BaseModel):
    target: Literal["all", "selected"]
    is_read: bool
    notification_ids: list[str] | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("notification_ids")
    @classmethod
    def validate_notification_ids(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        normalized = [item.strip() for item in value if item and item.strip()]
        if not normalized:
            raise ValueError("At least one notification id is required.")
        return list(dict.fromkeys(normalized))

    @model_validator(mode="after")
    def validate_target(self) -> "NotificationReadStateRequest":
        if self.target == "selected" and not self.notification_ids:
            raise ValueError("notification_ids is required when target is selected.")
        if self.target == "all" and self.is_read is False:
            raise ValueError("Marking all notifications as unread is not supported.")
        return self


class NotificationBulkUpdateResponse(BaseModel):
    updated_count: int


class NotificationDeleteResponse(BaseModel):
    message: str
    deleted_count: int
