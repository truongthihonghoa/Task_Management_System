import re
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.media import MEDIA_FOLDERS, MEDIA_ROOT, get_media_folder
from app.models.task import Task
from app.models.task_attachment import TaskAttachment
from app.models.user import User
from app.repository import media as media_repository
from app.schemas.pydantic_models import MediaUploadResponse, TaskAttachmentListResponse, TaskAttachmentResponse


MAX_UPLOAD_SIZE = 20 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024

ATTACHMENT_EXTENSIONS = {".pdf", ".zip", ".png", ".jpg", ".jpeg"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
ATTACHMENT_MIME_TYPES = {
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "image/png",
    "image/jpeg",
}
IMAGE_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
}


def _get_active_task_or_404(db: Session, task_id: str) -> Task:
    task = media_repository.get_task_with_space(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task is deleted")
    if task.space is None or task.space.deleted_at is not None or task.space.status_space == "Deleted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space is deleted")
    return task


def _ensure_task_space_active(task: Task) -> None:
    if task.space is not None and task.space.status_space == "Archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space is archived")
    if task.space is None or task.space.deleted_at is not None or task.space.status_space != "Active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space must be active")


def _is_space_owner(task: Task, user: User) -> bool:
    return task.space is not None and task.space.owner_id == user.user_id


def _is_active_space_member(db: Session, task: Task, user_id: str) -> bool:
    return media_repository.get_active_space_member(db, task.space_id, user_id) is not None


def _ensure_can_upload_media(db: Session, task: Task, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if _is_space_owner(task, current_user):
        return
    if _is_active_space_member(db, task, current_user.user_id):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")


def _ensure_can_view_deleted_attachments(task: Task, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if _is_space_owner(task, current_user):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")


def _sanitize_file_name(file_name: str) -> str:
    original_name = Path(file_name or "upload").name
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", original_name).strip("._")
    return safe_name or "upload"


def _validate_file(usage: str, file: UploadFile) -> str:
    safe_name = _sanitize_file_name(file.filename or "")
    extension = Path(safe_name).suffix.lower()
    mime_type = file.content_type

    if usage == "attachment":
        allowed_extensions = ATTACHMENT_EXTENSIONS
        allowed_mime_types = ATTACHMENT_MIME_TYPES
    else:
        allowed_extensions = IMAGE_EXTENSIONS
        allowed_mime_types = IMAGE_MIME_TYPES

    if extension not in allowed_extensions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File type is not allowed")
    if mime_type and mime_type not in allowed_mime_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File mime type is not allowed")
    return safe_name


def _public_media_url(usage: str, task_id: str, stored_name: str) -> str:
    return f"/media/{MEDIA_FOLDERS[usage]}/{task_id}/{stored_name}"


def _relative_media_path(path: Path) -> str:
    return path.relative_to(MEDIA_ROOT).as_posix()


def _get_attachment_usage(attachment: TaskAttachment) -> str:
    first_folder = Path(attachment.file_path).parts[0] if attachment.file_path else "attachments"
    for usage, folder in MEDIA_FOLDERS.items():
        if folder == first_folder:
            return usage
    return "attachment"


def _save_upload_file(file: UploadFile, target_path: Path) -> int:
    total_size = 0
    try:
        with target_path.open("wb") as output:
            while True:
                chunk = file.file.read(CHUNK_SIZE)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File size exceeds 20MB",
                    )
                output.write(chunk)
    except Exception:
        if target_path.exists():
            target_path.unlink()
        raise
    return total_size


def _create_attachment_record(
    db: Session,
    *,
    task_id: str,
    file_name: str,
    file_path: str,
    file_url: str,
    mime_type: str | None,
    file_size: int,
    uploaded_by: str,
) -> TaskAttachment:
    attachment = TaskAttachment(
        task_id=task_id,
        file_name=file_name,
        file_path=file_path,
        storage_url=file_url,
        mime_type=mime_type,
        file_size=file_size,
        uploaded_by=uploaded_by,
        uploaded_at=datetime.utcnow(),
    )
    return media_repository.create_task_attachment(db, attachment)


def _get_attachment_or_404(db: Session, attachment_id: str) -> TaskAttachment:
    attachment = media_repository.get_task_attachment(db, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return attachment


def _ensure_attachment_active(attachment: TaskAttachment) -> None:
    if attachment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attachment is deleted")


def _ensure_can_delete_attachment(attachment: TaskAttachment, current_user: User) -> None:
    if current_user.role == "SUPER_ADMIN":
        return
    if attachment.uploaded_by == current_user.user_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the attachment uploader can delete it")


def _ensure_can_replace_attachment(attachment: TaskAttachment, current_user: User) -> None:
    if attachment.uploaded_by != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the attachment uploader can replace it")


def upload_task_media(
    db: Session,
    task_id: str,
    *,
    usage: str,
    file: UploadFile,
    current_user: User,
) -> MediaUploadResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_task_space_active(task)
    _ensure_can_upload_media(db, task, current_user)

    safe_name = _validate_file(usage, file)
    stored_name = f"{uuid4().hex}_{safe_name}"
    media_folder = get_media_folder(usage, task_id)
    target_path = media_folder / stored_name
    file_size = _save_upload_file(file, target_path)

    relative_path = _relative_media_path(target_path)
    file_url = _public_media_url(usage, task_id, stored_name)
    try:
        attachment = _create_attachment_record(
            db,
            task_id=task_id,
            file_name=safe_name,
            file_path=relative_path,
            file_url=file_url,
            mime_type=file.content_type,
            file_size=file_size,
            uploaded_by=current_user.user_id,
        )
    except Exception:
        if target_path.exists():
            target_path.unlink()
        raise

    return MediaUploadResponse(
        usage=usage,
        file_name=safe_name,
        file_path=relative_path,
        file_url=file_url,
        mime_type=file.content_type,
        file_size=file_size,
        attachment_id=attachment.attachment_id,
    )


def list_task_attachments(
    db: Session,
    task_id: str,
    current_user: User,
    *,
    page: int = 1,
    page_size: int = 20,
    include_deleted: bool = False,
) -> TaskAttachmentListResponse:
    task = _get_active_task_or_404(db, task_id)
    _ensure_can_upload_media(db, task, current_user)
    if include_deleted:
        _ensure_can_view_deleted_attachments(task, current_user)
    attachments, total = media_repository.list_task_attachments(
        db,
        task_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
    )
    return TaskAttachmentListResponse(
        items=[TaskAttachmentResponse.model_validate(attachment) for attachment in attachments],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_task_attachment(db: Session, attachment_id: str, current_user: User) -> TaskAttachmentResponse:
    attachment = _get_attachment_or_404(db, attachment_id)
    task = _get_active_task_or_404(db, attachment.task_id)
    _ensure_can_upload_media(db, task, current_user)
    if attachment.deleted_at is not None:
        _ensure_can_view_deleted_attachments(task, current_user)
    return TaskAttachmentResponse.model_validate(attachment)


def delete_task_attachment(db: Session, attachment_id: str, current_user: User) -> TaskAttachmentResponse:
    attachment = _get_attachment_or_404(db, attachment_id)
    task = _get_active_task_or_404(db, attachment.task_id)
    _ensure_task_space_active(task)
    _ensure_attachment_active(attachment)
    _ensure_can_delete_attachment(attachment, current_user)

    attachment.deleted_at = datetime.utcnow()
    media_repository.save_task_attachment(db, attachment)
    return TaskAttachmentResponse.model_validate(attachment)


def replace_task_attachment(
    db: Session,
    attachment_id: str,
    *,
    file: UploadFile,
    current_user: User,
) -> TaskAttachmentResponse:
    attachment = _get_attachment_or_404(db, attachment_id)
    task = _get_active_task_or_404(db, attachment.task_id)
    _ensure_task_space_active(task)
    _ensure_attachment_active(attachment)
    _ensure_can_replace_attachment(attachment, current_user)

    usage = _get_attachment_usage(attachment)
    safe_name = _validate_file(usage, file)
    stored_name = f"{uuid4().hex}_{safe_name}"
    media_folder = get_media_folder(usage, attachment.task_id)
    target_path = media_folder / stored_name
    file_size = _save_upload_file(file, target_path)

    attachment.file_name = safe_name
    attachment.file_path = _relative_media_path(target_path)
    attachment.storage_url = _public_media_url(usage, attachment.task_id, stored_name)
    attachment.mime_type = file.content_type
    attachment.file_size = file_size
    attachment.uploaded_at = datetime.utcnow()

    try:
        media_repository.save_task_attachment(db, attachment)
    except Exception:
        if target_path.exists():
            target_path.unlink()
        raise

    return TaskAttachmentResponse.model_validate(attachment)
