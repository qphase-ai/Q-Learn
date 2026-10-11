"""Pydantic request/response schemas for the AI Classroom (kept separate from ORM)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.whiteboard import SCHEMA_VERSION

MAX_MESSAGE_CHARS = 2000

EventType = Literal[
    "agent.status",
    "message.delta",
    "message.completed",
    "whiteboard.action",
    "classroom.error",
]
SessionStatus = Literal["idle", "running", "completed", "failed"]


class SessionCreated(BaseModel):
    session_id: uuid.UUID


class TurnRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    client_message_id: uuid.UUID

    @field_validator("message")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message must not be blank")
        return v


class TurnAccepted(BaseModel):
    turn_id: uuid.UUID


class InterruptResult(BaseModel):
    interrupted: bool


class ClassroomMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime | None = None


class ClassroomSessionResponse(BaseModel):
    status: SessionStatus
    messages: list[ClassroomMessageOut]


class ClassroomEnvelope(BaseModel):
    """Realtime / replay envelope. `sequence_no` is set only on durable events."""

    schema_version: int = SCHEMA_VERSION
    event_id: str
    session_id: str
    turn_id: str
    sequence_no: int | None = None
    type: EventType
    step_id: str | None = None
    payload: dict[str, Any]


class BoardSnapshot(BaseModel):
    board_state: dict[str, Any]
    last_sequence_no: int


class ClassroomStateResponse(BaseModel):
    status: SessionStatus
    snapshot: BoardSnapshot | None = None
    events: list[ClassroomEnvelope]


def make_envelope(
    *,
    session_id: str | uuid.UUID,
    turn_id: str | uuid.UUID,
    type: EventType,
    payload: dict[str, Any],
    sequence_no: int | None = None,
    step_id: str | None = None,
    event_id: str | None = None,
) -> dict[str, Any]:
    """Build the wire envelope as a plain dict (what Realtime and replay return)."""
    return {
        "schema_version": SCHEMA_VERSION,
        "event_id": event_id or str(uuid.uuid4()),
        "session_id": str(session_id),
        "turn_id": str(turn_id),
        "sequence_no": sequence_no,
        "type": type,
        "step_id": step_id,
        "payload": payload,
    }
