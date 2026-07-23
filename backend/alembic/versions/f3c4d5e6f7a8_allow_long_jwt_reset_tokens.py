"""allow long jwt reset tokens

Revision ID: f3c4d5e6f7a8
Revises: f2b3c4d5e6f7
Create Date: 2026-07-22 00:00:02.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "f2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "verification_token",
        "otp_code",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "verification_token",
        "otp_code",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
