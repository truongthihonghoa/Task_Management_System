from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.id_generator import prefixed_id_column
from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    user_id = prefixed_id_column("USR", "users_user_id_seq")
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    status_user = Column(String(20), nullable=False)
    role = Column(String(30), nullable=False, default="USER", server_default="USER")
    avatar_url = Column(Text, nullable=True)
    is_verified = Column(Boolean, nullable=True, default=False, server_default="false")
    failed_login_attempts = Column(Integer, nullable=True, default=0, server_default="0")
    locked_until = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status_user IN ('Pending', 'Active', 'Inactive', 'Locked')",
            name="check_users_status_user",
        ),
        CheckConstraint(
            "role IN ('USER', 'SUPER_ADMIN')",
            name="check_users_role",
        ),
    )

    tokens = relationship("UserToken", back_populates="user")
    owned_spaces = relationship("Space", back_populates="owner", foreign_keys="Space.owner_id")
    space_memberships = relationship("SpaceMember", back_populates="user")
    created_tasks = relationship("Task", back_populates="creator", foreign_keys="Task.creator_id")
    comments = relationship("TaskComment", back_populates="user", foreign_keys="TaskComment.user_id")
    uploaded_attachments = relationship(
        "TaskAttachment",
        back_populates="uploader",
        foreign_keys="TaskAttachment.uploaded_by",
    )
    received_notifications = relationship(
        "Notification",
        back_populates="user",
        foreign_keys="Notification.user_id",
    )
    actor_notifications = relationship(
        "Notification",
        back_populates="actor",
        foreign_keys="Notification.actor_id",
    )
    notification_preferences = relationship("NotificationPreference", back_populates="user")
    layout_preference = relationship("UserPreference", back_populates="user", uselist=False)
    recent_views = relationship("RecentView", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    task_assignees = relationship(
        "TaskAssignee",
        back_populates="assignee",
        foreign_keys="TaskAssignee.assignee_id",
    )
    previous_assignment_history = relationship(
        "TaskAssignmentHistory",
        back_populates="previous_assignee",
        foreign_keys="TaskAssignmentHistory.previous_assignee_id",
    )
    new_assignment_history = relationship(
        "TaskAssignmentHistory",
        back_populates="new_assignee",
        foreign_keys="TaskAssignmentHistory.new_assignee_id",
    )
    changed_assignment_history = relationship(
        "TaskAssignmentHistory",
        back_populates="changed_by_user",
        foreign_keys="TaskAssignmentHistory.changed_by",
    )
