"""add user preferences

Revision ID: d4e5f6a7b8c9
Revises: c9d8e7f6a5b4, b7f9c8a21d34
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = ("c9d8e7f6a5b4", "b7f9c8a21d34")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS user_preferences_preference_id_seq"))
    op.create_table(
        "user_preferences",
        sa.Column(
            "preference_id",
            sa.String(length=15),
            server_default=sa.text("'UPR' || lpad(nextval('user_preferences_preference_id_seq')::text, 8, '0')"),
            nullable=False,
        ),
        sa.Column("user_id", sa.String(length=15), nullable=False),
        sa.Column("language", sa.String(length=10), server_default="en", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("language IN ('en', 'vi')", name="check_user_preferences_language"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("preference_id"),
        sa.UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("user_preferences")
    op.execute(sa.text("DROP SEQUENCE IF EXISTS user_preferences_preference_id_seq"))
