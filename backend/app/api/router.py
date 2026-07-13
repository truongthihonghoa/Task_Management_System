from fastapi import APIRouter

from app.api.v1.spaces import router as spaces_router
from app.api.v1.sprints import router as sprints_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.attachments import router as attachments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.comments import router as comments_router
from app.api.v1.media import router as media_router
from app.api.v1.task_management import router as task_management_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(spaces_router)
api_router.include_router(sprints_router)
api_router.include_router(tasks_router)
api_router.include_router(attachments_router)
api_router.include_router(comments_router)
api_router.include_router(media_router)
api_router.include_router(task_management_router)
api_router.include_router(auth_router)
