"""Pydantic request/response schemas for the AI Tutor (kept separate from ORM)."""
from __future__ import annotations

import uuid

from pydantic import BaseModel


class Citation(BaseModel):
    title: str
    url: str | None = None
    score: float


class TutorChatRequest(BaseModel):
    message: str
    session_id: uuid.UUID
    lesson_id: uuid.UUID | None = None


class TutorChatAccepted(BaseModel):
    session_id: uuid.UUID
    status: str


class MessageOut(BaseModel):
    role: str
    content: str
    citations: list[Citation] = []


class TutorSessionResponse(BaseModel):
    session_id: uuid.UUID
    messages: list[MessageOut]
