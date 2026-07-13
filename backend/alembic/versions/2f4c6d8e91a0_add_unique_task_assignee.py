"""add unique task assignee

Revision ID: 2f4c6d8e91a0
Revises: b7f9c8a21d34
Create Date: 2026-07-09 14:55:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "2f4c6d8e91a0"
down_revision: Union[str, Sequence[str], None] = "b7f9c8a21d34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint(
        "uq_task_assignees_task_id_assignee_id",
        "task_assignees",
        ["task_id", "assignee_id"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "uq_task_assignees_task_id_assignee_id",
        "task_assignees",
        type_="unique",
    )
