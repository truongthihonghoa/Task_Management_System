"""add notification indexes and preference unique constraint

Revision ID: 6c2e91f8a4b7
Revises: 2f4c6d8e91a0
Create Date: 2026-07-10 11:45:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "6c2e91f8a4b7"
down_revision: Union[str, Sequence[str], None] = "2f4c6d8e91a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        "ix_notifications_user_id_created_at",
        "notifications",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_user_id_is_read",
        "notifications",
        ["user_id", "is_read"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_user_id_type",
        "notifications",
        ["user_id", "type"],
        unique=False,
    )
    op.create_index("ix_notifications_task_id", "notifications", ["task_id"], unique=False)
    op.create_index("ix_notifications_space_id", "notifications", ["space_id"], unique=False)
    op.create_index("ix_notifications_audience", "notifications", ["audience"], unique=False)
    op.create_unique_constraint(
        "uq_notification_preferences_user_id_scope",
        "notification_preferences",
        ["user_id", "scope"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "uq_notification_preferences_user_id_scope",
        "notification_preferences",
        type_="unique",
    )
    op.drop_index("ix_notifications_audience", table_name="notifications")
    op.drop_index("ix_notifications_space_id", table_name="notifications")
    op.drop_index("ix_notifications_task_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id_type", table_name="notifications")
    op.drop_index("ix_notifications_user_id_is_read", table_name="notifications")
    op.drop_index("ix_notifications_user_id_created_at", table_name="notifications")
