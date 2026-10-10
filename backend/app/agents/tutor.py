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
# Math in an answer: \[…\] or $$…$$ (display), \(…\) or $…$ (inline). Clients
# render only the dollar forms.
_MATH_RE = re.compile(
    r"\\\[(?P<d1>.+?)\\\]|\$\$(?P<d2>.+?)\$\$|\\\((?P<i1>[^\n]+?)\\\)|(?<!\$)\$(?P<i2>[^$\n]+?)\$",
    re.DOTALL,
)
# A citation the model put inside math, e.g. `\text{[1]}`. Anchored on the literal
# `\text{` so matching stays linear; the spacing before it (`\quad`, `\,`, ...)
# is trimmed separately by _rstrip_math_spacing.
_MATH_CITATION_RE = re.compile(r"\\text\{[ \t]*\[(\d+(?:[ \t]*,[ \t]*\d+)*)\][ \t]*\}")
_MATH_SPACING = ("\\qquad", "\\quad", "\\,", "\\;", "\\:", "\\!", "\\ ", "~")
# A closing tag of one of the data blocks, tolerant of case and inner spaces.
_DATA_CLOSING_TAG_RE = re.compile(r"<\s*/\s*(sources|student_circuit)\s*>", re.IGNORECASE)


def _rstrip_math_spacing(text: str) -> str:
    """Drop trailing whitespace and LaTeX spacing commands (`\\quad`, `\\,`, `~`).

    Scans back from the end one token at a time, so it stays linear.
    """
    end = len(text)
    while end:
        for command in _MATH_SPACING:
            if text.endswith(command, 0, end):
                end -= len(command)
                break
        else:
            if not text[end - 1].isspace():
                break
            end -= 1
    return text[:end]


def _pull_math_citations(inner: str) -> tuple[str, list[str]]:
    """Remove `\\text{[n]}` citations (and the spacing before them) from math."""
    cites: list[str] = []
    out: list[str] = []
    pos = 0
    for m in _MATH_CITATION_RE.finditer(inner):
        cites.append(m.group(1))
        out.append(_rstrip_math_spacing(inner[pos:m.start()]))
        pos = m.end()
    out.append(inner[pos:])
    return "".join(out), cites


def _normalise_math_span(text: str) -> str:
    """normalise_math for text with no code in it."""
    out: list[str] = []
    pos = 0
    for m in _MATH_RE.finditer(text):
        display = m.group("d1") is not None or m.group("d2") is not None
        inner = next(g for g in (m.group("d1"), m.group("d2"), m.group("i1"), m.group("i2")) if g is not None)
        inner, cites = _pull_math_citations(inner)
        dollar_form = m.group("d2") is not None or m.group("i2") is not None
        if dollar_form and not cites:
            continue  # already renderable; leave it exactly as written
        inner = inner.strip()
        markers = "".join(f"[{c}]" for c in cites)
        before = text[pos:m.start()]
        if display:
            if markers:
                body = before.rstrip()
                before = f"{body} {markers}{before[len(body):]}"
            if before and not before.endswith("\n"):
                before += "\n"
            block = f"$$\n{inner}\n$$"
            if m.end() < len(text) and text[m.end()] != "\n":
                block += "\n"
            out.append(before + block)
        else:
            out.append(before + f"${inner}$" + (f" {markers}" if markers else ""))
        pos = m.end()
    out.append(text[pos:])
    return "".join(out)


def normalise_math(answer: str) -> str:
    """Rewrite the answer's math into the delimiters the clients render.

    Web (remark-math) and mobile only recognise `$…$` and `$$…$$`; `\\[…\\]` shows
    up as "[ … ]". Display math goes on its own lines, and citations the model
    put inside math (`\\quad\\text{[1]}`) move outside it so they render as
    citations. Code is left untouched.
    """
    out: list[str] = []
    pos = 0
    for code in _CODE_RE.finditer(answer):
        out.append(_normalise_math_span(answer[pos:code.start()]))
        out.append(code.group(0))
        pos = code.end()
    out.append(_normalise_math_span(answer[pos:]))
    return "".join(out)


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
    Numbers outside 1..n cite nothing and are dropped, and a marker left empty is
    removed, so the answer never shows a citation with no source behind it.
    """
    new_number = {old: new for new, old in enumerate(cited_indices(answer, n), start=1)}
    out: list[str] = []
    pos = 0
    for marker in _citation_markers(answer):
        renumbered: list[int] = []
        for i in _numbers(marker):
            j = new_number.get(i)
            if j is not None and j not in renumbered:
                renumbered.append(j)
        if renumbered:
            out.append(answer[pos:marker.start()])
            out.append("[" + ", ".join(str(j) for j in renumbered) + "]")
        else:
            out.append(answer[pos:marker.start()].rstrip(" \t"))
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
