from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class TaskAssignmentHistory(Base):
    __tablename__ = "task_assignment_history"

    assignment_history_id = prefixed_id_column("TAH", "task_assignment_history_assignment_history_id_seq")
    task_id = Column(String(15), ForeignKey("tasks.task_id"), nullable=False)
    previous_assignee_id = Column(String(15), ForeignKey("users.user_id"), nullable=True)
    new_assignee_id = Column(String(15), ForeignKey("users.user_id"), nullable=True)
    changed_by = Column(String(15), ForeignKey("users.user_id"), nullable=False)
    reason = Column(Text, nullable=True)
    change_status = Column(String(20), nullable=True)
    changed_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "change_status IN ('new', 'in_progress', 'in_testing', 'pending_review', 'done', 'need_revision', 'cancelled')",
            name="check_task_assignment_history_change_status",
        ),
    )

    task = relationship("Task", back_populates="assignment_history")
    previous_assignee = relationship(
        "User",
        back_populates="previous_assignment_history",
        foreign_keys=[previous_assignee_id],
    )
    new_assignee = relationship(
        "User",
        back_populates="new_assignment_history",
        foreign_keys=[new_assignee_id],
    )
    changed_by_user = relationship(
        "User",
        back_populates="changed_assignment_history",
        foreign_keys=[changed_by],
    )
