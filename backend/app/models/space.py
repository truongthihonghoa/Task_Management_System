from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class Space(Base):
    __tablename__ = "spaces"

    space_id = prefixed_id_column("SPC", "spaces_space_id_seq")
    name_space = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    status_space = Column(String(20), nullable=False, default="Active", server_default="Active")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    archived_at = Column(DateTime, nullable=True)
    reopen_until = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status_space IN ('Active', 'Archived', 'Deleted')",
            name="check_spaces_status_space",
        ),
    )

    owner = relationship("User", back_populates="owned_spaces", foreign_keys=[owner_id])
    members = relationship("SpaceMember", back_populates="space")
    sprints = relationship("Sprint", back_populates="space")
    tasks = relationship("Task", back_populates="space")
    notifications = relationship("Notification", back_populates="space")
