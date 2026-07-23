from datetime import datetime, timedelta
from app.core.timezone import vietnam_now

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


AUDIT_LOG_RETENTION_DAYS = 180


def cleanup_expired_audit_logs(db: Session, *, now: datetime | None = None, commit: bool = False) -> int:
    cutoff = (now or vietnam_now()) - timedelta(days=AUDIT_LOG_RETENTION_DAYS)
    query = db.query(AuditLog).filter(AuditLog.created_at < cutoff)
    if not hasattr(query, "delete"):
        return 0

    deleted_count = query.delete(synchronize_session=False)
    if commit and deleted_count:
        db.commit()
    return int(deleted_count or 0)
