"""seed user preferences

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed language preferences for existing users."""
    op.execute(
        sa.text(
            """
            WITH vi_user AS (
                SELECT user_id
                FROM users
                WHERE role = 'USER'
                ORDER BY created_at ASC, user_id ASC
                LIMIT 1
            )
            INSERT INTO user_preferences (user_id, language)
            SELECT
                users.user_id,
                CASE
                    WHEN users.user_id = (SELECT user_id FROM vi_user) THEN 'vi'
                    ELSE 'en'
                END AS language
            FROM users
            ON CONFLICT (user_id) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    """Keep user preferences on downgrade to avoid deleting user changes."""
    pass
