"""Tests for the RAG embedding helper.

Hermetic — the SentenceTransformer model is never loaded. We monkeypatch the
loader with a fake encoder so tests need no model download or network.
"""
from unittest.mock import MagicMock

import pytest

import app.rag.embeddings as embeddings


class _FakeEncoder:
    """Stand-in for SentenceTransformer: .encode returns fixed 384-length vectors."""

    def __init__(self) -> None:
        self.calls = 0

    def encode(self, texts, **kwargs):
        # sentence-transformers accepts a str or a list[str]; mirror that.
        if isinstance(texts, str):
            self.calls += 1
            return [0.1] * 384
        return [[0.1] * 384 for _ in texts]


@pytest.fixture
def fake_loader(monkeypatch):
    """Patch the module loader to count invocations and return a shared encoder."""
    encoder = _FakeEncoder()
    loader = MagicMock(return_value=encoder)
    # Reset the module-level singleton so each test starts cold.
    monkeypatch.setattr(embeddings, "_model", None)
    monkeypatch.setattr(embeddings, "_load_model", loader)
    return loader


def test_embed_text_returns_384_vector(fake_loader):
    vec = embeddings.embed_text("hello quantum")
    assert isinstance(vec, list)
    assert len(vec) == 384


def test_embed_batch_returns_vectors(fake_loader):
    vecs = embeddings.embed_batch(["a", "b", "c"])
    assert len(vecs) == 3
    assert all(len(v) == 384 for v in vecs)


def test_model_loaded_once_across_calls(fake_loader):
    """The lazy singleton must load the model exactly once, not per call."""
    embeddings.embed_text("first")
    embeddings.embed_text("second")
    embeddings.embed_batch(["third", "fourth"])
    assert fake_loader.call_count == 1
