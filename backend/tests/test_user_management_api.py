from datetime import datetime, timedelta
from app.core.timezone import vietnam_now
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from app.api.v1 import users as users_api
from app.repository import user as user_repository
from app.services import user_service
from app.schemas.pydantic_models import UserManagementUpdateRequest


class FakeDb:
    def __init__(self, users=None):
        self.users = users or []
        self.added = []
        self.commits = 0
        self.flushes = 0
        self.rollbacks = 0

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.commits += 1

    def flush(self):
        self.flushes += 1

    def rollback(self):
        self.rollbacks += 1

    def query(self, model):
        return FakeQuery(self.users)


class FakeQuery:
    def __init__(self, users):
        self.users = list(users)

    def filter(self, *criteria):
        # Repository get_user_or_404 uses SQLAlchemy expressions. For unit tests,
        # return self and let first() return the prepared first matching user.
        return self

    def first(self):
        return self.users[0] if self.users else None

    def count(self):
        return len(self.users)

    def order_by(self, *args):
        return self

    def offset(self, value):
        self._offset = value
        return self

    def limit(self, value):
        self._limit = value
        return self

    def all(self):
        offset = getattr(self, "_offset", 0)
        limit = getattr(self, "_limit", len(self.users))
        return self.users[offset : offset + limit]


def make_user(**overrides):
    now = vietnam_now()
    values = {
        "user_id": "USR00000001",
        "full_name": "Admin User",
        "email": "admin@example.com",
        "password_hash": "hashed-password",
        "status_user": "Active",
        "role": "USER",
        "avatar_url": None,
        "is_verified": True,
        "failed_login_attempts": 0,
        "locked_until": None,
        "last_login": None,
        "created_at": now - timedelta(days=1),
        "updated_at": now - timedelta(days=1),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def assert_http_exception(exc_info, status_code, detail):
    assert exc_info.value.status_code == status_code
    assert exc_info.value.detail == detail


def test_ensure_super_admin_allows_super_admin():
    user = make_user(role="SUPER_ADMIN")

    users_api._ensure_super_admin(user)


@pytest.mark.parametrize("role", ["USER", "OWNER", "", None])
def test_ensure_super_admin_rejects_non_super_admin(role):
    user = make_user(role=role)

    with pytest.raises(HTTPException) as exc_info:
        users_api._ensure_super_admin(user)

    assert_http_exception(exc_info, status.HTTP_403_FORBIDDEN, "SUPER_ADMIN access required.")


@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 1),
        (1, 20),
        (5, 100),
    ],
)
def test_validate_pagination_accepts_valid_values(page, page_size):
    users_api._validate_pagination(page, page_size)


@pytest.mark.parametrize(
    ("page", "page_size", "message"),
    [
        (0, 20, "page must be greater than or equal to 1"),
        (-1, 20, "page must be greater than or equal to 1"),
        (1, 0, "page_size must be between 1 and 100"),
        (1, 101, "page_size must be between 1 and 100"),
        (1, -5, "page_size must be between 1 and 100"),
    ],
)
def test_validate_pagination_rejects_invalid_values(page, page_size, message):
    with pytest.raises(HTTPException) as exc_info:
        users_api._validate_pagination(page, page_size)

    assert_http_exception(exc_info, status.HTTP_400_BAD_REQUEST, message)


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "Pending"},
        {"status": "Active"},
        {"status": "Inactive"},
        {"status": "Locked"},
        {"is_verified": True},
        {"is_verified": False},
        {"failed_login_attempts": 0},
        {"failed_login_attempts": 3},
        {"locked_until": vietnam_now()},
        {"locked_until": None},
        {
            "status": "Locked",
            "is_verified": True,
            "failed_login_attempts": 5,
            "locked_until": vietnam_now(),
        },
    ],
)
def test_validate_update_payload_accepts_allowed_fields(payload):
    user_service.validate_update_payload(payload)


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        ({}, "At least one field is required"),
        ({"email": "new@example.com"}, "Read-only fields cannot be modified after registration: email"),
        ({"full_name": "New Name"}, "Read-only fields cannot be modified after registration: full_name"),
        ({"password_hash": "new-hash"}, "Read-only fields cannot be modified after registration: password_hash"),
        (
            {"email": "new@example.com", "full_name": "New Name"},
            "Read-only fields cannot be modified after registration: email, full_name",
        ),
        ({"role": "SUPER_ADMIN"}, "Invalid update fields: role"),
        ({"avatar_url": "https://example.com/a.png"}, "Invalid update fields: avatar_url"),
        ({"status": "Deleted"}, "Invalid status value"),
        ({"status": "active"}, "Invalid status value"),
        ({"failed_login_attempts": -1}, "failed_login_attempts must be a non-negative integer"),
        ({"failed_login_attempts": "abc"}, "failed_login_attempts must be a non-negative integer"),
    ],
)
def test_validate_update_payload_rejects_invalid_fields(payload, message):
    with pytest.raises(HTTPException) as exc_info:
        user_service.validate_update_payload(payload)

    assert_http_exception(exc_info, status.HTTP_400_BAD_REQUEST, message)


def test_update_request_schema_accepts_allowed_fields():
    locked_until = vietnam_now()

    payload = UserManagementUpdateRequest(
        status="Locked",
        is_verified=True,
        failed_login_attempts=4,
        locked_until=locked_until,
    )

    assert payload.status == "Locked"
    assert payload.is_verified is True
    assert payload.failed_login_attempts == 4
    assert payload.locked_until == locked_until


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "Deleted"},
        {"failed_login_attempts": -1},
        {"locked_until": "not-a-date"},
        {"email": "new@example.com"},
    ],
)
def test_update_request_schema_rejects_invalid_payload(payload):
    with pytest.raises(Exception):
        UserManagementUpdateRequest(**payload)


def test_get_user_or_404_returns_existing_user():
    user = make_user(user_id="USR00000002")
    db = FakeDb(users=[user])

    result = user_service.get_user_or_404(db, "USR00000002")

    assert result is user


def test_get_user_or_404_raises_for_missing_user():
    db = FakeDb(users=[])

    with pytest.raises(HTTPException) as exc_info:
        user_service.get_user_or_404(db, "USR99999999")

    assert_http_exception(exc_info, status.HTTP_404_NOT_FOUND, "User not found")


def test_update_user_updates_only_allowed_fields():
    original_updated_at = vietnam_now() - timedelta(days=1)
    user = make_user(
        email="readonly@example.com",
        full_name="Read Only",
        password_hash="original-hash",
        status_user="Active",
        is_verified=False,
        failed_login_attempts=1,
        locked_until=None,
        updated_at=original_updated_at,
    )
    db = FakeDb(users=[user])
    locked_until = vietnam_now() + timedelta(minutes=15)

    response = user_service.update_user(
        db,
        user.user_id,
        {
            "status": "Locked",
            "is_verified": True,
            "failed_login_attempts": 5,
            "locked_until": locked_until,
        },
    )

    assert response.status_user == "Locked"
    assert response.is_verified is True
    assert response.failed_login_attempts == 5
    assert response.locked_until == locked_until
    assert user.email == "readonly@example.com"
    assert user.full_name == "Read Only"
    assert user.password_hash == "original-hash"
    assert user.updated_at > original_updated_at


def test_activate_user_sets_status_active():
    user = make_user(status_user="Inactive")
    db = FakeDb(users=[user])

    response = user_service.update_user_status(db, user.user_id, "Active")

    assert response.status_user == "Active"
    assert user.status_user == "Active"


def test_deactivate_user_sets_status_inactive():
    user = make_user(status_user="Active")
    db = FakeDb(users=[user])

    response = user_service.update_user_status(db, user.user_id, "Inactive")

    assert response.status_user == "Inactive"
    assert user.status_user == "Inactive"


def test_lock_user_sets_status_and_locked_until(monkeypatch):
    monkeypatch.setattr(user_service, "ACCOUNT_LOCK_MINUTES", 15)
    user = make_user(status_user="Active", locked_until=None)
    db = FakeDb(users=[user])
    before = vietnam_now()

    response = user_service.update_user_lock_status(db, user.user_id, True)

    after = vietnam_now()
    assert response.status_user == "Locked"
    assert user.status_user == "Locked"
    assert user.locked_until is not None
    assert before + timedelta(minutes=15) <= user.locked_until <= after + timedelta(minutes=15)


def test_unlock_user_sets_active_resets_attempts_and_clears_lock():
    user = make_user(
        status_user="Locked",
        failed_login_attempts=5,
        locked_until=vietnam_now() + timedelta(minutes=10),
    )
    db = FakeDb(users=[user])

    response = user_service.update_user_lock_status(db, user.user_id, False)

    assert response.status_user == "Active"
    assert response.failed_login_attempts == 0
    assert response.locked_until is None
    assert user.status_user == "Active"
    assert user.failed_login_attempts == 0
    assert user.locked_until is None


def test_user_response_never_exposes_password_hash():
    user = make_user(password_hash="secret-hash")

    response = user_service._user_response(user)
    response_data = response.model_dump()

    assert "password_hash" not in response_data


def test_update_user_avatar_saves_public_media_url_to_user(monkeypatch, tmp_path):
    user = make_user(avatar_url=None)
    db = FakeDb(users=[user])
    file = SimpleNamespace(
        filename="avatar.png",
        content_type="image/png",
        file=BytesIO(b"fake image content"),
    )
    monkeypatch.setattr(user_service, "MEDIA_ROOT", tmp_path)

    avatar_url = user_service.update_user_avatar(db, user.user_id, file)

    assert avatar_url.startswith("/media/avatars/")
    assert avatar_url.endswith(".png")
    assert user.avatar_url == avatar_url
    assert db.flushes == 1
    assert (tmp_path / avatar_url.removeprefix("/media/")).exists()


def test_create_user_audit_log_stores_expected_fields():
    db = FakeDb()

    audit_log = user_repository.create_user_audit_log(
        db,
        actor_user_id="USR00000001",
        action="UPDATE_USER",
        entity_id="USR00000002",
        payload={"status": "Active"},
        ip_address="127.0.0.1",
    )

    assert audit_log in db.added
    assert audit_log.user_id == "USR00000001"
    assert audit_log.action == "UPDATE_USER"
    assert audit_log.label_title == "user"
    assert audit_log.entity_id == "USR00000002"
    assert audit_log.payload["status"] == "Active"
    assert audit_log.payload["ip_address"] == "127.0.0.1"


@pytest.mark.parametrize(
    "action",
    [
        "VIEW_USERS",
        "VIEW_USER",
        "UPDATE_USER",
        "ACTIVATE_USER",
        "DEACTIVATE_USER",
        "LOCK_USER",
        "UNLOCK_USER",
        "UPDATE_USER_STATUS",
        "UPDATE_USER_LOCK_STATUS",
    ],
)
def test_create_user_audit_log_supports_all_user_management_actions(action):
    db = FakeDb()

    audit_log = user_repository.create_user_audit_log(
        db,
        actor_user_id="USR00000001",
        action=action,
        entity_id="USR00000002",
        payload={"test": True},
        ip_address="10.0.0.1",
    )

    assert audit_log.action == action
    assert audit_log.user_id == "USR00000001"
    assert audit_log.entity_id == "USR00000002"
    assert audit_log.payload["ip_address"] == "10.0.0.1"
