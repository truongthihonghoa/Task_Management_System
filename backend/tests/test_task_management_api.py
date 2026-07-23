from datetime import datetime, timedelta
from app.core.timezone import vietnam_now
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1 import task_management
from app.schemas.pydantic_models import TaskCreate, TaskListItemResponse, TaskUpdate
from app.services import task_management_service


def test_assignment_routes_are_documented_under_task_management():
    app = __import__("app.main", fromlist=["app"]).app
    app.openapi_schema = None
    openapi = app.openapi()

    task_management_operations = []
    for path, path_item in openapi["paths"].items():
        for method, operation in path_item.items():
            if operation["tags"] == ["task-management"]:
                task_management_operations.append((method, path, operation["summary"]))

    assert task_management_operations == [
        ("post", "/api/v1/spaces/{space_id}/tasks", "Create Task"),
        ("get", "/api/v1/spaces/{space_id}/tasks", "List Tasks"),
        ("post", "/api/v1/spaces/{space_id}/tasks/with-attachments", "Create Task With Attachments"),
        ("post", "/api/v1/tasks/{task_id}/assignees", "Assign Task Assignees"),
        ("get", "/api/v1/tasks/{task_id}/assignees", "Get Task Assignees"),
        ("put", "/api/v1/tasks/{task_id}/assignees", "Reassign Task Assignee"),
        ("delete", "/api/v1/tasks/{task_id}/assignees/{assignee_id}", "Remove Task Assignee"),
        ("get", "/api/v1/tasks/{task_id}/assignment-history", "Get Task Assignment History"),
        ("get", "/api/v1/spaces/{space_id}/tasks/deleted", "List Deleted Tasks"),
        ("get", "/api/v1/spaces/{space_id}/tasks/board", "Get Task Board"),
        ("get", "/api/v1/tasks/{task_id}", "Get Task Detail"),
        ("patch", "/api/v1/tasks/{task_id}", "Update Task"),
        ("delete", "/api/v1/tasks/{task_id}", "Delete Task"),
        ("post", "/api/v1/tasks/{task_id}/restore", "Restore Task"),
    ]


def test_create_task_delegates_form_payload_and_attachments_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003", role="USER")
    upload = SimpleNamespace(filename="logo.png", content_type="image/png")
    expected = {"task_id": "TSK00000007"}
    calls = []

    def fake_create_task(received_db, space_id, received_payload, current_user, **kwargs):
        calls.append((received_db, space_id, received_payload, current_user, kwargs))
        return expected

    monkeypatch.setattr(task_management.task_management_service, "create_task", fake_create_task)

    response = task_management.create_task(
        "SPC00000002",
        title="Design Screen App Quick",
        sprint_id="SPR00000003",
        priority="HIGH",
        description="Create quick task screen",
        task_status="new",
        story_points=2,
        completed_at=None,
        attachments=[upload],
        db=db,
        current_user=user,
    )

    assert response is expected
    assert calls[0][0:4] == (db, "SPC00000002", calls[0][2], user)
    assert calls[0][2].title == "Design Screen App Quick"
    assert calls[0][2].description == "Create quick task screen"
    assert calls[0][2].sprint_id == "SPR00000003"
    assert calls[0][2].priority == "HIGH"
    assert calls[0][2].task_status == "new"
    assert calls[0][2].story_points == 2
    assert calls[0][4] == {"attachments": [upload]}


def test_list_task_endpoints_delegate_filters_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    calls = []

    def fake_list_tasks(received_db, space_id, current_user, **kwargs):
        calls.append(("active", received_db, space_id, current_user, kwargs))
        return {"items": [], "total": 0}

    def fake_list_deleted_tasks(received_db, space_id, current_user, **kwargs):
        calls.append(("deleted", received_db, space_id, current_user, kwargs))
        return {"items": [], "total": 0}

    monkeypatch.setattr(task_management.task_management_service, "list_tasks", fake_list_tasks)
    monkeypatch.setattr(task_management.task_management_service, "list_deleted_tasks", fake_list_deleted_tasks)

    active_response = task_management.list_tasks(
        "SPC00000002",
        page=2,
        page_size=10,
        search="Design",
        task_status="new",
        priority="HIGH",
        sort="oldest",
        active_sprint_only=True,
        db=db,
        current_user=user,
    )
    deleted_response = task_management.list_deleted_tasks(
        "SPC00000002",
        page=1,
        page_size=5,
        search=None,
        task_status=None,
        priority=None,
        sort="newest",
        db=db,
        current_user=user,
    )

    assert active_response == {"items": [], "total": 0}
    assert deleted_response == {"items": [], "total": 0}
    assert calls == [
        (
            "active",
            db,
            "SPC00000002",
            user,
            {
                "page": 2,
                "page_size": 10,
                "search": "Design",
                "task_status": "new",
                "priority": "HIGH",
                "sort": "oldest",
                "active_sprint_only": True,
            },
        ),
        (
            "deleted",
            db,
            "SPC00000002",
            user,
            {
                "page": 1,
                "page_size": 5,
                "search": None,
                "task_status": None,
                "priority": None,
                "sort": "newest",
            },
        ),
    ]


def test_task_detail_update_delete_and_board_delegate_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    update_payload = TaskUpdate(title="Updated task", priority="MEDIUM")
    calls = []

    monkeypatch.setattr(
        task_management.task_management_service,
        "get_task_board",
        lambda received_db, space_id, current_user: calls.append(("board", received_db, space_id, current_user)) or "board",
    )
    monkeypatch.setattr(
        task_management.task_management_service,
        "get_task_detail",
        lambda received_db, task_id, current_user: calls.append(("detail", received_db, task_id, current_user)) or "detail",
    )
    monkeypatch.setattr(
        task_management.task_management_service,
        "update_task",
        lambda received_db, task_id, payload, current_user: calls.append(
            ("update", received_db, task_id, payload, current_user)
        )
        or "update",
    )
    monkeypatch.setattr(
        task_management.task_management_service,
        "delete_task",
        lambda received_db, task_id, current_user: calls.append(("delete", received_db, task_id, current_user)) or "delete",
    )

    assert task_management.get_task_board("SPC00000002", db, user) == "board"
    assert task_management.get_task_detail("TSK00000007", db, user) == "detail"
    assert task_management.update_task("TSK00000007", update_payload, db, user) == "update"
    assert task_management.delete_task("TSK00000007", db, user) == "delete"

    assert calls == [
        ("board", db, "SPC00000002", user),
        ("detail", db, "TSK00000007", user),
        ("update", db, "TSK00000007", update_payload, user),
        ("delete", db, "TSK00000007", user),
    ]


def test_delete_task_requires_space_owner(monkeypatch):
    db = object()
    member_user = SimpleNamespace(user_id="USR00000004", role="USER")
    task_space = SimpleNamespace(
        space_id="SPC00000002",
        owner_id="USR00000003",
        status_space="Active",
        deleted_at=None,
    )
    task = SimpleNamespace(
        task_id="TSK00000007",
        space_id="SPC00000002",
        space=task_space,
        deleted_at=None,
    )

    monkeypatch.setattr(task_management_service, "_get_task_or_404", lambda received_db, task_id: task)

    with pytest.raises(HTTPException) as exc_info:
        task_management_service.delete_task(db, "TSK00000007", member_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Only the space owner can perform this action"


def test_create_task_uploads_attachments_after_task_is_created(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003", role="USER")
    payload = TaskCreate(
        title="Design Screen App Quick",
        description="Create quick task screen",
        sprint_id="SPR00000003",
        priority="HIGH",
        task_status="new",
        story_points=2,
    )
    upload = SimpleNamespace(filename="logo.png", content_type="image/png")
    empty_upload = SimpleNamespace(filename="", content_type="image/png")
    refreshed = SimpleNamespace(task_id="TSK00000007", attachments=["logo"])
    calls = []

    monkeypatch.setattr(
        task_management_service,
        "_get_space_or_404",
        lambda received_db, space_id: SimpleNamespace(
            space_id=space_id,
            owner_id=user.user_id,
            status_space="Active",
            deleted_at=None,
        ),
    )
    monkeypatch.setattr(
        task_management_service,
        "_get_sprint_for_space_or_404",
        lambda received_db, space_id, sprint_id: SimpleNamespace(
            sprint_id=sprint_id,
            space_id=space_id,
            status="Active",
        ),
    )
    monkeypatch.setattr(
        task_management_service.task_repository,
        "create_task_record",
        lambda received_db, task: setattr(task, "task_id", "TSK00000007")
        or calls.append(("create", received_db, task))
        or task,
    )
    monkeypatch.setattr(
        task_management_service.media_service,
        "upload_task_media",
        lambda received_db, task_id, **kwargs: calls.append(("upload", received_db, task_id, kwargs)),
    )
    monkeypatch.setattr(task_management_service, "_get_task_or_404", lambda received_db, task_id: refreshed)
    monkeypatch.setattr(task_management_service, "_build_task_detail_response", lambda task: task)

    response = task_management_service.create_task(
        db,
        "SPC00000002",
        payload,
        user,
        attachments=[upload, empty_upload],
    )

    assert response is refreshed
    created_task = calls[0][2]
    assert created_task.title == "Design Screen App Quick"
    assert created_task.task_id == "TSK00000007"
    assert calls == [
        ("create", db, created_task),
        (
            "upload",
            db,
            "TSK00000007",
            {"usage": "attachment", "file": upload, "current_user": user},
        ),
    ]


def test_task_list_item_hydrates_image_attachment_for_board_preview():
    now = vietnam_now()
    task = SimpleNamespace(
        task_id="TSK00000007",
        space_id="SPC00000002",
        sprint_id="SPR00000003",
        title="Database Migration Script",
        priority="HIGH",
        task_status="new",
        completed_at=None,
        story_points=5,
        created_at=now,
        updated_at=now,
        sprint=None,
        attachments=[
            SimpleNamespace(
                attachment_id="TAT00000001",
                task_id="TSK00000007",
                file_name="logo.png",
                file_path="attachments/TSK00000007/logo.png",
                storage_url=None,
                mime_type="image/png",
                file_size=2048,
                uploaded_by="USR00000003",
                uploaded_at=now,
                deleted_at=None,
            )
        ],
    )

    response = TaskListItemResponse.model_validate(task)

    assert response.attachments[0].type == "image"
    assert response.attachments[0].previewUrl == "/media/attachments/TSK00000007/logo.png"
    assert response.attachments[0].url == "/media/attachments/TSK00000007/logo.png"


def test_task_overdue_flag_is_calculated_from_completed_at():
    now = datetime(2026, 7, 15, 9, 0, 0)
    overdue_task = SimpleNamespace(
        completed_at=now - timedelta(days=1),
        task_status="in_progress",
    )
    done_task = SimpleNamespace(
        completed_at=now - timedelta(days=1),
        task_status="done",
    )
    future_task = SimpleNamespace(
        completed_at=now + timedelta(days=1),
        task_status="new",
    )

    assert task_management_service._is_task_overdue(overdue_task, now=now) is True
    assert task_management_service._is_task_overdue(done_task, now=now) is False
    assert task_management_service._is_task_overdue(future_task, now=now) is False


def test_task_due_today_flag_is_calculated_from_completed_at():
    now = datetime(2026, 7, 15, 9, 0, 0)
    due_today_task = SimpleNamespace(
        completed_at=now.replace(hour=17),
        task_status="in_progress",
    )
    done_task = SimpleNamespace(
        completed_at=now,
        task_status="done",
    )
    future_task = SimpleNamespace(
        completed_at=now + timedelta(days=1),
        task_status="new",
    )

    assert task_management_service._is_task_due_today(due_today_task, now=now) is True
    assert task_management_service._is_task_due_today(done_task, now=now) is False
    assert task_management_service._is_task_due_today(future_task, now=now) is False


def test_task_list_item_response_includes_overdue_flag():
    now = vietnam_now()
    task = SimpleNamespace(
        task_id="TSK00000007",
        space_id="SPC00000002",
        sprint_id="SPR00000003",
        title="Database Migration Script",
        priority="HIGH",
        task_status="new",
        completed_at=now - timedelta(days=1),
        story_points=5,
        created_at=now,
        updated_at=now,
        sprint=None,
        attachments=[],
    )

    response = task_management_service._build_task_list_item_response(task)

    assert response.is_overdue is True


def test_task_list_item_response_includes_due_today_flag():
    now = vietnam_now()
    task = SimpleNamespace(
        task_id="TSK00000007",
        space_id="SPC00000002",
        sprint_id="SPR00000003",
        title="Database Migration Script",
        priority="HIGH",
        task_status="new",
        completed_at=now,
        story_points=5,
        created_at=now,
        updated_at=now,
        sprint=None,
        attachments=[],
    )

    response = task_management_service._build_task_list_item_response(task)

    assert response.is_due_today is True
    assert response.is_overdue is False
