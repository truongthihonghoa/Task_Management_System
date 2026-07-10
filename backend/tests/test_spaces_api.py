from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1 import spaces
from app.schemas.pydantic_models import SpaceCreate, SpaceMemberCreate, SpaceMemberUpdate, SpaceUpdate
from app.services import space_service


def test_space_crud_routes_delegate_to_service(monkeypatch):
    db = object()
    create_payload = SpaceCreate(
        name_space="Task Management",
        owner_id="USR00000003",
        description="Task management workspace",
    )
    update_payload = SpaceUpdate(name_space="Updated Space", description="Updated description")
    calls = []

    monkeypatch.setattr(
        spaces.space_service,
        "create_space",
        lambda received_db, payload: calls.append(("create", received_db, payload)) or {"space_id": "SPC00000002"},
    )
    monkeypatch.setattr(
        spaces.space_service,
        "list_spaces",
        lambda received_db, **kwargs: calls.append(("list", received_db, kwargs)) or [],
    )
    monkeypatch.setattr(
        spaces.space_service,
        "get_space",
        lambda received_db, space_id: calls.append(("get", received_db, space_id)) or {"space_id": space_id},
    )
    monkeypatch.setattr(
        spaces.space_service,
        "update_space",
        lambda received_db, space_id, payload: calls.append(("update", received_db, space_id, payload))
        or {"space_id": space_id},
    )
    monkeypatch.setattr(
        spaces.space_service,
        "archive_space",
        lambda received_db, space_id: calls.append(("archive", received_db, space_id)) or {"space_id": space_id},
    )
    monkeypatch.setattr(
        spaces.space_service,
        "restore_space",
        lambda received_db, space_id: calls.append(("restore", received_db, space_id)) or {"space_id": space_id},
    )
    monkeypatch.setattr(
        spaces.space_service,
        "delete_space",
        lambda received_db, space_id: calls.append(("delete", received_db, space_id)) or {"space_id": space_id},
    )

    assert spaces.create_space(create_payload, db) == {"space_id": "SPC00000002"}
    assert spaces.list_spaces(include_deleted=True, db=db) == []
    assert spaces.get_space("SPC00000002", db) == {"space_id": "SPC00000002"}
    assert spaces.update_space("SPC00000002", update_payload, db) == {"space_id": "SPC00000002"}
    assert spaces.archive_space("SPC00000002", db) == {"space_id": "SPC00000002"}
    assert spaces.restore_space("SPC00000002", db) == {"space_id": "SPC00000002"}
    assert spaces.delete_space("SPC00000002", db) == {"space_id": "SPC00000002"}

    assert calls == [
        ("create", db, create_payload),
        ("list", db, {"include_deleted": True}),
        ("get", db, "SPC00000002"),
        ("update", db, "SPC00000002", update_payload),
        ("archive", db, "SPC00000002"),
        ("restore", db, "SPC00000002"),
        ("delete", db, "SPC00000002"),
    ]


def test_space_trash_and_member_routes_delegate_to_service(monkeypatch):
    db = object()
    current_user = SimpleNamespace(user_id="USR00000003", role="USER")
    add_payload = SpaceMemberCreate(user_id="USR00000010")
    update_payload = SpaceMemberUpdate(role="MEMBER")
    calls = []

    monkeypatch.setattr(
        spaces.space_service,
        "list_owner_trash",
        lambda received_db, owner_id: calls.append(("trash", received_db, owner_id)) or [],
    )
    monkeypatch.setattr(
        spaces.space_service,
        "list_space_members",
        lambda received_db, space_id: calls.append(("members", received_db, space_id)) or [],
    )
    monkeypatch.setattr(
        spaces.space_service,
        "add_space_member",
        lambda received_db, space_id, payload, user: calls.append(("add_member", received_db, space_id, payload, user))
        or {"space_member_id": "SPM00000001"},
    )
    monkeypatch.setattr(
        spaces.space_service,
        "update_space_member",
        lambda received_db, space_id, user_id, payload, user: calls.append(
            ("update_member", received_db, space_id, user_id, payload, user)
        )
        or {"space_member_id": "SPM00000001"},
    )
    monkeypatch.setattr(
        spaces.space_service,
        "remove_space_member",
        lambda received_db, space_id, user_id, user: calls.append(("remove_member", received_db, space_id, user_id, user))
        or {"space_member_id": "SPM00000001"},
    )

    assert spaces.list_owner_trash("USR00000003", db) == []
    assert spaces.list_space_members("SPC00000002", db) == []
    assert spaces.add_space_member("SPC00000002", add_payload, db, current_user) == {"space_member_id": "SPM00000001"}
    assert spaces.update_space_member("SPC00000002", "USR00000010", update_payload, db, current_user) == {
        "space_member_id": "SPM00000001"
    }
    assert spaces.remove_space_member("SPC00000002", "USR00000010", db, current_user) == {
        "space_member_id": "SPM00000001"
    }

    assert calls == [
        ("trash", db, "USR00000003"),
        ("members", db, "SPC00000002"),
        ("add_member", db, "SPC00000002", add_payload, current_user),
        ("update_member", db, "SPC00000002", "USR00000010", update_payload, current_user),
        ("remove_member", db, "SPC00000002", "USR00000010", current_user),
    ]


def test_space_service_normalizes_space_name():
    assert space_service._normalize_space_name("  Product Team  ") == "Product Team"

    with pytest.raises(HTTPException) as exc_info:
        space_service._normalize_space_name("   ")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Space name is required"
