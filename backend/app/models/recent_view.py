from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class RecentView(Base):
    __tablename__ = "recent_views"

    recent_view_id = prefixed_id_column("RCV", "recent_views_recent_view_id_seq")
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    entity_type = Column(String(20), nullable=False)
    entity_id = Column(String(32), nullable=False)
    viewed_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "entity_type IN ('space', 'task', 'user')",
            name="check_recent_views_entity_type",
        ),
        UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_recent_views_user_entity"),
        Index("ix_recent_views_user_viewed_at", "user_id", "viewed_at"),
        Index("ix_recent_views_entity", "entity_type", "entity_id"),
    )

    user = relationship("User", back_populates="recent_views")
