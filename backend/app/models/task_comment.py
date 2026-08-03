from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class TaskComment(Base):
    __tablename__ = "task_comments"

    comment_id = prefixed_id_column("TCM", "task_comments_comment_id_seq")
    task_id = Column(String(32), ForeignKey("tasks.task_id"), nullable=False)
    user_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    parent_comment_id = Column(String(15), ForeignKey("task_comments.comment_id"), nullable=True)
    comment = Column(Text, nullable=False)
    is_edited = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime, nullable=True)

    task = relationship("Task", back_populates="comments")
    user = relationship("User", back_populates="comments", foreign_keys=[user_id])
    parent_comment = relationship(
        "TaskComment",
        back_populates="replies",
        remote_side=[comment_id],
    )
    replies = relationship("TaskComment", back_populates="parent_comment")
