from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    preference_id = prefixed_id_column("UPR", "user_preferences_preference_id_seq")
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    language = Column(String(10), nullable=False, default="en", server_default="en")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("language IN ('en', 'vi')", name="check_user_preferences_language"),
        UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
    )

    user = relationship("User", back_populates="layout_preference")
