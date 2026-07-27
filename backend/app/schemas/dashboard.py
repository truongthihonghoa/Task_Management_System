from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DashboardCountItem(BaseModel):
    key: str
    label: str
    count: int
    percentage: float = 0


class DashboardMetricsResponse(BaseModel):
    total_users: int
    total_spaces: int
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    overdue_tasks: int | None = None
    overdue_supported: bool = False


class SpaceSummaryMetricsResponse(BaseModel):
    total_users: int | None = None
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    overdue_tasks: int | None = None
    overdue_supported: bool = False


class DashboardStatusOverviewResponse(BaseModel):
    total: int
    items: list[DashboardCountItem] = Field(default_factory=list)


class DashboardPriorityBreakdownResponse(BaseModel):
    total: int
    items: list[DashboardCountItem] = Field(default_factory=list)


class DashboardUserAccountOverviewResponse(BaseModel):
    total: int
    items: list[DashboardCountItem] = Field(default_factory=list)


class DashboardSpaceOverviewResponse(BaseModel):
    total: int
    items: list[DashboardCountItem] = Field(default_factory=list)


class DashboardUserSummaryResponse(BaseModel):
    user_id: str | None = None
    full_name: str | None = None
    email: str | None = None
    role: str | None = None
    initials: str | None = None
    avatar_url: str | None = None


class DashboardAuditLogItemResponse(BaseModel):
    log_id: str
    user: DashboardUserSummaryResponse | None = None
    action: str
    event: str
    label_title: str
    entity_id: str | None = None
    payload: dict[str, Any] | None = None
    created_at: datetime


class DashboardFilterOptionResponse(BaseModel):
    value: str
    label: str
    count: int = 0


class DashboardAuditLogFilterOptionsResponse(BaseModel):
    event_types: list[DashboardFilterOptionResponse] = Field(default_factory=list)
    label_titles: list[DashboardFilterOptionResponse] = Field(default_factory=list)
    date_ranges: list[DashboardFilterOptionResponse] = Field(default_factory=list)
    sort_orders: list[DashboardFilterOptionResponse] = Field(default_factory=list)


class DashboardAssignmentHistoryItemResponse(BaseModel):
    assignment_history_id: str
    task_id: str
    task_title: str | None = None
    space_id: str | None = None
    space_name: str | None = None
    previous_assignee: DashboardUserSummaryResponse | None = None
    new_assignee: DashboardUserSummaryResponse | None = None
    changed_by: DashboardUserSummaryResponse | None = None
    reason: str | None = None
    change_status: str | None = None
    changed_at: datetime


class DashboardRecentActivityItemResponse(BaseModel):
    id: str
    source: str
    user: DashboardUserSummaryResponse | None = None
    action: str
    label_title: str
    target_type: str | None = None
    target_id: str | None = None
    target_title: str | None = None
    subtitle: str | None = None
    status: str | None = None
    priority: str | None = None
    space_id: str | None = None
    space_name: str | None = None
    assignees: list[DashboardUserSummaryResponse] = Field(default_factory=list)
    created_at: datetime


class DashboardActivitySpaceResponse(BaseModel):
    space_id: str
    name_space: str
    status_space: str
    owner_id: str | None = None
    owner: DashboardUserSummaryResponse | None = None
    active_member_count: int = 0
    task_count: int = 0
    assignment_history_count: int = 0


class DashboardSummaryMemberResponse(BaseModel):
    user: DashboardUserSummaryResponse
    role: str
    status: str
    joined_at: datetime | None = None
    is_owner: bool = False


class DashboardActivityCountsResponse(BaseModel):
    worked_on: int = 0
    viewed: int = 0
    assign_history: int = 0
    assigned_to_me: int = 0


class DashboardActivityListResponse(BaseModel):
    tab: str
    total: int
    page: int
    page_size: int
    counts: DashboardActivityCountsResponse
    items: list[DashboardRecentActivityItemResponse] = Field(default_factory=list)


class DashboardAuditLogListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[DashboardAuditLogItemResponse] = Field(default_factory=list)
    filters: DashboardAuditLogFilterOptionsResponse = Field(default_factory=DashboardAuditLogFilterOptionsResponse)


class DashboardAssignmentHistoryListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[DashboardAssignmentHistoryItemResponse] = Field(default_factory=list)


class SpaceSummaryDashboardResponse(BaseModel):
    space_id: str
    name_space: str
    status_space: str
    viewer_role: str
    viewer_scope: str
    selected_member_id: str | None = None
    owner: DashboardUserSummaryResponse | None = None
    members: list[DashboardSummaryMemberResponse] = Field(default_factory=list)
    metrics: SpaceSummaryMetricsResponse
    task_status_overview: DashboardStatusOverviewResponse
    priority_breakdown: DashboardPriorityBreakdownResponse
    user_account_overview: DashboardUserAccountOverviewResponse | None = None
    activity_counts: DashboardActivityCountsResponse = Field(default_factory=DashboardActivityCountsResponse)
    recent_activities: list[DashboardRecentActivityItemResponse] = Field(default_factory=list)
    recent_tasks: DashboardActivityListResponse
    viewed_items: DashboardActivityListResponse
    assignment_history: DashboardAssignmentHistoryListResponse | None = None
    assigned_to_me: DashboardActivityListResponse | None = None


class SuperAdminDashboardResponse(BaseModel):
    metrics: DashboardMetricsResponse
    task_status_overview: DashboardStatusOverviewResponse
    priority_breakdown: DashboardPriorityBreakdownResponse
    user_account_overview: DashboardUserAccountOverviewResponse
    space_overview: DashboardSpaceOverviewResponse
    activity_spaces: list[DashboardActivitySpaceResponse] = Field(default_factory=list)
    activity_counts: DashboardActivityCountsResponse = Field(default_factory=DashboardActivityCountsResponse)
    audit_logs: DashboardAuditLogListResponse
    assignment_history: DashboardAssignmentHistoryListResponse
    recent_activities: list[DashboardRecentActivityItemResponse] = Field(default_factory=list)
