from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.api.v1 import dashboard as dashboard_api
from app.services import dashboard_service


class FakeDb:
    pass


def make_user(user_id="USR00000001", role="SUPER_ADMIN", full_name="Alex Morgan"):
    return SimpleNamespace(
        user_id=user_id,
        role=role,
        full_name=full_name,
        email=f"{user_id.lower()}@example.com",
    )


def make_space(space_id="SPC00000001", owner=None):
    owner_user = owner if owner is not None else make_user("USR00000001", role="USER", full_name="Space Owner")
    return SimpleNamespace(
        space_id=space_id,
        name_space="Mobile App Development",
        status_space="Active",
        owner_id=owner_user.user_id,
        owner=owner_user,
    )


def make_space_member(user_id="USR00000011", space_id="SPC00000001"):
    return SimpleNamespace(
        space_member_id="SPM00000001",
        user_id=user_id,
        space_id=space_id,
        role="MEMBER",
        status="Active",
    )


def make_member_row(user=None, role="MEMBER", member_status="Active", is_owner=False):
    member = user if user is not None else make_user("USR00000011", role="USER", full_name="Space Member")
    return member, role, member_status, datetime(2026, 7, 15, 7, 0, 0), is_owner


def make_audit_log(
    log_id="AUD00000001",
    action="CREATE_USER",
    label_title="USER",
    created_at=None,
    user=None,
    entity_id="USR00000009",
):
    return SimpleNamespace(
        log_id=log_id,
        user=user if user is not None else make_user("USR00000002", role="USER", full_name="John Doe"),
        user_id="USR00000002",
        action=action,
        label_title=label_title,
        entity_id=entity_id,
        payload={"status": "Active"},
        created_at=created_at or datetime(2026, 7, 15, 8, 0, 0),
    )


def make_assignment_history(
    assignment_history_id="TAH00000001",
    changed_at=None,
    changed_by=None,
    task_title="Review Security Audit Report",
):
    space = SimpleNamespace(space_id="SPC00000001", name_space="Security")
    task = SimpleNamespace(
        task_id="TSK00000001",
        title=task_title,
        space_id=space.space_id,
        space=space,
    )
    return SimpleNamespace(
        assignment_history_id=assignment_history_id,
        task_id=task.task_id,
        task=task,
        previous_assignee=make_user("USR00000003", role="USER", full_name="Emma Wilson"),
        new_assignee=make_user("USR00000004", role="USER", full_name="Michael Chen"),
        changed_by_user=changed_by if changed_by is not None else make_user("USR00000001"),
        reason="rebalance workload",
        change_status="in_progress",
        changed_at=changed_at or datetime(2026, 7, 15, 9, 0, 0),
    )


def make_task(
    task_id="TSK00000001",
    title="Onboard New Engineering Team",
    task_status="in_progress",
    updated_at=None,
):
    space = SimpleNamespace(space_id="SPC00000001", name_space="User Management")
    creator = make_user("USR00000005", role="USER", full_name="Task Creator")
    assignee = make_user("USR00000006", role="USER", full_name="Trang Nguyen")
    return SimpleNamespace(
        task_id=task_id,
        title=title,
        space_id=space.space_id,
        space=space,
        creator=creator,
        assignees=[
            SimpleNamespace(
                assignee=assignee,
                assignee_at=datetime(2026, 7, 15, 8, 0, 0),
            )
        ],
        task_status=task_status,
        priority="HIGH",
        updated_at=updated_at or datetime(2026, 7, 15, 11, 0, 0),
    )


def make_recent_view_row(entity_type="task"):
    recent_view = SimpleNamespace(
        recent_view_id="RCV00000001",
        entity_type=entity_type,
        entity_id="TSK00000001" if entity_type == "task" else "SPC00000001",
        viewed_at=datetime(2026, 7, 15, 10, 0, 0),
    )
    viewer = make_user("USR00000007", role="USER", full_name="Viewer User")
    task = make_task() if entity_type == "task" else None
    task_space = task.space if task is not None else None
    direct_space = SimpleNamespace(space_id="SPC00000001", name_space="User Management", status_space="Active") if entity_type == "space" else None
    viewed_user = make_user("USR00000008", role="USER", full_name="Viewed User") if entity_type == "user" else None
    return recent_view, viewer, task, task_space, direct_space, viewed_user


def test_dashboard_requires_super_admin():
    with pytest.raises(HTTPException) as exc_info:
        dashboard_service.get_super_admin_dashboard(FakeDb(), make_user(role="USER"))

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc_info.value.detail == "SUPER_ADMIN access required."


@pytest.mark.parametrize(
    ("service_call", "kwargs"),
    [
        ("get_audit_logs", {}),
        ("get_audit_log_filter_options", {}),
        ("get_audit_log_detail", {"log_id": "AUD00000001"}),
        ("get_assignment_history", {}),
        ("get_activity_spaces", {}),
        ("get_recent_activities", {}),
    ],
)
def test_dashboard_services_require_super_admin(service_call, kwargs):
    with pytest.raises(HTTPException) as exc_info:
        getattr(dashboard_service, service_call)(FakeDb(), make_user(role="USER"), **kwargs)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc_info.value.detail == "SUPER_ADMIN access required."


def test_space_summary_access_allows_super_admin_owner_and_active_member(monkeypatch):
    owner = make_user("USR00000010", role="USER", full_name="Space Owner")
    member = make_user("USR00000011", role="USER", full_name="Space Member")
    space = make_space(owner=owner)
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_active_space_by_id",
        lambda _db, space_id: space if space_id == space.space_id else None,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_active_space_member",
        lambda _db, space_id, user_id: make_space_member(user_id, space_id) if user_id == member.user_id else None,
    )

    assert dashboard_service.ensure_space_summary_access(FakeDb(), space.space_id, make_user(role="SUPER_ADMIN")) is space
    assert dashboard_service.ensure_space_summary_access(FakeDb(), space.space_id, owner) is space
    assert dashboard_service.ensure_space_summary_access(FakeDb(), space.space_id, member) is space

    with pytest.raises(HTTPException) as exc_info:
        dashboard_service.ensure_space_summary_access(FakeDb(), space.space_id, make_user("USR00000012", role="USER"))

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert exc_info.value.detail == "Only SUPER_ADMIN, the space owner, or an active space member can access this summary."

    with pytest.raises(HTTPException) as missing_exc:
        dashboard_service.ensure_space_summary_access(FakeDb(), "SPC404", owner)

    assert missing_exc.value.status_code == status.HTTP_404_NOT_FOUND


def test_space_summary_members_are_visible_by_role(monkeypatch):
    owner = make_user("USR00000010", role="USER", full_name="Space Owner")
    member = make_user("USR00000011", role="USER", full_name="Space Member")
    space = make_space(owner=owner)
    member_rows = [
        make_member_row(owner, role="OWNER", is_owner=True),
        make_member_row(member),
    ]

    monkeypatch.setattr(dashboard_service.dashboard_repository, "get_active_space_by_id", lambda _db, space_id: space)
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_active_space_member",
        lambda _db, space_id, user_id: make_space_member(user_id, space_id) if user_id == member.user_id else None,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_space_summary_members",
        lambda _db, space_id: member_rows,
    )

    owner_response = dashboard_service.get_space_summary_members(FakeDb(), owner, space.space_id)
    member_response = dashboard_service.get_space_summary_members(FakeDb(), member, space.space_id)

    assert [item.user.user_id for item in owner_response] == [owner.user_id, member.user_id]
    assert owner_response[0].is_owner is True
    assert [item.user.user_id for item in member_response] == [member.user_id]


def test_space_summary_dashboard_aggregates_one_space_for_owner(monkeypatch):
    owner = make_user("USR00000010", role="USER", full_name="Space Owner")
    space = make_space(owner=owner)

    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_active_space_by_id",
        lambda _db, space_id: space if space_id == space.space_id else None,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_space_summary_members",
        lambda _db, space_id: [make_member_row(owner, role="OWNER", is_owner=True)],
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_space_member_status_counts",
        lambda _db, space_id: {"Active": 3} if space_id == space.space_id else {},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_space_task_status_counts",
        lambda _db, space_id: {"done": 28, "in_progress": 10, "new": 5} if space_id == space.space_id else {},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_space_task_priority_counts",
        lambda _db, space_id: {"HIGH": 12, "MEDIUM": 25, "LOW": 10} if space_id == space.space_id else {},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "count_space_overdue_tasks",
        lambda _db, space_id: 4 if space_id == space.space_id else 0,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_worked_on_tasks",
        lambda _db, **kwargs: ([make_task()], 4),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_viewed_activities",
        lambda _db, **kwargs: ([make_recent_view_row()], 2),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_assignment_history",
        lambda _db, **kwargs: ([make_assignment_history()], 3),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_task_audit_logs",
        lambda _db, **kwargs: ([], 0),
    )

    response = dashboard_service.get_space_summary_dashboard(FakeDb(), owner, space.space_id)

    assert response.space_id == space.space_id
    assert response.viewer_role == "OWNER"
    assert response.viewer_scope == "space"
    assert response.selected_member_id is None
    assert response.members[0].user.user_id == owner.user_id
    assert response.name_space == "Mobile App Development"
    assert response.owner.user_id == owner.user_id
    assert response.metrics.total_users == 3
    assert response.metrics.total_tasks == 43
    assert response.metrics.completed_tasks == 28
    assert response.metrics.in_progress_tasks == 10
    assert response.metrics.overdue_tasks == 4
    assert response.task_status_overview.items[-1].key == "overdue"
    assert response.priority_breakdown.total == 47
    assert response.user_account_overview.total == 3
    assert response.activity_counts.worked_on == 4
    assert response.activity_counts.viewed == 2
    assert response.activity_counts.assign_history == 3
    assert response.recent_tasks.tab == "worked_on"
    assert response.viewed_items.tab == "viewed"
    assert response.assignment_history.total == 3
    assert response.assigned_to_me is None
    assert response.recent_activities[0].space_id == "SPC00000001"
    assert {item.source for item in response.recent_activities} == {"worked_on", "viewed", "assignment_history"}


def test_space_summary_dashboard_filters_owner_view_by_selected_member(monkeypatch):
    owner = make_user("USR00000010", role="USER", full_name="Space Owner")
    selected = make_user("USR00000011", role="USER", full_name="Selected Member")
    space = make_space(owner=owner)
    calls = {}

    monkeypatch.setattr(dashboard_service.dashboard_repository, "get_active_space_by_id", lambda _db, space_id: space)
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_active_space_member",
        lambda _db, space_id, user_id: make_space_member(user_id, space_id) if user_id == selected.user_id else None,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_space_summary_members",
        lambda _db, space_id: [make_member_row(owner, role="OWNER", is_owner=True), make_member_row(selected)],
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_space_member_status_count",
        lambda _db, space_id, user_id: {"Active": 1} if user_id == selected.user_id else {},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_member_task_status_counts",
        lambda _db, space_id, user_id: {"done": 1, "in_progress": 2} if user_id == selected.user_id else {},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_member_task_priority_counts",
        lambda _db, space_id, user_id: {"HIGH": 2, "LOW": 1} if user_id == selected.user_id else {},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "count_member_overdue_tasks",
        lambda _db, space_id, user_id: 1 if user_id == selected.user_id else 0,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_worked_on_tasks",
        lambda _db, **kwargs: (calls.setdefault("worked_on", kwargs) and [make_task()], 3),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_viewed_activities",
        lambda _db, **kwargs: (calls.setdefault("viewed", kwargs) and [make_recent_view_row()], 1),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_assignment_history",
        lambda _db, **kwargs: (calls.setdefault("assignment", []).append(kwargs) or [make_assignment_history()], 2),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_task_audit_logs",
        lambda _db, **kwargs: (calls.setdefault("task_audit", kwargs) and [], 0),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_assigned_to_me_tasks",
        lambda _db, **kwargs: ([], 0),
    )

    response = dashboard_service.get_space_summary_dashboard(FakeDb(), owner, space.space_id, member_id=selected.user_id)

    assert response.viewer_role == "OWNER"
    assert response.viewer_scope == "space"
    assert response.selected_member_id == selected.user_id
    assert response.metrics.total_users == 1
    assert response.metrics.total_tasks == 3
    assert response.priority_breakdown.total == 3
    assert response.user_account_overview.total == 1
    assert calls["worked_on"]["user_id"] == selected.user_id
    assert calls["viewed"]["user_id"] == selected.user_id
    assert calls["task_audit"]["user_id"] == selected.user_id
    assert all(call["current_sprint_only"] is True for call in calls["assignment"])
    assert any(call.get("member_id") == selected.user_id for call in calls["assignment"])


def test_space_summary_dashboard_scopes_member_to_assigned_tasks(monkeypatch):
    owner = make_user("USR00000010", role="USER", full_name="Space Owner")
    member = make_user("USR00000011", role="USER", full_name="Space Member")
    space = make_space(owner=owner)
    calls = {}

    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_active_space_by_id",
        lambda _db, space_id: space if space_id == space.space_id else None,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_active_space_member",
        lambda _db, space_id, user_id: make_space_member(user_id, space_id) if user_id == member.user_id else None,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_space_summary_members",
        lambda _db, space_id: [make_member_row(owner, role="OWNER", is_owner=True), make_member_row(member)],
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_member_task_status_counts",
        lambda _db, space_id, user_id: {"done": 2, "in_progress": 1} if user_id == member.user_id else {},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_member_task_priority_counts",
        lambda _db, space_id, user_id: {"HIGH": 1, "MEDIUM": 2} if user_id == member.user_id else {},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "count_member_overdue_tasks",
        lambda _db, space_id, user_id: 1 if user_id == member.user_id else 0,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_worked_on_tasks",
        lambda _db, **kwargs: (calls.setdefault("worked_on", kwargs) and [make_task()], 3),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_viewed_activities",
        lambda _db, **kwargs: (calls.setdefault("viewed", kwargs) and [make_recent_view_row()], 2),
    )
    other_actor = make_user("USR00000012", role="USER", full_name="Other Member")
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_assignment_history",
        lambda _db, **kwargs: (calls.setdefault("assignment", []).append(kwargs) or [make_assignment_history(changed_by=other_actor)], 1),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_task_audit_logs",
        lambda _db, **kwargs: (
            calls.setdefault("task_audit", kwargs)
            and [
                (
                    make_audit_log(
                        action="UPDATE_TASK",
                        label_title="TASK",
                        entity_id="TSK00000001",
                        user=other_actor,
                        created_at=datetime(2026, 7, 15, 12, 0, 0),
                    ),
                    make_task(task_id="TSK00000001", title="Member Task", updated_at=datetime(2026, 7, 15, 8, 0, 0)),
                )
            ],
            1,
        ),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_assigned_to_me_tasks",
        lambda _db, **kwargs: (calls.setdefault("assigned_to_me", []).append(kwargs) or [make_task()], 3),
    )

    response = dashboard_service.get_space_summary_dashboard(FakeDb(), member, space.space_id)

    assert response.viewer_role == "MEMBER"
    assert response.viewer_scope == "member"
    assert response.selected_member_id == member.user_id
    assert [item.user.user_id for item in response.members] == [member.user_id]
    assert response.metrics.total_users is None
    assert response.metrics.total_tasks == 3
    assert response.metrics.completed_tasks == 2
    assert response.metrics.in_progress_tasks == 1
    assert response.metrics.overdue_tasks == 1
    assert response.user_account_overview is None
    assert response.assignment_history is None
    assert response.assigned_to_me.total == 3
    assert response.activity_counts.assigned_to_me == 3
    assert response.activity_counts.assign_history == 0
    assert {item.source for item in response.recent_activities} == {
        "worked_on",
        "viewed",
        "assigned_to_me",
        "audit_log",
        "assignment_history",
    }
    assert response.recent_activities[0].source == "audit_log"
    assert response.recent_activities[0].user.user_id == other_actor.user_id
    assert response.recent_activities[0].target_title == "Member Task"
    assert calls["worked_on"]["user_id"] == member.user_id
    assert calls["viewed"]["user_id"] == member.user_id
    assert calls["task_audit"]["user_id"] == member.user_id
    assert all(call["current_sprint_only"] is True for call in calls["assignment"])
    assert any(call.get("related_user_id") == member.user_id for call in calls["assignment"])
    assert all(call["current_sprint_only"] is True for call in calls["assigned_to_me"])
    assert all(call["user_id"] == member.user_id for call in calls["assigned_to_me"])

    with pytest.raises(HTTPException) as exc_info:
        dashboard_service.get_space_summary_assignment_history(FakeDb(), member, space.space_id)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    with pytest.raises(HTTPException) as filter_exc:
        dashboard_service.get_space_summary_dashboard(FakeDb(), member, space.space_id, member_id=owner.user_id)

    assert filter_exc.value.status_code == status.HTTP_403_FORBIDDEN


def test_space_summary_recent_tasks_and_assignment_history_are_scoped_to_space(monkeypatch):
    owner = make_user("USR00000010", role="USER", full_name="Space Owner")
    space = make_space(owner=owner)
    calls = {}

    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_active_space_by_id",
        lambda _db, space_id: space if space_id == space.space_id else None,
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_worked_on_tasks",
        lambda _db, **kwargs: (calls.setdefault("worked_on", kwargs) and [make_task()], 1),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_viewed_activities",
        lambda _db, **kwargs: (calls.setdefault("viewed", kwargs) and [make_recent_view_row()], 1),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_assignment_history",
        lambda _db, **kwargs: (calls.setdefault("assignment", []).append(kwargs) or [make_assignment_history()], 1),
    )

    viewed = dashboard_service.get_space_summary_recent_tasks(
        FakeDb(),
        owner,
        space.space_id,
        tab="viewed",
        search="Task",
        status_filter="in_progress",
        date_range="today",
    )
    history = dashboard_service.get_space_summary_assignment_history(
        FakeDb(),
        owner,
        space.space_id,
        search="Task",
        change_status="in_progress",
    )

    assert viewed.tab == "viewed"
    assert viewed.items[0].source == "viewed"
    assert calls["viewed"]["space_id"] == space.space_id
    assert calls["viewed"]["search"] == "Task"
    assert calls["viewed"]["status_filter"] == "in_progress"
    assert calls["viewed"]["date_from"] is not None
    assert history.items[0].space_id == "SPC00000001"
    assert all(call["space_id"] == space.space_id for call in calls["assignment"])
    assert all(call["current_sprint_only"] is True for call in calls["assignment"])
    assert any(call["change_status"] == "in_progress" for call in calls["assignment"])


def test_super_admin_dashboard_aggregates_system_metrics(monkeypatch):
    now = datetime(2026, 7, 15, 10, 0, 0)

    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_user_status_counts",
        lambda _db: {"Active": 8, "Pending": 1, "Locked": 1, "Inactive": 0},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_space_status_counts",
        lambda _db: {"Active": 3, "Archived": 1},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_task_status_counts",
        lambda _db: {"done": 5, "in_progress": 3, "new": 2},
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_task_priority_counts",
        lambda _db: {"HIGH": 4, "MEDIUM": 5, "LOW": 1},
    )
    monkeypatch.setattr(dashboard_service.dashboard_repository, "count_overdue_tasks", lambda _db: 2)
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_audit_logs",
        lambda _db, **_kwargs: ([make_audit_log(created_at=now - timedelta(minutes=5))], 1),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_assignment_history",
        lambda _db, **_kwargs: ([make_assignment_history(changed_at=now)], 1),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_activity_spaces",
        lambda _db: [(SimpleNamespace(space_id="SPC00000001", name_space="User Management", status_space="Active"), 8, 10, 3)],
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_worked_on_tasks",
        lambda _db, **_kwargs: ([], 4),
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_viewed_activities",
        lambda _db, **_kwargs: ([], 2),
    )

    response = dashboard_service.get_super_admin_dashboard(FakeDb(), make_user())

    assert response.metrics.total_users == 10
    assert response.metrics.total_spaces == 4
    assert response.metrics.total_tasks == 10
    assert response.metrics.completed_tasks == 5
    assert response.metrics.in_progress_tasks == 3
    assert response.metrics.overdue_tasks == 2
    assert response.metrics.overdue_supported is True
    assert response.user_account_overview.items[0].key == "Active"
    assert response.user_account_overview.items[0].count == 8
    assert response.user_account_overview.items[0].percentage == 80
    assert response.task_status_overview.items[0].key == "new"
    assert response.task_status_overview.items[-1].key == "overdue"
    assert response.task_status_overview.items[-1].count == 2
    assert response.task_status_overview.items[-1].percentage == 20
    assert response.priority_breakdown.items[0].key == "HIGH"
    assert response.audit_logs.total == 1
    assert response.assignment_history.total == 1
    assert response.activity_spaces[0].space_id == "SPC00000001"
    assert response.activity_counts.assign_history == 1
    assert [item.source for item in response.recent_activities] == ["assignment_history", "audit_log"]


def test_audit_logs_response_serializes_user_and_event(monkeypatch):
    log = make_audit_log(action="SESSION_LOGIN", label_title="SESSION")
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_audit_logs",
        lambda _db, **kwargs: ([log], 1),
    )

    response = dashboard_service.get_audit_logs(
        FakeDb(),
        make_user(),
        page=2,
        page_size=10,
        search="login",
        event_type="SESSION_LOGIN",
        label_title="SESSION",
        sort_order="asc",
    )

    assert response.total == 1
    assert response.page == 2
    assert response.page_size == 10
    assert response.items[0].event == "Session Login"
    assert response.items[0].user.initials == "JD"
    assert response.items[0].payload == {"status": "Active"}


def test_audit_log_detail_returns_payload_and_rejects_missing(monkeypatch):
    log = make_audit_log(log_id="AUD00000099", action="UPDATE_USER", label_title="user")
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_audit_log_by_id",
        lambda _db, log_id: log if log_id == "AUD00000099" else None,
    )

    response = dashboard_service.get_audit_log_detail(FakeDb(), make_user(), "AUD00000099")

    assert response.log_id == "AUD00000099"
    assert response.event == "Update User"
    assert response.label_title == "user"
    assert response.payload == {"status": "Active"}

    with pytest.raises(HTTPException) as exc_info:
        dashboard_service.get_audit_log_detail(FakeDb(), make_user(), "AUD404")

    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


def test_audit_log_filter_options_are_built_from_database(monkeypatch):
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_audit_log_event_type_counts",
        lambda _db: [("LOGIN", 5), ("UPDATE_USER", 2)],
    )
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "get_audit_log_label_title_counts",
        lambda _db: [("USER", 6), ("TOKEN", 1), ("user", 2)],
    )

    response = dashboard_service.get_audit_log_filter_options(FakeDb(), make_user())

    assert response.event_types[0].value == "LOGIN"
    assert response.event_types[1].label == "Update User"
    assert response.label_titles[0].value == "USER"
    assert response.label_titles[2].value == "user"
    assert response.date_ranges[0].value == "all_time"
    assert response.date_ranges[0].label == "All time"
    assert "last_30_days" not in {item.value for item in response.date_ranges}
    assert response.sort_orders[0].value == "desc"


def test_assignment_history_response_serializes_task_space_and_users(monkeypatch):
    history = make_assignment_history()
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_assignment_history",
        lambda _db, **kwargs: ([history], 1),
    )

    response = dashboard_service.get_assignment_history(
        FakeDb(),
        make_user(),
        page=1,
        page_size=25,
        search="Review",
        change_status="in_progress",
    )

    item = response.items[0]
    assert item.assignment_history_id == "TAH00000001"
    assert item.task_title == "Review Security Audit Report"
    assert item.space_name == "Security"
    assert item.previous_assignee.full_name == "Emma Wilson"
    assert item.new_assignee.full_name == "Michael Chen"
    assert item.changed_by.initials == "AM"


def test_activity_spaces_returns_all_super_admin_space_filters(monkeypatch):
    space = SimpleNamespace(space_id="SPC00000001", name_space="User Management", status_space="Active")
    monkeypatch.setattr(
        dashboard_service.dashboard_repository,
        "list_activity_spaces",
        lambda _db: [(space, 156, 12, 3)],
    )

    response = dashboard_service.get_activity_spaces(FakeDb(), make_user())

    assert response[0].space_id == "SPC00000001"
    assert response[0].active_member_count == 156
    assert response[0].task_count == 12
    assert response[0].assignment_history_count == 3


def test_recent_activities_worked_on_supports_space_search_status_date_and_counts(monkeypatch):
    calls = {}

    def fake_worked_on(_db, **kwargs):
        calls.setdefault("worked_on", []).append(kwargs)
        return ([make_task()], 1)

    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_worked_on_tasks", fake_worked_on)
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_viewed_activities", lambda _db, **kwargs: ([], 2))
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_assignment_history", lambda _db, **kwargs: ([], 3))

    response = dashboard_service.get_recent_activities(
        FakeDb(),
        make_user(),
        tab="worked_on",
        page=2,
        page_size=5,
        space_id="SPC00000001",
        search="Onboard",
        status_filter="in_progress",
        date_range="last_7_days",
    )

    assert response.tab == "worked_on"
    assert response.total == 1
    assert response.counts.worked_on == 1
    assert response.counts.viewed == 2
    assert response.counts.assign_history == 3
    assert response.items[0].source == "worked_on"
    assert response.items[0].space_id == "SPC00000001"
    assert response.items[0].assignees[0].initials == "TN"
    assert calls["worked_on"][0]["space_id"] == "SPC00000001"
    assert calls["worked_on"][0]["search"] == "Onboard"
    assert calls["worked_on"][0]["status_filter"] == "in_progress"
    assert calls["worked_on"][0]["date_from"] is not None


def test_dashboard_rejects_unsupported_date_range(monkeypatch):
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_worked_on_tasks", lambda _db, **kwargs: ([], 0))
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_viewed_activities", lambda _db, **kwargs: ([], 0))
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_assignment_history", lambda _db, **kwargs: ([], 0))

    with pytest.raises(HTTPException) as exc_info:
        dashboard_service.get_recent_activities(FakeDb(), make_user(), date_range="last_30_days")

    assert exc_info.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_recent_activities_viewed_and_assign_history_tabs(monkeypatch):
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_worked_on_tasks", lambda _db, **kwargs: ([], 0))
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_viewed_activities", lambda _db, **kwargs: ([make_recent_view_row()], 1))
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_assignment_history", lambda _db, **kwargs: ([make_assignment_history()], 1))

    viewed = dashboard_service.get_recent_activities(FakeDb(), make_user(), tab="viewed")
    assigned = dashboard_service.get_recent_activities(FakeDb(), make_user(), tab="assign_history")

    assert viewed.items[0].source == "viewed"
    assert viewed.items[0].action == "Viewed Task"
    assert assigned.items[0].source == "assignment_history"
    assert assigned.items[0].target_type == "task"


def test_recent_activities_invalid_tab_defaults_to_worked_on(monkeypatch):
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_worked_on_tasks", lambda _db, **kwargs: ([make_task()], 1))
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_viewed_activities", lambda _db, **kwargs: ([], 0))
    monkeypatch.setattr(dashboard_service.dashboard_repository, "list_assignment_history", lambda _db, **kwargs: ([], 0))

    response = dashboard_service.get_recent_activities(FakeDb(), make_user(), tab="unknown")

    assert response.tab == "worked_on"
    assert response.items[0].source == "worked_on"


def test_api_dashboard_route_delegates_to_dashboard_service(monkeypatch):
    expected = SimpleNamespace(ok=True)

    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_super_admin_dashboard",
        lambda db, current_user: expected,
    )

    assert dashboard_api.get_super_admin_dashboard(FakeDb(), make_user()) is expected


def test_api_space_summary_routes_delegate_to_dashboard_service(monkeypatch):
    expected_summary = SimpleNamespace(space_id="SPC00000001")
    expected_members = [SimpleNamespace(user=make_user("USR00000011"))]
    expected_activities = SimpleNamespace(items=[])
    expected_tasks = SimpleNamespace(items=[])
    expected_history = SimpleNamespace(items=[])

    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_space_summary_dashboard",
        lambda db, current_user, space_id, **kwargs: expected_summary,
    )
    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_space_summary_members",
        lambda db, current_user, space_id: expected_members,
    )
    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_space_summary_recent_activities",
        lambda db, current_user, space_id, **kwargs: expected_activities,
    )
    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_space_summary_recent_tasks",
        lambda db, current_user, space_id, **kwargs: expected_tasks,
    )
    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_space_summary_assignment_history",
        lambda db, current_user, space_id, **kwargs: expected_history,
    )

    assert dashboard_api.get_space_summary_dashboard("SPC00000001", "USR00000011", FakeDb(), make_user()) is expected_summary
    assert dashboard_api.get_space_summary_members("SPC00000001", FakeDb(), make_user()) is expected_members
    assert dashboard_api.get_space_summary_recent_activities(
        space_id="SPC00000001",
        member_id="USR00000011",
        page=1,
        page_size=20,
        search="task",
        status_filter="done",
        date_range="today",
        date_from=None,
        date_to=None,
        db=FakeDb(),
        current_user=make_user(),
    ) is expected_activities
    assert dashboard_api.get_space_summary_recent_tasks(
        space_id="SPC00000001",
        member_id="USR00000011",
        tab="assign_history",
        page=1,
        page_size=20,
        search="task",
        status_filter="done",
        date_range="today",
        date_from=None,
        date_to=None,
        db=FakeDb(),
        current_user=make_user(),
    ) is expected_tasks
    assert dashboard_api.get_space_summary_assignment_history(
        space_id="SPC00000001",
        member_id="USR00000011",
        page=1,
        page_size=25,
        search="task",
        change_status="done",
        date_from=None,
        date_to=None,
        sort_order="desc",
        db=FakeDb(),
        current_user=make_user(),
    ) is expected_history


def test_api_activity_routes_delegate_to_dashboard_service(monkeypatch):
    expected_spaces = [SimpleNamespace(space_id="SPC00000001")]
    expected_activities = SimpleNamespace(items=[])

    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_activity_spaces",
        lambda db, current_user: expected_spaces,
    )
    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_recent_activities",
        lambda db, current_user, **kwargs: expected_activities,
    )

    assert dashboard_api.get_super_admin_activity_spaces(FakeDb(), make_user()) is expected_spaces
    assert dashboard_api.get_super_admin_recent_activities(
        tab="viewed",
        page=2,
        page_size=10,
        space_id="SPC00000001",
        search="audit",
        status_filter="done",
        date_range="today",
        date_from=None,
        date_to=None,
        db=FakeDb(),
        current_user=make_user(),
    ) is expected_activities


def test_api_audit_log_routes_delegate_to_dashboard_service(monkeypatch):
    expected_logs = SimpleNamespace(items=[])
    expected_filters = SimpleNamespace(event_types=[])
    expected_detail = SimpleNamespace(log_id="AUD00000001")

    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_audit_logs",
        lambda db, current_user, **kwargs: expected_logs,
    )
    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_audit_log_filter_options",
        lambda db, current_user: expected_filters,
    )
    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_audit_log_detail",
        lambda db, current_user, log_id: expected_detail,
    )

    assert dashboard_api.get_super_admin_audit_logs(
        page=1,
        page_size=25,
        search=None,
        event_type=None,
        label_title=None,
        date_from=None,
        date_to=None,
        sort_order="desc",
        db=FakeDb(),
        current_user=make_user(),
    ) is expected_logs
    assert dashboard_api.get_super_admin_audit_log_filter_options(FakeDb(), make_user()) is expected_filters
    assert dashboard_api.get_super_admin_audit_log_detail("AUD00000001", FakeDb(), make_user()) is expected_detail


def test_api_assignment_history_route_delegates_to_dashboard_service(monkeypatch):
    expected = SimpleNamespace(items=[])

    monkeypatch.setattr(
        dashboard_api.dashboard_service,
        "get_assignment_history",
        lambda db, current_user, **kwargs: expected,
    )

    assert dashboard_api.get_super_admin_assignment_history(
        page=1,
        page_size=25,
        search=None,
        change_status=None,
        space_id=None,
        date_from=None,
        date_to=None,
        sort_order="desc",
        db=FakeDb(),
        current_user=make_user(),
    ) is expected
