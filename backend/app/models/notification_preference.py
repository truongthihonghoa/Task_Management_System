from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    preference_id = prefixed_id_column("NPF", "notification_preferences_preference_id_seq")
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    scope = Column(String(30), nullable=False)
    email_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    email_frequency = Column(String(30), nullable=False, default="INSTANT", server_default="INSTANT")
    email_settings = Column(JSONB, nullable=True)
    app_settings = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "scope IN ('USER_ACCOUNT', 'SUPER_ADMIN')",
            name="check_notification_preferences_scope",
        ),
        CheckConstraint(
            "email_frequency IN ('INSTANT', 'DAILY_DIGEST', 'WEEKLY_DIGEST', 'OFF')",
            name="check_notification_preferences_email_frequency",
        ),
    )

    user = relationship("User", back_populates="notification_preferences")
