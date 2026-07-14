from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.api.v1 import comments
from app.schemas.pydantic_models import TaskCommentCreate, TaskCommentUpdate


def test_comment_payloads_trim_and_validate_content():
    create_payload = TaskCommentCreate(comment="  Need to clarify acceptance criteria.  ")
    update_payload = TaskCommentUpdate(comment="  Updated comment  ")

    assert create_payload.comment == "Need to clarify acceptance criteria."
    assert update_payload.comment == "Updated comment"

    with pytest.raises(ValidationError):
        TaskCommentCreate(comment="   ")

    with pytest.raises(ValidationError):
        TaskCommentUpdate(comment="   ")


def test_comment_list_and_create_delegate_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    payload = TaskCommentCreate(comment="Need to clarify acceptance criteria.")
    calls = []

    monkeypatch.setattr(
        comments.comment_service,
        "list_task_comments",
        lambda received_db, task_id, current_user, **kwargs: calls.append(
            ("list", received_db, task_id, current_user, kwargs)
        )
        or {"items": [], "total": 0},
    )
    monkeypatch.setattr(
        comments.comment_service,
        "create_task_comment",
        lambda received_db, task_id, received_payload, current_user: calls.append(
            ("create", received_db, task_id, received_payload, current_user)
        )
        or {"comment_id": "TCM00000001"},
    )

    assert comments.list_task_comments(
        "TSK00000007",
        page=2,
        page_size=10,
        include_deleted=True,
        db=db,
        current_user=user,
    ) == {"items": [], "total": 0}
    assert comments.create_task_comment("TSK00000007", payload, db, user) == {"comment_id": "TCM00000001"}

    assert calls == [
        (
            "list",
            db,
            "TSK00000007",
            user,
            {"page": 2, "page_size": 10, "include_deleted": True},
        ),
        ("create", db, "TSK00000007", payload, user),
    ]


def test_comment_detail_update_delete_delegate_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    payload = TaskCommentUpdate(comment="Updated comment")
    calls = []

    monkeypatch.setattr(
        comments.comment_service,
        "get_task_comment",
        lambda received_db, comment_id, current_user: calls.append(("get", received_db, comment_id, current_user))
        or "get",
    )
    monkeypatch.setattr(
        comments.comment_service,
        "update_task_comment",
        lambda received_db, comment_id, received_payload, current_user: calls.append(
            ("update", received_db, comment_id, received_payload, current_user)
        )
        or "update",
    )
    monkeypatch.setattr(
        comments.comment_service,
        "delete_task_comment",
        lambda received_db, comment_id, current_user: calls.append(("delete", received_db, comment_id, current_user))
        or "delete",
    )

    assert comments.get_task_comment("TCM00000001", db, user) == "get"
    assert comments.update_task_comment("TCM00000001", payload, db, user) == "update"
    assert comments.delete_task_comment("TCM00000001", db, user) == "delete"

    assert calls == [
        ("get", db, "TCM00000001", user),
        ("update", db, "TCM00000001", payload, user),
        ("delete", db, "TCM00000001", user),
    ]
