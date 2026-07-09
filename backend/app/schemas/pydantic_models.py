from datetime import datetime

from pydantic import BaseModel, Field, field_validator


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


class UserSummaryResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    status_user: str
    role: str

    model_config = {"from_attributes": True}


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


class TaskAssigneesResponse(BaseModel):
    assignees: list[TaskAssigneeResponse]


class AssignmentHistoryListResponse(BaseModel):
    history: list[AssignmentHistoryResponse]


class MessageResponse(BaseModel):
    message: str
