"""register verify email flow

Revision ID: b7f9c8a21d34
Revises: 5006fd421313
Create Date: 2026-07-09 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7f9c8a21d34"
down_revision: Union[str, Sequence[str], None] = "5006fd421313"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("verification_token_user_id_fkey", "verification_token", type_="foreignkey")
    op.drop_constraint("verification_token_token_key", "verification_token", type_="unique")

    op.add_column("verification_token", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("verification_token", sa.Column("otp_code", sa.String(length=6), nullable=True))
    op.add_column(
        "verification_token",
        sa.Column("resend_count", sa.Integer(), server_default="0", nullable=False),
    )

    op.execute(
        sa.text(
            """
            UPDATE verification_token AS vt
            SET email = users.email
            FROM users
            WHERE vt.user_id = users.user_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE verification_token
            SET email = COALESCE(email, 'unknown+' || token_id || '@example.invalid'),
                otp_code = CASE
                    WHEN token ~ '^[0-9]{6}$' THEN token
                    ELSE '000000'
                END
            """
        )
    )

    op.alter_column("verification_token", "email", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("verification_token", "otp_code", existing_type=sa.String(length=6), nullable=False)
    op.create_unique_constraint(
        "uq_verification_token_email_token_type",
        "verification_token",
        ["email", "token_type"],
    )
    op.create_check_constraint(
        "check_verification_token_otp_code",
        "verification_token",
        "otp_code ~ '^[0-9]{6}$'",
    )

    op.drop_column("verification_token", "token")
    op.drop_column("verification_token", "user_id")

    op.alter_column("audit_logs", "user_id", existing_type=sa.String(length=15), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("audit_logs", "user_id", existing_type=sa.String(length=15), nullable=False)

    op.add_column("verification_token", sa.Column("user_id", sa.String(length=15), nullable=True))
    op.add_column("verification_token", sa.Column("token", sa.String(length=255), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE verification_token AS vt
            SET user_id = users.user_id,
                token = vt.otp_code
            FROM users
            WHERE vt.email = users.email
            """
        )
    )

    op.drop_constraint("check_verification_token_otp_code", "verification_token", type_="check")
    op.drop_constraint("uq_verification_token_email_token_type", "verification_token", type_="unique")
    op.drop_column("verification_token", "resend_count")
    op.drop_column("verification_token", "otp_code")
    op.drop_column("verification_token", "email")

    op.alter_column("verification_token", "user_id", existing_type=sa.String(length=15), nullable=False)
    op.alter_column("verification_token", "token", existing_type=sa.String(length=255), nullable=False)
    op.create_unique_constraint("verification_token_token_key", "verification_token", ["token"])
    op.create_foreign_key(
        "verification_token_user_id_fkey",
        "verification_token",
        "users",
        ["user_id"],
        ["user_id"],
    )
