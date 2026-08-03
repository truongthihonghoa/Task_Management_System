from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = prefixed_id_column("NTF", "notifications_notification_id_seq")
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    actor_id = Column(String(15), ForeignKey("users.user_id"), nullable=True)
    task_id = Column(String(32), ForeignKey("tasks.task_id"), nullable=True)
    space_id = Column(String(15), ForeignKey("spaces.space_id"), nullable=True)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    audience = Column(String(30), nullable=False, default="USER", server_default="USER")
    metadata_ = Column("metadata", JSONB, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, server_default="false")
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "type IN ("
            "'task_assigned', 'task_mentioned', 'task_created', 'task_updated', 'task_deleted', "
            "'status_changed', 'priority_changed', 'comment_added', 'comment_edited', 'comment_deleted', "
            "'attachment_added', 'due_today', 'due_date_changed', 'task_overdue', 'user_registered', "
            "'account_locked', 'user_verified', 'user_deactivated', 'role_changed', 'permission_changed', "
            "'space_created', 'space_updated', 'space_member_added', 'space_role_changed', "
            "'owner_space_update', 'audit_log_event', 'system_alert'"
            ")",
            name="check_notifications_type",
        ),
        CheckConstraint(
            "audience IN ('USER', 'OWNER', 'SUPER_ADMIN')",
            name="check_notifications_audience",
        ),
    )

    user = relationship("User", back_populates="received_notifications", foreign_keys=[user_id])
    actor = relationship("User", back_populates="actor_notifications", foreign_keys=[actor_id])
    task = relationship("Task", back_populates="notifications")
    space = relationship("Space", back_populates="notifications")
