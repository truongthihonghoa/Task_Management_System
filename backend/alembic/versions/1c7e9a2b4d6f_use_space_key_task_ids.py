"""use space key task ids

Revision ID: 1c7e9a2b4d6f
Revises: 0b6f4a8c9d12
Create Date: 2026-08-03 09:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1c7e9a2b4d6f"
down_revision: Union[str, Sequence[str], None] = "0b6f4a8c9d12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TASK_FKS = [
    ("notifications_task_id_fkey", "notifications", ["task_id"]),
    ("task_assignees_task_id_fkey", "task_assignees", ["task_id"]),
    ("task_assignment_history_task_id_fkey", "task_assignment_history", ["task_id"]),
    ("task_attachments_task_id_fkey", "task_attachments", ["task_id"]),
    ("task_comments_task_id_fkey", "task_comments", ["task_id"]),
]


def _drop_task_fks() -> None:
    for name, table, _columns in TASK_FKS:
        op.drop_constraint(name, table, type_="foreignkey")


def _create_task_fks() -> None:
    for name, table, columns in TASK_FKS:
        op.create_foreign_key(name, table, "tasks", columns, ["task_id"])


def _alter_task_id_columns(length: int, *, task_server_default=None) -> None:
    op.alter_column(
        "tasks",
        "task_id",
        existing_type=sa.String(length=15 if length == 32 else 32),
        type_=sa.String(length=length),
        existing_nullable=False,
        server_default=task_server_default,
    )
    for table, nullable in [
        ("notifications", True),
        ("task_assignees", False),
        ("task_assignment_history", False),
        ("task_attachments", False),
        ("task_comments", False),
    ]:
        op.alter_column(
            table,
            "task_id",
            existing_type=sa.String(length=15 if length == 32 else 32),
            type_=sa.String(length=length),
            existing_nullable=nullable,
        )


def upgrade() -> None:
    op.execute(sa.text("SET statement_timeout = 0"))
    _drop_task_fks()
    _alter_task_id_columns(32, task_server_default=None)
    op.alter_column("audit_logs", "entity_id", existing_type=sa.String(length=15), type_=sa.String(length=32), existing_nullable=True)
    op.alter_column("recent_views", "entity_id", existing_type=sa.String(length=15), type_=sa.String(length=32), existing_nullable=False)

    op.execute(
        sa.text(
            """
            CREATE TEMP TABLE task_id_migration_map ON COMMIT DROP AS
            SELECT
                tasks.task_id AS old_task_id,
                spaces.space_key || '-' || row_number() OVER (
                    PARTITION BY tasks.space_id
                    ORDER BY tasks.created_at, tasks.task_id
                )::text AS new_task_id
            FROM tasks
            JOIN spaces ON spaces.space_id = tasks.space_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE tasks
            SET task_id = task_id_migration_map.new_task_id
            FROM task_id_migration_map
            WHERE tasks.task_id = task_id_migration_map.old_task_id
            """
        )
    )
    for table in ["notifications", "task_assignees", "task_assignment_history", "task_attachments", "task_comments"]:
        op.execute(
            sa.text(
                f"""
                UPDATE {table}
                SET task_id = task_id_migration_map.new_task_id
                FROM task_id_migration_map
                WHERE {table}.task_id = task_id_migration_map.old_task_id
                """
            )
        )
    op.execute(
        sa.text(
            """
            UPDATE recent_views
            SET entity_id = task_id_migration_map.new_task_id
            FROM task_id_migration_map
            WHERE recent_views.entity_type = 'task'
              AND recent_views.entity_id = task_id_migration_map.old_task_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE audit_logs
            SET entity_id = task_id_migration_map.new_task_id
            FROM task_id_migration_map
            WHERE audit_logs.entity_id = task_id_migration_map.old_task_id
            """
        )
    )
    op.create_check_constraint(
        "check_tasks_task_id_space_key_format",
        "tasks",
        "task_id ~ '^[A-Z][A-Z0-9]{0,9}-[1-9][0-9]*$'",
    )
    _create_task_fks()
    op.execute(sa.text("DROP SEQUENCE IF EXISTS tasks_task_id_seq"))


def downgrade() -> None:
    op.execute(sa.text("SET statement_timeout = 0"))
    _drop_task_fks()
    op.drop_constraint("check_tasks_task_id_space_key_format", "tasks", type_="check")
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS tasks_task_id_seq"))
    op.execute(
        sa.text(
            """
            CREATE TEMP TABLE task_id_migration_map ON COMMIT DROP AS
            SELECT
                task_id AS old_task_id,
                'TSK' || lpad(row_number() OVER (ORDER BY created_at, task_id)::text, 8, '0') AS new_task_id
            FROM tasks
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE tasks
            SET task_id = task_id_migration_map.new_task_id
            FROM task_id_migration_map
            WHERE tasks.task_id = task_id_migration_map.old_task_id
            """
        )
    )
    for table in ["notifications", "task_assignees", "task_assignment_history", "task_attachments", "task_comments"]:
        op.execute(
            sa.text(
                f"""
                UPDATE {table}
                SET task_id = task_id_migration_map.new_task_id
                FROM task_id_migration_map
                WHERE {table}.task_id = task_id_migration_map.old_task_id
                """
            )
        )
    op.execute(
        sa.text(
            """
            UPDATE recent_views
            SET entity_id = task_id_migration_map.new_task_id
            FROM task_id_migration_map
            WHERE recent_views.entity_type = 'task'
              AND recent_views.entity_id = task_id_migration_map.old_task_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE audit_logs
            SET entity_id = task_id_migration_map.new_task_id
            FROM task_id_migration_map
            WHERE audit_logs.entity_id = task_id_migration_map.old_task_id
            """
        )
    )
    _alter_task_id_columns(
        15,
        task_server_default=sa.text("'TSK' || lpad(nextval('tasks_task_id_seq')::text, 8, '0')"),
    )
    op.alter_column("recent_views", "entity_id", existing_type=sa.String(length=32), type_=sa.String(length=15), existing_nullable=False)
    op.alter_column("audit_logs", "entity_id", existing_type=sa.String(length=32), type_=sa.String(length=15), existing_nullable=True)
    op.execute(sa.text("SELECT setval('tasks_task_id_seq', GREATEST((SELECT count(*) FROM tasks), 1), true)"))
    _create_task_fks()
