from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.pydantic_models import MediaUploadResponse, MediaUsage
from app.services import media_service


router = APIRouter(tags=["media"])


@router.post(
    "/tasks/{task_id}/media",
    response_model=MediaUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_task_media(
    task_id: str,
    usage: MediaUsage = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MediaUploadResponse:
    return media_service.upload_task_media(
        db,
        task_id,
        usage=usage,
        file=file,
        current_user=current_user,
    )
