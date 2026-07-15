"""add space member approval requests

Revision ID: c8d1e2f3a4b5
Revises: 6c2e91f8a4b7, a1c2d3e4f5g6
Create Date: 2026-07-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d1e2f3a4b5"
down_revision: Union[str, Sequence[str], None] = ("6c2e91f8a4b7", "a1c2d3e4f5g6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS space_member_requests_space_member_request_id_seq"))
    op.create_table(
        "space_member_requests",
        sa.Column(
            "space_member_request_id",
            sa.String(length=15),
            server_default=sa.text(
                "'SMR' || lpad(nextval('space_member_requests_space_member_request_id_seq')::text, 8, '0')"
            ),
            nullable=False,
        ),
        sa.Column("space_id", sa.String(length=15), nullable=False),
        sa.Column("requester_id", sa.String(length=15), nullable=False),
        sa.Column("requested_user_id", sa.String(length=15), nullable=True),
        sa.Column("requested_email", sa.String(length=255), nullable=False),
        sa.Column("requested_name", sa.String(length=100), nullable=True),
        sa.Column("owner_id", sa.String(length=15), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="PENDING_OWNER", nullable=False),
        sa.Column("review_token", sa.Text(), nullable=False),
        sa.Column("requested_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "status IN ('PENDING_OWNER', 'PENDING_INVITEE', 'APPROVED', 'REJECTED')",
            name="check_space_member_requests_status",
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.user_id"]),
        sa.ForeignKeyConstraint(["requested_user_id"], ["users.user_id"]),
        sa.ForeignKeyConstraint(["requester_id"], ["users.user_id"]),
        sa.ForeignKeyConstraint(["space_id"], ["spaces.space_id"]),
        sa.PrimaryKeyConstraint("space_member_request_id"),
        sa.UniqueConstraint("review_token", name="uq_space_member_requests_review_token"),
        sa.UniqueConstraint("space_member_request_id"),
    )
    op.create_index(
        "ix_space_member_requests_space_status",
        "space_member_requests",
        ["space_id", "status"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_space_member_requests_space_status", table_name="space_member_requests")
    op.drop_table("space_member_requests")
    op.execute(sa.text("DROP SEQUENCE IF EXISTS space_member_requests_space_member_request_id_seq"))
