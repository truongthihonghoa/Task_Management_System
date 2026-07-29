from datetime import datetime, timedelta
from app.core.timezone import vietnam_now

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.task import Task
from app.models.task_assignment_history import TaskAssignmentHistory
from app.models.user import User
from app.repository import dashboard as dashboard_repository
from app.schemas.dashboard import (
    DashboardAssignmentHistoryItemResponse,
    DashboardAssignmentHistoryListResponse,
    DashboardAuditLogItemResponse,
    DashboardAuditLogFilterOptionsResponse,
    DashboardAuditLogListResponse,
    DashboardActivityCountsResponse,
    DashboardActivityListResponse,
    DashboardActivitySpaceResponse,
    DashboardCountItem,
    DashboardFilterOptionResponse,
    DashboardMetricsResponse,
    DashboardPriorityBreakdownResponse,
    DashboardRecentActivityItemResponse,
    DashboardSpaceOverviewResponse,
    DashboardStatusOverviewResponse,
    DashboardSummaryMemberResponse,
    DashboardUserAccountOverviewResponse,
    DashboardUserSummaryResponse,
    SpaceSummaryDashboardResponse,
    SpaceSummaryMetricsResponse,
    SuperAdminDashboardResponse,
)


TASK_STATUS_LABELS = {
    "new": "New",
    "in_progress": "In Progress",
    "in_testing": "In Testing",
    "pending_review": "Pending Review",
    "done": "Done",
    "need_revision": "Need Revision",
    "cancelled": "Cancelled",
}

USER_STATUS_LABELS = {
    "Active": "Active Users",
    "Pending": "Pending Verification",
    "Locked": "Locked Accounts",
    "Inactive": "Inactive Users",
}

SPACE_STATUS_LABELS = {
    "Active": "Active Spaces",
    "Archived": "Archived Spaces",
}

OVERDUE_STATUS_KEY = "overdue"
OVERDUE_STATUS_LABEL = "Overdue"

PRIORITY_LABELS = {
    "HIGH": "High",
    "MEDIUM": "Medium",
    "LOW": "Low",
}

ACTIVITY_TABS = {"worked_on", "viewed", "assign_history"}
SPACE_SUMMARY_TABS = {"worked_on", "viewed", "assign_history", "assigned_to_me"}
AUDIT_DATE_RANGE_OPTIONS = [
    ("all_time", "All time"),
    ("today", "Today"),
    ("yesterday", "Yesterday"),
    ("last_7_days", "Last 7 days"),
    ("last_30_days", "Last 30 days"),
    ("last_90_days", "Last 90 days"),
    ("last_6_months", "Last 6 months"),
]
AUDIT_SORT_OPTIONS = [
    ("desc", "Newest First"),
    ("asc", "Oldest First"),
]


def ensure_super_admin(user: User) -> None:
    if user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SUPER_ADMIN access required.")


def ensure_space_summary_access(db: Session, space_id: str, user: User):
    space = dashboard_repository.get_active_space_by_id(db, space_id)
    if space is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")
    if user.role == "SUPER_ADMIN" or space.owner_id == user.user_id:
        return space
    if dashboard_repository.get_active_space_member(db, space_id, user.user_id) is not None:
        return space
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only SUPER_ADMIN, the space owner, or an active space member can access this summary.",
    )


def _space_summary_scope(space, user: User) -> tuple[str, str]:
    if user.role == "SUPER_ADMIN":
        return "SUPER_ADMIN", "space"
    if space.owner_id == user.user_id:
        return "OWNER", "space"
    return "MEMBER", "member"


def _space_summary_member_item(row) -> DashboardSummaryMemberResponse:
    member, role, member_status, joined_at, is_owner = row
    return DashboardSummaryMemberResponse(
        user=_user_summary(member),
        role=role,
        status=member_status,
        joined_at=joined_at,
        is_owner=is_owner,
    )


def get_space_summary_members(db: Session, user: User, space_id: str) -> list[DashboardSummaryMemberResponse]:
    space = ensure_space_summary_access(db, space_id, user)
    _, viewer_scope = _space_summary_scope(space, user)
    members = [_space_summary_member_item(row) for row in dashboard_repository.list_space_summary_members(db, space_id)]
    if viewer_scope == "member":
        return [member for member in members if member.user.user_id == user.user_id]
    return members


def _resolve_summary_member_filter(
    db: Session,
    space,
    user: User,
    member_id: str | None,
) -> str | None:
    _, viewer_scope = _space_summary_scope(space, user)
    if viewer_scope == "member":
        if member_id and member_id != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Members can only filter their own summary.",
            )
        return user.user_id

    if member_id is None:
        return None
    if member_id == space.owner_id or dashboard_repository.get_active_space_member(db, space.space_id, member_id) is not None:
        return member_id
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this space.")


def initials_for_name(name: str | None) -> str:
    if not name:
        return ""
    parts = [part for part in name.strip().split() if part]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


def humanize_action(action: str) -> str:
    return action.replace("_", " ").strip().title()


def _percentage(count: int, total: int) -> float:
    if total <= 0:
        return 0
    return round((count / total) * 100, 2)


def _build_count_items(counts: dict[str, int], labels: dict[str, str]) -> list[DashboardCountItem]:
    total = sum(counts.values())
    return [
        DashboardCountItem(
            key=key,
            label=label,
            count=int(counts.get(key, 0)),
            percentage=_percentage(int(counts.get(key, 0)), total),
        )
        for key, label in labels.items()
    ]


def _user_summary(user: User | None) -> DashboardUserSummaryResponse | None:
    if user is None:
        return None
    return DashboardUserSummaryResponse(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        initials=initials_for_name(user.full_name),
        avatar_url=getattr(user, "avatar_url", None),
    )


def _user_summaries(users: list[User]) -> list[DashboardUserSummaryResponse]:
    return [summary for user in users if (summary := _user_summary(user)) is not None]


def _audit_log_item(log: AuditLog) -> DashboardAuditLogItemResponse:
    return DashboardAuditLogItemResponse(
        log_id=log.log_id,
        user=_user_summary(log.user),
        action=log.action,
        event=humanize_action(log.action),
        label_title=log.label_title,
        entity_id=log.entity_id,
        payload=log.payload,
        created_at=log.created_at,
    )


def _assignment_history_item(history: TaskAssignmentHistory) -> DashboardAssignmentHistoryItemResponse:
    task = history.task
    space = task.space if task is not None else None
    return DashboardAssignmentHistoryItemResponse(
        assignment_history_id=history.assignment_history_id,
        task_id=history.task_id,
        task_title=task.title if task is not None else None,
        space_id=task.space_id if task is not None else None,
        space_name=space.name_space if space is not None else None,
        previous_assignee=_user_summary(history.previous_assignee),
        new_assignee=_user_summary(history.new_assignee),
        changed_by=_user_summary(history.changed_by_user),
        reason=history.reason,
        change_status=history.change_status,
        changed_at=history.changed_at,
    )


def _recent_activity_from_audit(log: DashboardAuditLogItemResponse) -> DashboardRecentActivityItemResponse:
    return DashboardRecentActivityItemResponse(
        id=log.log_id,
        source="audit_log",
        user=log.user,
        action=log.event,
        label_title=log.label_title,
        target_type=None,
        target_id=log.entity_id,
        target_title=None,
        status=None,
        created_at=log.created_at,
    )


def _recent_activity_from_task_audit(row) -> DashboardRecentActivityItemResponse:
    try:
        log, task = row
    except (TypeError, ValueError):
        log, task = row, None
    return _recent_activity_from_audit(_audit_log_item(log)).model_copy(
        update={
            "target_type": "task",
            "target_id": task.task_id if task is not None else log.entity_id,
            "target_title": task.title if task is not None else None,
            "subtitle": f"{task.task_id} - {task.space.name_space}" if task is not None and task.space else (task.task_id if task is not None else None),
            "status": task.task_status if task is not None else None,
            "priority": task.priority if task is not None else None,
            "space_id": task.space_id if task is not None else None,
            "space_name": task.space.name_space if task is not None and task.space else None,
        }
    )


def _recent_activity_from_assignment(
    history: DashboardAssignmentHistoryItemResponse,
) -> DashboardRecentActivityItemResponse:
    return DashboardRecentActivityItemResponse(
        id=history.assignment_history_id,
        source="assignment_history",
        user=history.changed_by,
        action="Updated Task Assignment",
        label_title="ASSIGNMENT",
        target_type="task",
        target_id=history.task_id,
        target_title=history.task_title,
        status=history.change_status,
        space_id=history.space_id,
        space_name=history.space_name,
        created_at=history.changed_at,
    )


def _recent_activity_from_task(task: Task) -> DashboardRecentActivityItemResponse:
    assignees = [
        entry.assignee
        for entry in sorted(task.assignees, key=lambda item: item.assignee_at)
        if entry.assignee is not None
    ]
    return DashboardRecentActivityItemResponse(
        id=task.task_id,
        source="worked_on",
        user=_user_summary(task.creator),
        action="Updated Task",
        label_title="TASK",
        target_type="task",
        target_id=task.task_id,
        target_title=task.title,
        subtitle=f"{task.task_id} - {task.space.name_space}" if task.space else task.task_id,
        status=task.task_status,
        priority=task.priority,
        space_id=task.space_id,
        space_name=task.space.name_space if task.space else None,
        assignees=_user_summaries(assignees),
        created_at=task.updated_at,
    )


def _recent_activity_from_assigned_task(task: Task) -> DashboardRecentActivityItemResponse:
    item = _recent_activity_from_task(task)
    item.source = "assigned_to_me"
    item.action = "Assigned To Me"
    return item


def _recent_activity_from_view(row) -> DashboardRecentActivityItemResponse:
    recent_view, viewer, task, task_space, direct_space, viewed_user = row
    if recent_view.entity_type == "task" and task is not None:
        return DashboardRecentActivityItemResponse(
            id=recent_view.recent_view_id,
            source="viewed",
            user=_user_summary(viewer),
            action="Viewed Task",
            label_title="TASK",
            target_type="task",
            target_id=task.task_id,
            target_title=task.title,
            subtitle=f"{task.task_id} - {task_space.name_space}" if task_space else task.task_id,
            status=task.task_status,
            priority=task.priority,
            space_id=task.space_id,
            space_name=task_space.name_space if task_space else None,
            created_at=recent_view.viewed_at,
        )
    if recent_view.entity_type == "space" and direct_space is not None:
        return DashboardRecentActivityItemResponse(
            id=recent_view.recent_view_id,
            source="viewed",
            user=_user_summary(viewer),
            action="Viewed Space",
            label_title="SPACE",
            target_type="space",
            target_id=direct_space.space_id,
            target_title=direct_space.name_space,
            subtitle=direct_space.space_id,
            status=direct_space.status_space,
            space_id=direct_space.space_id,
            space_name=direct_space.name_space,
            created_at=recent_view.viewed_at,
        )
    return DashboardRecentActivityItemResponse(
        id=recent_view.recent_view_id,
        source="viewed",
        user=_user_summary(viewer),
        action="Viewed User",
        label_title="USER",
        target_type="user",
        target_id=viewed_user.user_id if viewed_user else recent_view.entity_id,
        target_title=viewed_user.full_name if viewed_user else recent_view.entity_id,
        subtitle=viewed_user.email if viewed_user else None,
        status=viewed_user.status_user if viewed_user else None,
        created_at=recent_view.viewed_at,
    )


def _date_range_bounds(date_range: str | None) -> tuple[datetime | None, datetime | None]:
    if not date_range:
        return None, None
    normalized = date_range.lower().replace(" ", "_").replace("-", "_")
    if normalized in {"all_time", "all"}:
        return None, None
    now = vietnam_now()
    today_start = datetime(now.year, now.month, now.day)
    if normalized == "today":
        return today_start, now
    if normalized == "yesterday":
        yesterday_start = today_start - timedelta(days=1)
        return yesterday_start, today_start
    if normalized in {"last_7_days", "last_7"}:
        return now - timedelta(days=7), now
    if normalized in {"last_30_days", "last_30"}:
        return now - timedelta(days=30), now
    if normalized in {"last_90_days", "last_90"}:
        return now - timedelta(days=90), now
    if normalized in {"last_6_months", "last_6_month", "last_180_days", "last_180"}:
        return now - timedelta(days=183), now
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail="Unsupported date_range. Use all_time, today, yesterday, last_7_days, last_30_days, last_90_days, or last_6_months.",
    )


def get_audit_logs(
    db: Session,
    user: User,
    *,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    event_type: str | None = None,
    label_title: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
) -> DashboardAuditLogListResponse:
    ensure_super_admin(user)
    logs, total = dashboard_repository.list_audit_logs(
        db,
        page=page,
        page_size=page_size,
        search=search,
        event_type=event_type,
        label_title=label_title,
        date_from=date_from,
        date_to=date_to,
        sort_order=sort_order,
    )
    return DashboardAuditLogListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_audit_log_item(log) for log in logs],
        filters=_build_audit_log_filter_options(db),
    )


def get_audit_log_detail(db: Session, user: User, log_id: str) -> DashboardAuditLogItemResponse:
    ensure_super_admin(user)
    log = dashboard_repository.get_audit_log_by_id(db, log_id)
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found.")
    return _audit_log_item(log)


def _build_audit_log_filter_options(db: Session) -> DashboardAuditLogFilterOptionsResponse:
    event_types = [
        DashboardFilterOptionResponse(value=action, label=humanize_action(action), count=int(count or 0))
        for action, count in dashboard_repository.get_audit_log_event_type_counts(db)
    ]
    label_titles = [
        DashboardFilterOptionResponse(value=label_title, label=str(label_title).replace("_", " ").strip().title(), count=int(count or 0))
        for label_title, count in dashboard_repository.get_audit_log_label_title_counts(db)
    ]
    return DashboardAuditLogFilterOptionsResponse(
        event_types=event_types,
        label_titles=label_titles,
        date_ranges=[
            DashboardFilterOptionResponse(value=value, label=label)
            for value, label in AUDIT_DATE_RANGE_OPTIONS
        ],
        sort_orders=[
            DashboardFilterOptionResponse(value=value, label=label)
            for value, label in AUDIT_SORT_OPTIONS
        ],
    )


def get_audit_log_filter_options(db: Session, user: User) -> DashboardAuditLogFilterOptionsResponse:
    ensure_super_admin(user)
    return _build_audit_log_filter_options(db)


def get_assignment_history(
    db: Session,
    user: User,
    *,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    change_status: str | None = None,
    space_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
) -> DashboardAssignmentHistoryListResponse:
    ensure_super_admin(user)
    histories, total = dashboard_repository.list_assignment_history(
        db,
        page=page,
        page_size=page_size,
        search=search,
        change_status=change_status,
        space_id=space_id,
        date_from=date_from,
        date_to=date_to,
        sort_order=sort_order,
    )
    return DashboardAssignmentHistoryListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_assignment_history_item(history) for history in histories],
    )


def get_activity_spaces(db: Session, user: User) -> list[DashboardActivitySpaceResponse]:
    ensure_super_admin(user)
    return [
        DashboardActivitySpaceResponse(
            space_id=space.space_id,
            name_space=space.name_space,
            status_space=space.status_space,
            owner_id=getattr(space, "owner_id", None),
            owner=_user_summary(owner),
            active_member_count=int(member_count or 0),
            task_count=int(task_count or 0),
            assignment_history_count=int(history_count or 0),
        )
        for space, owner, member_count, task_count, history_count in dashboard_repository.list_activity_spaces(db)
    ]


def _activity_counts(
    db: Session,
    *,
    space_id: str | None,
    search: str | None,
    status_filter: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    user_id: str | None = None,
    assignment_member_id: str | None = None,
    include_assign_history: bool = True,
    current_sprint_only_for_assignments: bool = False,
) -> DashboardActivityCountsResponse:
    _, worked_on_total = dashboard_repository.list_worked_on_tasks(
        db,
        page=1,
        page_size=1,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    _, viewed_total = dashboard_repository.list_viewed_activities(
        db,
        page=1,
        page_size=1,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    assign_total = 0
    if include_assign_history:
        _, assign_total = dashboard_repository.list_assignment_history(
            db,
            page=1,
            page_size=1,
            search=search,
            change_status=status_filter,
            space_id=space_id,
            member_id=assignment_member_id,
            date_from=date_from,
            date_to=date_to,
            current_sprint_only=current_sprint_only_for_assignments,
        )
    assigned_to_me_total = 0
    if space_id and user_id:
        _, assigned_to_me_total = dashboard_repository.list_assigned_to_me_tasks(
            db,
            page=1,
            page_size=1,
            space_id=space_id,
            user_id=user_id,
            search=search,
            status_filter=status_filter,
            date_from=date_from,
            date_to=date_to,
            current_sprint_only=current_sprint_only_for_assignments,
        )
    return DashboardActivityCountsResponse(
        worked_on=worked_on_total,
        viewed=viewed_total,
        assign_history=assign_total,
        assigned_to_me=assigned_to_me_total,
    )


def get_recent_activities(
    db: Session,
    user: User,
    *,
    tab: str = "worked_on",
    page: int = 1,
    page_size: int = 20,
    space_id: str | None = None,
    search: str | None = None,
    status_filter: str | None = None,
    date_range: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> DashboardActivityListResponse:
    ensure_super_admin(user)
    normalized_tab = tab if tab in ACTIVITY_TABS else "worked_on"
    range_from, range_to = _date_range_bounds(date_range)
    effective_from = date_from or range_from
    effective_to = date_to or range_to
    counts = _activity_counts(
        db,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_from=effective_from,
        date_to=effective_to,
    )

    if normalized_tab == "viewed":
        rows, total = dashboard_repository.list_viewed_activities(
            db,
            page=page,
            page_size=page_size,
            space_id=space_id,
            search=search,
            status_filter=status_filter,
            date_from=effective_from,
            date_to=effective_to,
        )
        items = [_recent_activity_from_view(row) for row in rows]
    elif normalized_tab == "assign_history":
        histories, total = dashboard_repository.list_assignment_history(
            db,
            page=page,
            page_size=page_size,
            search=search,
            change_status=status_filter,
            space_id=space_id,
            member_id=None,
            date_from=effective_from,
            date_to=effective_to,
        )
        items = [_recent_activity_from_assignment(_assignment_history_item(history)) for history in histories]
    else:
        tasks, total = dashboard_repository.list_worked_on_tasks(
            db,
            page=page,
            page_size=page_size,
            space_id=space_id,
            search=search,
            status_filter=status_filter,
            date_from=effective_from,
            date_to=effective_to,
        )
        items = [_recent_activity_from_task(task) for task in tasks]

    return DashboardActivityListResponse(
        tab=normalized_tab,
        total=total,
        page=page,
        page_size=page_size,
        counts=counts,
        items=items,
    )


def get_space_summary_recent_tasks(
    db: Session,
    user: User,
    space_id: str,
    *,
    tab: str = "worked_on",
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status_filter: str | None = None,
    date_range: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    member_id: str | None = None,
) -> DashboardActivityListResponse:
    space = ensure_space_summary_access(db, space_id, user)
    _, viewer_scope = _space_summary_scope(space, user)
    selected_member_id = _resolve_summary_member_filter(db, space, user, member_id)
    normalized_tab = tab if tab in SPACE_SUMMARY_TABS else "worked_on"
    if viewer_scope == "member" and normalized_tab == "assign_history":
        normalized_tab = "assigned_to_me"
    if viewer_scope == "space" and normalized_tab == "assigned_to_me":
        normalized_tab = "assign_history"
    scoped_user_id = selected_member_id
    range_from, range_to = _date_range_bounds(date_range)
    effective_from = date_from or range_from
    effective_to = date_to or range_to
    counts = _activity_counts(
        db,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_from=effective_from,
        date_to=effective_to,
        user_id=scoped_user_id,
        assignment_member_id=selected_member_id,
        include_assign_history=viewer_scope == "space",
        current_sprint_only_for_assignments=True,
    )

    if normalized_tab == "viewed":
        rows, total = dashboard_repository.list_viewed_activities(
            db,
            page=page,
            page_size=page_size,
            space_id=space_id,
            search=search,
            status_filter=status_filter,
            date_from=effective_from,
            date_to=effective_to,
            user_id=scoped_user_id,
        )
        items = [_recent_activity_from_view(row) for row in rows]
    elif normalized_tab == "assign_history":
        histories, total = dashboard_repository.list_assignment_history(
            db,
            page=page,
            page_size=page_size,
            search=search,
            change_status=status_filter,
            space_id=space_id,
            member_id=selected_member_id,
            date_from=effective_from,
            date_to=effective_to,
            current_sprint_only=True,
        )
        items = [_recent_activity_from_assignment(_assignment_history_item(history)) for history in histories]
    elif normalized_tab == "assigned_to_me":
        tasks, total = dashboard_repository.list_assigned_to_me_tasks(
            db,
            page=page,
            page_size=page_size,
            space_id=space_id,
            user_id=selected_member_id or user.user_id,
            search=search,
            status_filter=status_filter,
            date_from=effective_from,
            date_to=effective_to,
            current_sprint_only=True,
        )
        items = [_recent_activity_from_assigned_task(task) for task in tasks]
    else:
        tasks, total = dashboard_repository.list_worked_on_tasks(
            db,
            page=page,
            page_size=page_size,
            space_id=space_id,
            search=search,
            status_filter=status_filter,
            date_from=effective_from,
            date_to=effective_to,
            user_id=scoped_user_id,
        )
        items = [_recent_activity_from_task(task) for task in tasks]

    return DashboardActivityListResponse(
        tab=normalized_tab,
        total=total,
        page=page,
        page_size=page_size,
        counts=counts,
        items=items,
    )


def get_space_summary_recent_activities(
    db: Session,
    user: User,
    space_id: str,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status_filter: str | None = None,
    date_range: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    member_id: str | None = None,
) -> DashboardActivityListResponse:
    space = ensure_space_summary_access(db, space_id, user)
    _, viewer_scope = _space_summary_scope(space, user)
    selected_member_id = _resolve_summary_member_filter(db, space, user, member_id)
    scoped_user_id = selected_member_id
    range_from, range_to = _date_range_bounds(date_range)
    effective_from = date_from or range_from
    effective_to = date_to or range_to
    fetch_size = page * page_size
    counts = _activity_counts(
        db,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_from=effective_from,
        date_to=effective_to,
        user_id=scoped_user_id,
        assignment_member_id=selected_member_id,
        include_assign_history=viewer_scope == "space",
        current_sprint_only_for_assignments=True,
    )

    worked_on_tasks, worked_on_total = dashboard_repository.list_worked_on_tasks(
        db,
        page=1,
        page_size=fetch_size,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_from=effective_from,
        date_to=effective_to,
        user_id=scoped_user_id,
    )
    viewed_rows, viewed_total = dashboard_repository.list_viewed_activities(
        db,
        page=1,
        page_size=fetch_size,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_from=effective_from,
        date_to=effective_to,
        user_id=scoped_user_id,
    )
    task_audit_logs, task_audit_total = dashboard_repository.list_task_audit_logs(
        db,
        page=1,
        page_size=fetch_size,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_from=effective_from,
        date_to=effective_to,
        user_id=scoped_user_id,
    )
    items = [
        *[_recent_activity_from_task(task) for task in worked_on_tasks],
        *[_recent_activity_from_view(row) for row in viewed_rows],
        *[_recent_activity_from_task_audit(log) for log in task_audit_logs],
    ]

    if viewer_scope == "member":
        assigned_tasks, assigned_total = dashboard_repository.list_assigned_to_me_tasks(
            db,
            page=1,
            page_size=fetch_size,
            space_id=space_id,
            user_id=user.user_id,
            search=search,
            status_filter=status_filter,
            date_from=effective_from,
            date_to=effective_to,
            current_sprint_only=True,
        )
        histories, assignment_total = dashboard_repository.list_assignment_history(
            db,
            page=1,
            page_size=fetch_size,
            search=search,
            change_status=status_filter,
            space_id=space_id,
            related_user_id=scoped_user_id,
            date_from=effective_from,
            date_to=effective_to,
            current_sprint_only=True,
        )
        items.extend(_recent_activity_from_assigned_task(task) for task in assigned_tasks)
        items.extend(_recent_activity_from_assignment(_assignment_history_item(history)) for history in histories)
        total = worked_on_total + viewed_total + task_audit_total + assigned_total + assignment_total
    else:
        histories, assignment_total = dashboard_repository.list_assignment_history(
            db,
            page=1,
            page_size=fetch_size,
            search=search,
            change_status=status_filter,
            space_id=space_id,
            related_user_id=selected_member_id,
            date_from=effective_from,
            date_to=effective_to,
            current_sprint_only=True,
        )
        items.extend(_recent_activity_from_assignment(_assignment_history_item(history)) for history in histories)
        total = worked_on_total + viewed_total + task_audit_total + assignment_total

    sorted_items = sorted(items, key=lambda item: item.created_at, reverse=True)
    page_start = (page - 1) * page_size
    page_items = sorted_items[page_start:page_start + page_size]
    return DashboardActivityListResponse(
        tab="recent_activity",
        total=total,
        page=page,
        page_size=page_size,
        counts=counts,
        items=page_items,
    )


def get_space_summary_assignment_history(
    db: Session,
    user: User,
    space_id: str,
    *,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    change_status: str | None = None,
    member_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
) -> DashboardAssignmentHistoryListResponse:
    space = ensure_space_summary_access(db, space_id, user)
    _, viewer_scope = _space_summary_scope(space, user)
    if viewer_scope == "member":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SUPER_ADMIN or the space owner can access assignment history.",
        )
    selected_member_id = _resolve_summary_member_filter(db, space, user, member_id)
    histories, total = dashboard_repository.list_assignment_history(
        db,
        page=page,
        page_size=page_size,
        search=search,
        change_status=change_status,
        space_id=space_id,
        member_id=selected_member_id,
        date_from=date_from,
        date_to=date_to,
        sort_order=sort_order,
        current_sprint_only=True,
    )
    return DashboardAssignmentHistoryListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_assignment_history_item(history) for history in histories],
    )


def get_space_summary_dashboard(
    db: Session,
    user: User,
    space_id: str,
    *,
    member_id: str | None = None,
    activities_page: int = 1,
    activities_page_size: int = 20,
    activities_search: str | None = None,
    activities_status: str | None = None,
    activities_date_range: str | None = None,
    activities_date_from: datetime | None = None,
    activities_date_to: datetime | None = None,
    tasks_tab: str = "worked_on",
    tasks_page: int = 1,
    tasks_page_size: int = 20,
    tasks_search: str | None = None,
    tasks_status: str | None = None,
    tasks_date_range: str | None = None,
    tasks_date_from: datetime | None = None,
    tasks_date_to: datetime | None = None,
    assignment_page: int = 1,
    assignment_page_size: int = 25,
    assignment_search: str | None = None,
    assignment_change_status: str | None = None,
    assignment_date_from: datetime | None = None,
    assignment_date_to: datetime | None = None,
    assignment_sort_order: str = "desc",
) -> SpaceSummaryDashboardResponse:
    space = ensure_space_summary_access(db, space_id, user)
    viewer_role, viewer_scope = _space_summary_scope(space, user)
    selected_member_id = _resolve_summary_member_filter(db, space, user, member_id)
    member_rows = dashboard_repository.list_space_summary_members(db, space_id)
    visible_members = [_space_summary_member_item(row) for row in member_rows]
    if viewer_scope == "member":
        visible_members = [member for member in visible_members if member.user.user_id == user.user_id]

    if selected_member_id is not None:
        member_counts = {}
        if viewer_scope == "space":
            member_counts = dashboard_repository.get_space_member_status_count(db, space_id, selected_member_id)
        task_status_counts = dashboard_repository.get_member_task_status_counts(db, space_id, selected_member_id)
        task_priority_counts = dashboard_repository.get_member_task_priority_counts(db, space_id, selected_member_id)
        overdue_tasks = dashboard_repository.count_member_overdue_tasks(db, space_id, selected_member_id)
    else:
        member_counts = dashboard_repository.get_space_member_status_counts(db, space_id)
        task_status_counts = dashboard_repository.get_space_task_status_counts(db, space_id)
        task_priority_counts = dashboard_repository.get_space_task_priority_counts(db, space_id)
        overdue_tasks = dashboard_repository.count_space_overdue_tasks(db, space_id)

    total_users = sum(member_counts.values())
    total_tasks = sum(task_status_counts.values())
    task_status_items = _build_count_items(task_status_counts, TASK_STATUS_LABELS)
    task_status_items.append(
        DashboardCountItem(
            key=OVERDUE_STATUS_KEY,
            label=OVERDUE_STATUS_LABEL,
            count=overdue_tasks,
            percentage=_percentage(overdue_tasks, total_tasks),
        )
    )

    recent_tasks = get_space_summary_recent_tasks(
        db,
        user,
        space_id,
        tab=tasks_tab,
        page=tasks_page,
        page_size=tasks_page_size,
        member_id=selected_member_id,
        search=tasks_search,
        status_filter=tasks_status,
        date_range=tasks_date_range,
        date_from=tasks_date_from,
        date_to=tasks_date_to,
    )
    viewed_items = get_space_summary_recent_tasks(
        db,
        user,
        space_id,
        tab="viewed",
        page=tasks_page,
        page_size=tasks_page_size,
        member_id=selected_member_id,
        search=tasks_search,
        status_filter=tasks_status,
        date_range=tasks_date_range,
        date_from=tasks_date_from,
        date_to=tasks_date_to,
    )
    if viewer_scope == "member":
        assignment_history = None
        assigned_to_me = get_space_summary_recent_tasks(
            db,
            user,
            space_id,
            tab="assigned_to_me",
            page=tasks_page,
            page_size=tasks_page_size,
            member_id=selected_member_id,
            search=tasks_search,
            status_filter=tasks_status,
            date_range=tasks_date_range,
            date_from=tasks_date_from,
            date_to=tasks_date_to,
        )
    else:
        assignment_history = get_space_summary_assignment_history(
            db,
            user,
            space_id,
            page=assignment_page,
            page_size=assignment_page_size,
            member_id=selected_member_id,
            search=assignment_search,
            change_status=assignment_change_status,
            date_from=assignment_date_from,
            date_to=assignment_date_to,
            sort_order=assignment_sort_order,
        )
        assigned_to_me = None

    recent_activities = get_space_summary_recent_activities(
        db,
        user,
        space_id,
        page=activities_page,
        page_size=activities_page_size,
        member_id=selected_member_id,
        search=activities_search,
        status_filter=activities_status,
        date_range=activities_date_range,
        date_from=activities_date_from,
        date_to=activities_date_to,
    )

    return SpaceSummaryDashboardResponse(
        space_id=space.space_id,
        name_space=space.name_space,
        status_space=space.status_space,
        viewer_role=viewer_role,
        viewer_scope=viewer_scope,
        selected_member_id=selected_member_id,
        owner=_user_summary(space.owner),
        members=visible_members,
        metrics=SpaceSummaryMetricsResponse(
            total_users=total_users if viewer_scope == "space" else None,
            total_tasks=total_tasks,
            completed_tasks=int(task_status_counts.get("done", 0)),
            in_progress_tasks=int(task_status_counts.get("in_progress", 0)),
            overdue_tasks=overdue_tasks,
            overdue_supported=True,
        ),
        task_status_overview=DashboardStatusOverviewResponse(
            total=total_tasks,
            items=task_status_items,
        ),
        priority_breakdown=DashboardPriorityBreakdownResponse(
            total=sum(task_priority_counts.values()),
            items=_build_count_items(task_priority_counts, PRIORITY_LABELS),
        ),
        user_account_overview=(
            DashboardUserAccountOverviewResponse(
                total=total_users,
                items=_build_count_items(member_counts, USER_STATUS_LABELS),
            )
            if viewer_scope == "space"
            else None
        ),
        activity_counts=recent_activities.counts,
        recent_activities=recent_activities.items,
        recent_tasks=recent_tasks,
        viewed_items=viewed_items,
        assignment_history=assignment_history,
        assigned_to_me=assigned_to_me,
    )


def get_super_admin_dashboard(db: Session, user: User) -> SuperAdminDashboardResponse:
    ensure_super_admin(user)

    user_counts = dashboard_repository.get_user_status_counts(db)
    space_counts = dashboard_repository.get_space_status_counts(db)
    task_status_counts = dashboard_repository.get_task_status_counts(db)
    task_priority_counts = dashboard_repository.get_task_priority_counts(db)
    overdue_tasks = dashboard_repository.count_overdue_tasks(db)

    total_users = sum(user_counts.values())
    total_spaces = sum(space_counts.values())
    total_tasks = sum(task_status_counts.values())
    task_status_items = _build_count_items(task_status_counts, TASK_STATUS_LABELS)
    task_status_items.append(
        DashboardCountItem(
            key=OVERDUE_STATUS_KEY,
            label=OVERDUE_STATUS_LABEL,
            count=overdue_tasks,
            percentage=_percentage(overdue_tasks, total_tasks),
        )
    )

    audit_logs = get_audit_logs(db, user, page=1, page_size=8)
    assignment_history = get_assignment_history(db, user, page=1, page_size=8)
    activity_spaces = get_activity_spaces(db, user)
    activity_counts = _activity_counts(
        db,
        space_id=None,
        search=None,
        status_filter=None,
        date_from=None,
        date_to=None,
    )

    recent_activities = [
        *[_recent_activity_from_audit(log) for log in audit_logs.items],
        *[_recent_activity_from_assignment(history) for history in assignment_history.items],
    ]
    recent_activities = sorted(recent_activities, key=lambda item: item.created_at, reverse=True)[:10]

    return SuperAdminDashboardResponse(
        metrics=DashboardMetricsResponse(
            total_users=total_users,
            total_spaces=total_spaces,
            total_tasks=total_tasks,
            completed_tasks=int(task_status_counts.get("done", 0)),
            in_progress_tasks=int(task_status_counts.get("in_progress", 0)),
            overdue_tasks=overdue_tasks,
            overdue_supported=True,
        ),
        task_status_overview=DashboardStatusOverviewResponse(
            total=total_tasks,
            items=task_status_items,
        ),
        priority_breakdown=DashboardPriorityBreakdownResponse(
            total=sum(task_priority_counts.values()),
            items=_build_count_items(task_priority_counts, PRIORITY_LABELS),
        ),
        user_account_overview=DashboardUserAccountOverviewResponse(
            total=total_users,
            items=_build_count_items(user_counts, USER_STATUS_LABELS),
        ),
        space_overview=DashboardSpaceOverviewResponse(
            total=total_spaces,
            items=_build_count_items(space_counts, SPACE_STATUS_LABELS),
        ),
        activity_spaces=activity_spaces,
        activity_counts=activity_counts,
        audit_logs=audit_logs,
        assignment_history=assignment_history,
        recent_activities=recent_activities,
    )
