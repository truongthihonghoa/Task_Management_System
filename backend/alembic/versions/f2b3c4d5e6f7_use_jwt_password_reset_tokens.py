"""use jwt password reset tokens

Revision ID: f2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-07-22 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


JWT_TOKEN_PATTERN = "^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$"


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("check_verification_token_otp_code", "verification_token", type_="check")
    op.execute(
        sa.text(
            f"""
            UPDATE verification_token
            SET otp_code = 'legacy.' || token_id || '.expired',
                used_at = COALESCE(used_at, now()),
                expires_at = LEAST(expires_at, now())
            WHERE token_type = 'PASSWORD_RESET'
              AND otp_code !~ '{JWT_TOKEN_PATTERN}'
            """
        )
    )
    op.create_check_constraint(
        "check_verification_token_otp_code",
        "verification_token",
        "(token_type = 'EMAIL_VERIFICATION' AND otp_code ~ '^[0-9]{6}$') "
        f"OR (token_type = 'PASSWORD_RESET' AND otp_code ~ '{JWT_TOKEN_PATTERN}')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("check_verification_token_otp_code", "verification_token", type_="check")
    op.create_check_constraint(
        "check_verification_token_otp_code",
        "verification_token",
        "(token_type = 'EMAIL_VERIFICATION' AND otp_code ~ '^[0-9]{6}$') "
        "OR (token_type = 'PASSWORD_RESET' AND otp_code ~ '^[A-Za-z0-9_-]{32,255}$')",
    )
