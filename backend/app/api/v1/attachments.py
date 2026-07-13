from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.pydantic_models import TaskAttachmentListResponse, TaskAttachmentResponse
from app.services import media_service


router = APIRouter(tags=["attachments"])


@router.get("/tasks/{task_id}/attachments", response_model=TaskAttachmentListResponse)
def list_task_attachments(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    include_deleted: bool = Query(default=False),
) -> TaskAttachmentListResponse:
    return media_service.list_task_attachments(
        db,
        task_id,
        current_user,
        page=page,
        page_size=page_size,
        include_deleted=include_deleted,
    )


@router.get("/attachments/{attachment_id}", response_model=TaskAttachmentResponse)
def get_task_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAttachmentResponse:
    return media_service.get_task_attachment(db, attachment_id, current_user)


@router.delete("/attachments/{attachment_id}", response_model=TaskAttachmentResponse)
def delete_task_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAttachmentResponse:
    return media_service.delete_task_attachment(db, attachment_id, current_user)


@router.put("/attachments/{attachment_id}", response_model=TaskAttachmentResponse)
def replace_task_attachment(
    attachment_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAttachmentResponse:
    return media_service.replace_task_attachment(
        db,
        attachment_id,
        file=file,
        current_user=current_user,
    )
