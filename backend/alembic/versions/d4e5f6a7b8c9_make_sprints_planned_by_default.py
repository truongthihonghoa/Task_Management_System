"""make sprints planned by default

Revision ID: d4e5f6a7b8c9
Revises: c8d1e2f3a4b5
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c8d1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "sprints",
        "status",
        existing_type=sa.String(length=20),
        server_default="Planned",
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "sprints",
        "status",
        existing_type=sa.String(length=20),
        server_default="Active",
        existing_nullable=False,
    )
