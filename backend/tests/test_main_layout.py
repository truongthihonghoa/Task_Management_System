from types import SimpleNamespace
from datetime import datetime, timedelta
from app.core.timezone import vietnam_now

import pytest
from fastapi import HTTPException

from app.api.v1 import main_layout as main_layout_api
from app.core import security
from app.services import main_layout_service
from app.schemas.pydantic_models import UpdateProfileRequest


class FakeDb:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def make_user(user_id="USR00000001", role="USER", full_name="Trang Nguyen"):
    now = vietnam_now()
    return SimpleNamespace(
        user_id=user_id,
        role=role,
        full_name=full_name,
        email=f"{user_id.lower()}@example.com",
        avatar_url=None,
        status_user="Active",
        created_at=now,
        updated_at=now,
        last_login=None,
    )


def make_preference(language="en"):
    return SimpleNamespace(
        preference_id="UPR00000001",
        user_id="USR00000001",
        language=language,
        updated_at=vietnam_now(),
    )


def make_space(owner_id="USR00000001", deleted=False):
    owner = make_user(owner_id, full_name="Trang Nguyen")
    return SimpleNamespace(
        space_id="SPC00000001",
        name_space="Task Management System",
        description="Manage tasks",
        owner_id=owner_id,
        owner=owner,
        status_space="Deleted" if deleted else "Active",
        deleted_at="deleted" if deleted else None,
        created_at=datetime(2026, 7, 1, 8, 0, 0),
        updated_at=datetime(2026, 7, 2, 8, 0, 0),
    )


def test_initials_for_name():
    assert main_layout_service.initials_for_name("Trang Nguyen") == "TN"
    assert main_layout_service.initials_for_name("  Alex  Morgan  ") == "AM"
    assert main_layout_service.initials_for_name("Hoa") == "HO"


def test_openapi_keeps_only_backend_owned_main_layout_routes():
    app = __import__("app.main", fromlist=["app"]).app
    app.openapi_schema = None
    openapi = app.openapi()

    assert "/api/v1/main-layout" not in openapi["paths"]
    assert "/api/v1/main-layout/sidebar-summary" not in openapi["paths"]
    assert "/api/v1/main-layout/preferences" not in openapi["paths"]
    assert "/api/v1/main-layout/preferences/language" not in openapi["paths"]
    assert "/api/v1/main-layout/profile" not in openapi["paths"]
    assert "/api/v1/main-layout/logout" not in openapi["paths"]
    assert "/api/v1/main-layout/spaces/{space_id}/context" not in openapi["paths"]
    assert "/api/v1/me/preferences" in openapi["paths"]
    assert "/api/v1/me/preferences/language" in openapi["paths"]
    assert "/api/v1/me/profile" in openapi["paths"]
    assert "/api/v1/me/spaces/{space_id}/context" in openapi["paths"]
    assert openapi["paths"]["/api/v1/me/preferences"]["get"]["tags"] == ["current user"]


def test_get_preferences_uses_default_when_missing(monkeypatch):
    user = make_user()
    monkeypatch.setattr(main_layout_service.main_layout_repository, "get_user_preference", lambda db, user_id: None)

    response = main_layout_service.get_preferences(object(), user)

    assert response.language == "en"


def test_update_language_creates_missing_preference(monkeypatch):
    user = make_user()
    created = []

    monkeypatch.setattr(main_layout_service.main_layout_repository, "get_user_preference", lambda db, user_id: None)
    monkeypatch.setattr(
        main_layout_service.main_layout_repository,
        "create_user_preference",
        lambda db, user_id, language: created.append((user_id, language)) or make_preference(language),
    )

    response = main_layout_service.update_language(object(), user=user, language="vi")

    assert response.language == "vi"
    assert created == [(user.user_id, "vi")]


def test_update_language_updates_existing_preference(monkeypatch):
    user = make_user()
    preference = make_preference("en")

    monkeypatch.setattr(main_layout_service.main_layout_repository, "get_user_preference", lambda db, user_id: preference)

    response = main_layout_service.update_language(object(), user=user, language="vi")

    assert response.language == "vi"
    assert preference.language == "vi"


def test_update_language_rejects_unsupported_language():
    with pytest.raises(HTTPException) as exc:
        main_layout_service.update_language(object(), user=make_user(), language="fr")

    assert exc.value.status_code == 422
    assert exc.value.detail["message"] == "Unsupported language."


def test_update_language_endpoint_commits(monkeypatch):
    db = FakeDb()
    user = make_user()

    monkeypatch.setattr(
        main_layout_api.main_layout_service,
        "update_language",
        lambda received_db, user, language: make_preference(language),
    )

    response = main_layout_api.update_language(
        SimpleNamespace(language="vi"),
        db=db,
        current_user=user,
    )

    assert response.language == "vi"
    assert db.commits == 1
    assert db.rollbacks == 0


def test_main_layout_profile_get_and_update():
    user = make_user(full_name="Trang Nguyen")

    profile = main_layout_service.get_profile(user)
    assert profile.full_name == "Trang Nguyen"
    assert profile.email == user.email

    updated = main_layout_service.update_profile(
        object(),
        user=user,
        payload=UpdateProfileRequest(full_name="Trang Nguyen Updated"),
    )
    assert updated.full_name == "Trang Nguyen Updated"
    assert user.full_name == "Trang Nguyen Updated"


def test_current_user_rejects_access_token_missing_from_token_store(monkeypatch):
    user = make_user()
    access_token, _expires_at = security.create_access_token(
        {"user_id": user.user_id, "email": user.email, "role": user.role}
    )

    monkeypatch.setattr(security, "get_user_token", lambda db, token: None)

    with pytest.raises(HTTPException) as exc:
        security.get_current_user(
            credentials=SimpleNamespace(scheme="Bearer", credentials=access_token),
            db=object(),
        )

    assert exc.value.status_code == 401


def test_current_user_accepts_stored_matching_access_token(monkeypatch):
    user = make_user()
    access_token, _expires_at = security.create_access_token(
        {"user_id": user.user_id, "email": user.email, "role": user.role}
    )
    stored_token = SimpleNamespace(
        user_id=user.user_id,
        access_expires_at=vietnam_now() + timedelta(minutes=5),
    )

    monkeypatch.setattr(security, "get_user_token", lambda db, token: stored_token)
    monkeypatch.setattr(security, "get_user_by_id", lambda db, user_id: user)

    response = security.get_current_user(
        credentials=SimpleNamespace(scheme="Bearer", credentials=access_token),
        db=object(),
    )

    assert response == user


def test_current_user_rejects_refresh_token_even_when_stored(monkeypatch):
    user = make_user()
    refresh_token, _expires_at = security.create_refresh_token(
        {"user_id": user.user_id, "email": user.email, "role": user.role}
    )
    stored_token = SimpleNamespace(
        user_id=user.user_id,
        access_expires_at=vietnam_now() + timedelta(minutes=5),
    )

    monkeypatch.setattr(security, "get_user_token", lambda db, token: stored_token)

    with pytest.raises(HTTPException) as exc:
        security.get_current_user(
            credentials=SimpleNamespace(scheme="Bearer", credentials=refresh_token),
            db=object(),
        )

    assert exc.value.status_code == 401


def test_space_context_owner_member_and_non_member(monkeypatch):
    db = object()
    owner = make_user("USR00000001")
    member = make_user("USR00000002")
    outsider = make_user("USR00000003")
    space = make_space(owner_id=owner.user_id)
    recent_views = []

    monkeypatch.setattr(main_layout_service.main_layout_repository, "get_space_for_context", lambda _db, space_id: space)
    monkeypatch.setattr(
        main_layout_service.main_layout_repository,
        "get_active_space_member",
        lambda _db, space_id, user_id: SimpleNamespace(role="MEMBER") if user_id == member.user_id else None,
    )
    monkeypatch.setattr(
        main_layout_service.recent_view_repository,
        "record_recent_view",
        lambda _db, **kwargs: recent_views.append(kwargs),
    )

    owner_context = main_layout_service.get_space_context(db, space_id=space.space_id, user=owner)
    member_context = main_layout_service.get_space_context(db, space_id=space.space_id, user=member)

    assert owner_context.space_role == "OWNER"
    assert owner_context.permissions.can_manage_members is True
    assert member_context.space_role == "USER"
    assert member_context.permissions.can_create_task is True
    assert member_context.permissions.can_manage_members is False
    assert recent_views == [
        {"user_id": owner.user_id, "entity_type": "space", "entity_id": space.space_id},
        {"user_id": member.user_id, "entity_type": "space", "entity_id": space.space_id},
    ]

    with pytest.raises(HTTPException) as exc:
        main_layout_service.get_space_context(db, space_id=space.space_id, user=outsider)
    assert exc.value.status_code == 403


def test_space_context_super_admin_is_read_only_and_records_recent_view(monkeypatch):
    db = object()
    super_admin = make_user("USR00000001", role="SUPER_ADMIN", full_name="Alex Morgan")
    space = make_space(owner_id="USR00000002")
    recent_views = []

    monkeypatch.setattr(main_layout_service.main_layout_repository, "get_space_for_context", lambda _db, space_id: space)
    monkeypatch.setattr(
        main_layout_service.main_layout_repository,
        "get_active_space_member",
        lambda _db, space_id, user_id: None,
    )
    monkeypatch.setattr(
        main_layout_service.recent_view_repository,
        "record_recent_view",
        lambda _db, **kwargs: recent_views.append(kwargs),
    )

    response = main_layout_service.get_space_context(db, space_id=space.space_id, user=super_admin)

    assert response.space_role == "SUPER_ADMIN"
    assert response.permissions.can_view is True
    assert response.permissions.can_create_task is False
    assert response.permissions.can_assign_task is False
    assert response.permissions.can_manage_members is False
    assert recent_views == [{"user_id": super_admin.user_id, "entity_type": "space", "entity_id": space.space_id}]


def test_space_context_missing_or_deleted_returns_404(monkeypatch):
    user = make_user()

    monkeypatch.setattr(main_layout_service.main_layout_repository, "get_space_for_context", lambda _db, space_id: None)
    with pytest.raises(HTTPException) as missing_exc:
        main_layout_service.get_space_context(object(), space_id="SPC404", user=user)
    assert missing_exc.value.status_code == 404

    deleted_space = make_space(owner_id=user.user_id, deleted=True)
    monkeypatch.setattr(
        main_layout_service.main_layout_repository,
        "get_space_for_context",
        lambda _db, space_id: deleted_space,
    )
    with pytest.raises(HTTPException) as deleted_exc:
        main_layout_service.get_space_context(object(), space_id=deleted_space.space_id, user=user)
    assert deleted_exc.value.status_code == 404


def test_global_search_hides_users_for_regular_user(monkeypatch):
    user = make_user(role="USER")
    user_search_called = False

    monkeypatch.setattr(main_layout_service.main_layout_repository, "search_spaces", lambda *args, **kwargs: [])
    monkeypatch.setattr(main_layout_service.main_layout_repository, "search_tasks", lambda *args, **kwargs: [])

    def fake_search_users(*args, **kwargs):
        nonlocal user_search_called
        user_search_called = True
        return [make_user()]

    monkeypatch.setattr(main_layout_service.main_layout_repository, "search_users", fake_search_users)

    response = main_layout_service.global_search(
        object(),
        user=user,
        q="trang",
        types="users",
        limit_per_type=5,
    )

    assert response.users == []
    assert user_search_called is False


def test_global_search_keyword_searches_selected_types(monkeypatch):
    user = make_user(role="SUPER_ADMIN")
    space = make_space()
    task = SimpleNamespace(
        task_id="TSK00000001",
        title="Design Login Page",
        task_status="done",
        priority="HIGH",
        space_id=space.space_id,
        space=space,
        assignees=[],
    )
    calls = []

    monkeypatch.setattr(
        main_layout_service.main_layout_repository,
        "search_spaces",
        lambda db, **kwargs: calls.append(("spaces", kwargs)) or [(space, 2)],
    )
    monkeypatch.setattr(
        main_layout_service.main_layout_repository,
        "search_tasks",
        lambda db, **kwargs: calls.append(("tasks", kwargs)) or [task],
    )
    monkeypatch.setattr(
        main_layout_service.main_layout_repository,
        "search_users",
        lambda *args, **kwargs: calls.append(("users", kwargs)) or [],
    )

    response = main_layout_service.global_search(
        object(),
        user=user,
        q="design",
        types="spaces,tasks",
        limit_per_type=5,
    )

    assert response.spaces[0].space_id == space.space_id
    assert response.tasks[0].task_id == task.task_id
    assert response.tasks[0].space_id == space.space_id
    assert [name for name, _kwargs in calls] == ["spaces", "tasks"]
    assert response.users == []


def test_global_search_super_admin_user_items_include_display_context(monkeypatch):
    super_admin = make_user(role="SUPER_ADMIN", full_name="Alex Morgan")
    owner_user = make_user("USR00000002", full_name="Trang Nguyen")
    owner_user.owned_spaces = [make_space(owner_id=owner_user.user_id)]
    owner_user.space_memberships = []
    super_admin.owned_spaces = []
    super_admin.space_memberships = []

    monkeypatch.setattr(main_layout_service.main_layout_repository, "search_spaces", lambda *args, **kwargs: [])
    monkeypatch.setattr(main_layout_service.main_layout_repository, "search_tasks", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        main_layout_service.main_layout_repository,
        "search_users",
        lambda *args, **kwargs: [super_admin, owner_user],
    )

    response = main_layout_service.global_search(
        object(),
        user=super_admin,
        q="alex",
        types="users",
        limit_per_type=5,
    )

    assert response.users[0].display_role == "Super Admin"
    assert response.users[0].space_name == "System"
    assert response.users[1].display_role == "Owner"
    assert response.users[1].space_name == "Task Management System"


def test_global_search_empty_query_uses_real_recent_views(monkeypatch):
    db = object()
    user = make_user(role="SUPER_ADMIN")
    viewed_at = datetime(2026, 7, 13, 9, 0, 0)
    space = make_space()
    task = SimpleNamespace(
        task_id="TSK00000001",
        title="Infrastructure setup",
        task_status="new",
        priority="HIGH",
        space_id=space.space_id,
        space=space,
        assignees=[],
    )
    profile_user = make_user("USR00000008", full_name="Hoang Hoa")
    profile_user.owned_spaces = []
    profile_user.space_memberships = []

    monkeypatch.setattr(
        main_layout_service.recent_view_repository,
        "list_recent_spaces",
        lambda received_db, user, limit: [(space, 4, viewed_at)],
    )
    monkeypatch.setattr(
        main_layout_service.recent_view_repository,
        "list_recent_tasks",
        lambda received_db, user, limit, space_id=None: [(task, viewed_at)],
    )
    monkeypatch.setattr(
        main_layout_service.recent_view_repository,
        "list_recent_users",
        lambda received_db, user, limit: [(profile_user, viewed_at)],
    )

    response = main_layout_service.global_search(
        db,
        user=user,
        q="",
        types=None,
        limit_per_type=5,
    )

    assert response.spaces[0].space_id == space.space_id
    assert response.spaces[0].viewed_at == viewed_at.isoformat()
    assert response.tasks[0].task_id == task.task_id
    assert response.tasks[0].viewed_at == viewed_at.isoformat()
    assert response.users[0].user_id == profile_user.user_id
    assert response.users[0].viewed_at == viewed_at.isoformat()


def test_global_search_empty_query_can_skip_recent(monkeypatch):
    recent_called = False

    def fake_recent(*args, **kwargs):
        nonlocal recent_called
        recent_called = True
        return []

    monkeypatch.setattr(main_layout_service.recent_view_repository, "list_recent_spaces", fake_recent)

    response = main_layout_service.global_search(
        object(),
        user=make_user(role="SUPER_ADMIN"),
        q="",
        types=None,
        limit_per_type=5,
        include_recent=False,
    )

    assert response.spaces == []
    assert response.tasks == []
    assert response.users == []
    assert recent_called is False


def test_global_search_empty_query_hides_recent_users_for_regular_user(monkeypatch):
    user = make_user(role="USER")
    user_recent_called = False

    monkeypatch.setattr(main_layout_service.recent_view_repository, "list_recent_spaces", lambda *args, **kwargs: [])
    monkeypatch.setattr(main_layout_service.recent_view_repository, "list_recent_tasks", lambda *args, **kwargs: [])

    def fake_recent_users(*args, **kwargs):
        nonlocal user_recent_called
        user_recent_called = True
        return []

    monkeypatch.setattr(main_layout_service.recent_view_repository, "list_recent_users", fake_recent_users)

    response = main_layout_service.global_search(
        object(),
        user=user,
        q=None,
        types="users",
        limit_per_type=5,
    )

    assert response.users == []
    assert user_recent_called is False


def test_global_search_rejects_invalid_types():
    with pytest.raises(HTTPException) as exc:
        main_layout_service.global_search(
            object(),
            user=make_user(role="SUPER_ADMIN"),
            q="dashboard",
            types="spaces,invalid",
            limit_per_type=5,
        )
    assert exc.value.status_code == 422
