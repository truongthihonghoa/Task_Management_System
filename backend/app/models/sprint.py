from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, event, func, text
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


SPRINT_NAME_PREFIX = "SCRUM Sprint"


def get_next_sprint_name(connection, space_id: str) -> str:
    connection.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:space_id))"),
        {"space_id": space_id},
    )

    next_number = connection.execute(
        text(
            """
            SELECT COALESCE(
                MAX(CAST(substring(name from '^SCRUM Sprint ([0-9]+)$') AS INTEGER)),
                0
            ) + 1
            FROM sprints
            WHERE space_id = :space_id
              AND name ~ '^SCRUM Sprint [0-9]+$'
            """
        ),
        {"space_id": space_id},
    ).scalar_one()

    return f"{SPRINT_NAME_PREFIX} {next_number}"


class Sprint(Base):
    __tablename__ = "sprints"

    sprint_id = prefixed_id_column("SPR", "sprints_sprint_id_seq")
    space_id = Column(String(15), ForeignKey("spaces.space_id"), nullable=False)
    name = Column(String(255), nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    duration_weeks = Column(Integer, nullable=True, default=2, server_default="2")
    status = Column(String(20), nullable=False, default="Planned", server_default="Planned")
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


@event.listens_for(Sprint, "before_insert")
def set_sequential_sprint_name(mapper, connection, target):
    if target.space_id:
        target.name = get_next_sprint_name(connection, target.space_id)
