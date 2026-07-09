from fastapi import APIRouter

from app.api.v1.spaces import router as spaces_router


api_router = APIRouter(prefix="/api/v1")
api_router.include_router(spaces_router)
