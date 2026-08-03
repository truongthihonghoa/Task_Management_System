"""add space key

Revision ID: 0b6f4a8c9d12
Revises: f3c4d5e6f7a8
Create Date: 2026-08-03 09:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0b6f4a8c9d12"
down_revision: Union[str, Sequence[str], None] = "f3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("SET statement_timeout = 0"))
    op.add_column("spaces", sa.Column("space_key", sa.String(length=10), nullable=True))
    op.execute(
        sa.text(
            """
            WITH ranked_spaces AS (
                SELECT
                    space_id,
                    'SP' || lpad(row_number() OVER (ORDER BY created_at, space_id)::text, 8, '0') AS generated_key
                FROM spaces
            )
            UPDATE spaces
            SET space_key = ranked_spaces.generated_key
            FROM ranked_spaces
            WHERE spaces.space_id = ranked_spaces.space_id
            """
        )
    )
    op.alter_column("spaces", "space_key", existing_type=sa.String(length=10), nullable=False)
    op.create_check_constraint(
        "check_spaces_space_key_format",
        "spaces",
        "space_key ~ '^[A-Z][A-Z0-9]{0,9}$'",
    )
    op.create_unique_constraint("uq_spaces_space_key", "spaces", ["space_key"])


def downgrade() -> None:
    op.execute(sa.text("SET statement_timeout = 0"))
    op.drop_constraint("uq_spaces_space_key", "spaces", type_="unique")
    op.drop_constraint("check_spaces_space_key_format", "spaces", type_="check")
    op.drop_column("spaces", "space_key")
