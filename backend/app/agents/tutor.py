"""Tutor streaming chain — build a grounded prompt and stream the answer.

Single streaming chain (no LangGraph). The system prompt holds only the role and
the rules. The numbered retrieved sources (or the "not covered" note) and the
student's circuit go into the latest user turn, as delimited data, followed by
the question. Then `get_llm().astream(...)` yields each token's content.
"""
from __future__ import annotations

import re
from typing import AsyncIterator

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.agents.llm import get_llm, estimate_tokens
from app.config import get_settings
from app.agents.prompts import (
    TUTOR_SYSTEM_PROMPT,
    TUTOR_SOURCES_BLOCK,
    TUTOR_NO_SOURCES_NOTE,
    TUTOR_CIRCUIT_BLOCK,
    TUTOR_QUESTION_BLOCK,
    TUTOR_DEFAULT_LEVEL,
    TUTOR_DEFAULT_CONCEPT,
)
from app.rag.retrieval import RetrievedChunk

# A citation marker like [2]. Not preceded by an identifier character or `)`, so
# indexing in code (q[1], f(x)[0]) isn't mistaken for one; [1][2] still counts.
_CITATION_RE = re.compile(r"(?<![\w)])\[(\d+)\]")
_CITATION_STRIP_RE = re.compile(r"[ \t]*(?<![\w)])\[\d+\]")
# A closing tag of one of the data blocks, tolerant of case and inner spaces.
_DATA_CLOSING_TAG_RE = re.compile(r"<\s*/\s*(sources|student_circuit)\s*>", re.IGNORECASE)


def _neutralise_closing_tags(text: str) -> str:
    """Escape </sources> and </student_circuit> inside inserted data.

    Chunk and circuit text is untrusted; a literal closing tag in it would end
    the data block early and let the rest read as instructions.
    """
    return _DATA_CLOSING_TAG_RE.sub(lambda m: f"&lt;/{m.group(1)}&gt;", text)


def _format_context(retrieved_chunks: list[RetrievedChunk]) -> str:
    """Number the retrieved chunks so the model can cite them as [1], [2], ..."""
    return "\n\n".join(
        f"[{i}] {chunk.title}: {chunk.content}"
        for i, chunk in enumerate(retrieved_chunks, start=1)
    )


def _strip_citations(text: str) -> str:
    """Drop [n] markers from an earlier answer; its numbers meant other sources."""
    return _CITATION_STRIP_RE.sub("", text)


def cited_indices(answer: str, n: int) -> list[int]:
    """1-based source numbers the answer cites, in first-seen order, within 1..n."""
    seen: list[int] = []
    for match in _CITATION_RE.finditer(answer):
        i = int(match.group(1))
        if 1 <= i <= n and i not in seen:
            seen.append(i)
    return seen


def renumber_citations(answer: str, n: int) -> str:
    """Rewrite in-range [n] markers to their position in `cited_indices` order.

    The citations list holds only the cited sources, in first-cited order, and
    clients label them [1], [2], ... by position; the answer's markers must match.
    Markers outside 1..n cite nothing and are left as they are.
    """
    new_number = {old: new for new, old in enumerate(cited_indices(answer, n), start=1)}

    def _sub(match: re.Match[str]) -> str:
        i = int(match.group(1))
        return f"[{new_number[i]}]" if i in new_number else match.group(0)

    return _CITATION_RE.sub(_sub, answer)


def _user_turn(
    question: str, retrieved_chunks: list[RetrievedChunk], circuit: str | None
) -> str:
    """Sources (or the not-covered note), then the circuit, then the question."""
    if retrieved_chunks:
        context = _neutralise_closing_tags(_format_context(retrieved_chunks))
        turn = TUTOR_SOURCES_BLOCK.format(context=context)
    else:
        turn = TUTOR_NO_SOURCES_NOTE
    if circuit:
        turn += TUTOR_CIRCUIT_BLOCK.format(circuit=_neutralise_closing_tags(circuit))
    return turn + TUTOR_QUESTION_BLOCK.format(question=question)


async def stream_tutor_answer(
    question: str,
    retrieved_chunks: list[RetrievedChunk],
    context: dict | None = None,
    prior_messages: list | None = None,
) -> AsyncIterator[str]:
    """Stream a grounded tutor answer token-by-token.

    `context` may carry `level` and `concept` for the prompt slots.
    `context` may also carry `circuit` (the student's Qiskit code), which goes
    into the latest user turn as data.
    `prior_messages` are AgentMessage ORM rows from the current session — injected
    between the system prompt and the current question so every model in the router
    pool receives the full conversation context regardless of which one is selected.
    Their [n] markers are stripped, since those numbers meant other sources.
    """
    context = context or {}
    system = TUTOR_SYSTEM_PROMPT.format(
        level=context.get("level", TUTOR_DEFAULT_LEVEL),
        concept=context.get("concept", TUTOR_DEFAULT_CONCEPT),
    )

    history = []
    for msg in (prior_messages or []):
        if msg.role == "user":
            history.append(HumanMessage(content=msg.content))
        else:
            history.append(AIMessage(content=_strip_citations(msg.content)))

    user_turn = _user_turn(question, retrieved_chunks, context.get("circuit"))
    messages = [SystemMessage(content=system)] + history + [HumanMessage(content=user_turn)]

    llm = get_llm(est_tokens=estimate_tokens(messages, get_settings().llm_max_tokens))
    async for chunk in llm.astream(messages):
        token = getattr(chunk, "content", "")
        if token:
            yield token
