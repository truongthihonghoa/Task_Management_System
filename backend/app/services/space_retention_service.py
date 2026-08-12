import asyncio
import logging
import os

from app.db.session import SessionLocal
from app.repository import space as space_repository

logger = logging.getLogger(__name__)


def purge_expired_spaces() -> tuple[int, int]:
    db = SessionLocal()
    try:
        deleted_count = space_repository.cleanup_expired_deleted_spaces(db)
        expired_reopen_count = space_repository.cleanup_expired_archived_space_reopen_windows(db)
        return deleted_count, expired_reopen_count
    except Exception:
        db.rollback()
        logger.exception("space retention cleanup failed")
        raise
    finally:
        db.close()


async def run_space_retention_job(stop_event: asyncio.Event) -> None:
    interval_seconds = int(os.getenv("SPACE_RETENTION_JOB_INTERVAL_SECONDS", "86400"))
    while not stop_event.is_set():
        try:
            deleted_count, expired_reopen_count = purge_expired_spaces()
            logger.info(
                "space retention cleanup completed",
                extra={
                    "deleted_count": deleted_count,
                    "expired_reopen_count": expired_reopen_count,
                },
            )
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue
