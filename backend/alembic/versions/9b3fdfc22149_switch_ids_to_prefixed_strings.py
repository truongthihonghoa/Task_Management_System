"""switch ids to prefixed strings

Revision ID: 9b3fdfc22149
Revises: 4787cc109936
Create Date: 2026-07-08 16:29:55.189314

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b3fdfc22149"
down_revision: Union[str, Sequence[str], None] = "4787cc109936"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ID_COLUMNS = [
    ("users", "user_id", False, "USR", "users_user_id_seq"),
    ("user_tokens", "token_id", False, "UTK", "user_tokens_token_id_seq"),
    ("spaces", "space_id", False, "SPC", "spaces_space_id_seq"),
    ("space_members", "space_member_id", False, "SPM", "space_members_space_member_id_seq"),
    ("sprints", "sprint_id", False, "SPR", "sprints_sprint_id_seq"),
    ("tasks", "task_id", False, "TSK", "tasks_task_id_seq"),
    ("task_assignees", "assignee_entry_id", False, "TAS", "task_assignees_assignee_entry_id_seq"),
    ("task_comments", "comment_id", False, "TCM", "task_comments_comment_id_seq"),
    ("task_attachments", "attachment_id", False, "TAT", "task_attachments_attachment_id_seq"),
    (
        "task_assignment_history",
        "assignment_history_id",
        False,
        "TAH",
        "task_assignment_history_assignment_history_id_seq",
    ),
    ("notifications", "notification_id", False, "NTF", "notifications_notification_id_seq"),
    (
        "notification_preferences",
        "preference_id",
        False,
        "NPF",
        "notification_preferences_preference_id_seq",
    ),
    ("verification_token", "token_id", False, "VTK", "verification_token_token_id_seq"),
    ("audit_logs", "log_id", False, "AUD", "audit_logs_log_id_seq"),
]

FK_COLUMNS = [
    ("audit_logs", "user_id", False),
    ("notification_preferences", "user_id", False),
    ("spaces", "owner_id", False),
    ("user_tokens", "user_id", False),
    ("verification_token", "user_id", False),
    ("space_members", "space_id", False),
    ("space_members", "user_id", False),
    ("sprints", "space_id", False),
    ("tasks", "space_id", False),
    ("tasks", "sprint_id", True),
    ("tasks", "creator_id", False),
    ("notifications", "user_id", False),
    ("notifications", "actor_id", True),
    ("notifications", "task_id", True),
    ("notifications", "space_id", True),
    ("task_assignees", "task_id", False),
    ("task_assignees", "assignee_id", False),
    ("task_assignment_history", "task_id", False),
    ("task_assignment_history", "previous_assignee_id", True),
    ("task_assignment_history", "new_assignee_id", True),
    ("task_assignment_history", "changed_by", False),
    ("task_attachments", "task_id", False),
    ("task_attachments", "uploaded_by", False),
    ("task_comments", "task_id", False),
    ("task_comments", "user_id", False),
    ("task_comments", "parent_comment_id", True),
    ("audit_logs", "entity_id", True),
]

FOREIGN_KEYS = [
    ("audit_logs_user_id_fkey", "audit_logs", ["user_id"], "users", ["user_id"]),
    (
        "notification_preferences_user_id_fkey",
        "notification_preferences",
        ["user_id"],
        "users",
        ["user_id"],
    ),
    ("spaces_owner_id_fkey", "spaces", ["owner_id"], "users", ["user_id"]),
    ("user_tokens_user_id_fkey", "user_tokens", ["user_id"], "users", ["user_id"]),
    ("verification_token_user_id_fkey", "verification_token", ["user_id"], "users", ["user_id"]),
    ("space_members_space_id_fkey", "space_members", ["space_id"], "spaces", ["space_id"]),
    ("space_members_user_id_fkey", "space_members", ["user_id"], "users", ["user_id"]),
    ("sprints_space_id_fkey", "sprints", ["space_id"], "spaces", ["space_id"]),
    ("tasks_creator_id_fkey", "tasks", ["creator_id"], "users", ["user_id"]),
    ("tasks_space_id_fkey", "tasks", ["space_id"], "spaces", ["space_id"]),
    ("tasks_sprint_id_fkey", "tasks", ["sprint_id"], "sprints", ["sprint_id"]),
    ("notifications_actor_id_fkey", "notifications", ["actor_id"], "users", ["user_id"]),
    ("notifications_space_id_fkey", "notifications", ["space_id"], "spaces", ["space_id"]),
    ("notifications_task_id_fkey", "notifications", ["task_id"], "tasks", ["task_id"]),
    ("notifications_user_id_fkey", "notifications", ["user_id"], "users", ["user_id"]),
    ("task_assignees_assignee_id_fkey", "task_assignees", ["assignee_id"], "users", ["user_id"]),
    ("task_assignees_task_id_fkey", "task_assignees", ["task_id"], "tasks", ["task_id"]),
    (
        "task_assignment_history_changed_by_fkey",
        "task_assignment_history",
        ["changed_by"],
        "users",
        ["user_id"],
    ),
    (
        "task_assignment_history_new_assignee_id_fkey",
        "task_assignment_history",
        ["new_assignee_id"],
        "users",
        ["user_id"],
    ),
    (
        "task_assignment_history_previous_assignee_id_fkey",
        "task_assignment_history",
        ["previous_assignee_id"],
        "users",
        ["user_id"],
    ),
    (
        "task_assignment_history_task_id_fkey",
        "task_assignment_history",
        ["task_id"],
        "tasks",
        ["task_id"],
    ),
    ("task_attachments_task_id_fkey", "task_attachments", ["task_id"], "tasks", ["task_id"]),
    ("task_attachments_uploaded_by_fkey", "task_attachments", ["uploaded_by"], "users", ["user_id"]),
    (
        "task_comments_parent_comment_id_fkey",
        "task_comments",
        ["parent_comment_id"],
        "task_comments",
        ["comment_id"],
    ),
    ("task_comments_task_id_fkey", "task_comments", ["task_id"], "tasks", ["task_id"]),
    ("task_comments_user_id_fkey", "task_comments", ["user_id"], "users", ["user_id"]),
]


def _prefixed_default(prefix: str, sequence_name: str):
    return sa.text(f"'{prefix}' || lpad(nextval('{sequence_name}')::text, 8, '0')")


def _drop_foreign_keys() -> None:
    for name, table, _local, _remote_table, _remote in FOREIGN_KEYS:
        op.drop_constraint(name, table, type_="foreignkey")


def _create_foreign_keys() -> None:
    for name, table, local, remote_table, remote in FOREIGN_KEYS:
        op.create_foreign_key(name, table, remote_table, local, remote)


def _create_sequences() -> None:
    for _table, _column, _nullable, _prefix, sequence_name in ID_COLUMNS:
        op.execute(sa.text(f"CREATE SEQUENCE IF NOT EXISTS {sequence_name}"))


def _drop_sequences() -> None:
    for _table, _column, _nullable, _prefix, sequence_name in reversed(ID_COLUMNS):
        op.execute(sa.text(f"DROP SEQUENCE IF EXISTS {sequence_name}"))


def _alter_to_string() -> None:
    for table, column, nullable, prefix, sequence_name in ID_COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=sa.UUID(),
            type_=sa.String(length=11),
            existing_nullable=nullable,
            server_default=_prefixed_default(prefix, sequence_name),
            postgresql_using=f"{column}::text",
        )

    for table, column, nullable in FK_COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=sa.UUID(),
            type_=sa.String(length=11),
            existing_nullable=nullable,
            postgresql_using=f"{column}::text",
        )


def _alter_to_uuid() -> None:
    for table, column, nullable in reversed(FK_COLUMNS):
        op.alter_column(
            table,
            column,
            existing_type=sa.String(length=11),
            type_=sa.UUID(),
            existing_nullable=nullable,
            postgresql_using=f"{column}::uuid",
        )

    for table, column, nullable, _prefix, _sequence_name in reversed(ID_COLUMNS):
        op.alter_column(
            table,
            column,
            existing_type=sa.String(length=11),
            type_=sa.UUID(),
            existing_nullable=nullable,
            server_default=None,
            postgresql_using=f"{column}::uuid",
        )


def upgrade() -> None:
    """Upgrade schema."""
    _drop_foreign_keys()
    _create_sequences()
    _alter_to_string()
    _create_foreign_keys()


def downgrade() -> None:
    """Downgrade schema."""
    _drop_foreign_keys()
    _alter_to_uuid()
    _drop_sequences()
    _create_foreign_keys()
