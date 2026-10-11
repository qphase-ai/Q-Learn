"""AI Classroom ORM models.

- `classroom_sessions`   one row per classroom; `id` doubles as the LangGraph
                         `thread_id`. Carries the run lease and the atomic
                         whiteboard sequence counter (`last_event_seq`).
- `whiteboard_events`    durable, ordered whiteboard actions (replayable).
- `whiteboard_snapshots` materialised board state at `last_sequence_no`.

Chat messages reuse `agent_messages` through `agent_session_id`.
"""
import uuid

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base

# JSONB on Postgres, generic JSON elsewhere.
JSONType = JSON().with_variant(JSONB(), "postgresql")

SESSION_STATUSES = ("idle", "running", "completed", "failed")


class ClassroomSession(Base):
    __tablename__ = "classroom_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    agent_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_sessions.id", ondelete="CASCADE"), unique=True
    )
    title: Mapped[str] = mapped_column(String(200), default="New classroom")
    status: Mapped[str] = mapped_column(String(20), default="idle")  # idle | running | completed | failed
    # The turn (run) currently allowed to write events. NULL when nothing runs.
    active_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    run_lease_expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    summary: Mapped[str | None] = mapped_column(Text)
    summary_version: Mapped[int] = mapped_column(Integer, default=0)
    last_event_seq: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_activity_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WhiteboardEvent(Base):
    __tablename__ = "whiteboard_events"
    __table_args__ = (
        UniqueConstraint("session_id", "sequence_no", name="uq_whiteboard_events_session_seq"),
        UniqueConstraint("session_id", "event_id", name="uq_whiteboard_events_session_event"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classroom_sessions.id", ondelete="CASCADE"), index=True
    )
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    step_id: Mapped[str | None] = mapped_column(String(100))
    turn_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    payload: Mapped[dict] = mapped_column(JSONType, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WhiteboardSnapshot(Base):
    __tablename__ = "whiteboard_snapshots"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classroom_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    version: Mapped[int] = mapped_column(Integer, default=0)
    board_state: Mapped[dict] = mapped_column(JSONType, nullable=False)
    last_sequence_no: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
