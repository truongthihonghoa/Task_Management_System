import os

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.media import MEDIA_ROOT, ensure_media_dirs
from app.db.session import get_db

app = FastAPI(title="Task Management System API")

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


def _patch_upload_file_schemas(schema_part):
    if isinstance(schema_part, dict):
        if schema_part.get("type") == "string" and schema_part.get("contentMediaType") == "application/octet-stream":
            schema_part.pop("contentMediaType", None)
            schema_part["format"] = "binary"
        for value in schema_part.values():
            _patch_upload_file_schemas(value)
    elif isinstance(schema_part, list):
        for item in schema_part:
            _patch_upload_file_schemas(item)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        routes=app.routes,
    )
    _patch_upload_file_schemas(openapi_schema)
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

@app.exception_handler(HTTPException)
def http_exception_handler(_request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "message" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail, headers=exc.headers)
    return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)}, headers=exc.headers)

