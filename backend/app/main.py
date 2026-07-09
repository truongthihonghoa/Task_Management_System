import os

from fastapi import FastAPI
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.api.v1.auth import router as auth_router
from app.api.v1.tasks import router as tasks_router


app = FastAPI(title="Task Management System API")

frontend_url = os.getenv("FRONTEND_URL")
allowed_origins = [frontend_url] if frontend_url else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=bool(frontend_url),
    allow_methods=["*"],
    allow_headers=["*"],
)

def include_routes(router, *, prefix: str = "") -> None:
    for route in router.routes:
        if not isinstance(route, APIRoute):
            continue
        app.add_api_route(
            f"{prefix}{route.path}",
            route.endpoint,
            methods=route.methods,
            response_model=route.response_model,
            status_code=route.status_code,
            tags=route.tags,
            dependencies=route.dependencies,
            summary=route.summary,
            description=route.description,
            response_description=route.response_description,
            responses=route.responses,
            deprecated=route.deprecated,
            operation_id=route.operation_id,
            name=route.name,
            include_in_schema=route.include_in_schema,
        )


include_routes(auth_router, prefix="/api/v1")
include_routes(tasks_router, prefix="/api/v1")


@app.exception_handler(HTTPException)
def http_exception_handler(_request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "message" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail, headers=exc.headers)
    return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)}, headers=exc.headers)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
