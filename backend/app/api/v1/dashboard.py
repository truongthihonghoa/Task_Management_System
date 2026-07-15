from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import (
    DashboardActivityListResponse,
    DashboardActivitySpaceResponse,
    DashboardAuditLogFilterOptionsResponse,
    DashboardAuditLogItemResponse,
    DashboardAssignmentHistoryListResponse,
    DashboardAuditLogListResponse,
    DashboardSummaryMemberResponse,
    SpaceSummaryDashboardResponse,
    SuperAdminDashboardResponse,
)
from app.services import dashboard_service


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/super-admin", response_model=SuperAdminDashboardResponse)
def get_super_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SuperAdminDashboardResponse:
    return dashboard_service.get_super_admin_dashboard(db, current_user)


@router.get("/spaces/{space_id}/summary", response_model=SpaceSummaryDashboardResponse)
def get_space_summary_dashboard(
    space_id: str,
    member_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SpaceSummaryDashboardResponse:
    return dashboard_service.get_space_summary_dashboard(db, current_user, space_id, member_id=member_id)


@router.get("/spaces/{space_id}/summary/members", response_model=list[DashboardSummaryMemberResponse])
def get_space_summary_members(
    space_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DashboardSummaryMemberResponse]:
    return dashboard_service.get_space_summary_members(db, current_user, space_id)


@router.get("/spaces/{space_id}/summary/recent-activities", response_model=DashboardActivityListResponse)
def get_space_summary_recent_activities(
    space_id: str,
    member_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_range: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardActivityListResponse:
    return dashboard_service.get_space_summary_recent_activities(
        db,
        current_user,
        space_id,
        member_id=member_id,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        date_range=date_range,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/spaces/{space_id}/summary/recent-tasks", response_model=DashboardActivityListResponse)
def get_space_summary_recent_tasks(
    space_id: str,
    member_id: str | None = Query(default=None),
    tab: str = Query(default="worked_on"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_range: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardActivityListResponse:
    return dashboard_service.get_space_summary_recent_tasks(
        db,
        current_user,
        space_id,
        member_id=member_id,
        tab=tab,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        date_range=date_range,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/spaces/{space_id}/summary/assignment-history", response_model=DashboardAssignmentHistoryListResponse)
def get_space_summary_assignment_history(
    space_id: str,
    member_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    change_status: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardAssignmentHistoryListResponse:
    return dashboard_service.get_space_summary_assignment_history(
        db,
        current_user,
        space_id,
        member_id=member_id,
        page=page,
        page_size=page_size,
        search=search,
        change_status=change_status,
        date_from=date_from,
        date_to=date_to,
        sort_order=sort_order,
    )


@router.get("/super-admin/activity-spaces", response_model=list[DashboardActivitySpaceResponse])
def get_super_admin_activity_spaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DashboardActivitySpaceResponse]:
    return dashboard_service.get_activity_spaces(db, current_user)


@router.get("/super-admin/recent-activities", response_model=DashboardActivityListResponse)
def get_super_admin_recent_activities(
    tab: str = Query(default="worked_on"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    space_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_range: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardActivityListResponse:
    return dashboard_service.get_recent_activities(
        db,
        current_user,
        tab=tab,
        page=page,
        page_size=page_size,
        space_id=space_id,
        search=search,
        status_filter=status_filter,
        date_range=date_range,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/super-admin/audit-logs", response_model=DashboardAuditLogListResponse)
def get_super_admin_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    label_title: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardAuditLogListResponse:
    return dashboard_service.get_audit_logs(
        db,
        current_user,
        page=page,
        page_size=page_size,
        search=search,
        event_type=event_type,
        label_title=label_title,
        date_from=date_from,
        date_to=date_to,
        sort_order=sort_order,
    )


@router.get("/super-admin/audit-logs/filters", response_model=DashboardAuditLogFilterOptionsResponse)
def get_super_admin_audit_log_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardAuditLogFilterOptionsResponse:
    return dashboard_service.get_audit_log_filter_options(db, current_user)


@router.get("/super-admin/audit-logs/{log_id}", response_model=DashboardAuditLogItemResponse)
def get_super_admin_audit_log_detail(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardAuditLogItemResponse:
    return dashboard_service.get_audit_log_detail(db, current_user, log_id)


@router.get("/super-admin/assignment-history", response_model=DashboardAssignmentHistoryListResponse)
def get_super_admin_assignment_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    change_status: str | None = Query(default=None),
    space_id: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardAssignmentHistoryListResponse:
    return dashboard_service.get_assignment_history(
        db,
        current_user,
        page=page,
        page_size=page_size,
        search=search,
        change_status=change_status,
        space_id=space_id,
        date_from=date_from,
        date_to=date_to,
        sort_order=sort_order,
    )
