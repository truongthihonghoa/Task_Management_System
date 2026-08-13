from datetime import datetime, timedelta
from app.core.timezone import vietnam_now
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1 import spaces
from app.repository import space as space_repository
from app.schemas.pydantic_models import SpaceAddPeopleRequest, SpaceCreate, SpaceUpdate
from app.services import space_service
from app.services import space_retention_service


def test_space_crud_routes_delegate_to_repository(monkeypatch):
    db = object()
    current_user = SimpleNamespace(user_id="USR00000003", role="USER")
    create_payload = SpaceCreate(
        name_space="Task Management",
        space_key="TM",
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
        "unarchive_space",
        lambda received_db, space_id, **kwargs: calls.append(("unarchive", received_db, space_id, kwargs))
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
    assert spaces.complete_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.unarchive_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.restore_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}
    assert spaces.delete_space("SPC00000002", db, current_user) == {"space_id": "SPC00000002"}

    assert calls == [
        ("create", db, create_payload),
        ("list", db, {"include_deleted": True, "current_user": current_user}),
        ("get", db, "SPC00000002", {"current_user": current_user}),
        ("update", db, "SPC00000002", update_payload, {"current_user": current_user}),
        ("archive", db, "SPC00000002", {"current_user": current_user}),
        ("unarchive", db, "SPC00000002", {"current_user": current_user}),
        ("restore", db, "SPC00000002", {"current_user": current_user}),
        ("delete", db, "SPC00000002", {"current_user": current_user}),
    ]


def test_create_space_requires_user_role():
    db = object()
    payload = SpaceCreate(
        name_space="Task Management",
        space_key="TM",
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
        space_key="TM",
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


def test_complete_space_rejects_unfinished_work_and_pending_invites():
    class FakeCountQuery:
        def __init__(self, value):
            self.value = value

        def filter(self, *_args):
            return self

        def scalar(self):
            return self.value

    class FakeDB:
        def __init__(self):
            self.counts = iter([2, 1, 1])

        def query(self, *_args):
            return FakeCountQuery(next(self.counts))

    with pytest.raises(HTTPException) as exc_info:
        space_repository._ensure_space_completion_requirements(FakeDB(), "SPC00000002")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == (
        "Cannot complete space: 2 task(s) are not done or cancelled, "
        "1 sprint(s) are not completed, "
        "1 member invitation(s) are still pending."
    )


def test_archive_space_checks_completion_requirements(monkeypatch):
    created_at = datetime(2026, 7, 1, 9, 0, 0)
    owner = SimpleNamespace(user_id="USR00000003")
    active_space = SimpleNamespace(
        space_id="SPC00000002",
        name_space="Product Team",
        description="Active project",
        owner_id=owner.user_id,
        status_space="Active",
        created_at=created_at,
        updated_at=created_at,
        archived_at=None,
        reopen_until=None,
        deleted_at=None,
    )

    class FakeDB:
        def __init__(self):
            self.committed = False

        def commit(self):
            self.committed = True

    def reject_completion(*_args):
        raise HTTPException(status_code=400, detail="Cannot complete space: 1 task(s) are not done or cancelled.")

    db = FakeDB()
    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: active_space)
    monkeypatch.setattr(space_repository, "_ensure_space_completion_requirements", reject_completion)

    with pytest.raises(HTTPException) as exc_info:
        space_repository.archive_space(db, active_space.space_id, current_user=owner)

    assert exc_info.value.detail == "Cannot complete space: 1 task(s) are not done or cancelled."
    assert active_space.status_space == "Active"
    assert db.committed is False


def test_delete_space_allows_archived_space_for_owner(monkeypatch):
    created_at = datetime(2026, 7, 1, 9, 0, 0)
    owner = SimpleNamespace(user_id="USR00000003")
    archived_space = SimpleNamespace(
        space_id="SPC00000002",
        name_space="Product Team",
        description="Archived project",
        owner_id=owner.user_id,
        status_space="Archived",
        created_at=created_at,
        updated_at=created_at,
        deleted_at=None,
    )

    class FakeDB:
        def __init__(self):
            self.committed = False
            self.refreshed = None

        def commit(self):
            self.committed = True

        def refresh(self, space):
            self.refreshed = space

    class FakeNotificationService:
        def create_notification(self, *_args, **_kwargs):
            return None

    db = FakeDB()
    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: archived_space)
    monkeypatch.setattr(space_repository, "notification_service", FakeNotificationService())

    response = space_repository.delete_space(db, archived_space.space_id, current_user=owner)

    assert response.status_space == "Deleted"
    assert archived_space.status_space == "Deleted"
    assert archived_space.deleted_at is not None
    assert db.committed is True
    assert db.refreshed is archived_space


def test_unarchive_space_reopens_archived_space_for_owner(monkeypatch):
    created_at = datetime(2026, 7, 1, 9, 0, 0)
    archived_at = vietnam_now()
    owner = SimpleNamespace(user_id="USR00000003", status_user="Active")
    archived_space = SimpleNamespace(
        space_id="SPC00000002",
        name_space="Product Team",
        description="Archived project",
        owner_id=owner.user_id,
        status_space="Archived",
        created_at=created_at,
        updated_at=created_at,
        archived_at=archived_at,
        reopen_until=archived_at + timedelta(days=7),
        deleted_at=None,
    )

    class FakeQuery:
        def filter(self, *_args):
            return self

        def first(self):
            return owner

    class FakeDB:
        def __init__(self):
            self.committed = False
            self.refreshed = None

        def query(self, _model):
            return FakeQuery()

        def commit(self):
            self.committed = True

        def refresh(self, space):
            self.refreshed = space

    notifications = []

    class FakeNotificationService:
        def create_notification(self, *_args, **kwargs):
            notifications.append(kwargs)

    db = FakeDB()
    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: archived_space)
    monkeypatch.setattr(space_repository, "_ensure_space_name_available", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(space_repository, "notification_service", FakeNotificationService())

    response = space_repository.unarchive_space(db, archived_space.space_id, current_user=owner)

    assert response.status_space == "Active"
    assert archived_space.status_space == "Active"
    assert archived_space.archived_at is None
    assert archived_space.reopen_until is None
    assert archived_space.deleted_at is None
    assert archived_space.updated_at != created_at
    assert notifications[0]["metadata"]["event"] == "space_unarchived"
    assert db.committed is True
    assert db.refreshed is archived_space


def test_unarchive_space_rejects_expired_reopen_window(monkeypatch):
    owner = SimpleNamespace(user_id="USR00000003")
    archived_at = vietnam_now() - timedelta(days=8)
    archived_space = SimpleNamespace(
        space_id="SPC00000002",
        owner_id=owner.user_id,
        status_space="Archived",
        archived_at=archived_at,
        reopen_until=archived_at + timedelta(days=7),
        deleted_at=None,
    )

    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: archived_space)

    with pytest.raises(HTTPException) as exc_info:
        space_repository.unarchive_space(object(), archived_space.space_id, current_user=owner)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Space reopen period has expired"


def test_unarchive_space_rejects_deleted_space(monkeypatch):
    owner = SimpleNamespace(user_id="USR00000003")
    deleted_space = SimpleNamespace(
        space_id="SPC00000002",
        owner_id=owner.user_id,
        status_space="Deleted",
        archived_at=vietnam_now(),
        reopen_until=None,
        deleted_at=vietnam_now(),
    )

    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: deleted_space)

    with pytest.raises(HTTPException) as exc_info:
        space_repository.unarchive_space(object(), deleted_space.space_id, current_user=owner)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Cannot unarchive deleted space"


def test_delete_space_rejects_already_deleted_space(monkeypatch):
    owner = SimpleNamespace(user_id="USR00000003")
    deleted_space = SimpleNamespace(
        space_id="SPC00000002",
        owner_id=owner.user_id,
        status_space="Deleted",
        deleted_at=vietnam_now(),
    )

    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: deleted_space)

    with pytest.raises(HTTPException) as exc_info:
        space_repository.delete_space(object(), deleted_space.space_id, current_user=owner)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Space is already deleted"


def test_invitation_acceptance_notifies_original_inviter(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "http://frontend.test")
    inviter = SimpleNamespace(user_id="USR00000003", full_name="Inviter", email="inviter@example.com")
    invitee = SimpleNamespace(user_id="USR00000004", full_name="Invitee", email="invitee@example.com")
    space = SimpleNamespace(space_id="SPC00000002", name_space="Product Team")
    member_request = SimpleNamespace(
        requester_id=inviter.user_id,
        owner_id=inviter.user_id,
        requested_email=invitee.email,
        requested_name=invitee.full_name,
    )

    class FakeQuery:
        def filter(self, *_args):
            return self

        def first(self):
            return inviter

    class FakeDB:
        def query(self, _model):
            return FakeQuery()

    notifications = []

    class FakeNotificationService:
        def create_notification(self, *args, **kwargs):
            notifications.append(kwargs)

    monkeypatch.setattr(space_repository, "notification_service", FakeNotificationService())

    space_repository._notify_inviter_invitation_accepted(
        FakeDB(),
        space=space,
        request=member_request,
        invitee=invitee,
    )

    assert notifications == [
        {
            "user_id": inviter.user_id,
            "actor_id": invitee.user_id,
            "space_id": space.space_id,
            "notification_type": "space_member_added",
            "title": "Invitation accepted",
            "message": "Invitee accepted your invitation to join Product Team.",
            "audience": "USER",
            "metadata": {
                "space_name": space.name_space,
                "invitee_email": invitee.email,
                "event": "space_invitation_accepted",
                "action_url": "http://frontend.test/dashboard/tasks/SPC00000002",
            },
            "allow_self_notification": True,
        }
    ]


def test_invitation_acceptance_notifies_owner_and_requester(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "http://frontend.test")
    owner = SimpleNamespace(user_id="USR00000001", full_name="Owner", email="owner@example.com")
    requester = SimpleNamespace(user_id="USR00000003", full_name="Requester", email="requester@example.com")
    invitee = SimpleNamespace(user_id="USR00000004", full_name="Invitee", email="invitee@example.com")
    space = SimpleNamespace(space_id="SPC00000002", name_space="Product Team")
    member_request = SimpleNamespace(
        requester_id=requester.user_id,
        owner_id=owner.user_id,
        requested_email=invitee.email,
        requested_name=invitee.full_name,
    )

    users = {
        owner.user_id: owner,
        requester.user_id: requester,
    }

    class FakeQuery:
        def __init__(self):
            self.user_id = None

        def filter(self, condition):
            self.user_id = condition.right.value
            return self

        def first(self):
            return users.get(self.user_id)

    class FakeDB:
        def query(self, _model):
            return FakeQuery()

    notifications = []

    class FakeNotificationService:
        def create_notification(self, *args, **kwargs):
            notifications.append(kwargs)

    monkeypatch.setattr(space_repository, "notification_service", FakeNotificationService())

    space_repository._notify_inviter_invitation_accepted(
        FakeDB(),
        space=space,
        request=member_request,
        invitee=invitee,
    )

    assert [notification["user_id"] for notification in notifications] == [
        requester.user_id,
        owner.user_id,
    ]
    assert all(
        notification["title"] == "Invitation accepted"
        and notification["message"] == "Invitee accepted your invitation to join Product Team."
        and notification["metadata"]["invitee_email"] == invitee.email
        and notification["metadata"]["action_url"] == "http://frontend.test/dashboard/tasks/SPC00000002"
        for notification in notifications
    )


def test_owner_approval_sends_invitation_from_original_requester(monkeypatch):
    owner = SimpleNamespace(
        user_id="USR00000001",
        full_name="Owner User",
        email="owner@example.com",
    )
    requester = SimpleNamespace(
        user_id="USR00000002",
        full_name="Member User",
        email="member@example.com",
    )
    member_request = SimpleNamespace(
        space_id="SPC00000002",
        owner_id=owner.user_id,
        requester_id=requester.user_id,
        requested_email="invitee@example.com",
        requested_name="Invitee",
        status="PENDING_OWNER",
        review_token="owner-review-token",
        reviewed_at=None,
    )
    space = SimpleNamespace(space_id="SPC00000002", name_space="Product Team", status_space="Active", deleted_at=None)

    class FakeQuery:
        def __init__(self, result):
            self.result = result

        def filter(self, *_args):
            return self

        def first(self):
            return self.result

    class FakeDB:
        def __init__(self):
            self.user_results = [owner, requester]
            self.committed = False

        def query(self, model):
            if model is space_repository.SpaceMemberRequest:
                return FakeQuery(member_request)
            if model is space_repository.User:
                return FakeQuery(self.user_results.pop(0))
            raise AssertionError(f"Unexpected model: {model}")

        def commit(self):
            self.committed = True

    sent_invitations = []

    def fake_send_member_invitation_email(*, inviter, space, request):
        sent_invitations.append((inviter, space, request))
        return True

    db = FakeDB()
    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: space)
    monkeypatch.setattr(space_repository, "_ensure_space_active", lambda _space: None)
    monkeypatch.setattr(space_repository, "_send_member_invitation_email", fake_send_member_invitation_email)
    monkeypatch.setattr(space_repository.secrets, "token_urlsafe", lambda _size: "invitee-token")

    message = space_repository.review_space_member_request(db, "owner-review-token", approve=True)

    assert message == "Owner approved. Invitation email sent to the invitee."
    assert member_request.status == "PENDING_INVITEE"
    assert member_request.review_token == "invitee-token"
    assert db.committed is True
    assert sent_invitations == [(requester, space, member_request)]


def test_admin_cannot_add_people_to_space(monkeypatch):
    space = SimpleNamespace(
        space_id="SPC00000002",
        owner_id="USR00000001",
        status_space="Active",
        deleted_at=None,
    )
    payload = SpaceAddPeopleRequest(email="invitee@example.com")
    current_user = SimpleNamespace(user_id="USR00000099", role="SUPER_ADMIN")

    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: space)

    with pytest.raises(HTTPException) as exc_info:
        space_repository.add_people_to_space(object(), space.space_id, payload, current_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "ADMIN and SUPER_ADMIN cannot add people to spaces"


def test_owner_invites_existing_user_and_waits_for_acceptance(monkeypatch):
    owner = SimpleNamespace(
        user_id="USR00000001",
        role="USER",
        full_name="Owner",
        email="owner@example.com",
        status_user="Active",
    )
    invitee = SimpleNamespace(
        user_id="USR00000002",
        role="USER",
        full_name="Invitee User",
        email="invitee@example.com",
        status_user="Active",
        status="Active",
        locked_until=None,
        deleted_at=None,
    )
    space = SimpleNamespace(
        space_id="SPC00000002",
        owner_id=owner.user_id,
        name_space="Product Team",
        status_space="Active",
        deleted_at=None,
    )

    class FakeDB:
        def __init__(self):
            self.added = None
            self.committed = False

        def add(self, value):
            self.added = value

        def flush(self):
            if self.added is not None:
                self.added.space_member_request_id = "SMR00000001"

        def commit(self):
            self.committed = True

        def refresh(self, value):
            pass

        def query(self, model):
            class FakeQuery:
                def filter(self, *_args):
                    return self

                def first(self):
                    return owner

            return FakeQuery()

    sent_invitations = []

    def fake_send_member_invitation_email(*, inviter, space, request):
        sent_invitations.append((inviter, space, request))
        return True

    db = FakeDB()
    monkeypatch.setattr(space_repository, "get_space_or_404", lambda _db, _space_id: space)
    monkeypatch.setattr(space_repository, "_resolve_requested_user", lambda _db, _payload: invitee)
    monkeypatch.setattr(space_repository, "_get_space_member", lambda *_args: None)
    monkeypatch.setattr(space_repository, "_pending_member_request_exists", lambda *_args, **_kwargs: False)
    monkeypatch.setattr(space_repository, "_send_member_invitation_email", fake_send_member_invitation_email)
    monkeypatch.setattr(space_repository.secrets, "token_urlsafe", lambda _size: "invitee-token")

    response = space_repository.add_people_to_space(
        db,
        space.space_id,
        SpaceAddPeopleRequest(email=invitee.email),
        owner,
    )

    assert response.status == "PENDING_INVITEE"
    assert response.member is None
    assert response.request.requested_user_id == invitee.user_id
    assert response.request.status == "PENDING_INVITEE"
    assert db.committed is True
    assert sent_invitations == [(owner, space, db.added)]


def test_cleanup_expired_deleted_spaces_hard_deletes_only_expired_spaces(monkeypatch):
    now = datetime(2026, 7, 20, 9, 0, 0)
    expired_space = SimpleNamespace(space_id="SPC00000001", deleted_at=now - timedelta(days=14, minutes=1))
    deleted = []

    class FakeDB:
        def __init__(self):
            self.committed = False
            self.rolled_back = False

        def commit(self):
            self.committed = True

        def rollback(self):
            self.rolled_back = True

    db = FakeDB()
    monkeypatch.setattr(
        space_repository,
        "list_expired_deleted_space_records",
        lambda received_db, **kwargs: [expired_space],
    )
    monkeypatch.setattr(
        space_repository,
        "hard_delete_space",
        lambda received_db, space_id, **kwargs: deleted.append((received_db, space_id, kwargs)) or True,
    )

    deleted_count = space_repository.cleanup_expired_deleted_spaces(db, now=now)

    assert deleted_count == 1
    assert deleted == [(db, "SPC00000001", {"commit": False})]
    assert db.committed is True
    assert db.rolled_back is False


def test_cleanup_expired_deleted_spaces_skips_commit_when_nothing_expired(monkeypatch):
    class FakeDB:
        def __init__(self):
            self.committed = False
            self.rolled_back = False

        def commit(self):
            self.committed = True

        def rollback(self):
            self.rolled_back = True

    db = FakeDB()
    monkeypatch.setattr(space_repository, "list_expired_deleted_space_records", lambda received_db, **kwargs: [])

    deleted_count = space_repository.cleanup_expired_deleted_spaces(db)

    assert deleted_count == 0
    assert db.committed is False
    assert db.rolled_back is False


def test_cleanup_expired_deleted_spaces_rolls_back_on_failure(monkeypatch):
    expired_space = SimpleNamespace(space_id="SPC00000001")

    class FakeDB:
        def __init__(self):
            self.committed = False
            self.rolled_back = False

        def commit(self):
            self.committed = True

        def rollback(self):
            self.rolled_back = True

    def fail_hard_delete(*_args, **_kwargs):
        raise RuntimeError("delete failed")

    db = FakeDB()
    monkeypatch.setattr(
        space_repository,
        "list_expired_deleted_space_records",
        lambda received_db, **kwargs: [expired_space],
    )
    monkeypatch.setattr(space_repository, "hard_delete_space", fail_hard_delete)

    with pytest.raises(RuntimeError, match="delete failed"):
        space_repository.cleanup_expired_deleted_spaces(db)

    assert db.committed is False
    assert db.rolled_back is True


def test_cleanup_expired_archived_space_reopen_windows_expires_reopen(monkeypatch):
    now = datetime(2026, 7, 20, 9, 0, 0)
    archived_space = SimpleNamespace(
        space_id="SPC00000002",
        status_space="Archived",
        deleted_at=None,
        reopen_until=now - timedelta(minutes=1),
        updated_at=now - timedelta(days=14),
    )

    class FakeDB:
        def __init__(self):
            self.committed = False
            self.rolled_back = False

        def commit(self):
            self.committed = True

        def rollback(self):
            self.rolled_back = True

    db = FakeDB()
    monkeypatch.setattr(
        space_repository,
        "list_expired_archived_space_reopen_records",
        lambda received_db, **kwargs: [archived_space],
    )

    expired_count = space_repository.cleanup_expired_archived_space_reopen_windows(db, now=now)

    assert expired_count == 1
    assert archived_space.reopen_until is None
    assert archived_space.updated_at == now
    assert db.committed is True
    assert db.rolled_back is False


def test_space_retention_service_purges_expired_spaces(monkeypatch):
    class FakeDB:
        def __init__(self):
            self.closed = False
            self.rolled_back = False

        def rollback(self):
            self.rolled_back = True

        def close(self):
            self.closed = True

    db = FakeDB()
    calls = []

    monkeypatch.setattr(space_retention_service, "SessionLocal", lambda: db)
    monkeypatch.setattr(
        space_retention_service.space_repository,
        "cleanup_expired_deleted_spaces",
        lambda received_db: calls.append(("deleted", received_db)) or 2,
    )
    monkeypatch.setattr(
        space_retention_service.space_repository,
        "cleanup_expired_archived_space_reopen_windows",
        lambda received_db: calls.append(("archived", received_db)) or 3,
    )

    assert space_retention_service.purge_expired_spaces() == (2, 3)
    assert calls == [("deleted", db), ("archived", db)]
    assert db.closed is True
    assert db.rolled_back is False
