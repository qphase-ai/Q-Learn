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
