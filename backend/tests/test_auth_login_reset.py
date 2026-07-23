from datetime import datetime, timedelta
from app.core.timezone import vietnam_now
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1 import auth as auth_api
from app.services import auth_service
from app.repository.auth import PASSWORD_RESET
from app.schemas.pydantic_models import EmailRequest, LoginRequest, RegisterRequest, ResetPasswordRequest

RESET_TOKEN = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJ0eXBlIjoicGFzc3dvcmRfcmVzZXQiLCJ1c2VyX2lkIjoiVVNSMDAwMDAwMDIiLCJlbWFpbCI6Im1pbmh0cmFuZ0BnbWFpbC5jb20ifQ."
    "signature"
)


class FakeDb:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0
        self.refreshed = []

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def refresh(self, value):
        self.refreshed.append(value)


def make_user(**overrides):
    values = {
        "user_id": "USR00000002",
        "full_name": "Nguyen Minh Trang",
        "email": "minhtrang@gmail.com",
        "password_hash": "hashed-password",
        "status_user": "Active",
        "role": "USER",
        "failed_login_attempts": 0,
        "locked_until": None,
        "last_login": None,
        "updated_at": vietnam_now() - timedelta(days=1),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def make_token(**overrides):
    values = {
        "email": "minhtrang@gmail.com",
        "otp_code": RESET_TOKEN,
        "token_type": PASSWORD_RESET,
        "expires_at": vietnam_now() + timedelta(minutes=15),
        "used_at": None,
        "resend_count": 0,
        "created_at": vietnam_now(),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def assert_http_error(exc_info, status_code, message):
    assert exc_info.value.status_code == status_code
    assert exc_info.value.detail == {"message": message}


def patch_valid_reset_jwt(monkeypatch, user):
    monkeypatch.setattr(
        auth_service,
        "decode_password_reset_token",
        lambda token: {
            "type": "password_reset",
            "user_id": user.user_id,
            "email": user.email,
        },
    )


def test_login_success_generates_tokens_saves_user_token_and_audit(monkeypatch):
    db = FakeDb()
    user = make_user(role="SUPER_ADMIN", failed_login_attempts=2, locked_until=vietnam_now())
    saved_tokens = []
    audit_logs = []
    token_payloads = []

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "verify_password", lambda password, password_hash: True)
    monkeypatch.setattr(
        auth_service,
        "create_access_token",
        lambda payload: (token_payloads.append(payload) or ("access-token", vietnam_now() + timedelta(minutes=30))),
    )
    monkeypatch.setattr(
        auth_service,
        "create_refresh_token",
        lambda payload: ("refresh-token", vietnam_now() + timedelta(days=7)),
    )
    monkeypatch.setattr(auth_service, "create_user_token", lambda _db, **kwargs: saved_tokens.append(kwargs))
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: audit_logs.append(kwargs))

    response = auth_service.login(
        db,
        "minhtrang@gmail.com",
        "Password@123",
    )

    assert response.access_token == "access-token"
    assert response.refresh_token == "refresh-token"
    assert response.token_type == "Bearer"
    assert response.user.user_id == "USR00000002"
    assert response.user.role == "SUPER_ADMIN"
    assert token_payloads == [{"user_id": user.user_id, "email": user.email, "role": "SUPER_ADMIN"}]
    assert saved_tokens[0]["user_id"] == user.user_id
    assert audit_logs[0]["action"] == "LOGIN"
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert user.last_login is not None
    assert db.commits == 1


def test_login_email_not_found(monkeypatch):
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: None)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.login(FakeDb(), "missing@gmail.com", "Password@123")

    assert_http_error(exc_info, 404, "Email does not exist.")


def test_login_wrong_password_increments_failed_attempts(monkeypatch):
    db = FakeDb()
    user = make_user(failed_login_attempts=1)

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "verify_password", lambda password, password_hash: False)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.login(db, user.email, "Wrong@123")

    assert_http_error(exc_info, 401, "Invalid email or password.")
    assert user.failed_login_attempts == 2
    assert user.status_user == "Active"
    assert db.commits == 1


def test_login_wrong_password_locks_at_max_attempts(monkeypatch):
    db = FakeDb()
    user = make_user(failed_login_attempts=auth_service.MAX_FAILED_LOGIN_ATTEMPTS - 1)
    notifications = []

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "verify_password", lambda password, password_hash: False)
    monkeypatch.setattr(
        auth_service.notification_service,
        "create_super_admin_notification",
        lambda _db, **kwargs: notifications.append(kwargs),
    )

    with pytest.raises(HTTPException) as exc_info:
        auth_service.login(db, user.email, "Wrong@123")

    assert_http_error(exc_info, 401, "Invalid email or password.")
    assert user.status_user == "Locked"
    assert user.locked_until is not None
    assert notifications[0]["notification_type"] == "account_locked"
    assert notifications[0]["metadata"]["email"] == user.email
    assert db.commits == 1


def test_register_notifies_super_admins(monkeypatch):
    db = FakeDb()
    now = datetime.utcnow()
    token = make_token(
        email="new.user@example.com",
        token_type=auth_service.EMAIL_VERIFICATION,
        expires_at=now + timedelta(minutes=15),
        used_at=now,
    )
    user = make_user(
        user_id="USR00000009",
        full_name="New User",
        email="new.user@example.com",
        role="USER",
    )
    notifications = []

    db.flush = lambda: None
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type=auth_service.EMAIL_VERIFICATION: token)
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: None)
    monkeypatch.setattr(auth_service, "hash_password", lambda password: f"hashed::{password}")
    monkeypatch.setattr(auth_service, "create_user", lambda _db, **kwargs: user)
    monkeypatch.setattr(auth_service, "_materialize_accepted_space_invitations", lambda _db, created_user, received_now: None)
    monkeypatch.setattr(auth_service, "create_access_token", lambda payload: ("access-token", now + timedelta(minutes=30)))
    monkeypatch.setattr(auth_service, "create_refresh_token", lambda payload: ("refresh-token", now + timedelta(days=7)))
    monkeypatch.setattr(auth_service, "create_user_token", lambda _db, **kwargs: None)
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: None)
    monkeypatch.setattr(
        auth_service.notification_service,
        "create_super_admin_notification",
        lambda _db, **kwargs: notifications.append(kwargs),
    )

    response = auth_service.register(
        db,
        RegisterRequest(
            email=user.email,
            full_name=user.full_name,
            password="Password@123",
            confirm_password="Password@123",
        ),
    )

    assert response.email == user.email
    assert notifications[0]["notification_type"] == "user_registered"
    assert notifications[0]["metadata"]["email"] == user.email
    assert db.commits == 1


@pytest.mark.parametrize(
    ("user", "message"),
    [
        (make_user(status_user="Pending"), "Please verify your email first."),
        (make_user(status_user="Inactive"), "Account has been deactivated."),
        (
            make_user(status_user="Locked", locked_until=vietnam_now() + timedelta(minutes=10)),
            "Account temporarily locked.",
        ),
    ],
)
def test_login_blocked_account_states(monkeypatch, user, message):
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.login(FakeDb(), user.email, "Password@123")

    assert_http_error(exc_info, 403, message)


def test_forgot_password_generates_password_reset_token_and_sends_email(monkeypatch):
    db = FakeDb()
    user = make_user()
    upserts = []
    sent = []

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    expires_at = vietnam_now() + timedelta(minutes=15)
    monkeypatch.setattr(auth_service, "create_password_reset_token", lambda payload: (RESET_TOKEN, expires_at))
    monkeypatch.setattr(auth_service, "upsert_verification_token", lambda _db, **kwargs: upserts.append(kwargs))
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: None)
    monkeypatch.setattr(auth_service, "send_password_reset_email", lambda email, code: sent.append((email, code)) or True)

    response = auth_service.forgot_password(db, user.email)

    assert response.message == "Password reset link sent successfully."
    assert upserts[0]["token_type"] == PASSWORD_RESET
    assert upserts[0]["otp_code"] == RESET_TOKEN
    assert upserts[0]["expires_at"] == expires_at
    assert sent == [(user.email, RESET_TOKEN)]
    assert db.commits == 1


def test_forgot_password_email_not_found(monkeypatch):
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: None)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.forgot_password(FakeDb(), "missing@gmail.com")

    assert_http_error(exc_info, 404, "Email does not exist.")


def test_upload_register_avatar_uses_current_user_and_returns_avatar_url(monkeypatch):
    db = FakeDb()
    current_user = make_user()
    uploaded = []
    audit_logs = []

    monkeypatch.setattr(
        auth_api.user_service,
        "update_user_avatar",
        lambda _db, user_id, file: uploaded.append((user_id, file)) or "/media/avatar/new-avatar.png",
    )
    monkeypatch.setattr(auth_api, "create_audit_log", lambda _db, **kwargs: audit_logs.append(kwargs))

    file = SimpleNamespace(filename="avatar.png", content_type="image/png")
    response = auth_api.upload_register_avatar(
        request=SimpleNamespace(),
        file=file,
        db=db,
        current_user=current_user,
    )

    assert response.message == "Registration avatar uploaded successfully."
    assert response.avatar_url == "/media/avatar/new-avatar.png"
    assert uploaded == [(current_user.user_id, file)]
    assert audit_logs[0]["action"] == "UPLOAD_REGISTER_AVATAR"
    assert audit_logs[0]["entity_id"] == current_user.user_id
    assert db.commits == 1


def test_resend_reset_code_replaces_code_and_sends_email(monkeypatch):
    db = FakeDb()
    user = make_user()
    token = make_token(otp_code="old.reset.token", resend_count=1, used_at=vietnam_now())
    sent = []
    expires_at = vietnam_now() + timedelta(minutes=15)

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type: token)
    monkeypatch.setattr(auth_service, "create_password_reset_token", lambda payload: (RESET_TOKEN, expires_at))
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: None)
    monkeypatch.setattr(auth_service, "send_password_reset_email", lambda email, code: sent.append((email, code)) or True)

    response = auth_service.resend_reset_code(db, user.email)

    assert response.message == "Password reset link has been resent."
    assert token.otp_code == RESET_TOKEN
    assert token.expires_at == expires_at
    assert token.used_at is None
    assert token.resend_count == 2
    assert sent == [(user.email, RESET_TOKEN)]
    assert db.commits == 1


def test_reset_password_hashes_password_and_clears_lock(monkeypatch):
    db = FakeDb()
    user = make_user(status_user="Locked", failed_login_attempts=5, locked_until=vietnam_now())
    token = make_token(used_at=None)
    audits = []
    revoked = []

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type: token)
    patch_valid_reset_jwt(monkeypatch, user)
    monkeypatch.setattr(auth_service, "hash_password", lambda password: f"hashed::{password}")
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: audits.append(kwargs))
    monkeypatch.setattr(auth_service, "revoke_all_user_tokens", lambda _db, user_id: revoked.append(user_id))

    response = auth_service.reset_password(db, user.email, token.otp_code, "NewPassword@123")

    assert response.message == "Password reset successfully."
    assert user.password_hash == "hashed::NewPassword@123"
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert user.status_user == "Active"
    assert token.used_at is not None
    assert revoked == [user.user_id]
    assert audits[0]["action"] == "RESET_PASSWORD"
    assert db.commits == 1


def test_reset_password_rejects_used_reset_link(monkeypatch):
    user = make_user()
    token = make_token(used_at=vietnam_now())

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type: token)
    patch_valid_reset_jwt(monkeypatch, user)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.reset_password(FakeDb(), user.email, token.otp_code, "NewPassword@123")

    assert_http_error(exc_info, 400, "The password reset link is no longer valid.")


def test_reset_password_validates_password_strength_and_match():
    with pytest.raises(ValidationError):
        ResetPasswordRequest(
            email="minhtrang@gmail.com",
            token=RESET_TOKEN,
            password="weak",
            confirm_password="weak",
        )

    with pytest.raises(ValidationError):
        ResetPasswordRequest(
            email="minhtrang@gmail.com",
            token=RESET_TOKEN,
            password="Password@123",
            confirm_password="Password@124",
        )

    with pytest.raises(ValidationError):
        ResetPasswordRequest(
            email="minhtrang@gmail.com",
            token="not-a-jwt-reset-token",
            password="Password@123",
            confirm_password="Password@123",
        )


def test_logout_revokes_refresh_token_for_current_access_token(monkeypatch):
    db = FakeDb()
    user = make_user()
    calls = []

    monkeypatch.setattr(
        auth_service,
        "revoke_refresh_token_for_access_token",
        lambda received_db, access_token: calls.append(("revoke_refresh", received_db, access_token)),
    )
    monkeypatch.setattr(
        auth_service,
        "create_audit_log",
        lambda received_db, **kwargs: calls.append(("audit", received_db, kwargs)),
    )

    response = auth_service.logout(db, user, "access-token")

    assert response.message == "Successfully logged out."
    assert calls == [
        ("revoke_refresh", db, "access-token"),
        (
            "audit",
            db,
            {
                "user_id": user.user_id,
                "action": "LOGOUT",
                "label_title": "Logout user",
                "entity_id": user.user_id,
            },
        ),
    ]
    assert db.commits == 1
    assert db.rollbacks == 0
