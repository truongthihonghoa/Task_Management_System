from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.repository.audit_retention import cleanup_expired_audit_logs


def create_audit_log(
    db: Session,
    user_id: str,
    action: str,
    label_title: str,
    entity_id: Optional[str] = None,
    payload: Optional[dict] = None
) -> AuditLog:
    """Create an audit log entry."""
    cleanup_expired_audit_logs(db)
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        label_title=label_title,
        entity_id=entity_id,
        payload=payload,
        created_at=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log
