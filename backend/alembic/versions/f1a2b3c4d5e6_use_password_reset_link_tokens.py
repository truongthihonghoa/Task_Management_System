"""use password reset link tokens

Revision ID: f1a2b3c4d5e6
Revises: b8c9d0e1f2a3, d4e5f6a7b8c8
Create Date: 2026-07-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = ("b8c9d0e1f2a3", "d4e5f6a7b8c8")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("check_verification_token_otp_code", "verification_token", type_="check")
    op.alter_column(
        "verification_token",
        "otp_code",
        existing_type=sa.String(length=6),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
    op.execute(
        sa.text(
            """
            UPDATE verification_token
            SET otp_code = 'legacy-reset-token-' || token_id || '-expired',
                used_at = COALESCE(used_at, now()),
                expires_at = LEAST(expires_at, now())
            WHERE token_type = 'PASSWORD_RESET'
              AND otp_code !~ '^[A-Za-z0-9_-]{32,255}$'
            """
        )
    )
    op.create_check_constraint(
        "check_verification_token_otp_code",
        "verification_token",
        "(token_type = 'EMAIL_VERIFICATION' AND otp_code ~ '^[0-9]{6}$') "
        "OR (token_type = 'PASSWORD_RESET' AND otp_code ~ '^[A-Za-z0-9_-]{32,255}$')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("check_verification_token_otp_code", "verification_token", type_="check")
    op.execute(
        sa.text(
            """
            UPDATE verification_token
            SET otp_code = '000000'
            WHERE token_type = 'PASSWORD_RESET'
              AND otp_code !~ '^[0-9]{6}$'
            """
        )
    )
    op.alter_column(
        "verification_token",
        "otp_code",
        existing_type=sa.String(length=255),
        type_=sa.String(length=6),
        existing_nullable=False,
    )
    op.create_check_constraint(
        "check_verification_token_otp_code",
        "verification_token",
        "otp_code ~ '^[0-9]{6}$'",
    )
