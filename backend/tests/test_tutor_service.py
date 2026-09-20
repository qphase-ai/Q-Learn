"""Tests for the tutor service — start_message and run_and_stream.

Hermetic: retrieve, stream_tutor_answer, and the realtime publishers are all
mocked; the DB session is an AsyncMock. No model, network, or database.
"""
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.retrieval import RetrievedChunk
from app.schemas.tutor import TutorChatRequest


def _make_mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    return db


def _make_session_cm(mock_db):
    @asynccontextmanager
    async def _cm():
        yield mock_db
    return _cm


def _canned_chunks():
    return [
        RetrievedChunk(
            content="Superposition ...",
            title="Superposition",
            source_url="https://qlearn.dev/s",
            chunk_index=0,
            score=0.9,
        ),
    ]


async def _aiter(tokens):
    for t in tokens:
        yield t


# ---------------------------------------------------------------------------
# start_message
# ---------------------------------------------------------------------------

class TestStartMessage:
    @pytest.mark.asyncio
    async def test_writes_session_and_user_message_and_returns_id(self):
        from app.services.tutor_service import start_message
        from app.models.agent import AgentSession, AgentMessage

        db = _make_mock_db()
        db.get = AsyncMock(return_value=None)  # no existing session → create
        session_id = uuid.uuid4()
        user_id = uuid.uuid4()
        body = TutorChatRequest(message="What is superposition?", session_id=session_id)

        returned = await start_message(db, user_id, body)

        assert returned == session_id
        added = [call.args[0] for call in db.add.call_args_list]
        assert any(isinstance(a, AgentSession) for a in added)
        user_msgs = [a for a in added if isinstance(a, AgentMessage)]
        assert len(user_msgs) == 1
        assert user_msgs[0].role == "user"
        assert user_msgs[0].content == "What is superposition?"
        db.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_does_not_duplicate_existing_session(self):
        from app.services.tutor_service import start_message
        from app.models.agent import AgentSession, AgentMessage

        existing = MagicMock(spec=AgentSession)
        db = _make_mock_db()
        db.get = AsyncMock(return_value=existing)
        body = TutorChatRequest(message="hi", session_id=uuid.uuid4())

        await start_message(db, uuid.uuid4(), body)

        added = [call.args[0] for call in db.add.call_args_list]
        assert not any(isinstance(a, AgentSession) for a in added)
        assert any(isinstance(a, AgentMessage) for a in added)


# ---------------------------------------------------------------------------
# run_and_stream
# ---------------------------------------------------------------------------

class TestRunAndStream:
    @pytest.mark.asyncio
    async def test_publishes_tokens_persists_assistant_and_completes(self):
        from app.services.tutor_service import run_and_stream
        from app.models.agent import AgentMessage

        session_id = uuid.uuid4()
        user_id = uuid.uuid4()
        db = _make_mock_db()

        spy_token = AsyncMock()
        spy_complete = AsyncMock()

        with (
            patch(
                "app.services.tutor_service.AsyncSessionLocal",
                MagicMock(return_value=_make_session_cm(db)()),
            ),
            patch("app.services.tutor_service.retrieve", AsyncMock(return_value=_canned_chunks())),
            patch(
                "app.services.tutor_service.stream_tutor_answer",
                MagicMock(return_value=_aiter(["Super", "position"])),
            ),
            patch("app.services.tutor_service.publish_tutor_token", spy_token),
            patch("app.services.tutor_service.publish_tutor_complete", spy_complete),
        ):
            await run_and_stream(session_id, user_id, "What is superposition?", None)

        # tokens streamed in order
        token_args = [c.args[1] for c in spy_token.await_args_list]
        assert token_args == ["Super", "position"]

        # assistant message persisted with citations
        added = [call.args[0] for call in db.add.call_args_list]
        assistant = [a for a in added if isinstance(a, AgentMessage) and a.role == "assistant"]
        assert len(assistant) == 1
        assert assistant[0].content == "Superposition"
        assert assistant[0].citations and assistant[0].citations[0]["title"] == "Superposition"

        # complete published with citations
        spy_complete.assert_awaited_once()
        complete_payload = spy_complete.await_args.args[1]
        assert complete_payload["content"] == "Superposition"
        assert complete_payload["citations"][0]["title"] == "Superposition"
        assert "error" not in complete_payload

    @pytest.mark.asyncio
    async def test_error_path_publishes_error_complete_without_raising(self):
        from app.services.tutor_service import run_and_stream
        from app.models.agent import AgentMessage

        session_id = uuid.uuid4()
        db = _make_mock_db()

        spy_complete = AsyncMock()

        def _boom(*a, **k):
            raise RuntimeError("llm exploded")

        with (
            patch(
                "app.services.tutor_service.AsyncSessionLocal",
                MagicMock(return_value=_make_session_cm(db)()),
            ),
            patch("app.services.tutor_service.retrieve", AsyncMock(return_value=_canned_chunks())),
            patch("app.services.tutor_service.stream_tutor_answer", MagicMock(side_effect=_boom)),
            patch("app.services.tutor_service.publish_tutor_token", AsyncMock()),
            patch("app.services.tutor_service.publish_tutor_complete", spy_complete),
        ):
            # must not raise
            await run_and_stream(session_id, uuid.uuid4(), "q", None)

        spy_complete.assert_awaited_once()
        payload = spy_complete.await_args.args[1]
        assert "error" in payload

        # no successful assistant message persisted
        added = [call.args[0] for call in db.add.call_args_list]
        good_assistant = [
            a for a in added
            if isinstance(a, AgentMessage) and a.role == "assistant" and getattr(a, "content", "")
        ]
        assert good_assistant == []
