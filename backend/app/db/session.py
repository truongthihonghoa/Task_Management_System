import os
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", "5432"))
    db_name = os.getenv("DB_NAME", "task_management_db")
    SQLALCHEMY_DATABASE_URL = URL.create(
        "postgresql",
        username=db_user,
        password=db_password or None,
        host=db_host,
        port=db_port,
        database=db_name,
    )

engine_options = {
    "pool_pre_ping": True,
    "connect_args": {
        "options": "-c timezone=Asia/Ho_Chi_Minh"
    },
}

database_url_text = str(SQLALCHEMY_DATABASE_URL)

if "supabase.com" in database_url_text:
    # Supabase nên dùng NullPool
    engine_options["poolclass"] = NullPool
else:
    engine_options["pool_size"] = int(os.getenv("DB_POOL_SIZE", "3"))
    engine_options["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "2"))
    engine_options["pool_timeout"] = int(os.getenv("DB_POOL_TIMEOUT", "10"))
    engine_options["pool_recycle"] = int(os.getenv("DB_POOL_RECYCLE", "300"))

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    **engine_options,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
