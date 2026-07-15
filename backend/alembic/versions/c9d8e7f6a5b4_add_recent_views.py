"""add recent views

Revision ID: c9d8e7f6a5b4
Revises: 6c2e91f8a4b7, a1c2d3e4f5g6
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, Sequence[str], None] = ("6c2e91f8a4b7", "a1c2d3e4f5g6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS recent_views_recent_view_id_seq"))
    op.create_table(
        "recent_views",
        sa.Column(
            "recent_view_id",
            sa.String(length=15),
            server_default=sa.text("'RCV' || lpad(nextval('recent_views_recent_view_id_seq')::text, 8, '0')"),
            nullable=False,
        ),
        sa.Column("user_id", sa.String(length=15), nullable=False),
        sa.Column("entity_type", sa.String(length=20), nullable=False),
        sa.Column("entity_id", sa.String(length=15), nullable=False),
        sa.Column("viewed_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("entity_type IN ('space', 'task', 'user')", name="check_recent_views_entity_type"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("recent_view_id"),
        sa.UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_recent_views_user_entity"),
    )
    op.create_index("ix_recent_views_user_viewed_at", "recent_views", ["user_id", "viewed_at"], unique=False)
    op.create_index("ix_recent_views_entity", "recent_views", ["entity_type", "entity_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_recent_views_entity", table_name="recent_views")
    op.drop_index("ix_recent_views_user_viewed_at", table_name="recent_views")
    op.drop_table("recent_views")
    op.execute(sa.text("DROP SEQUENCE IF EXISTS recent_views_recent_view_id_seq"))
