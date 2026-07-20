import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.media import MEDIA_ROOT, ensure_media_dirs
from app.db.session import get_db
from app.services.audit_retention_service import run_audit_retention_job
from app.services.notification_retention_service import run_notification_retention_job


async def start_scheduled_job(app: FastAPI, *, name: str, enabled_env: str, runner) -> None:
    if os.getenv(enabled_env, "true").lower() in {"0", "false", "no"}:
        return
    stop_event = asyncio.Event()
    setattr(app.state, f"{name}_stop_event", stop_event)
    setattr(app.state, f"{name}_task", asyncio.create_task(runner(stop_event)))


async def stop_scheduled_job(app: FastAPI, *, name: str) -> None:
    stop_event = getattr(app.state, f"{name}_stop_event", None)
    retention_task = getattr(app.state, f"{name}_task", None)
    if stop_event is None or retention_task is None:
        return
    stop_event.set()
    await retention_task


@asynccontextmanager
async def lifespan(app: FastAPI):
    await start_scheduled_job(
        app,
        name="notification_retention",
        enabled_env="NOTIFICATION_RETENTION_JOB_ENABLED",
        runner=run_notification_retention_job,
    )
    await start_scheduled_job(
        app,
        name="audit_retention",
        enabled_env="AUDIT_LOG_RETENTION_JOB_ENABLED",
        runner=run_audit_retention_job,
    )
    yield
    await stop_scheduled_job(app, name="notification_retention")
    await stop_scheduled_job(app, name="audit_retention")


app = FastAPI(title="Task Management System API", lifespan=lifespan)

ensure_media_dirs()
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")


@app.get("/", include_in_schema=False)
def read_root():
    return {"status": "ok", "service": "task-management-backend"}


@app.get("/health", include_in_schema=False)
def health_check():
    return {"status": "ok"}


@app.get("/health/db", include_in_schema=False)
def database_health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))

frontend_url = os.getenv("FRONTEND_URL")
allowed_origins = [frontend_url] if frontend_url else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=bool(frontend_url),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.exception_handler(HTTPException)
def http_exception_handler(_request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "message" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail, headers=exc.headers)
    return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)}, headers=exc.headers)

