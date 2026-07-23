import asyncio
import logging
import os

from app.db.session import SessionLocal
from app.repository import notification as notification_repository

logger = logging.getLogger(__name__)


def purge_expired_notifications() -> int:
    db = SessionLocal()
    try:
        deleted_count = notification_repository.delete_notifications_older_than(
            db,
            notification_repository.notification_retention_cutoff(),
        )
        db.commit()
        return deleted_count
    except Exception:
        db.rollback()
        logger.exception("notification retention purge failed")
        raise
    finally:
        db.close()


async def run_notification_retention_job(stop_event: asyncio.Event) -> None:
    interval_seconds = int(os.getenv("NOTIFICATION_RETENTION_JOB_INTERVAL_SECONDS", "86400"))
    while not stop_event.is_set():
        try:
            deleted_count = purge_expired_notifications()
            logger.info("notification retention purge completed", extra={"deleted_count": deleted_count})
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue
