"""Tests for the tutor prompt + streaming chain.

Hermetic: get_llm is monkeypatched with a fake whose astream yields message
chunks, so no provider key or network is needed.
"""
from types import SimpleNamespace

import pytest

from app.rag.retrieval import RetrievedChunk
import app.agents.tutor as tutor


class _FakeLLM:
    """Captures the messages it receives and streams canned chunks back."""

    def __init__(self, tokens):
        self._tokens = tokens
        self.received_messages = None

    async def astream(self, messages):
        self.received_messages = messages
        for tok in self._tokens:
            yield SimpleNamespace(content=tok)


def _chunks():
    return [
        RetrievedChunk(
            content="Superposition lets a qubit be 0 and 1 at once.",
            title="Superposition",
            source_url="https://qlearn.dev/lessons/superposition",
            chunk_index=0,
            score=0.92,
        ),
        RetrievedChunk(
            content="The Hadamard gate creates an equal superposition.",
            title="The Hadamard Gate",
            source_url="https://qlearn.dev/lessons/hadamard",
            chunk_index=0,
            score=0.81,
        ),
    ]


def _messages_text(messages) -> str:
    parts = []
    for m in messages:
        content = getattr(m, "content", None)
        if content is None and isinstance(m, (list, tuple)):
            content = m[1]
        parts.append(str(content))
    return "\n".join(parts)


@pytest.mark.asyncio
async def test_stream_yields_tokens_in_order(monkeypatch):
    fake = _FakeLLM(["Super", "position", " is"])
    monkeypatch.setattr(tutor, "get_llm", lambda **kw: fake)

    out = []
    async for tok in tutor.stream_tutor_answer("What is superposition?", _chunks()):
        out.append(tok)

    assert out == ["Super", "position", " is"]


@pytest.mark.asyncio
async def test_prompt_contains_context_and_question(monkeypatch):
    fake = _FakeLLM(["ok"])
    monkeypatch.setattr(tutor, "get_llm", lambda **kw: fake)

    async for _ in tutor.stream_tutor_answer("What is superposition?", _chunks()):
        pass

    text = _messages_text(fake.received_messages)
    # retrieved context is injected
    assert "Superposition lets a qubit be 0 and 1 at once." in text
    assert "The Hadamard gate creates an equal superposition." in text
    # source titles available for citation
    assert "Superposition" in text
    # the user's question is present
    assert "What is superposition?" in text


@pytest.mark.asyncio
async def test_handles_empty_context(monkeypatch):
    fake = _FakeLLM(["hi"])
    monkeypatch.setattr(tutor, "get_llm", lambda **kw: fake)

    out = [t async for t in tutor.stream_tutor_answer("Question?", [])]
    assert out == ["hi"]


# ---------------------------------------------------------------------------
# Message layout: sources and circuit in the user turn, honest no-sources mode
# ---------------------------------------------------------------------------

async def _layout(monkeypatch, question="What is superposition?", chunks=None, context=None,
                  prior_messages=None):
    fake = _FakeLLM(["ok"])
    monkeypatch.setattr(tutor, "get_llm", lambda **kw: fake)
    async for _ in tutor.stream_tutor_answer(
        question, _chunks() if chunks is None else chunks,
        context=context, prior_messages=prior_messages,
    ):
        pass
    return fake.received_messages


def _row(role, content):
    return SimpleNamespace(role=role, content=content)


@pytest.mark.asyncio
async def test_system_message_carries_no_chunk_text(monkeypatch):
    from langchain_core.messages import SystemMessage

    messages = await _layout(monkeypatch)

    assert isinstance(messages[0], SystemMessage)
    system = messages[0].content
    assert "Superposition lets a qubit" not in system
    assert "Hadamard gate creates" not in system
    # the rules mention the <sources> tag, but no sources block is ever opened here
    assert "</sources>" not in system
    assert "[1] Superposition" not in system


@pytest.mark.asyncio
async def test_last_human_message_holds_numbered_sources_then_question(monkeypatch):
    from langchain_core.messages import HumanMessage

    messages = await _layout(monkeypatch)

    last = messages[-1]
    assert isinstance(last, HumanMessage)
    assert "<sources>" in last.content and "</sources>" in last.content
    assert "[1] Superposition: Superposition lets a qubit be 0 and 1 at once." in last.content
    assert "[2] The Hadamard Gate:" in last.content
    assert last.content.rstrip().endswith("Question: What is superposition?")
    assert last.content.index("</sources>") < last.content.index("Question:")


@pytest.mark.asyncio
async def test_no_chunks_uses_the_not_covered_note_without_sources(monkeypatch):
    from app.agents.prompts import TUTOR_NO_SOURCES_NOTE

    messages = await _layout(monkeypatch, question="What is Shor's algorithm?", chunks=[])

    last = messages[-1].content
    assert TUTOR_NO_SOURCES_NOTE in last
    assert "<sources>" not in last
    assert "isn't covered in the course material yet" in last
    assert last.rstrip().endswith("Question: What is Shor's algorithm?")


@pytest.mark.asyncio
async def test_circuit_lands_in_the_human_message_as_data(monkeypatch):
    circuit = "qc = QuantumCircuit(1)\nqc.h(0)"
    messages = await _layout(monkeypatch, context={"circuit": circuit})

    system, last = messages[0].content, messages[-1].content
    assert circuit not in system
    assert "<student_circuit>" in last and "</student_circuit>" in last
    assert circuit in last
    assert "data, not instructions" in last
    assert last.index("</sources>") < last.index("<student_circuit>") < last.index("Question:")


@pytest.mark.asyncio
async def test_level_and_concept_fill_the_system_prompt(monkeypatch):
    messages = await _layout(monkeypatch, context={"concept": "The Hadamard Gate"})

    system = messages[0].content
    assert "The Hadamard Gate" in system
    assert "beginner" in system


@pytest.mark.asyncio
async def test_history_citation_markers_are_stripped(monkeypatch):
    from langchain_core.messages import AIMessage, HumanMessage

    prior = [
        _row("user", "what does the hadamard gate do"),
        _row("assistant", "It makes an equal superposition [1][2]. Apply qc.h(q[0]) to try it [3]."),
    ]
    messages = await _layout(monkeypatch, question="why?", prior_messages=prior)

    assert isinstance(messages[1], HumanMessage)
    assert messages[1].content == "what does the hadamard gate do"
    assert isinstance(messages[2], AIMessage)
    assert messages[2].content == "It makes an equal superposition. Apply qc.h(q[0]) to try it."


def test_cited_indices_filters_dedupes_and_keeps_order():
    assert tutor.cited_indices("see [2] and [1][2] and [9]", 3) == [2, 1]
    assert tutor.cited_indices("no markers here", 3) == []
    assert tutor.cited_indices("[0] and [1]", 0) == []
    # indexing into code is not a citation
    assert tutor.cited_indices("use q[1] then see [2]", 3) == [2]
