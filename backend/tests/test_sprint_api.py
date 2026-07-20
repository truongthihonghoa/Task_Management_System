from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1 import sprints
from app.schemas.pydantic_models import SprintCreate, SprintUpdate
from app.services import sprint_service


def test_sprint_create_validates_date_range():
    with pytest.raises(ValidationError):
        SprintCreate(
            goal="Invalid dates",
            start_date=datetime(2026, 7, 24, 9, 0, 0),
            end_date=datetime(2026, 7, 10, 9, 0, 0),
            duration_weeks=2,
        )


def test_sprint_update_trims_name_and_validates_date_range():
    payload = SprintUpdate(name="  SCRUM Sprint 2  ")

    assert payload.name == "SCRUM Sprint 2"

    with pytest.raises(ValidationError):
        SprintUpdate(
            start_date=datetime(2026, 7, 24, 9, 0, 0),
            end_date=datetime(2026, 7, 10, 9, 0, 0),
        )


def test_list_and_create_sprints_delegate_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    payload = SprintCreate(
        goal="Hoan thien task management APIs",
        start_date=datetime(2026, 7, 10, 9, 0, 0),
        end_date=datetime(2026, 7, 24, 9, 0, 0),
        duration_weeks=2,
        status="Planned",
        auto_start=False,
        auto_complete=False,
    )
    calls = []

    monkeypatch.setattr(
        sprints.sprint_service,
        "list_sprints",
        lambda received_db, space_id, current_user, **kwargs: calls.append(
            ("list", received_db, space_id, current_user, kwargs)
        )
        or [],
    )
    monkeypatch.setattr(
        sprints.sprint_service,
        "create_sprint",
        lambda received_db, space_id, received_payload, current_user: calls.append(
            ("create", received_db, space_id, received_payload, current_user)
        )
        or {"sprint_id": "SPR00000006"},
    )

    assert sprints.list_sprints("SPC00000002", include_deleted=True, db=db, current_user=user) == []
    assert sprints.create_sprint("SPC00000002", payload, db, user) == {"sprint_id": "SPR00000006"}
    assert calls == [
        ("list", db, "SPC00000002", user, {"include_deleted": True}),
        ("create", db, "SPC00000002", payload, user),
    ]


def test_sprint_create_defaults_to_planned():
    payload = SprintCreate()

    assert payload.status == "Planned"


def test_sprint_detail_update_delete_activate_and_complete_delegate_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    update_payload = SprintUpdate(
        name="SCRUM Sprint 2",
        goal="Cap nhat muc tieu sprint",
        duration_weeks=2,
        auto_complete=True,
    )
    calls = []

    monkeypatch.setattr(
        sprints.sprint_service,
        "get_sprint",
        lambda received_db, sprint_id, current_user: calls.append(("get", received_db, sprint_id, current_user)) or "get",
    )
    monkeypatch.setattr(
        sprints.sprint_service,
        "update_sprint",
        lambda received_db, sprint_id, payload, current_user: calls.append(
            ("update", received_db, sprint_id, payload, current_user)
        )
        or "update",
    )
    monkeypatch.setattr(
        sprints.sprint_service,
        "delete_sprint",
        lambda received_db, sprint_id, current_user: calls.append(("delete", received_db, sprint_id, current_user))
        or "delete",
    )
    monkeypatch.setattr(
        sprints.sprint_service,
        "activate_sprint",
        lambda received_db, sprint_id, current_user: calls.append(("activate", received_db, sprint_id, current_user))
        or "activate",
    )
    monkeypatch.setattr(
        sprints.sprint_service,
        "complete_sprint",
        lambda received_db, sprint_id, current_user: calls.append(("complete", received_db, sprint_id, current_user))
        or "complete",
    )

    assert sprints.get_sprint("SPR00000003", db, user) == "get"
    assert sprints.update_sprint("SPR00000003", update_payload, db, user) == "update"
    assert sprints.delete_sprint("SPR00000003", db, user) == "delete"
    assert sprints.activate_sprint("SPR00000003", db, user) == "activate"
    assert sprints.complete_sprint("SPR00000003", db, user) == "complete"
    assert calls == [
        ("get", db, "SPR00000003", user),
        ("update", db, "SPR00000003", update_payload, user),
        ("delete", db, "SPR00000003", user),
        ("activate", db, "SPR00000003", user),
        ("complete", db, "SPR00000003", user),
    ]


def test_complete_sprint_requires_all_tasks_done(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003", role="USER")
    space = SimpleNamespace(
        space_id="SPC00000002",
        owner_id=user.user_id,
        status_space="Active",
        deleted_at=None,
    )
    sprint = SimpleNamespace(
        sprint_id="SPR00000003",
        space_id=space.space_id,
        status="Active",
        space=space,
    )

    monkeypatch.setattr(sprint_service, "_get_sprint_or_404", lambda received_db, sprint_id: sprint)
    monkeypatch.setattr(sprint_service.sprint_repository, "count_incomplete_tasks_by_sprint", lambda *_args: 2)

    with pytest.raises(HTTPException) as exc_info:
        sprint_service.complete_sprint(db, sprint.sprint_id, user)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Sprint can only be completed when all tasks are done"
