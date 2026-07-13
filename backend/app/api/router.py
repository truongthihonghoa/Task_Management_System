from fastapi import APIRouter

from app.api.v1.spaces import router as spaces_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(spaces_router)
api_router.include_router(tasks_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
