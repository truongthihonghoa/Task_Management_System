"""require task sprint id

Revision ID: a1c2d3e4f5g6
Revises: 5006fd421313
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1c2d3e4f5g6"
down_revision: Union[str, Sequence[str], None] = "5006fd421313"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM tasks WHERE sprint_id IS NULL) THEN
                    RAISE EXCEPTION
                        'Cannot require tasks.sprint_id while tasks with NULL sprint_id exist';
                END IF;
            END
            $$;
            """
        )
    )
    op.alter_column(
        "tasks",
        "sprint_id",
        existing_type=sa.String(length=15),
        nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "tasks",
        "sprint_id",
        existing_type=sa.String(length=15),
        nullable=True,
    )
