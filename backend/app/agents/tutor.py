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

# A citation marker: [2], or a comma list like [1, 3]. Not directly after an
# identifier character, `)`, `(` or `[`, so indexing (q[1], f(x)[0]) and list
# arguments (f([0])) aren't mistaken for one; [1][2] still counts.
_CITATION_RE = re.compile(r"(?<![\w)(\[])\[(\d+(?:[ \t]*,[ \t]*\d+)*)\]")
# Code the model writes: fenced blocks (an unclosed fence runs to the end) and
# inline spans. Brackets in code are never citations.
_CODE_RE = re.compile(r"```.*?(?:```|\Z)|(`+)[^\n]*?\1", re.DOTALL)
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


def _in_open_call(line_prefix: str) -> bool:
    """True when the text ends inside a call's parentheses, e.g. `qc.measure([0], `.

    A call paren directly follows an identifier character or `]`/`)`; prose
    parentheses ("(see [1])") follow a space and don't count.
    """
    stack: list[bool] = []
    for i, ch in enumerate(line_prefix):
        if ch == "(":
            stack.append(i > 0 and (line_prefix[i - 1].isalnum() or line_prefix[i - 1] in "_])"))
        elif ch == ")" and stack:
            stack.pop()
    return any(stack)


def _citation_markers(text: str) -> list[re.Match[str]]:
    """The [n] / [n, m] markers in `text` that are citations, in order.

    Skips markers inside code spans and inside an open call's arguments.
    """
    code = [m.span() for m in _CODE_RE.finditer(text)]
    markers = []
    for match in _CITATION_RE.finditer(text):
        start = match.start()
        if any(lo <= start < hi for lo, hi in code):
            continue
        if _in_open_call(text[text.rfind("\n", 0, start) + 1:start]):
            continue
        markers.append(match)
    return markers


def _numbers(marker: re.Match[str]) -> list[int]:
    return [int(part) for part in marker.group(1).split(",")]


def _strip_citations(text: str) -> str:
    """Drop [n] markers from an earlier answer; its numbers meant other sources."""
    out: list[str] = []
    pos = 0
    for marker in _citation_markers(text):
        out.append(text[pos:marker.start()].rstrip(" \t"))
        pos = marker.end()
    out.append(text[pos:])
    return "".join(out)


def cited_indices(answer: str, n: int) -> list[int]:
    """1-based source numbers the answer cites, in first-seen order, within 1..n."""
    seen: list[int] = []
    for marker in _citation_markers(answer):
        for i in _numbers(marker):
            if 1 <= i <= n and i not in seen:
                seen.append(i)
    return seen


def renumber_citations(answer: str, n: int) -> str:
    """Rewrite in-range [n] markers to their position in `cited_indices` order.

    The citations list holds only the cited sources, in first-cited order, and
    clients label them [1], [2], ... by position; the answer's markers must match.
    Numbers outside 1..n cite nothing and are left as they are.
    """
    new_number = {old: new for new, old in enumerate(cited_indices(answer, n), start=1)}
    out: list[str] = []
    pos = 0
    for marker in _citation_markers(answer):
        renumbered: list[int] = []
        for i in _numbers(marker):
            j = new_number.get(i, i)
            if j not in renumbered:
                renumbered.append(j)
        out.append(answer[pos:marker.start()])
        out.append("[" + ", ".join(str(j) for j in renumbered) + "]")
        pos = marker.end()
    out.append(answer[pos:])
    return "".join(out)


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
