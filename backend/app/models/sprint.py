from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class Sprint(Base):
    __tablename__ = "sprints"

    sprint_id = prefixed_id_column("SPR", "sprints_sprint_id_seq")
    space_id = Column(String(15), ForeignKey("spaces.space_id"), nullable=False)
    name = Column(String(255), nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    duration_weeks = Column(Integer, nullable=True, default=2, server_default="2")
    status = Column(String(20), nullable=False, default="Active", server_default="Active")
    auto_start = Column(Boolean, nullable=True, default=False, server_default="false")
    auto_complete = Column(Boolean, nullable=True, default=False, server_default="false")
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "status IN ('Planned', 'Active', 'Completed', 'Deleted')",
            name="check_sprints_status",
        ),
    )

    space = relationship("Space", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint")
