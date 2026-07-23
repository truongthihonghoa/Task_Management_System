"""add space archive reopen window

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("spaces", sa.Column("archived_at", sa.DateTime(), nullable=True))
    op.add_column("spaces", sa.Column("reopen_until", sa.DateTime(), nullable=True))
    op.execute(
        """
        UPDATE spaces
        SET archived_at = COALESCE(updated_at, created_at),
            reopen_until = COALESCE(updated_at, created_at) + INTERVAL '7 days'
        WHERE status_space = 'Archived'
          AND deleted_at IS NULL
          AND archived_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("spaces", "reopen_until")
    op.drop_column("spaces", "archived_at")
