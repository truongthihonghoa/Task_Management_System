"""reduce archived space reopen window to seven days

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE spaces
        SET reopen_until = archived_at + INTERVAL '7 days'
        WHERE status_space = 'Archived'
          AND deleted_at IS NULL
          AND archived_at IS NOT NULL
          AND reopen_until IS NOT NULL
          AND reopen_until > archived_at + INTERVAL '7 days'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE spaces
        SET reopen_until = archived_at + INTERVAL '14 days'
        WHERE status_space = 'Archived'
          AND deleted_at IS NULL
          AND archived_at IS NOT NULL
          AND reopen_until IS NOT NULL
        """
    )
