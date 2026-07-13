from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1 import auth
from app.services import auth_service
from app.repository.auth import PASSWORD_RESET
from app.schemas.pydantic_models import EmailRequest, LoginRequest, ResetPasswordRequest, VerifyResetCodeRequest


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
        "updated_at": datetime.utcnow() - timedelta(days=1),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def make_token(**overrides):
    values = {
        "email": "minhtrang@gmail.com",
        "otp_code": "483921",
        "token_type": PASSWORD_RESET,
        "expires_at": datetime.utcnow() + timedelta(minutes=15),
        "used_at": None,
        "resend_count": 0,
        "created_at": datetime.utcnow(),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def assert_http_error(exc_info, status_code, message):
    assert exc_info.value.status_code == status_code
    assert exc_info.value.detail == {"message": message}


def test_login_success_generates_tokens_saves_user_token_and_audit(monkeypatch):
    db = FakeDb()
    user = make_user(role="SUPER_ADMIN", failed_login_attempts=2, locked_until=datetime.utcnow())
    saved_tokens = []
    audit_logs = []
    token_payloads = []

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "verify_password", lambda password, password_hash: True)
    monkeypatch.setattr(
        auth_service,
        "create_access_token",
        lambda payload: (token_payloads.append(payload) or ("access-token", datetime.utcnow() + timedelta(minutes=30))),
    )
    monkeypatch.setattr(
        auth_service,
        "create_refresh_token",
        lambda payload: ("refresh-token", datetime.utcnow() + timedelta(days=7)),
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
        auth.notification_service,
        "create_super_admin_notification",
        lambda _db, **kwargs: notifications.append(kwargs),
    )

    with pytest.raises(HTTPException) as exc_info:
        auth_service.login(db, user.email, "Wrong@123")

    assert_http_error(exc_info, 401, "Invalid email or password.")
    assert user.status_user == "Locked"
    assert user.locked_until is not None
    assert notifications[0]["notification_type"] == "account_locked"
    assert notifications[0]["metadata"]["user_id"] == user.user_id
    assert db.commits == 1


@pytest.mark.parametrize(
    ("user", "message"),
    [
        (make_user(status_user="Pending"), "Please verify your email first."),
        (make_user(status_user="Inactive"), "Account has been deactivated."),
        (
            make_user(status_user="Locked", locked_until=datetime.utcnow() + timedelta(minutes=10)),
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
    monkeypatch.setattr(auth_service, "generate_otp", lambda: "483921")
    monkeypatch.setattr(auth_service, "upsert_verification_token", lambda _db, **kwargs: upserts.append(kwargs))
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: None)
    monkeypatch.setattr(auth_service, "send_verification_email", lambda email, code: sent.append((email, code)))

    response = auth_service.forgot_password(db, user.email)

    assert response.message == "Verification code sent successfully."
    assert upserts[0]["token_type"] == PASSWORD_RESET
    assert upserts[0]["otp_code"] == "483921"
    assert sent == [(user.email, "483921")]
    assert db.commits == 1


def test_forgot_password_email_not_found(monkeypatch):
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: None)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.forgot_password(FakeDb(), "missing@gmail.com")

    assert_http_error(exc_info, 404, "Email does not exist.")


def test_verify_reset_code_success_marks_token_used(monkeypatch):
    db = FakeDb()
    user = make_user()
    token = make_token()

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type: token)
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: None)

    response = auth_service.verify_reset_code(db, user.email, "483921")

    assert response.verified is True
    assert token.used_at is not None
    assert db.commits == 1


@pytest.mark.parametrize(
    ("token", "code", "message"),
    [
        (make_token(otp_code="111111"), "483921", "The verification code is incorrect."),
        (make_token(expires_at=datetime.utcnow() - timedelta(minutes=1)), "483921", "The verification code has expired."),
        (make_token(used_at=datetime.utcnow()), "483921", "The verification code is no longer valid."),
    ],
)
def test_verify_reset_code_rejects_invalid_expired_or_used_codes(monkeypatch, token, code, message):
    user = make_user()

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type: token)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.verify_reset_code(FakeDb(), user.email, code)

    assert_http_error(exc_info, 400, message)


def test_resend_reset_code_replaces_code_and_sends_email(monkeypatch):
    db = FakeDb()
    user = make_user()
    token = make_token(otp_code="111111", resend_count=1, used_at=datetime.utcnow())
    sent = []

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type: token)
    monkeypatch.setattr(auth_service, "generate_otp", lambda: "222222")
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: None)
    monkeypatch.setattr(auth_service, "send_verification_email", lambda email, code: sent.append((email, code)))

    response = auth_service.resend_reset_code(db, user.email)

    assert response.message == "Verification code has been resent."
    assert token.otp_code == "222222"
    assert token.used_at is None
    assert token.resend_count == 2
    assert sent == [(user.email, "222222")]
    assert db.commits == 1


def test_reset_password_hashes_password_and_clears_lock(monkeypatch):
    db = FakeDb()
    user = make_user(status_user="Locked", failed_login_attempts=5, locked_until=datetime.utcnow())
    token = make_token(used_at=datetime.utcnow())
    audits = []
    notifications = []

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type: token)
    monkeypatch.setattr(auth_service, "hash_password", lambda password: f"hashed::{password}")
    monkeypatch.setattr(auth_service, "create_audit_log", lambda _db, **kwargs: audits.append(kwargs))
    monkeypatch.setattr(
        auth.notification_service,
        "create_super_admin_notification",
        lambda _db, **kwargs: notifications.append(kwargs),
    )

    response = auth_service.reset_password(db, user.email, "NewPassword@123")

    assert response.message == "Password reset successfully."
    assert user.password_hash == "hashed::NewPassword@123"
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert user.status_user == "Active"
    assert audits[0]["action"] == "RESET_PASSWORD"
    assert notifications[0]["notification_type"] == "user_verified"
    assert notifications[0]["metadata"]["user_id"] == user.user_id
    assert db.commits == 1


def test_reset_password_requires_verified_reset_code(monkeypatch):
    user = make_user()
    token = make_token(used_at=None)

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, email: user)
    monkeypatch.setattr(auth_service, "get_verification_token", lambda _db, email, token_type: token)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.reset_password(FakeDb(), user.email, "NewPassword@123")

    assert_http_error(exc_info, 400, "Password reset code must be verified before resetting password.")


def test_reset_password_validates_password_strength_and_match():
    with pytest.raises(ValidationError):
        ResetPasswordRequest(email="minhtrang@gmail.com", password="weak", confirm_password="weak")

    with pytest.raises(ValidationError):
        ResetPasswordRequest(
            email="minhtrang@gmail.com",
            password="Password@123",
            confirm_password="Password@124",
        )
