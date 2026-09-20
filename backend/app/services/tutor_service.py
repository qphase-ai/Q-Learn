"""Tutor service — orchestrates persistence, retrieval, streaming, and realtime.

Flow (mirrors circuits_service):
    Router calls start_message() → upsert AgentSession + persist the user
    AgentMessage (202) → returns session_id.

    Router enqueues run_and_stream() as a BackgroundTask (module-level so it owns
    its own DB session): retrieve() → stream_tutor_answer() publishing each token
    via publish_tutor_token, persist the assistant AgentMessage + citations, then
    publish a `complete` event. Never raises — errors publish an error `complete`.
"""
from __future__ import annotations

import uuid

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tutor import stream_tutor_answer
from app.database import AsyncSessionLocal
from app.models.agent import AgentSession, AgentMessage
from app.rag.retrieval import retrieve
from app.schemas.tutor import TutorChatRequest
from app.services.realtime_service import publish_tutor_token, publish_tutor_complete

logger = structlog.get_logger(__name__)


async def start_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    body: TutorChatRequest,
) -> uuid.UUID:
    """Upsert the session, persist the user's message, commit, return session_id."""
    session = await db.get(AgentSession, body.session_id)
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
) -> None:
    """Retrieve → stream tokens → persist assistant message → publish `complete`.

    Opens its own DB session (the request session is gone by the time this runs
    as a BackgroundTask). Never re-raises: on failure it publishes an error
    `complete` and persists no successful assistant message.
    """
    async with AsyncSessionLocal() as db:
        try:
            chunks = await retrieve(db, message)

            content = ""
            async for token in stream_tutor_answer(message, chunks):
                content += token
                await publish_tutor_token(str(session_id), token)

            citations = _citations_from_chunks(chunks)
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
