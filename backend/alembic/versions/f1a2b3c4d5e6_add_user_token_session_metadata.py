"""add user token session metadata

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_tokens", sa.Column("session_id", sa.String(length=64), nullable=True))
    op.add_column("user_tokens", sa.Column("access_token_hash", sa.String(length=64), nullable=True))
    op.add_column("user_tokens", sa.Column("refresh_token_hash", sa.String(length=64), nullable=True))
    op.add_column("user_tokens", sa.Column("access_token_jti", sa.String(length=64), nullable=True))
    op.add_column("user_tokens", sa.Column("refresh_token_jti", sa.String(length=64), nullable=True))
    op.add_column("user_tokens", sa.Column("revoked_at", sa.DateTime(), nullable=True))
    op.add_column("user_tokens", sa.Column("user_agent", sa.Text(), nullable=True))
    op.add_column("user_tokens", sa.Column("ip_address", sa.String(length=45), nullable=True))
    op.add_column("user_tokens", sa.Column("last_used_at", sa.DateTime(), nullable=True))
    op.add_column("user_tokens", sa.Column("updated_at", sa.DateTime(), nullable=True))

    op.alter_column("user_tokens", "access_token", existing_type=sa.Text(), nullable=True)
    op.alter_column("user_tokens", "refresh_token", existing_type=sa.Text(), nullable=True)

    op.create_index("ix_user_tokens_session_id", "user_tokens", ["session_id"], unique=True)
    op.create_index("ix_user_tokens_access_token_hash", "user_tokens", ["access_token_hash"], unique=False)
    op.create_index("ix_user_tokens_refresh_token_hash", "user_tokens", ["refresh_token_hash"], unique=False)
    op.create_index(
        "ix_user_tokens_user_session_active",
        "user_tokens",
        ["user_id", "session_id", "is_revoked"],
        unique=False,
    )
    op.create_index(
        "ix_user_tokens_refresh_hash_active",
        "user_tokens",
        ["refresh_token_hash", "is_revoked"],
        unique=False,
    )
    op.create_index(
        "ix_user_tokens_access_hash_active",
        "user_tokens",
        ["access_token_hash", "is_revoked"],
        unique=False,
    )

    # Existing raw-token records predate sid/jti claims. They remain usable only
    # until normal expiration; new login sessions are stored by token hash.
    op.execute(
        sa.text(
            """
            UPDATE user_tokens
            SET updated_at = COALESCE(updated_at, created_at),
                last_used_at = COALESCE(last_used_at, created_at)
            WHERE updated_at IS NULL OR last_used_at IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_user_tokens_access_hash_active", table_name="user_tokens")
    op.drop_index("ix_user_tokens_refresh_hash_active", table_name="user_tokens")
    op.drop_index("ix_user_tokens_user_session_active", table_name="user_tokens")
    op.drop_index("ix_user_tokens_refresh_token_hash", table_name="user_tokens")
    op.drop_index("ix_user_tokens_access_token_hash", table_name="user_tokens")
    op.drop_index("ix_user_tokens_session_id", table_name="user_tokens")

    op.alter_column("user_tokens", "refresh_token", existing_type=sa.Text(), nullable=False)
    op.alter_column("user_tokens", "access_token", existing_type=sa.Text(), nullable=False)

    op.drop_column("user_tokens", "updated_at")
    op.drop_column("user_tokens", "last_used_at")
    op.drop_column("user_tokens", "ip_address")
    op.drop_column("user_tokens", "user_agent")
    op.drop_column("user_tokens", "revoked_at")
    op.drop_column("user_tokens", "refresh_token_jti")
    op.drop_column("user_tokens", "access_token_jti")
    op.drop_column("user_tokens", "refresh_token_hash")
    op.drop_column("user_tokens", "access_token_hash")
    op.drop_column("user_tokens", "session_id")
