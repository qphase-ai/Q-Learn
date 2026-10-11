"""ai classroom: sessions, whiteboard events/snapshots, message idempotency columns

Additive only. Adds:
- classroom_sessions   (id = LangGraph thread_id; run lease; atomic event counter)
- whiteboard_events    (durable ordered actions; unique (session_id, sequence_no)
                        and (session_id, event_id))
- whiteboard_snapshots (materialised board state per session)
- agent_messages.agent_name / turn_id / client_message_id, with a unique
  (session_id, client_message_id) so retried turns are idempotent. NULLs (all
  existing rows) never collide.

RLS is enabled on the new tables with no policies, like every other table: the
API's service role bypasses it and the public anon key gets nothing.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = ["classroom_sessions", "whiteboard_events", "whiteboard_snapshots"]


def upgrade() -> None:
    op.add_column("agent_messages", sa.Column("agent_name", sa.String(50), nullable=True))
    op.add_column("agent_messages", sa.Column("turn_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("agent_messages", sa.Column("client_message_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_agent_messages_turn_id", "agent_messages", ["turn_id"])
    op.create_unique_constraint(
        "uq_agent_messages_session_client_msg", "agent_messages", ["session_id", "client_message_id"]
    )

    op.create_table(
        "classroom_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "agent_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("title", sa.String(200), nullable=False, server_default="New classroom"),
        sa.Column("status", sa.String(20), nullable=False, server_default="idle"),
        sa.Column("active_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("run_lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("summary_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_event_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_classroom_sessions_user_id", "classroom_sessions", ["user_id"])

    op.create_table(
        "whiteboard_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("classroom_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence_no", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.String(64), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("step_id", sa.String(100), nullable=True),
        sa.Column("turn_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("session_id", "sequence_no", name="uq_whiteboard_events_session_seq"),
        sa.UniqueConstraint("session_id", "event_id", name="uq_whiteboard_events_session_event"),
    )
    op.create_index("ix_whiteboard_events_session_id", "whiteboard_events", ["session_id"])

    op.create_table(
        "whiteboard_snapshots",
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("classroom_sessions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("board_state", postgresql.JSONB(), nullable=False),
        sa.Column("last_sequence_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    for table in NEW_TABLES:
        op.execute(f'ALTER TABLE "public"."{table}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table("whiteboard_snapshots")
    op.drop_table("whiteboard_events")
    op.drop_table("classroom_sessions")
    op.drop_constraint("uq_agent_messages_session_client_msg", "agent_messages", type_="unique")
    op.drop_index("ix_agent_messages_turn_id", table_name="agent_messages")
    op.drop_column("agent_messages", "client_message_id")
    op.drop_column("agent_messages", "turn_id")
    op.drop_column("agent_messages", "agent_name")
