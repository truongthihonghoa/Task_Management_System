from datetime import datetime
from app.core.timezone import vietnam_now
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.pydantic_models import (
    AssignTaskAssigneesRequest,
    ReassignTaskAssigneeRequest,
    RemoveTaskAssigneeRequest,
)
from app.services import task_assignment_service as assignment_service_module
from app.services.task_assignment_service import TaskAssignmentService


class FakeDb:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def make_user(user_id="USR00000001", role="USER", status_user="Active", locked_until=None):
    return SimpleNamespace(
        user_id=user_id,
        role=role,
        full_name=f"User {user_id}",
        email=f"{user_id.lower()}@example.com",
        status_user=status_user,
        locked_until=locked_until,
    )


def make_space(owner_id="USR00000001"):
    return SimpleNamespace(
        space_id="SPC00000001",
        owner_id=owner_id,
        name_space="Smoke Space",
    )


def make_task(**overrides):
    space = overrides.pop("space", make_space())
    values = {
        "task_id": "TSK00000001",
        "space_id": space.space_id,
        "space": space,
        "title": "Smoke Task",
        "task_status": "new",
        "deleted_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def make_assignee_entry(task_id="TSK00000001", assignee_id="USR00000002"):
    return SimpleNamespace(
        assignee_entry_id="TAS00000001",
        task_id=task_id,
        assignee_id=assignee_id,
        assignee_at=datetime(2026, 7, 10, 8, 0, 0),
        assignee=make_user(assignee_id),
    )


def make_history(previous_assignee_id=None, new_assignee_id="USR00000002"):
    return SimpleNamespace(
        assignment_history_id="TAH00000001",
        task_id="TSK00000001",
        previous_assignee_id=previous_assignee_id,
        new_assignee_id=new_assignee_id,
        changed_by="USR00000001",
        reason="Smoke reason",
        change_status="new",
        changed_at=datetime(2026, 7, 10, 8, 0, 0),
        previous_assignee=make_user(previous_assignee_id) if previous_assignee_id else None,
        new_assignee=make_user(new_assignee_id) if new_assignee_id else None,
        changed_by_user=make_user("USR00000001"),
    )


def make_service(notifications=None):
    notifications = notifications if notifications is not None else []
    notification_service = SimpleNamespace(
        create_notification=lambda _db, **kwargs: notifications.append(kwargs),
    )
    return TaskAssignmentService(notification_service=notification_service)


def install_common_task_mocks(monkeypatch, task=None, assignees=None, active_members=None):
    task = task or make_task()
    assignees = list(assignees or [])
    active_members = set(active_members or ["USR00000001", "USR00000002", "USR00000003"])

    monkeypatch.setattr(assignment_service_module, "get_task_by_id", lambda _db, task_id: task)
    monkeypatch.setattr(
        assignment_service_module,
        "get_active_space_member",
        lambda _db, space_id, user_id: SimpleNamespace(user_id=user_id) if user_id in active_members else None,
    )
    monkeypatch.setattr(assignment_service_module, "list_task_assignees", lambda _db, task_id: assignees)
    return task


def test_assign_task_assignees_creates_assignment_history_notification_and_commits(monkeypatch):
    db = FakeDb()
    task = install_common_task_mocks(monkeypatch)
    created_assignees = []
    histories = []
    notifications = []
    service = make_service(notifications)

    monkeypatch.setattr(assignment_service_module, "get_user_by_id", lambda _db, user_id: make_user(user_id))
    monkeypatch.setattr(assignment_service_module, "get_task_assignee", lambda _db, task_id, assignee_id: None)
    monkeypatch.setattr(
        assignment_service_module,
        "create_task_assignee",
        lambda _db, task_id, assignee_id: created_assignees.append((task_id, assignee_id)),
    )
    monkeypatch.setattr(assignment_service_module, "create_assignment_history", lambda _db, **kwargs: histories.append(kwargs))
    monkeypatch.setattr(
        assignment_service_module,
        "list_task_assignees",
        lambda _db, task_id: [make_assignee_entry(assignee_id="USR00000002")],
    )

    assignees = service.assign_task_assignees(
        db,
        task.task_id,
        AssignTaskAssigneesRequest(assignee_ids=["USR00000002"], reason="assign smoke"),
        make_user("USR00000001"),
    )

    assert assignees[0].assignee_id == "USR00000002"
    assert created_assignees == [(task.task_id, "USR00000002")]
    assert histories[0]["new_assignee_id"] == "USR00000002"
    assert notifications[0]["notification_type"] == "task_assigned"
    assert notifications[0]["user_id"] == "USR00000002"
    assert db.commits == 1
    assert db.rollbacks == 0


def test_assign_rejects_duplicate_payload_and_existing_assignment(monkeypatch):
    with pytest.raises(ValidationError):
        AssignTaskAssigneesRequest(assignee_ids=["USR00000002", "USR00000002"])

    db = FakeDb()
    task = install_common_task_mocks(monkeypatch)
    service = make_service()

    monkeypatch.setattr(assignment_service_module, "get_user_by_id", lambda _db, user_id: make_user(user_id))
    monkeypatch.setattr(assignment_service_module, "get_task_assignee", lambda _db, task_id, assignee_id: make_assignee_entry())

    with pytest.raises(HTTPException) as exc_info:
        service.assign_task_assignees(
            db,
            task.task_id,
            AssignTaskAssigneesRequest(assignee_ids=["USR00000002"]),
            make_user("USR00000001"),
        )

    assert exc_info.value.status_code == 409


def test_assign_rejects_user_not_active_or_not_space_member(monkeypatch):
    db = FakeDb()
    task = install_common_task_mocks(monkeypatch, active_members=["USR00000001"])
    service = make_service()

    monkeypatch.setattr(assignment_service_module, "get_task_assignee", lambda _db, task_id, assignee_id: None)
    monkeypatch.setattr(assignment_service_module, "get_user_by_id", lambda _db, user_id: make_user(user_id, status_user="Inactive"))

    with pytest.raises(HTTPException) as inactive_exc:
        service.assign_task_assignees(
            db,
            task.task_id,
            AssignTaskAssigneesRequest(assignee_ids=["USR00000002"]),
            make_user("USR00000001"),
        )

    assert inactive_exc.value.status_code == 400

    monkeypatch.setattr(assignment_service_module, "get_user_by_id", lambda _db, user_id: make_user(user_id))
    with pytest.raises(HTTPException) as member_exc:
        service.assign_task_assignees(
            db,
            task.task_id,
            AssignTaskAssigneesRequest(assignee_ids=["USR00000002"]),
            make_user("USR00000001"),
        )

    assert member_exc.value.status_code == 400


def test_get_task_assignees_and_assignment_history(monkeypatch):
    db = FakeDb()
    task = install_common_task_mocks(monkeypatch, assignees=[make_assignee_entry()])
    service = make_service()

    monkeypatch.setattr(assignment_service_module, "list_assignment_history", lambda _db, task_id: [make_history()])

    assignees = service.get_task_assignees(db, task.task_id, make_user("USR00000001"))
    history = service.get_assignment_history(db, task.task_id, make_user("USR00000001"))

    assert assignees[0].assignee_id == "USR00000002"
    assert history[0].new_assignee_id == "USR00000002"


def test_reassign_task_assignee_updates_assignment_and_notifies_both_users(monkeypatch):
    db = FakeDb()
    task = install_common_task_mocks(monkeypatch)
    current_assignment = make_assignee_entry(assignee_id="USR00000002")
    histories = []
    notifications = []
    service = make_service(notifications)

    def fake_get_task_assignee(_db, task_id, assignee_id):
        if assignee_id == "USR00000002":
            return current_assignment
        return None

    monkeypatch.setattr(assignment_service_module, "get_user_by_id", lambda _db, user_id: make_user(user_id))
    monkeypatch.setattr(assignment_service_module, "get_task_assignee", fake_get_task_assignee)
    monkeypatch.setattr(assignment_service_module, "create_assignment_history", lambda _db, **kwargs: histories.append(kwargs))
    monkeypatch.setattr(
        assignment_service_module,
        "list_task_assignees",
        lambda _db, task_id: [make_assignee_entry(assignee_id="USR00000003")],
    )

    assignees = service.reassign_task_assignee(
        db,
        task.task_id,
        ReassignTaskAssigneeRequest(
            previous_assignee_id="USR00000002",
            new_assignee_id="USR00000003",
            reason="reassign smoke",
        ),
        make_user("USR00000001"),
    )

    assert current_assignment.assignee_id == "USR00000003"
    assert assignees[0].assignee_id == "USR00000003"
    assert histories[0]["previous_assignee_id"] == "USR00000002"
    assert histories[0]["new_assignee_id"] == "USR00000003"
    assert [item["user_id"] for item in notifications] == ["USR00000003", "USR00000002"]
    assert [item["notification_type"] for item in notifications] == ["task_assigned", "task_updated"]
    assert db.commits == 1


def test_reassign_rejects_missing_previous_same_or_existing_new_assignee(monkeypatch):
    db = FakeDb()
    task = install_common_task_mocks(monkeypatch)
    service = make_service()

    monkeypatch.setattr(assignment_service_module, "get_user_by_id", lambda _db, user_id: make_user(user_id))

    monkeypatch.setattr(assignment_service_module, "get_task_assignee", lambda _db, task_id, assignee_id: None)
    with pytest.raises(HTTPException) as missing_exc:
        service.reassign_task_assignee(
            db,
            task.task_id,
            ReassignTaskAssigneeRequest(previous_assignee_id="USR00000002", new_assignee_id="USR00000003"),
            make_user("USR00000001"),
        )
    assert missing_exc.value.status_code == 404

    monkeypatch.setattr(
        assignment_service_module,
        "get_task_assignee",
        lambda _db, task_id, assignee_id: make_assignee_entry(assignee_id=assignee_id),
    )
    with pytest.raises(HTTPException) as existing_exc:
        service.reassign_task_assignee(
            db,
            task.task_id,
            ReassignTaskAssigneeRequest(previous_assignee_id="USR00000002", new_assignee_id="USR00000003"),
            make_user("USR00000001"),
        )
    assert existing_exc.value.status_code == 409

    def same_assignment(_db, task_id, assignee_id):
        if assignee_id == "USR00000002":
            return make_assignee_entry(assignee_id="USR00000002")
        return None

    monkeypatch.setattr(assignment_service_module, "get_task_assignee", same_assignment)
    with pytest.raises(HTTPException) as same_exc:
        service.reassign_task_assignee(
            db,
            task.task_id,
            ReassignTaskAssigneeRequest(previous_assignee_id="USR00000002", new_assignee_id="USR00000002"),
            make_user("USR00000001"),
        )
    assert same_exc.value.status_code == 400


def test_remove_task_assignee_deletes_history_notification_and_commits(monkeypatch):
    db = FakeDb()
    task = install_common_task_mocks(monkeypatch)
    current_assignment = make_assignee_entry(assignee_id="USR00000002")
    deleted = []
    histories = []
    notifications = []
    service = make_service(notifications)

    monkeypatch.setattr(assignment_service_module, "get_task_assignee", lambda _db, task_id, assignee_id: current_assignment)
    monkeypatch.setattr(assignment_service_module, "delete_task_assignee", lambda _db, assignment: deleted.append(assignment))
    monkeypatch.setattr(assignment_service_module, "create_assignment_history", lambda _db, **kwargs: histories.append(kwargs))

    service.remove_task_assignee(
        db,
        task.task_id,
        "USR00000002",
        RemoveTaskAssigneeRequest(reason="remove smoke"),
        make_user("USR00000001"),
    )

    assert deleted == [current_assignment]
    assert histories[0]["previous_assignee_id"] == "USR00000002"
    assert histories[0]["new_assignee_id"] is None
    assert notifications[0]["notification_type"] == "task_updated"
    assert notifications[0]["user_id"] == "USR00000002"
    assert db.commits == 1


def test_permissions_and_deleted_task_guards(monkeypatch):
    db = FakeDb()
    service = make_service()
    install_common_task_mocks(monkeypatch, active_members=[])

    with pytest.raises(HTTPException) as permission_exc:
        service.get_task_assignees(db, "TSK00000001", make_user("USR00000099"))
    assert permission_exc.value.status_code == 403

    with pytest.raises(HTTPException) as super_admin_exc:
        service.assign_task_assignees(
            db,
            "TSK00000001",
            AssignTaskAssigneesRequest(assignee_ids=["USR00000002"]),
            make_user("USR00000099", role="SUPER_ADMIN"),
        )
    assert super_admin_exc.value.status_code == 403

    install_common_task_mocks(monkeypatch, task=make_task(deleted_at=vietnam_now()))
    with pytest.raises(HTTPException) as deleted_exc:
        service.get_task_assignees(db, "TSK00000001", make_user("USR00000001"))
    assert deleted_exc.value.status_code == 400


def test_assign_task_rejects_completed_sprint(monkeypatch):
    db = FakeDb()
    task = install_common_task_mocks(
        monkeypatch,
        task=make_task(sprint=SimpleNamespace(status="Completed")),
    )
    service = make_service()

    with pytest.raises(HTTPException) as exc_info:
        service.assign_task_assignees(
            db,
            task.task_id,
            AssignTaskAssigneesRequest(assignee_ids=["USR00000002"]),
            make_user("USR00000001"),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Completed sprint is read-only."


def test_transaction_rolls_back_when_assignment_creation_fails(monkeypatch):
    db = FakeDb()
    task = install_common_task_mocks(monkeypatch)
    service = make_service()

    monkeypatch.setattr(assignment_service_module, "get_user_by_id", lambda _db, user_id: make_user(user_id))
    monkeypatch.setattr(assignment_service_module, "get_task_assignee", lambda _db, task_id, assignee_id: None)
    monkeypatch.setattr(assignment_service_module, "create_task_assignee", lambda _db, task_id, assignee_id: None)

    def fail_history(_db, **kwargs):
        raise RuntimeError("history failed")

    monkeypatch.setattr(assignment_service_module, "create_assignment_history", fail_history)

    with pytest.raises(RuntimeError):
        service.assign_task_assignees(
            db,
            task.task_id,
            AssignTaskAssigneesRequest(assignee_ids=["USR00000002"]),
            make_user("USR00000001"),
        )

    assert db.commits == 0
    assert db.rollbacks == 1
