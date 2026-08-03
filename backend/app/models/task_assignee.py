from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class TaskAssignee(Base):
    __tablename__ = "task_assignees"

    assignee_entry_id = prefixed_id_column("TAS", "task_assignees_assignee_entry_id_seq", unique=True)
    task_id = Column(String(32), ForeignKey("tasks.task_id"), nullable=False)
    assignee_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    assignee_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("task_id", "assignee_id", name="uq_task_assignees_task_id_assignee_id"),
    )

    task = relationship("Task", back_populates="assignees")
    assignee = relationship("User", back_populates="task_assignees", foreign_keys=[assignee_id])
