from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.router import api_router
from app.db.session import get_db


app = FastAPI(title="Task Management Backend")
app.include_router(api_router)


@app.get("/")
def read_root():
    return {"status": "ok", "service": "task-management-backend"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def database_health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
