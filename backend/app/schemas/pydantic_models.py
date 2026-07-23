import re
from datetime import datetime

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

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
    archived_at: Optional[datetime] = None
    reopen_until: Optional[datetime] = None
    can_reopen: bool = False
    deleted_at: Optional[datetime]


class UserSummaryResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    status_user: str

    model_config = {"from_attributes": True}


class SpaceMemberResponse(BaseModel):
    space_member_id: str
    space_id: str
    user_id: str
    role: str
    joined_at: datetime
    status: str
    removed_at: Optional[datetime]
    user: Optional[UserSummaryResponse] = None

    model_config = {"from_attributes": True}


class SpaceMemberCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=15)
    role: Literal["MEMBER"] = "MEMBER"


class SpaceMemberUpdate(BaseModel):
    role: Literal["MEMBER", "OWNER"]


class SpaceAddPeopleRequest(BaseModel):
    user_id: Optional[str] = Field(default=None, max_length=15)
    email: Optional[str] = Field(default=None, max_length=255)
    name: Optional[str] = Field(default=None, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_optional_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        email = normalize_email(value)
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Invalid email format.")
        return email

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        name = value.strip()
        return name or None

    @model_validator(mode="after")
    def validate_identifier(self) -> "SpaceAddPeopleRequest":
        if not self.user_id and not self.email and not self.name:
            raise ValueError("Provide user_id, email, or name.")
        return self


class SpaceMemberRequestResponse(BaseModel):
    space_member_request_id: str
    space_id: str
    requester_id: str
    requested_user_id: Optional[str]
    requested_email: str
    requested_name: Optional[str]
    owner_id: str
    status: str
    requested_at: datetime
    reviewed_at: Optional[datetime]
    requester: Optional[UserSummaryResponse] = None
    requested_user: Optional[UserSummaryResponse] = None
    owner: Optional[UserSummaryResponse] = None

    model_config = {"from_attributes": True}


class SpaceAddPeopleResponse(BaseModel):
    status: Literal["PENDING_OWNER", "PENDING_INVITEE", "APPROVED", "REJECTED"]
    message: str
    member: Optional[SpaceMemberResponse] = None
    request: Optional[SpaceMemberRequestResponse] = None


class AssignTaskAssigneesRequest(BaseModel):
    assignee_ids: list[str] = Field(..., min_length=1)
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("assignee_ids")
    @classmethod
    def validate_assignee_ids(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value if item and item.strip()]
        if not normalized:
            raise ValueError("At least one assignee is required.")
        if len(normalized) != len(set(normalized)):
            raise ValueError("Duplicate assignee ids are not allowed.")
        return normalized


class ReassignTaskAssigneeRequest(BaseModel):
    previous_assignee_id: str
    new_assignee_id: str | None = None
    reason: str | None = Field(default=None, max_length=1000)


class RemoveTaskAssigneeRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


TaskStatus = Literal[
    "new",
    "in_progress",
    "in_testing",
    "pending_review",
    "need_revision",
    "done",
    "cancelled",
]
TaskPriority = Literal["HIGH", "MEDIUM", "LOW"]
TaskSort = Literal["newest", "oldest"]
SprintStatus = Literal["Planned", "Active", "Completed", "Deleted"]
MediaUsage = Literal["attachment", "comment", "description"]


class SprintSummaryResponse(BaseModel):
    sprint_id: str
    space_id: str
    name: str
    status: str

    model_config = {"from_attributes": True}


class SprintCreate(BaseModel):
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    duration_weeks: Optional[int] = Field(default=2, ge=1, le=52)
    status: Literal["Planned", "Active"] = "Planned"
    auto_start: bool = False
    auto_complete: bool = False

    @model_validator(mode="after")
    def validate_date_range(self) -> "SprintCreate":
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValueError("End date must be after start date.")
        return self


class SprintUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    duration_weeks: Optional[int] = Field(default=None, ge=1, le=52)
    status: Optional[Literal["Planned", "Active"]] = None
    auto_start: Optional[bool] = None
    auto_complete: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        name = value.strip()
        if not name:
            raise ValueError("Sprint name is required.")
        return name

    @model_validator(mode="after")
    def validate_date_range(self) -> "SprintUpdate":
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValueError("End date must be after start date.")
        return self


class SprintResponse(BaseModel):
    sprint_id: str
    space_id: str
    name: str
    goal: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    duration_weeks: Optional[int]
    status: str
    auto_start: Optional[bool]
    auto_complete: Optional[bool]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sprint_id: str = Field(..., min_length=1, max_length=15)
    priority: TaskPriority
    task_status: TaskStatus = "new"
    story_points: float = Field(default=0, ge=0)
    completed_at: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Title is required.")
        return title


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    sprint_id: Optional[str] = Field(default=None, min_length=1, max_length=15)
    priority: Optional[TaskPriority] = None
    task_status: Optional[TaskStatus] = None
    story_points: Optional[float] = Field(default=None, ge=0)
    completed_at: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def validate_optional_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        title = value.strip()
        if not title:
            raise ValueError("Title is required.")
        return title


class TaskCommentCreate(BaseModel):
    comment: str = Field(..., min_length=1, max_length=5000)
    parent_comment_id: Optional[str] = Field(default=None, max_length=15)

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, value: str) -> str:
        comment = value.strip()
        if not comment:
            raise ValueError("Comment is required.")
        return comment


class TaskCommentUpdate(BaseModel):
    comment: str = Field(..., min_length=1, max_length=5000)

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, value: str) -> str:
        comment = value.strip()
        if not comment:
            raise ValueError("Comment is required.")
        return comment


class TaskAttachmentResponse(BaseModel):
    attachment_id: str
    task_id: str
    file_name: str
    file_path: str
    storage_url: Optional[str]
    mime_type: Optional[str]
    file_size: Optional[int]
    uploaded_by: str
    uploaded_at: datetime
    deleted_at: Optional[datetime]
    type: Optional[str] = None
    previewUrl: Optional[str] = None
    url: Optional[str] = None
    name: Optional[str] = None
    size: Optional[str] = None

    @model_validator(mode="after")
    def hydrate_frontend_fields(self) -> "TaskAttachmentResponse":
        is_image = (self.mime_type or "").startswith("image/")
        file_url = self.storage_url or (f"/media/{self.file_path}" if self.file_path else None)
        self.type = self.type or ("image" if is_image else "file")
        self.url = self.url or file_url
        self.previewUrl = self.previewUrl or (file_url if is_image else None)
        self.name = self.name or self.file_name
        if self.size is None and self.file_size is not None:
            if self.file_size >= 1024 * 1024:
                self.size = f"{self.file_size / (1024 * 1024):.1f} MB"
            elif self.file_size >= 1024:
                self.size = f"{self.file_size / 1024:.1f} KB"
            else:
                self.size = f"{self.file_size} B"
        return self

    model_config = {"from_attributes": True}


class TaskAttachmentListResponse(BaseModel):
    items: list[TaskAttachmentResponse]
    total: int
    page: int
    page_size: int


class MediaUploadResponse(BaseModel):
    usage: MediaUsage
    file_name: str
    file_path: str
    file_url: str
    mime_type: Optional[str]
    file_size: int
    attachment_id: Optional[str] = None


class TaskCommentResponse(BaseModel):
    comment_id: str
    task_id: str
    user_id: str
    parent_comment_id: Optional[str]
    comment: str
    is_edited: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]
    user: Optional[UserSummaryResponse] = None

    model_config = {"from_attributes": True}


class TaskCommentListResponse(BaseModel):
    items: list[TaskCommentResponse]
    total: int
    page: int
    page_size: int


class TaskAssigneeResponse(BaseModel):
    assignee_entry_id: str
    task_id: str
    assignee_id: str
    assignee_at: datetime
    assignee: UserSummaryResponse | None = None

    model_config = {"from_attributes": True}


class AssignmentHistoryResponse(BaseModel):
    assignment_history_id: str
    task_id: str
    previous_assignee_id: str | None
    new_assignee_id: str | None
    changed_by: str
    reason: str | None
    change_status: str | None
    changed_at: datetime
    previous_assignee: UserSummaryResponse | None = None
    new_assignee: UserSummaryResponse | None = None
    changed_by_user: UserSummaryResponse | None = None

    model_config = {"from_attributes": True}


class TaskListItemResponse(BaseModel):
    task_id: str
    space_id: str
    sprint_id: str
    title: str
    priority: str
    task_status: str
    completed_at: Optional[datetime]
    is_overdue: bool = False
    is_due_today: bool = False
    story_points: Optional[float]
    created_at: datetime
    updated_at: datetime
    sprint: Optional[SprintSummaryResponse] = None
    assignees: list[TaskAssigneeResponse] = Field(default_factory=list)
    attachments: list[TaskAttachmentResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    items: list[TaskListItemResponse]
    total: int
    page: int
    page_size: int


class TaskBoardResponse(BaseModel):
    new: list[TaskListItemResponse]
    in_progress: list[TaskListItemResponse]
    in_testing: list[TaskListItemResponse]
    pending_review: list[TaskListItemResponse]
    need_revision: list[TaskListItemResponse]
    done: list[TaskListItemResponse]
    cancelled: list[TaskListItemResponse]


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_SPECIAL_PATTERN = re.compile(r"[^A-Za-z0-9]")
PASSWORD_RESET_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")


def normalize_email(value: str) -> str:
    return value.strip().lower()


def validate_password_strength(value: str, *, field_name: str = "Password") -> str:
    if len(value) < 8:
        raise ValueError(f"{field_name} must be at least 8 characters.")
    if not any(char.isupper() for char in value):
        raise ValueError(f"{field_name} must contain at least one uppercase letter.")
    if not any(char.islower() for char in value):
        raise ValueError(f"{field_name} must contain at least one lowercase letter.")
    if not any(char.isdigit() for char in value):
        raise ValueError(f"{field_name} must contain at least one number.")
    if not PASSWORD_SPECIAL_PATTERN.search(value):
        raise ValueError(f"{field_name} must contain at least one special character.")
    return value


class EmailRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = normalize_email(value)
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Invalid email format.")
        return email


class VerifyEmailRequest(EmailRequest):
    otp_code: str = Field(..., min_length=6, max_length=6)

    @field_validator("otp_code")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 6:
            raise ValueError("OTP must be exactly 6 digits.")
        return value


class RegisterRequest(EmailRequest):
    full_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        full_name = value.strip()
        if not full_name:
            raise ValueError("Full name is required.")
        return full_name

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Confirm password must be at least 8 characters.")
        return value


class MessageResponse(BaseModel):
    message: str


class VerifyEmailResponse(MessageResponse):
    verified: bool


class LoginRequest(EmailRequest):
    password: str = Field(..., min_length=1)


class LoginUserResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class TaskAssigneesResponse(BaseModel):
    assignees: list[TaskAssigneeResponse]


class AssignmentHistoryListResponse(BaseModel):
    history: list[AssignmentHistoryResponse]


class TaskDetailResponse(TaskListItemResponse):
    description: Optional[str]
    creator_id: str
    deleted_at: Optional[datetime]
    task_status_label: Optional[str] = None
    sprint_name: Optional[str] = None
    creator_name: Optional[str] = None
    primary_assignee: Optional[TaskAssigneeResponse] = None
    creator: Optional[UserSummaryResponse] = None
    assignees: list[TaskAssigneeResponse] = Field(default_factory=list)
    comments: list[TaskCommentResponse] = Field(default_factory=list)
    attachments: list[TaskAttachmentResponse] = Field(default_factory=list)
    assignment_history: list[AssignmentHistoryResponse] = Field(default_factory=list)



class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user: LoginUserResponse





class ResetPasswordRequest(EmailRequest):
    token: str = Field(..., min_length=32, max_length=2048)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @field_validator("token")
    @classmethod
    def validate_reset_token(cls, value: str) -> str:
        token = value.strip()
        if not PASSWORD_RESET_TOKEN_PATTERN.fullmatch(token):
            raise ValueError("Invalid password reset token.")
        return token

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @model_validator(mode="after")
    def validate_password_match(self) -> "ResetPasswordRequest":
        if self.password != self.confirm_password:
            raise ValueError("Confirm password mismatch.")
        return self


class UserResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    status_user: str
    role: str
    avatar_url: str | None
    is_verified: bool | None
    failed_login_attempts: int | None
    locked_until: datetime | None
    last_login: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class RegisterUserResponse(BaseModel):
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}

class RegisterResponse(MessageResponse):
    email: str
    full_name: str
    role: str
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user: LoginUserResponse


UserStatus = Literal["Pending", "Active", "Inactive", "Locked"]
UserSortField = Literal["created_at", "full_name", "email", "last_login"]


class UserManagementResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    status_user: UserStatus
    role: str
    avatar_url: str | None
    is_verified: bool | None
    failed_login_attempts: int | None
    locked_until: datetime | None
    last_login: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserManagementListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[UserManagementResponse]


class UserManagementUpdateRequest(BaseModel):
    status: UserStatus | None = None
    is_verified: bool | None = None
    failed_login_attempts: int | None = Field(default=None, ge=0)
    locked_until: datetime | None = None

    model_config = {"extra": "forbid"}

class UserStatusUpdateRequest(BaseModel):
    status: Literal["Active", "Inactive"]


class UserLockUpdateRequest(BaseModel):
    locked: bool

class UserProfileResponse(BaseModel):
    avatar_url: str | None
    full_name: str
    email: str
    role: str
    status_user: str
    created_at: datetime
    last_login: datetime | None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        full_name = value.strip()
        if not full_name:
            raise ValueError("Full name is required.")
        return full_name


class UpdateAvatarResponse(MessageResponse):
    avatar_url: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value, field_name="New password")

    @model_validator(mode="after")
    def validate_password_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Confirm password mismatch.")
        if self.current_password == self.new_password:
            raise ValueError("New password must not be the same as current password.")
        return self


class TokenRefreshRequest(BaseModel):
    refresh_token: str

    
