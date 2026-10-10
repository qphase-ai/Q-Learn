"""Tutor service — orchestrates persistence, retrieval, streaming, and realtime.

Flow (mirrors circuits_service):
    Router calls start_message() → upsert AgentSession + persist the user
    AgentMessage (202) → returns session_id.

    Router enqueues run_and_stream() as a BackgroundTask (module-level so it owns
    its own DB session): load history → retrieve() with the previous user turn
    and the current lesson → stream_tutor_answer() publishing each token
    via publish_tutor_token, persist the assistant AgentMessage with citations
    for only the sources the answer cites, then publish a `complete` event.
    Never raises — errors publish an error `complete`.
"""
from __future__ import annotations

import time
import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tutor import cited_indices, stream_tutor_answer
from app.database import AsyncSessionLocal
from app.exceptions import NotFoundError
from app.models.agent import AgentSession, AgentMessage
from app.models.learning import Lesson
from app.rag.retrieval import RetrievalQuery, retrieve
from app.schemas.tutor import (
    Citation,
    MessageOut,
    TutorChatRequest,
    TutorSessionResponse,
)
from app.services.realtime_service import publish_tutor_token, publish_tutor_complete

logger = structlog.get_logger(__name__)

# Long enough for a question plus its predecessor; MiniLM sees ~200 words at most.
RETRIEVAL_QUERY_MAX_WORDS = 150


async def start_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    body: TutorChatRequest,
) -> uuid.UUID:
    """Upsert the session, persist the user's message, commit, return session_id.

    404 if the session exists but belongs to another user — same as get_session,
    so a known session UUID can't be used to write into someone else's history.
    """
    session = await db.get(AgentSession, body.session_id)
    if session is not None and session.user_id != user_id:
        raise NotFoundError("Session not found")
    if session is None:
        session = AgentSession(
            id=body.session_id,
            user_id=user_id,
            session_type="tutor",
        )
        db.add(session)

    db.add(
        AgentMessage(
            session_id=body.session_id,
            role="user",
            content=body.message,
        )
    )

    await db.commit()
    return body.session_id


async def get_session(
    db: AsyncSession,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> TutorSessionResponse:
    """Return the session's message history. 404 if missing or not owned."""
    session = await db.get(AgentSession, session_id)
    if session is None or session.user_id != user_id:
        raise NotFoundError("Session not found")

    result = await db.execute(
        select(AgentMessage)
        .where(AgentMessage.session_id == session_id)
        .order_by(AgentMessage.created_at)
    )
    messages = result.scalars().all()

    return TutorSessionResponse(
        session_id=session_id,
        messages=[
            MessageOut(
                role=m.role,
                content=m.content,
                citations=[Citation(**c) for c in (m.citations or [])],
            )
            for m in messages
        ],
    )


def _retrieval_text(message: str, prior_messages: list) -> str:
    """The current message, preceded by the previous user turn, capped in words.

    A follow-up like "why?" retrieves nothing useful alone, so the last prior
    user message rides along. The current message always survives the cap and
    stays last; the prior turn keeps its most recent words. No LLM call.
    """
    current = message.split()[:RETRIEVAL_QUERY_MAX_WORDS]
    prior_user = next((m.content for m in reversed(prior_messages) if m.role == "user"), "")
    budget = RETRIEVAL_QUERY_MAX_WORDS - len(current)
    prior = prior_user.split()[-budget:] if budget > 0 else []
    return " ".join(prior + current)


async def _lesson_concept(db: AsyncSession, lesson_id: uuid.UUID | None) -> str | None:
    """Title of the student's current lesson, or None. Never raises.

    lesson_id is a content_refs id; legacy `lessons` rows share the same UUID
    (see app/models/content_ref.py). An id with no lessons row (e.g. a
    Payload-only lesson) keeps the default concept.
    """
    if lesson_id is None:
        return None
    try:
        return await db.scalar(select(Lesson.title).where(Lesson.id == lesson_id))
    except Exception as exc:  # noqa: BLE001 — the concept is a nice-to-have
        logger.warning("tutor_lesson_lookup_failed", lesson_id=str(lesson_id), error=str(exc))
        return None


def _citations_from_chunks(chunks) -> list[dict]:
    """Build JSON-serialisable citation dicts from retrieved chunks."""
    return [
        {"title": c.title, "url": c.source_url, "score": c.score}
        for c in chunks
    ]


async def run_and_stream(
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    message: str,
    lesson_id: uuid.UUID | None,
    circuit_context: str | None = None,
) -> None:
    """Retrieve → stream tokens → persist assistant message → publish `complete`.

    Opens its own DB session (the request session is gone by the time this runs
    as a BackgroundTask). Never re-raises: on failure it publishes an error
    `complete` and persists no successful assistant message.
    """
    async with AsyncSessionLocal() as db:
        try:
            # Load prior turns for this session once: they feed both the retrieval
            # query and the model. All messages are already committed (start_message
            # ran before this task). Drop the last row — it's the current user
            # message we're answering now.
            history_result = await db.execute(
                select(AgentMessage)
                .where(AgentMessage.session_id == session_id)
                .order_by(AgentMessage.created_at.asc())
            )
            all_msgs = history_result.scalars().all()
            prior_messages = list(all_msgs[:-1])[-20:]  # cap at 20 rows (10 turns)

            tutor_context = {}
            if circuit_context:
                tutor_context["circuit"] = circuit_context
            concept = await _lesson_concept(db, lesson_id)
            if concept:
                tutor_context["concept"] = concept

            query = RetrievalQuery(
                text=_retrieval_text(message, prior_messages),
                content_ref_id=lesson_id,
            )
            started = time.perf_counter()
            chunks = await retrieve(db, query)
            logger.info(
                "rag_retrieved",
                session_id=str(session_id),
                n=len(chunks),
                top_score=max((c.score for c in chunks), default=None),
                lesson_boost=lesson_id is not None,
                ms=round((time.perf_counter() - started) * 1000),
            )

            content = ""
            async for token in stream_tutor_answer(message, chunks, context=tutor_context or None, prior_messages=prior_messages):
                content += token
                await publish_tutor_token(str(session_id), token)

            # Only sources the answer actually cites; none if it cited nothing.
            cited = [chunks[i - 1] for i in cited_indices(content, len(chunks))]
            citations = _citations_from_chunks(cited)
            assistant = AgentMessage(
                session_id=session_id,
                role="assistant",
                content=content,
                citations=citations,
            )
            db.add(assistant)
            await db.commit()

            await publish_tutor_complete(
                str(session_id),
                {
                    "message_id": str(assistant.id),
                    "content": content,
                    "citations": citations,
                },
            )

        except Exception as exc:  # noqa: BLE001 — background task, never re-raise
            logger.exception(
                "tutor_stream_failed",
                session_id=str(session_id),
                error=str(exc),
            )
            try:
                await publish_tutor_complete(str(session_id), {"error": str(exc)})
            except Exception:  # noqa: BLE001 — realtime is best-effort
                logger.warning(
                    "realtime_publish_failed_in_background",
                    session_id=str(session_id),
                )
