from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class Task(Base):
    __tablename__ = "tasks"

    task_id = prefixed_id_column("TSK", "tasks_task_id_seq")
    space_id = Column(String(15), ForeignKey("spaces.space_id"), nullable=False)
    sprint_id = Column(String(15), ForeignKey("sprints.sprint_id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    creator_id = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    priority = Column(String(20), nullable=False)
    task_status = Column(String(20), nullable=False, default="new", server_default="new")
    story_points = Column(Float, nullable=True, default=0, server_default="0")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint("priority IN ('HIGH', 'MEDIUM', 'LOW')", name="check_tasks_priority"),
        CheckConstraint(
            "task_status IN ('new', 'in_progress', 'in_testing', 'pending_review', 'done', 'need_revision', 'cancelled')",
            name="check_tasks_task_status",
        ),
    )

    space = relationship("Space", back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    creator = relationship("User", back_populates="created_tasks", foreign_keys=[creator_id])
    assignees = relationship("TaskAssignee", back_populates="task")
    comments = relationship("TaskComment", back_populates="task")
    attachments = relationship("TaskAttachment", back_populates="task")
    assignment_history = relationship("TaskAssignmentHistory", back_populates="task")
    notifications = relationship("Notification", back_populates="task")
