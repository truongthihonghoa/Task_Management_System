from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1 import spaces
from app.repository import space as space_repository
from app.schemas.pydantic_models import SpaceCreate, SpaceUpdate
from app.services import space_service


def test_space_crud_routes_delegate_to_repository(monkeypatch):
    db = object()
    current_user = SimpleNamespace(user_id="USR00000003", role="USER")
    create_payload = SpaceCreate(
        name_space="Task Management",
        owner_id="USR00000003",
        description="Task management workspace",
    )
    update_payload = SpaceUpdate(name_space="Updated Space", description="Updated description")
    calls = []

    monkeypatch.setattr(
        spaces.space_crud,
        "create_space",
        lambda received_db, payload: calls.append(("create", received_db, payload)) or {"space_id": "SPC00000002"},
    )
    monkeypatch.setattr(
        spaces.space_crud,
        "list_spaces",
        lambda received_db, **kwargs: calls.append(("list", received_db, kwargs)) or [],
    )
    monkeypatch.setattr(
        spaces.space_crud,
        "get_space",
        lambda received_db, space_id, **kwargs: calls.append(("get", received_db, space_id, kwargs))
        or {"space_id": space_id},
    )
    monkeypatch.setattr(
        spaces.space_crud,
        "update_space",
        lambda received_db, space_id, payload, **kwargs: calls.append(("update", received_db, space_id, payload, kwargs))
        or {"space_id": space_id},
    )
    monkeypatch.setattr(
        spaces.space_crud,
        "archive_space",
        lambda received_db, space_id, **kwargs: calls.append(("archive", received_db, space_id, kwargs))
        or {"space_id": space_id},
    )
    monkeypatch.setattr(
        spaces.space_crud,
        "restore_space",
        lambda received_db, space_id, **kwargs: calls.append(("restore", received_db, space_id, kwargs))
        or {"space_id": space_id},
    )
    monkeypatch.setattr(
        spaces.space_crud,
        "delete_space",
        lambda received_db, space_id, **kwargs: calls.append(("delete", received_db, space_id, kwargs))
        or {"space_id": space_id},
    )

    assert spaces.create_space(create_payload, db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.list_spaces(include_deleted=True, db=db, current_user=current_user) == []
    assert spaces.get_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.update_space("SPC00000002", update_payload, db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.archive_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.complete_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.restore_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.delete_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}

    assert calls == [
        ("create", db, create_payload),
        ("list", db, {"include_deleted": True, "current_user": current_user}),
        ("get", db, "SPC00000002", {"current_user": current_user}),
        ("update", db, "SPC00000002", update_payload, {"current_user": current_user}),
        ("archive", db, "SPC00000002", {"current_user": current_user}),
        ("archive", db, "SPC00000002", {"current_user": current_user}),
        ("restore", db, "SPC00000002", {"current_user": current_user}),
        ("delete", db, "SPC00000002", {"current_user": current_user}),
    ]


def test_create_space_requires_user_role():
    db = object()
    payload = SpaceCreate(
        name_space="Task Management",
        owner_id="USR00000001",
        description="Task management workspace",
    )
    current_user = SimpleNamespace(user_id="USR00000001", role="SUPER_ADMIN")

    with pytest.raises(HTTPException) as exc_info:
        spaces.create_space(payload, db, current_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Only users can create spaces"


def test_create_space_requires_current_user_as_owner():
    db = object()
    payload = SpaceCreate(
        name_space="Task Management",
        owner_id="USR00000099",
        description="Task management workspace",
    )
    current_user = SimpleNamespace(user_id="USR00000003", role="USER")

    with pytest.raises(HTTPException) as exc_info:
        spaces.create_space(payload, db, current_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Users can only create spaces for themselves"


def test_space_trash_and_members_routes_delegate_to_repository(monkeypatch):
    db = object()
    current_user = SimpleNamespace(user_id="USR00000003", role="USER")
    calls = []

    monkeypatch.setattr(
        spaces.space_crud,
        "list_owner_trash",
        lambda received_db, owner_id, **kwargs: calls.append(("trash", received_db, owner_id, kwargs)) or [],
    )
    monkeypatch.setattr(
        spaces.space_crud,
        "list_space_members",
        lambda received_db, space_id, **kwargs: calls.append(("members", received_db, space_id, kwargs)) or [],
    )

    assert spaces.list_owner_trash("USR00000003", db, current_user) == []
    assert spaces.list_space_members("SPC00000002", db, current_user) == []

    assert calls == [
        ("trash", db, "USR00000003", {"current_user": current_user}),
        ("members", db, "SPC00000002", {"current_user": current_user}),
    ]


def test_space_service_normalizes_space_name():
    assert space_service._normalize_space_name("  Product Team  ") == "Product Team"

    with pytest.raises(HTTPException) as exc_info:
        space_service._normalize_space_name("   ")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Space name is required"


def test_archived_space_is_read_only():
    archived_space = SimpleNamespace(status_space="Archived", deleted_at=None)

    with pytest.raises(HTTPException) as repo_exc:
        space_repository._ensure_space_mutable(archived_space)

    assert repo_exc.value.status_code == 400
    assert repo_exc.value.detail == "Space is archived"

    with pytest.raises(HTTPException) as service_exc:
        space_service._ensure_space_mutable(archived_space)

    assert service_exc.value.status_code == 400
    assert service_exc.value.detail == "Space is archived"
