from types import SimpleNamespace

from app.api.v1 import attachments, media


def test_attachment_upload_delegates_to_media_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    upload = SimpleNamespace(filename="task-spec.pdf", content_type="application/pdf")
    calls = []

    monkeypatch.setattr(
        media.media_service,
        "upload_task_media",
        lambda received_db, task_id, **kwargs: calls.append(("upload", received_db, task_id, kwargs))
        or {
            "usage": "attachment",
            "file_name": "task-spec.pdf",
            "file_path": "attachments/TSK00000007/task-spec.pdf",
            "file_url": "/media/attachments/TSK00000007/task-spec.pdf",
            "attachment_id": "TAT00000001",
        },
    )

    assert media.upload_task_media(
        "TSK00000007",
        usage="attachment",
        file=upload,
        db=db,
        current_user=user,
    ) == {
        "usage": "attachment",
        "file_name": "task-spec.pdf",
        "file_path": "attachments/TSK00000007/task-spec.pdf",
        "file_url": "/media/attachments/TSK00000007/task-spec.pdf",
        "attachment_id": "TAT00000001",
    }

    assert calls == [
        (
            "upload",
            db,
            "TSK00000007",
            {"usage": "attachment", "file": upload, "current_user": user},
        )
    ]


def test_attachment_routes_delegate_to_service(monkeypatch):
    db = object()
    user = SimpleNamespace(user_id="USR00000003")
    upload = SimpleNamespace(filename="updated.png", content_type="image/png")
    calls = []

    monkeypatch.setattr(
        attachments.media_service,
        "list_task_attachments",
        lambda received_db, task_id, current_user, **kwargs: calls.append(
            ("list", received_db, task_id, current_user, kwargs)
        )
        or {"items": [], "total": 0, "page": kwargs["page"], "page_size": kwargs["page_size"]},
    )
    monkeypatch.setattr(
        attachments.media_service,
        "get_task_attachment",
        lambda received_db, attachment_id, current_user: calls.append(("get", received_db, attachment_id, current_user))
        or {"attachment_id": attachment_id},
    )
    monkeypatch.setattr(
        attachments.media_service,
        "delete_task_attachment",
        lambda received_db, attachment_id, current_user: calls.append(("delete", received_db, attachment_id, current_user))
        or {"attachment_id": attachment_id},
    )
    monkeypatch.setattr(
        attachments.media_service,
        "replace_task_attachment",
        lambda received_db, attachment_id, **kwargs: calls.append(("replace", received_db, attachment_id, kwargs))
        or {"attachment_id": attachment_id},
    )

    assert attachments.list_task_attachments(
        "TSK00000007",
        db,
        user,
        page=2,
        page_size=10,
        include_deleted=True,
    ) == {"items": [], "total": 0, "page": 2, "page_size": 10}
    assert attachments.get_task_attachment("TAT00000001", db, user) == {"attachment_id": "TAT00000001"}
    assert attachments.delete_task_attachment("TAT00000001", db, user) == {"attachment_id": "TAT00000001"}
    assert attachments.replace_task_attachment("TAT00000001", upload, db, user) == {"attachment_id": "TAT00000001"}

    assert calls == [
        ("list", db, "TSK00000007", user, {"page": 2, "page_size": 10, "include_deleted": True}),
        ("get", db, "TAT00000001", user),
        ("delete", db, "TAT00000001", user),
        ("replace", db, "TAT00000001", {"file": upload, "current_user": user}),
    ]
