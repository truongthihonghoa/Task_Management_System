from app.db.base_class import Base


# Import all models so Alembic/create_all can discover every table via Base.metadata.
from app.models import (  # noqa: E402,F401
    AuditLog,
    Notification,
    NotificationPreference,
    Space,
    SpaceMember,
    Sprint,
    Task,
    TaskAssignee,
    TaskAssignmentHistory,
    TaskAttachment,
    TaskComment,
    User,
    UserToken,
    VerificationToken,
)
