import asyncio
import logging
import os

from app.db.session import SessionLocal
from app.repository.audit_retention import cleanup_expired_audit_logs

logger = logging.getLogger(__name__)


def purge_expired_audit_logs() -> int:
    db = SessionLocal()
    try:
        deleted_count = cleanup_expired_audit_logs(db)
        db.commit()
        return deleted_count
    except Exception:
        db.rollback()
        logger.exception("audit log retention purge failed")
        raise
    finally:
        db.close()


async def run_audit_retention_job(stop_event: asyncio.Event) -> None:
    interval_seconds = int(os.getenv("AUDIT_LOG_RETENTION_JOB_INTERVAL_SECONDS", "86400"))
    while not stop_event.is_set():
        try:
            deleted_count = purge_expired_audit_logs()
            logger.info("audit log retention purge completed", extra={"deleted_count": deleted_count})
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except asyncio.TimeoutError:
            continue
