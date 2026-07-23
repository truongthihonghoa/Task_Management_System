from datetime import datetime

from pydantic import BaseModel, Field, StrictBool

from app.core.notification_constants import (
    NotificationEmailDeliveryMode,
    NotificationEmailFrequency,
    NotificationPreferenceScope,
)


NotificationSettings = dict[str, StrictBool]


class NotificationPreferenceResponse(BaseModel):
    preference_id: str
    user_id: str
    scope: NotificationPreferenceScope
    email_enabled: bool
    email_frequency: NotificationEmailFrequency
    email_settings: dict[str, bool]
    app_settings: dict[str, bool]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationPreferenceListResponse(BaseModel):
    items: list[NotificationPreferenceResponse]


class NotificationPreferenceUpdateRequest(BaseModel):
    email_enabled: bool
    email_frequency: NotificationEmailDeliveryMode
    email_settings: NotificationSettings = Field(...)
    app_settings: NotificationSettings = Field(...)


class NotificationPreferencePatchRequest(BaseModel):
    email_enabled: bool | None = None
    email_frequency: NotificationEmailDeliveryMode | None = None
    email_settings: NotificationSettings | None = None
    app_settings: NotificationSettings | None = None
