from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1 import notification_preferences as preference_api
from app.api.v1 import notifications as notification_api
from app.core.notification_constants import default_preference_values
from app.repository.notification import NotificationListResult
from app.schemas.notification import NotificationBulkIdsRequest, NotificationResponse
from app.schemas.notification_preference import (
    NotificationPreferencePatchRequest,
    NotificationPreferenceUpdateRequest,
)
from app.services.notification_preference_service import NotificationPreferenceService
from app.services.notification_service import NotificationService


class FakeResult:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return self

    def all(self):
        return self.values

    def __iter__(self):
        return iter(self.values)


class FakeDb:
    def __init__(self, values=None, execute_results=None):
        self.values = values or {}
        self.execute_results = list(execute_results or [])
        self.get_calls = []
        self.execute_calls = []
        self.commits = 0
        self.rollbacks = 0
        self.refreshed = []

    def get(self, model, item_id):
        self.get_calls.append((model.__name__, item_id))
        return self.values.get((model.__name__, item_id))

    def execute(self, statement):
        self.execute_calls.append(statement)
        return FakeResult(self.execute_results.pop(0))

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def refresh(self, value):
        self.refreshed.append(value)


def make_user(user_id="USR00000001", role="USER"):
    return SimpleNamespace(
        user_id=user_id,
        role=role,
        full_name=f"User {user_id}",
        email=f"{user_id.lower()}@example.com",
        status_user="Active",
        password_hash="secret-hash",
    )


def make_notification(**overrides):
    values = {
        "notification_id": "NTF00000001",
        "user_id": "USR00000001",
        "actor_id": "USR00000002",
        "task_id": "TSK00000001",
        "space_id": "SPC00000001",
        "type": "task_assigned",
        "title": "New task assigned",
        "message": "A task was assigned.",
        "audience": "USER",
        "metadata_": {"task_title": "Demo"},
        "is_read": False,
        "read_at": None,
        "created_at": datetime(2026, 7, 10, 8, 0, 0),
        "actor": make_user("USR00000002"),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def make_preference(**overrides):
    defaults = default_preference_values(overrides.get("scope", "USER_ACCOUNT"))
    values = {
        "preference_id": "NPF00000001",
        "user_id": "USR00000001",
        "scope": defaults["scope"],
        "email_enabled": defaults["email_enabled"],
        "email_frequency": defaults["email_frequency"],
        "email_settings": defaults["email_settings"],
        "app_settings": defaults["app_settings"],
        "created_at": datetime(2026, 7, 10, 8, 0, 0),
        "updated_at": datetime(2026, 7, 10, 8, 0, 0),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_list_notifications_uses_current_user_and_returns_unread_count(monkeypatch):
    captured = {}
    item = make_notification()

    def fake_list_notifications(_db, **kwargs):
        captured.update(kwargs)
        return NotificationListResult(items=[item], total=3, unread_count=2)

    monkeypatch.setattr(notification_api.notification_repository, "list_notifications", fake_list_notifications)

    response = notification_api.list_notifications(
        status_filter=None,
        notification_type=None,
        audience=None,
        search=None,
        task_id=None,
        space_id=None,
        page=2,
        page_size=1,
        sort_order=notification_api.SortOrder.DESC,
        db=FakeDb(),
        current_user=make_user("USR00000001"),
    )

    assert captured["user_id"] == "USR00000001"
    assert response.total == 3
    assert response.total_pages == 3
    assert response.unread_count == 2
    assert response.items[0].notification_id == item.notification_id


def test_get_notification_for_other_user_returns_404(monkeypatch):
    monkeypatch.setattr(
        notification_api.notification_repository,
        "get_notification_for_user",
        lambda _db, notification_id, user_id: None,
    )

    with pytest.raises(HTTPException) as exc_info:
        notification_api.get_notification("NTF00000099", db=FakeDb(), current_user=make_user())

    assert exc_info.value.status_code == 404


def test_notification_response_does_not_expose_actor_password_hash():
    response = NotificationResponse.model_validate(make_notification())
    actor_payload = response.model_dump()["actor"]

    assert actor_payload["user_id"] == "USR00000002"
    assert "password_hash" not in actor_payload


def test_system_notification_can_have_null_actor():
    response = NotificationResponse.model_validate(
        make_notification(
            actor=None,
            actor_id=None,
            type="system_alert",
            audience="SUPER_ADMIN",
        )
    )

    assert response.actor is None
    assert response.actor_id is None


def test_list_filters_are_forwarded_to_repository(monkeypatch):
    captured = {}

    def fake_list_notifications(_db, **kwargs):
        captured.update(kwargs)
        return NotificationListResult(items=[], total=0, unread_count=7)

    monkeypatch.setattr(notification_api.notification_repository, "list_notifications", fake_list_notifications)

    notification_api.list_notifications(
        status_filter=notification_api.NotificationReadStatus.READ,
        notification_type=notification_api.NotificationType.COMMENT_ADDED,
        audience=notification_api.NotificationAudience.OWNER,
        search="DeMo",
        task_id="TSK00000001",
        space_id="SPC00000001",
        page=1,
        page_size=20,
        sort_order=notification_api.SortOrder.ASC,
        db=FakeDb(),
        current_user=make_user(),
    )

    assert captured["read_status"] == "read"
    assert captured["notification_type"] == "comment_added"
    assert captured["audience"] == "OWNER"
    assert captured["search"] == "DeMo"
    assert captured["task_id"] == "TSK00000001"
    assert captured["space_id"] == "SPC00000001"
    assert captured["sort_order"] == "asc"


def test_openapi_documents_page_size_limit_and_no_create_notification_endpoint():
    schema = notification_api.router.routes[0].body_field
    openapi = __import__("app.main", fromlist=["app"]).app.openapi()
    notifications_path = openapi["paths"]["/api/v1/notifications"]
    page_size_param = next(
        param
        for param in notifications_path["get"]["parameters"]
        if param["name"] == "page_size"
    )

    assert schema is None
    assert "post" not in notifications_path
    assert page_size_param["schema"]["maximum"] == 100


def test_mark_read_is_idempotent_and_commits(monkeypatch):
    db = FakeDb()
    notification = make_notification(is_read=True, read_at=datetime.utcnow())
    monkeypatch.setattr(notification_api.notification_service, "mark_read", lambda _db, user_id, notification_id: notification)

    response = notification_api.mark_notification_read("NTF00000001", db=db, current_user=make_user())

    assert response.notification_id == "NTF00000001"
    assert db.commits == 1


def test_mark_unread_clears_read_state(monkeypatch):
    db = FakeDb()
    notification = make_notification(is_read=False, read_at=None)
    monkeypatch.setattr(notification_api.notification_service, "mark_unread", lambda _db, user_id, notification_id: notification)

    response = notification_api.mark_notification_unread("NTF00000001", db=db, current_user=make_user())

    assert response.is_read is False
    assert response.read_at is None
    assert db.commits == 1


def test_mark_all_read_updates_only_current_user(monkeypatch):
    captured = {}

    def fake_mark_all_read(_db, **kwargs):
        captured.update(kwargs)
        return 4

    monkeypatch.setattr(notification_api.notification_repository, "mark_all_read", fake_mark_all_read)

    response = notification_api.mark_all_read(db=FakeDb(), current_user=make_user("USR00000077"))

    assert captured["user_id"] == "USR00000077"
    assert response.updated_count == 4


def test_bulk_ids_deduplicate_and_empty_request_rejected():
    payload = NotificationBulkIdsRequest(notification_ids=["NTF00000001", "NTF00000001", "NTF00000002"])

    assert payload.notification_ids == ["NTF00000001", "NTF00000002"]
    with pytest.raises(ValidationError):
        NotificationBulkIdsRequest(notification_ids=[])


def test_bulk_ids_have_maximum_size():
    with pytest.raises(ValidationError):
        NotificationBulkIdsRequest(notification_ids=[f"NTF{i:08d}" for i in range(101)])


def test_bulk_mark_read_uses_current_user_and_deduped_ids(monkeypatch):
    captured = {}

    def fake_bulk_mark_read(_db, **kwargs):
        captured.update(kwargs)
        return 2

    monkeypatch.setattr(notification_api.notification_repository, "bulk_mark_read", fake_bulk_mark_read)

    response = notification_api.bulk_mark_read(
        NotificationBulkIdsRequest(notification_ids=["NTF00000001", "NTF00000001"]),
        db=FakeDb(),
        current_user=make_user("USR00000001"),
    )

    assert response.updated_count == 2
    assert captured["user_id"] == "USR00000001"
    assert captured["notification_ids"] == ["NTF00000001"]


def test_delete_single_returns_204_and_other_user_returns_404(monkeypatch):
    monkeypatch.setattr(notification_api.notification_repository, "delete_notification_for_user", lambda _db, **kwargs: True)
    response = notification_api.delete_notification("NTF00000001", db=FakeDb(), current_user=make_user())
    assert response.status_code == 204

    monkeypatch.setattr(notification_api.notification_repository, "delete_notification_for_user", lambda _db, **kwargs: False)
    with pytest.raises(HTTPException) as exc_info:
        notification_api.delete_notification("NTF00000002", db=FakeDb(), current_user=make_user())
    assert exc_info.value.status_code == 404


def test_delete_read_and_bulk_delete_use_current_user(monkeypatch):
    captured_read = {}
    captured_bulk = {}
    monkeypatch.setattr(
        notification_api.notification_repository,
        "delete_read_notifications",
        lambda _db, **kwargs: captured_read.update(kwargs) or 3,
    )
    monkeypatch.setattr(
        notification_api.notification_repository,
        "bulk_delete_notifications",
        lambda _db, **kwargs: captured_bulk.update(kwargs) or 2,
    )

    read_response = notification_api.delete_read_notifications(db=FakeDb(), current_user=make_user("USR00000008"))
    bulk_response = notification_api.bulk_delete_notifications(
        NotificationBulkIdsRequest(notification_ids=["NTF00000001"]),
        db=FakeDb(),
        current_user=make_user("USR00000008"),
    )

    assert read_response.deleted_count == 3
    assert bulk_response.deleted_count == 2
    assert captured_read["user_id"] == "USR00000008"
    assert captured_bulk["user_id"] == "USR00000008"


def test_preference_scopes_for_user_owner_and_super_admin():
    service = NotificationPreferenceService()

    assert service.allowed_scopes_for_user(make_user(role="USER")) == ["USER_ACCOUNT"]
    assert service.allowed_scopes_for_user(make_user(role="OWNER")) == ["USER_ACCOUNT"]
    assert service.allowed_scopes_for_user(make_user(role="SUPER_ADMIN")) == ["USER_ACCOUNT", "SUPER_ADMIN"]


def test_non_super_admin_cannot_access_super_admin_scope():
    service = NotificationPreferenceService()

    with pytest.raises(HTTPException) as exc_info:
        service.ensure_scope_access(make_user(role="OWNER"), "SUPER_ADMIN")

    assert exc_info.value.status_code == 403


def test_get_preferences_auto_creates_defaults_without_duplicates(monkeypatch):
    service = NotificationPreferenceService()
    existing = make_preference()
    created = []
    calls = []

    monkeypatch.setattr(
        "app.services.notification_preference_service.preference_repository.get_preference",
        lambda _db, user_id, scope: calls.append((user_id, scope)) or existing,
    )
    monkeypatch.setattr(
        "app.services.notification_preference_service.preference_repository.create_preference",
        lambda _db, **kwargs: created.append(kwargs),
    )

    preferences = service.get_preferences_for_user(FakeDb(), user=make_user())

    assert preferences == [existing]
    assert calls == [("USR00000001", "USER_ACCOUNT")]
    assert created == []


def test_super_admin_gets_super_admin_preference(monkeypatch):
    service = NotificationPreferenceService()
    preferences = {
        "USER_ACCOUNT": make_preference(scope="USER_ACCOUNT"),
        "SUPER_ADMIN": make_preference(scope="SUPER_ADMIN"),
    }
    monkeypatch.setattr(
        "app.services.notification_preference_service.preference_repository.get_preference",
        lambda _db, user_id, scope: preferences[scope],
    )

    response = service.get_preferences_for_user(FakeDb(), user=make_user(role="SUPER_ADMIN"))

    assert [item.scope for item in response] == ["USER_ACCOUNT", "SUPER_ADMIN"]


def test_preference_put_patch_and_reset(monkeypatch):
    service = NotificationPreferenceService()
    preference = make_preference(app_settings={"task_assigned": True, "comment_added": True})
    updates = []
    monkeypatch.setattr(service, "ensure_preference", lambda _db, user_id, scope: preference)
    monkeypatch.setattr(
        "app.services.notification_preference_service.preference_repository.update_preference",
        lambda _db, pref, **kwargs: updates.append(kwargs) or pref,
    )

    service.update_preference(
        FakeDb(),
        user=make_user(),
        scope="USER_ACCOUNT",
        payload=NotificationPreferenceUpdateRequest(
            email_enabled=False,
            email_frequency="DAILY_DIGEST",
            email_settings={"task_assigned": True},
            app_settings={"task_assigned": False},
        ),
    )
    service.patch_preference(
        FakeDb(),
        user=make_user(),
        scope="USER_ACCOUNT",
        payload=NotificationPreferencePatchRequest(app_settings={"comment_added": False}),
    )
    service.reset_preference(FakeDb(), user=make_user(), scope="USER_ACCOUNT")

    assert updates[0]["email_enabled"] is False
    assert updates[0]["email_frequency"] == "DAILY_DIGEST"
    assert updates[1]["app_settings"] == {"task_assigned": True, "comment_added": False}
    assert updates[2]["app_settings"]["owner_space_update"] is True


def test_preference_validation_rejects_bad_frequency_settings_shape_value_and_scope_key():
    service = NotificationPreferenceService()

    with pytest.raises(ValidationError):
        NotificationPreferenceUpdateRequest(
            email_enabled=True,
            email_frequency="SOMETIMES",
            email_settings={"task_assigned": True},
            app_settings={"task_assigned": True},
        )
    with pytest.raises(ValidationError):
        NotificationPreferenceUpdateRequest(
            email_enabled=True,
            email_frequency="INSTANT",
            email_settings=["task_assigned"],
            app_settings={"task_assigned": True},
        )
    with pytest.raises(ValidationError):
        NotificationPreferenceUpdateRequest(
            email_enabled=True,
            email_frequency="INSTANT",
            email_settings={"task_assigned": "yes"},
            app_settings={"task_assigned": True},
        )
    with pytest.raises(HTTPException) as exc_info:
        service.validate_settings("USER_ACCOUNT", {"account_locked": True})

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["invalid_keys"] == ["account_locked"]


def test_owner_can_enable_owner_space_update_without_owning_a_space(monkeypatch):
    service = NotificationPreferenceService()
    preference = make_preference()
    monkeypatch.setattr(service, "ensure_preference", lambda _db, user_id, scope: preference)
    monkeypatch.setattr(
        "app.services.notification_preference_service.preference_repository.update_preference",
        lambda _db, pref, **kwargs: SimpleNamespace(**kwargs),
    )

    response = service.update_preference(
        FakeDb(),
        user=make_user(role="OWNER"),
        scope="USER_ACCOUNT",
        payload=NotificationPreferenceUpdateRequest(
            email_enabled=True,
            email_frequency="INSTANT",
            email_settings={"owner_space_update": True},
            app_settings={"owner_space_update": True},
        ),
    )

    assert response.app_settings == {"owner_space_update": True}


def test_preference_api_never_accepts_user_id_from_client():
    openapi = __import__("app.main", fromlist=["app"]).app.openapi()
    request_ref = openapi["paths"]["/api/v1/notification-preferences/{scope}"]["put"]["requestBody"]["content"][
        "application/json"
    ]["schema"]["$ref"]
    schema_name = request_ref.rsplit("/", 1)[-1]

    assert "user_id" not in openapi["components"]["schemas"][schema_name]["properties"]


def test_notification_service_skips_self_notification_before_db_lookup():
    service = NotificationService()
    db = FakeDb()

    notification = service.create_notification(
        db,
        user_id="USR00000001",
        actor_id="USR00000001",
        notification_type="task_assigned",
        title="Task assigned",
        message="You assigned yourself.",
    )

    assert notification is None
    assert db.get_calls == []


def test_notification_service_allows_self_notification_when_flag_is_true(monkeypatch):
    service = NotificationService()
    db = FakeDb({("User", "USR00000001"): make_user("USR00000001")})
    created = []
    monkeypatch.setattr(
        "app.services.notification_service.preference_repository.get_preference",
        lambda _db, user_id, scope: make_preference(app_settings={}),
    )
    monkeypatch.setattr(
        "app.services.notification_service.notification_repository.create_notification",
        lambda _db, **kwargs: created.append(kwargs) or SimpleNamespace(**kwargs),
    )

    notification = service.create_notification(
        db,
        user_id="USR00000001",
        actor_id="USR00000001",
        notification_type="task_assigned",
        title="Task assigned",
        message="Self notification allowed.",
        allow_self_notification=True,
    )

    assert notification is not None
    assert created[0]["user_id"] == "USR00000001"


def test_notification_service_skips_when_app_setting_disabled(monkeypatch):
    service = NotificationService()
    db = FakeDb(
        {
            ("User", "USR00000001"): make_user("USR00000001"),
            ("User", "USR00000002"): make_user("USR00000002"),
            ("Task", "TSK00000001"): SimpleNamespace(task_id="TSK00000001"),
            ("Space", "SPC00000001"): SimpleNamespace(space_id="SPC00000001", owner_id="USR00000002"),
        }
    )
    created = []

    monkeypatch.setattr(
        "app.services.notification_service.preference_repository.get_preference",
        lambda _db, user_id, scope: make_preference(app_settings={"task_assigned": False}),
    )
    monkeypatch.setattr(
        "app.services.notification_service.notification_repository.create_notification",
        lambda _db, **kwargs: created.append(kwargs),
    )

    notification = service.create_notification(
        db,
        user_id="USR00000001",
        actor_id="USR00000002",
        task_id="TSK00000001",
        space_id="SPC00000001",
        notification_type="task_assigned",
        title="Task assigned",
        message="A task was assigned.",
    )

    assert notification is None
    assert created == []


def test_notification_service_creates_when_setting_key_missing_and_default_true(monkeypatch):
    service = NotificationService()
    db = FakeDb(
        {
            ("User", "USR00000001"): make_user("USR00000001"),
            ("User", "USR00000002"): make_user("USR00000002"),
        }
    )
    monkeypatch.setattr(
        "app.services.notification_service.preference_repository.get_preference",
        lambda _db, user_id, scope: make_preference(app_settings={}),
    )
    monkeypatch.setattr(
        "app.services.notification_service.notification_repository.create_notification",
        lambda _db, **kwargs: SimpleNamespace(**kwargs),
    )

    notification = service.create_notification(
        db,
        user_id="USR00000001",
        actor_id="USR00000002",
        notification_type="task_assigned",
        title="Task assigned",
        message="A task was assigned.",
    )

    assert notification is not None


def test_owner_space_update_requires_recipient_to_own_space(monkeypatch):
    service = NotificationService()
    db = FakeDb(
        {
            ("User", "USR00000001"): make_user("USR00000001"),
            ("User", "USR00000002"): make_user("USR00000002"),
            ("Space", "SPC00000001"): SimpleNamespace(space_id="SPC00000001", owner_id="USR00000003"),
        }
    )
    monkeypatch.setattr(
        "app.services.notification_service.preference_repository.get_preference",
        lambda _db, user_id, scope: make_preference(app_settings={"owner_space_update": True}),
    )

    notification = service.create_notification(
        db,
        user_id="USR00000001",
        actor_id="USR00000002",
        space_id="SPC00000001",
        notification_type="owner_space_update",
        title="Space update",
        message="Important settings changed.",
        audience="OWNER",
    )

    assert notification is None


def test_owner_space_update_creates_for_owner_and_skips_missing_space_id(monkeypatch):
    service = NotificationService()
    db = FakeDb(
        {
            ("User", "USR00000001"): make_user("USR00000001"),
            ("User", "USR00000002"): make_user("USR00000002"),
            ("Space", "SPC00000001"): SimpleNamespace(space_id="SPC00000001", owner_id="USR00000001"),
        }
    )
    monkeypatch.setattr(
        "app.services.notification_service.preference_repository.get_preference",
        lambda _db, user_id, scope: make_preference(app_settings={"owner_space_update": True}),
    )
    monkeypatch.setattr(
        "app.services.notification_service.notification_repository.create_notification",
        lambda _db, **kwargs: SimpleNamespace(**kwargs),
    )

    created = service.create_notification(
        db,
        user_id="USR00000001",
        actor_id="USR00000002",
        space_id="SPC00000001",
        notification_type="owner_space_update",
        title="Space update",
        message="Important settings changed.",
        audience="USER",
    )
    skipped = service.create_notification(
        db,
        user_id="USR00000001",
        actor_id="USR00000002",
        notification_type="owner_space_update",
        title="Space update",
        message="Important settings changed.",
    )

    assert created is not None
    assert created.audience == "OWNER"
    assert skipped is None


def test_system_notification_with_null_actor_requires_super_admin_recipient(monkeypatch):
    service = NotificationService()
    db = FakeDb({("User", "USR00000001"): make_user("USR00000001", role="SUPER_ADMIN")})
    monkeypatch.setattr(
        "app.services.notification_service.preference_repository.get_preference",
        lambda _db, user_id, scope: make_preference(scope="SUPER_ADMIN", app_settings={}),
    )
    monkeypatch.setattr(
        "app.services.notification_service.notification_repository.create_notification",
        lambda _db, **kwargs: SimpleNamespace(**kwargs),
    )

    notification = service.create_notification(
        db,
        user_id="USR00000001",
        actor_id=None,
        notification_type="system_alert",
        title="System alert",
        message="Maintenance.",
    )

    assert notification is not None
    assert notification.actor_id is None
    assert notification.audience == "SUPER_ADMIN"


def test_notification_service_skips_missing_recipient_task_and_space(monkeypatch):
    service = NotificationService()
    monkeypatch.setattr(
        "app.services.notification_service.preference_repository.get_preference",
        lambda _db, user_id, scope: make_preference(app_settings={}),
    )

    assert service.create_notification(
        FakeDb(),
        user_id="USR404",
        notification_type="task_assigned",
        title="Missing user",
        message="Missing user",
    ) is None
    assert service.create_notification(
        FakeDb({("User", "USR00000001"): make_user("USR00000001")}),
        user_id="USR00000001",
        task_id="TSK404",
        notification_type="task_assigned",
        title="Missing task",
        message="Missing task",
    ) is None
    assert service.create_notification(
        FakeDb({("User", "USR00000001"): make_user("USR00000001")}),
        user_id="USR00000001",
        space_id="SPC404",
        notification_type="space_updated",
        title="Missing space",
        message="Missing space",
    ) is None


def test_notification_service_validates_type_and_audience():
    service = NotificationService()

    with pytest.raises(ValueError):
        service.create_notification(
            FakeDb(),
            user_id="USR00000001",
            notification_type="bad_type",
            title="Bad",
            message="Bad",
        )
    with pytest.raises(ValueError):
        service.create_notification(
            FakeDb(),
            user_id="USR00000001",
            notification_type="task_assigned",
            title="Bad",
            message="Bad",
            audience="EVERYONE",
        )


def test_bulk_create_deduplicates_skips_self_and_avoids_repeated_lookup(monkeypatch):
    service = NotificationService()
    actor = make_user("USR00000002")
    recipients = [make_user("USR00000001"), actor, make_user("USR00000003")]
    preferences = [
        make_preference(user_id="USR00000001", app_settings={}),
        make_preference(user_id="USR00000003", app_settings={}),
    ]
    db = FakeDb(
        {
            ("User", "USR00000002"): actor,
            ("Task", "TSK00000001"): SimpleNamespace(task_id="TSK00000001"),
            ("Space", "SPC00000001"): SimpleNamespace(space_id="SPC00000001", owner_id="USR00000001"),
        },
        execute_results=[recipients, preferences],
    )
    created = []
    monkeypatch.setattr(
        "app.services.notification_service.notification_repository.create_notification",
        lambda _db, **kwargs: created.append(kwargs) or SimpleNamespace(**kwargs),
    )

    notifications = service.create_notifications_for_users(
        db,
        user_ids=["USR00000001", "USR00000002", "USR00000001", "USR00000003"],
        actor_id="USR00000002",
        task_id="TSK00000001",
        space_id="SPC00000001",
        notification_type="task_assigned",
        title="Task assigned",
        message="A task was assigned.",
    )

    assert [item.user_id for item in notifications] == ["USR00000001", "USR00000003"]
    assert [item["user_id"] for item in created] == ["USR00000001", "USR00000003"]
    assert db.get_calls == [
        ("User", "USR00000002"),
        ("Task", "TSK00000001"),
        ("Space", "SPC00000001"),
    ]
    assert len(db.execute_calls) == 2
