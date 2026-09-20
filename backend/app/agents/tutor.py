"""Tutor streaming chain — build a grounded prompt and stream the answer.

Single streaming chain (no LangGraph): compose the system prompt with numbered
retrieved context, then `get_llm().astream(...)` yielding each token's content.
"""
from __future__ import annotations

from typing import AsyncIterator

from langchain_core.messages import SystemMessage, HumanMessage

from app.agents.llm import get_llm
from app.agents.prompts import (
    TUTOR_SYSTEM_PROMPT,
    TUTOR_DEFAULT_LEVEL,
    TUTOR_DEFAULT_CONCEPT,
)
from app.rag.retrieval import RetrievedChunk


def _format_context(retrieved_chunks: list[RetrievedChunk]) -> str:
    """Number the retrieved chunks so the model can cite them as [1], [2], ..."""
    if not retrieved_chunks:
        return "(no relevant sources were retrieved)"
    lines = []
    for i, chunk in enumerate(retrieved_chunks, start=1):
        lines.append(f"[{i}] {chunk.title}: {chunk.content}")
    return "\n\n".join(lines)


async def stream_tutor_answer(
    question: str,
    retrieved_chunks: list[RetrievedChunk],
    context: dict | None = None,
) -> AsyncIterator[str]:
    """Stream a grounded tutor answer token-by-token.

    `context` may carry `level` and `concept` for the prompt slots.
    """
    context = context or {}
    system = TUTOR_SYSTEM_PROMPT.format(
        level=context.get("level", TUTOR_DEFAULT_LEVEL),
        concept=context.get("concept", TUTOR_DEFAULT_CONCEPT),
        context=_format_context(retrieved_chunks),
    )
    messages = [SystemMessage(content=system), HumanMessage(content=question)]

    async for chunk in get_llm().astream(messages):
        token = getattr(chunk, "content", "")
        if token:
            yield token
