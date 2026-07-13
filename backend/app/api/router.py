from fastapi import APIRouter

from app.api.v1.notification_preferences import router as notification_preferences_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.main_layout import router as main_layout_router
from app.api.v1.search import router as search_router
from app.api.v1.spaces import router as spaces_router
from app.api.v1.sprints import router as sprints_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.auth import router as auth_router
from app.api.v1.task_management import router as task_management_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(spaces_router)
api_router.include_router(sprints_router)
api_router.include_router(tasks_router)
api_router.include_router(task_management_router)
api_router.include_router(auth_router)
api_router.include_router(main_layout_router)
api_router.include_router(search_router)
api_router.include_router(notifications_router)
api_router.include_router(notification_preferences_router)
