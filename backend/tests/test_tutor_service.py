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


class _Savepoint:
    """Stands in for AsyncSession.begin_nested(): records the exception it saw."""

    def __init__(self):
        self.entered = False
        self.exc = None

    async def __aenter__(self):
        self.entered = True
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self.exc = exc
        return False  # never swallow, like the real savepoint


def _make_mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.begin_nested = MagicMock(return_value=_Savepoint())
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    # db.execute is AsyncMock by default; its return_value must support
    # .scalars().all() as synchronous calls (used by the history fetch).
    exec_result = MagicMock()
    exec_result.scalars.return_value.all.return_value = []
    db.execute.return_value = exec_result
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

        user_id = uuid.uuid4()
        existing = MagicMock(spec=AgentSession)
        existing.user_id = user_id
        db = _make_mock_db()
        db.get = AsyncMock(return_value=existing)
        body = TutorChatRequest(message="hi", session_id=uuid.uuid4())

        await start_message(db, user_id, body)

        added = [call.args[0] for call in db.add.call_args_list]
        assert not any(isinstance(a, AgentSession) for a in added)
        assert any(isinstance(a, AgentMessage) for a in added)

    @pytest.mark.asyncio
    async def test_rejects_other_users_session(self):
        from app.services.tutor_service import start_message
        from app.models.agent import AgentSession
        from app.exceptions import NotFoundError

        existing = MagicMock(spec=AgentSession)
        existing.user_id = uuid.uuid4()
        db = _make_mock_db()
        db.get = AsyncMock(return_value=existing)
        body = TutorChatRequest(message="hi", session_id=uuid.uuid4())

        with pytest.raises(NotFoundError):
            await start_message(db, uuid.uuid4(), body)

        db.add.assert_not_called()
        db.commit.assert_not_awaited()


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
                MagicMock(return_value=_aiter(["Super", "position [1]"])),
            ),
            patch("app.services.tutor_service.publish_tutor_token", spy_token),
            patch("app.services.tutor_service.publish_tutor_complete", spy_complete),
        ):
            await run_and_stream(session_id, user_id, "What is superposition?", None)

        # tokens streamed in order
        token_args = [c.args[1] for c in spy_token.await_args_list]
        assert token_args == ["Super", "position [1]"]

        # assistant message persisted with citations
        added = [call.args[0] for call in db.add.call_args_list]
        assistant = [a for a in added if isinstance(a, AgentMessage) and a.role == "assistant"]
        assert len(assistant) == 1
        assert assistant[0].content == "Superposition [1]"
        assert assistant[0].citations and assistant[0].citations[0]["title"] == "Superposition"

        # complete published with citations
        spy_complete.assert_awaited_once()
        complete_payload = spy_complete.await_args.args[1]
        assert complete_payload["content"] == "Superposition [1]"
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


# ---------------------------------------------------------------------------
# run_and_stream — history- and lesson-aware retrieval query
# ---------------------------------------------------------------------------

def _msg(role, content):
    m = MagicMock()
    m.role = role
    m.content = content
    return m


async def _run_capturing(db, message, lesson_id=None, chunks=None, tokens=("ok",)):
    """Run run_and_stream with everything patched; return (retrieve_mock, stream_mock)."""
    from app.services.tutor_service import run_and_stream

    retrieve_mock = AsyncMock(return_value=_canned_chunks() if chunks is None else chunks)
    stream_mock = MagicMock(return_value=_aiter(list(tokens)))
    spy_complete = AsyncMock()
    with (
        patch(
            "app.services.tutor_service.AsyncSessionLocal",
            MagicMock(return_value=_make_session_cm(db)()),
        ),
        patch("app.services.tutor_service.retrieve", retrieve_mock),
        patch("app.services.tutor_service.stream_tutor_answer", stream_mock),
        patch("app.services.tutor_service.publish_tutor_token", AsyncMock()),
        patch("app.services.tutor_service.publish_tutor_complete", spy_complete),
    ):
        await run_and_stream(uuid.uuid4(), uuid.uuid4(), message, lesson_id)
    return retrieve_mock, stream_mock, spy_complete


class TestRetrievalQuery:
    @pytest.mark.asyncio
    async def test_follow_up_query_includes_prior_user_turn(self):
        from app.rag.retrieval import RetrievalQuery

        db = _make_mock_db()
        db.execute.return_value.scalars.return_value.all.return_value = [
            _msg("user", "what does the hadamard gate do"),
            _msg("assistant", "It creates an equal superposition [1]."),
            _msg("user", "why?"),  # the current message, already persisted
        ]

        retrieve_mock, stream_mock, _ = await _run_capturing(db, "why?")

        query = retrieve_mock.await_args.args[1]
        assert isinstance(query, RetrievalQuery)
        assert "what does the hadamard gate do" in query.text
        assert query.text.endswith("why?")
        assert query.content_ref_id is None
        # the history is still passed to the model, without the current message
        prior = stream_mock.call_args.kwargs["prior_messages"]
        assert [m.content for m in prior] == [
            "what does the hadamard gate do",
            "It creates an equal superposition [1].",
        ]

    @pytest.mark.asyncio
    async def test_first_turn_query_is_just_the_message(self):
        db = _make_mock_db()
        db.execute.return_value.scalars.return_value.all.return_value = [_msg("user", "what is a qubit")]

        retrieve_mock, _, _ = await _run_capturing(db, "what is a qubit")

        assert retrieve_mock.await_args.args[1].text == "what is a qubit"

    @pytest.mark.asyncio
    async def test_query_capped_at_150_words_keeping_current_message_last(self):
        db = _make_mock_db()
        db.execute.return_value.scalars.return_value.all.return_value = [
            _msg("user", " ".join(f"old{i}" for i in range(200))),
            _msg("assistant", "answer"),
            _msg("user", "current question here"),
        ]

        retrieve_mock, _, _ = await _run_capturing(db, "current question here")

        words = retrieve_mock.await_args.args[1].text.split()
        assert len(words) == 150
        assert words[-3:] == ["current", "question", "here"]
        assert words[-4] == "old199"  # the prior turn's most recent words survive

    @pytest.mark.asyncio
    async def test_lesson_id_sets_boost_and_concept_from_lesson_title(self):
        lesson_id = uuid.uuid4()
        db = _make_mock_db()
        db.scalar = AsyncMock(return_value="The Hadamard Gate")

        retrieve_mock, stream_mock, _ = await _run_capturing(db, "explain this", lesson_id=lesson_id)

        query = retrieve_mock.await_args.args[1]
        assert query.content_ref_id == lesson_id
        assert stream_mock.call_args.kwargs["context"]["concept"] == "The Hadamard Gate"

    @pytest.mark.asyncio
    async def test_unknown_lesson_id_keeps_default_concept(self):
        lesson_id = uuid.uuid4()
        db = _make_mock_db()
        db.scalar = AsyncMock(return_value=None)

        _, stream_mock, spy_complete = await _run_capturing(
            db, "explain this", lesson_id=lesson_id
        )

        context = stream_mock.call_args.kwargs["context"] or {}
        assert "concept" not in context
        assert "error" not in spy_complete.await_args.args[1]

    @pytest.mark.asyncio
    async def test_lesson_lookup_runs_in_a_savepoint(self):
        db = _make_mock_db()
        db.scalar = AsyncMock(return_value="The Hadamard Gate")

        await _run_capturing(db, "explain this", lesson_id=uuid.uuid4())

        db.begin_nested.assert_called_once()
        assert db.begin_nested.return_value.entered

    @pytest.mark.asyncio
    async def test_failed_lesson_lookup_rolls_back_its_savepoint_and_still_retrieves(self):
        db = _make_mock_db()
        boom = RuntimeError("relation lessons does not exist")
        db.scalar = AsyncMock(side_effect=boom)

        retrieve_mock, stream_mock, spy_complete = await _run_capturing(
            db, "explain this", lesson_id=uuid.uuid4()
        )

        # the error left through the savepoint, so only the savepoint is rolled back
        assert db.begin_nested.return_value.exc is boom
        retrieve_mock.assert_awaited_once()
        assert "concept" not in (stream_mock.call_args.kwargs["context"] or {})
        assert "error" not in spy_complete.await_args.args[1]

    @pytest.mark.asyncio
    async def test_no_lesson_id_skips_lesson_lookup(self):
        db = _make_mock_db()
        db.scalar = AsyncMock()

        retrieve_mock, _, _ = await _run_capturing(db, "hi")

        db.scalar.assert_not_awaited()
        assert retrieve_mock.await_args.args[1].content_ref_id is None

    @pytest.mark.asyncio
    async def test_logs_retrieval_once_per_turn(self):
        db = _make_mock_db()
        with patch("app.services.tutor_service.logger") as log:
            await _run_capturing(db, "what is superposition")

        calls = [c for c in log.info.call_args_list if c.args and c.args[0] == "rag_retrieved"]
        assert len(calls) == 1
        kw = calls[0].kwargs
        assert kw["n"] == 1
        assert kw["top_score"] == pytest.approx(0.9)
        assert kw["lesson_boost"] is False
        assert kw["ms"] >= 0


# ---------------------------------------------------------------------------
# run_and_stream — only sources the answer cites become citations
# ---------------------------------------------------------------------------

def _two_chunks():
    return [
        RetrievedChunk(content="Superposition ...", title="Superposition",
                       source_url="https://qlearn.dev/s", chunk_index=0, score=0.9),
        RetrievedChunk(content="Hadamard ...", title="The Hadamard Gate",
                       source_url="qlearn://lesson/h", chunk_index=0, score=0.7),
    ]


def _persisted_assistant(db):
    from app.models.agent import AgentMessage

    added = [call.args[0] for call in db.add.call_args_list]
    assistant = [a for a in added if isinstance(a, AgentMessage) and a.role == "assistant"]
    assert len(assistant) == 1
    return assistant[0]


class TestCitedOnlyCitations:
    @pytest.mark.asyncio
    async def test_answer_citing_2_gets_exactly_that_citation(self):
        db = _make_mock_db()
        _, _, spy_complete = await _run_capturing(
            db, "q", chunks=_two_chunks(), tokens=("H makes a superposition ", "[2].")
        )

        expected = [{"title": "The Hadamard Gate", "url": "qlearn://lesson/h", "score": 0.7}]
        assert _persisted_assistant(db).citations == expected
        assert spy_complete.await_args.args[1]["citations"] == expected

    @pytest.mark.asyncio
    async def test_answer_without_markers_gets_no_citations(self):
        db = _make_mock_db()
        _, _, spy_complete = await _run_capturing(
            db, "q", chunks=_two_chunks(), tokens=("No markers ", "here.")
        )

        assert _persisted_assistant(db).citations == []
        assert spy_complete.await_args.args[1]["citations"] == []

    @pytest.mark.asyncio
    async def test_citations_follow_first_cited_order_and_ignore_out_of_range(self):
        db = _make_mock_db()
        _, _, spy_complete = await _run_capturing(
            db, "q", chunks=_two_chunks(), tokens=("See [2], then [1] and [7]. Again [2].",)
        )

        titles = [c["title"] for c in spy_complete.await_args.args[1]["citations"]]
        assert titles == ["The Hadamard Gate", "Superposition"]
        # markers renumbered to the citations list's 1-based positions; [7] cites
        # nothing, so it is dropped rather than shown without a source
        expected = "See [1], then [2] and. Again [1]."
        assert spy_complete.await_args.args[1]["content"] == expected
        assert _persisted_assistant(db).content == expected

    @pytest.mark.asyncio
    async def test_sparse_markers_are_renumbered_to_list_positions(self):
        db = _make_mock_db()
        chunks = _two_chunks() + [
            RetrievedChunk(content="c", title="Third", source_url="u3", chunk_index=0, score=0.5),
            RetrievedChunk(content="d", title="Fourth", source_url="u4", chunk_index=0, score=0.4),
        ]
        _, _, spy_complete = await _run_capturing(
            db, "q", chunks=chunks, tokens=("First [2] ", "and then [4].")
        )

        payload = spy_complete.await_args.args[1]
        assert [c["title"] for c in payload["citations"]] == ["The Hadamard Gate", "Fourth"]
        assert payload["content"] == "First [1] and then [2]."
        assert _persisted_assistant(db).content == "First [1] and then [2]."
