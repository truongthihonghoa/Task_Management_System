from types import SimpleNamespace

from app.api.v1 import task_management
from app.schemas.pydantic_models import TaskCreate, TaskUpdate


def test_create_task_delegates_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    payload = TaskCreate(
        title="Design Screen App Quick",
        description="Create quick task screen",
        sprint_id="SPR00000003",
        priority="HIGH",
        task_status="new",
        story_points=2,
    )
    expected = {"task_id": "TSK00000007"}
    calls = []

    def fake_create_task(received_db, space_id, received_payload, current_user):
        calls.append((received_db, space_id, received_payload, current_user))
        return expected

    monkeypatch.setattr(task_management.task_management_service, "create_task", fake_create_task)

    response = task_management.create_task("SPC00000002", payload, db, user)

    assert response is expected
    assert calls == [(db, "SPC00000002", payload, user)]


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


def test_task_detail_update_delete_restore_and_board_delegate_to_service(monkeypatch):
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
    monkeypatch.setattr(
        task_management.task_management_service,
        "restore_task",
        lambda received_db, task_id, current_user: calls.append(("restore", received_db, task_id, current_user))
        or "restore",
    )

    assert task_management.get_task_board("SPC00000002", db, user) == "board"
    assert task_management.get_task_detail("TSK00000007", db, user) == "detail"
    assert task_management.update_task("TSK00000007", update_payload, db, user) == "update"
    assert task_management.delete_task("TSK00000007", db, user) == "delete"
    assert task_management.restore_task("TSK00000007", db, user) == "restore"

    assert calls == [
        ("board", db, "SPC00000002", user),
        ("detail", db, "TSK00000007", user),
        ("update", db, "TSK00000007", update_payload, user),
        ("delete", db, "TSK00000007", user),
        ("restore", db, "TSK00000007", user),
    ]
