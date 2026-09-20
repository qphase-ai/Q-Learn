"""Tests for tutor realtime publishers + tutor schemas.

Hermetic: `_broadcast` is monkeypatched with a spy so nothing hits Supabase.
"""
import uuid
from unittest.mock import AsyncMock

import pytest

import app.services.realtime_service as realtime
from app.schemas.tutor import (
    Citation,
    TutorChatRequest,
    TutorChatAccepted,
    MessageOut,
    TutorSessionResponse,
)


@pytest.mark.asyncio
async def test_publish_tutor_complete_broadcasts_complete_event(monkeypatch):
    spy = AsyncMock()
    monkeypatch.setattr(realtime, "_broadcast", spy)

    payload = {"message_id": "m1", "content": "done", "citations": []}
    await realtime.publish_tutor_complete("s", payload)

    spy.assert_awaited_once_with("tutor:s", "complete", payload)


@pytest.mark.asyncio
async def test_publish_tutor_token_still_broadcasts_token(monkeypatch):
    spy = AsyncMock()
    monkeypatch.setattr(realtime, "_broadcast", spy)

    await realtime.publish_tutor_token("s", "Hello")

    spy.assert_awaited_once_with("tutor:s", "token", {"token": "Hello"})


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

def test_citation_schema():
    c = Citation(title="Superposition", url="https://qlearn.dev/s", score=0.9)
    assert c.title == "Superposition"
    assert c.url == "https://qlearn.dev/s"
    assert c.score == 0.9


def test_tutor_chat_request_lesson_id_optional():
    sid = uuid.uuid4()
    body = TutorChatRequest(message="hi", session_id=sid)
    assert body.session_id == sid
    assert body.lesson_id is None

    lid = uuid.uuid4()
    body2 = TutorChatRequest(message="hi", session_id=sid, lesson_id=lid)
    assert body2.lesson_id == lid


def test_tutor_chat_accepted():
    sid = uuid.uuid4()
    acc = TutorChatAccepted(session_id=sid, status="pending")
    assert acc.status == "pending"


def test_tutor_session_response_nests_messages_and_citations():
    resp = TutorSessionResponse(
        session_id=uuid.uuid4(),
        messages=[
            MessageOut(role="user", content="What is superposition?", citations=[]),
            MessageOut(
                role="assistant",
                content="It is ...",
                citations=[Citation(title="Superposition", url="u", score=0.8)],
            ),
        ],
    )
    assert len(resp.messages) == 2
    assert resp.messages[1].citations[0].title == "Superposition"
