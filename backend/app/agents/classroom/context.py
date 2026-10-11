"""Bounded context assembly for a classroom turn.

`assemble_context` is pure and enforces every size limit; `load_context` gathers
the inputs from the database (recent messages or summary, latest board snapshot,
RAG chunks, read-only skill mastery). Agents never write to the learner profile.
"""
from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.classroom.state import (
    CONTEXT_BOARD_OBJECTS,
    CONTEXT_HISTORY_MESSAGES,
    CONTEXT_HISTORY_WITH_SUMMARY,
    CONTEXT_MASTERY,
    CONTEXT_MESSAGE_CHARS,
    CONTEXT_SOURCE_CHARS,
    CONTEXT_SOURCES,
    CONTEXT_SUMMARY_CHARS,
    CONTEXT_TOTAL_CHARS,
)

logger = structlog.get_logger(__name__)


def _clip(text: str, limit: int) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _board_brief(obj: dict[str, Any]) -> str:
    kind = obj.get("kind")
    if kind == "circuit":
        gates = obj.get("gates") or []
        return f"{obj.get('qubits')}-qubit circuit, gates: " + " ".join(g.get("type", "?") for g in gates[:16])
    if kind == "equation":
        return _clip(obj.get("latex", ""), 120)
    return _clip(obj.get("text", ""), 120)


def assemble_context(
    *,
    messages: list[dict[str, str]],
    summary: str | None,
    board_state: dict[str, Any] | None,
    sources: list[dict[str, str]] | None = None,
    mastery: list[str] | None = None,
) -> dict[str, Any]:
    """Build the bounded context dict. `messages` excludes the current user turn."""
    keep = CONTEXT_HISTORY_WITH_SUMMARY if summary else CONTEXT_HISTORY_MESSAGES
    history = [
        {"role": m["role"], "content": _clip(m["content"], CONTEXT_MESSAGE_CHARS)}
        for m in messages[-keep:]
        if m.get("role") in ("user", "assistant")
    ]
    board: list[dict[str, str]] = []
    if board_state:
        objects = board_state.get("objects") or {}
        for oid in (board_state.get("order") or [])[-CONTEXT_BOARD_OBJECTS:]:
            obj = objects.get(oid)
            if obj:
                board.append({"id": oid, "kind": obj.get("kind", "?"), "brief": _board_brief(obj)})
    ctx: dict[str, Any] = {
        "history": history,
        "summary": _clip(summary, CONTEXT_SUMMARY_CHARS) if summary else None,
        "board": board,
        "sources": [
            {"title": _clip(s["title"], 100), "content": _clip(s["content"], CONTEXT_SOURCE_CHARS)}
            for s in (sources or [])[:CONTEXT_SOURCES]
        ],
        "mastery": [_clip(m, 60) for m in (mastery or [])[:CONTEXT_MASTERY]],
    }
    # Overall cap: drop the oldest history first, then sources, until it fits.
    while context_size(ctx) > CONTEXT_TOTAL_CHARS and ctx["history"]:
        ctx["history"].pop(0)
    while context_size(ctx) > CONTEXT_TOTAL_CHARS and ctx["sources"]:
        ctx["sources"].pop()
    return ctx


def context_size(ctx: dict[str, Any]) -> int:
    total = len(ctx.get("summary") or "")
    total += sum(len(m["content"]) + len(m["role"]) for m in ctx.get("history", []))
    total += sum(len(b["brief"]) + len(b["id"]) for b in ctx.get("board", []))
    total += sum(len(s["content"]) + len(s["title"]) for s in ctx.get("sources", []))
    total += sum(len(m) for m in ctx.get("mastery", []))
    return total


def build_summary(messages: list[dict[str, str]], limit: int = CONTEXT_SUMMARY_CHARS) -> str:
    """Deterministic summary of older turns: the student's questions, newest last.

    No LLM call — a refresh must not spend rate-limit budget. Keeps the tail
    that fits in `limit`.
    """
    bullets = [f"- {_clip(m['content'], 140)}" for m in messages if m.get("role") == "user"]
    out: list[str] = []
    size = 0
    for b in reversed(bullets):
        if size + len(b) + 1 > limit:
            break
        out.append(b)
        size += len(b) + 1
    return "Topics the student asked about:\n" + "\n".join(reversed(out)) if out else ""


async def _load_mastery(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    """Names of the student's weakest attempted concepts. Read-only; never raises."""
    from app.models.learning import Concept
    from app.models.progress import SkillMastery

    try:
        async with db.begin_nested():
            result = await db.execute(
                select(Concept.name)
                .join(SkillMastery, SkillMastery.concept_id == Concept.id)
                .where(SkillMastery.user_id == user_id, SkillMastery.attempt_count > 0)
                .order_by(SkillMastery.mastery_score.asc())
                .limit(CONTEXT_MASTERY)
            )
            return [row[0] for row in result.all()]
    except Exception as exc:  # noqa: BLE001 — nice-to-have
        logger.warning("classroom_mastery_lookup_failed", error=str(exc))
        return []


async def _load_sources(db: AsyncSession, query_text: str) -> list[dict[str, str]]:
    from app.rag.retrieval import RetrievalQuery, retrieve

    try:
        chunks = await retrieve(db, RetrievalQuery(text=" ".join(query_text.split()[:150])))
    except Exception as exc:  # noqa: BLE001 — answer without sources rather than fail
        logger.warning("classroom_rag_failed", error=str(exc))
        return []
    return [{"title": c.title, "content": c.content} for c in chunks[:CONTEXT_SOURCES]]


async def load_context(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    messages: list[dict[str, str]],
    summary: str | None,
    board_state: dict[str, Any] | None,
    user_message: str,
) -> dict[str, Any]:
    """Gather inputs from the database and assemble the bounded context."""
    sources = await _load_sources(db, user_message)
    mastery = await _load_mastery(db, user_id)
    return assemble_context(
        messages=messages, summary=summary, board_state=board_state, sources=sources, mastery=mastery
    )
