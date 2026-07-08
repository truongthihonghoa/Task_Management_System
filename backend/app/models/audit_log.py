from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = prefixed_id_column("AUD", "audit_logs_log_id_seq")
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    action = Column(String(100), nullable=False)
    label_title = Column(String(50), nullable=False)
    entity_id = Column(String(15), nullable=True)
    payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
