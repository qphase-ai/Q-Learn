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


# ---------------------------------------------------------------------------
# Async embedding + warm-up
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aembed_text_returns_vector_off_the_event_loop(monkeypatch):
    import threading

    caller = threading.get_ident()
    seen: list[int] = []

    def _fake_embed(text):
        seen.append(threading.get_ident())
        return [0.5] * 384

    monkeypatch.setattr(embeddings, "embed_text", _fake_embed)

    vec = await embeddings.aembed_text("hello")

    assert vec == [0.5] * 384
    assert seen and seen[0] != caller  # ran in a worker thread


def test_warm_up_loads_model_exactly_once(fake_loader):
    embeddings.warm_up()
    embeddings.warm_up()
    embeddings.embed_text("after warm-up")
    assert fake_loader.call_count == 1


# ---------------------------------------------------------------------------
# App lifespan preloads the model, but never blocks boot
# ---------------------------------------------------------------------------

async def _run_lifespan():
    import app.main as main

    async with main.lifespan(main.app):
        pass


@pytest.mark.asyncio
async def test_lifespan_warms_up_embeddings(monkeypatch):
    import app.main as main

    warm = MagicMock()
    monkeypatch.setattr(main, "warm_up", warm)
    monkeypatch.setattr(main.settings, "rag_warmup_embeddings", True)

    await _run_lifespan()

    warm.assert_called_once()


@pytest.mark.asyncio
async def test_lifespan_skips_warm_up_when_disabled(monkeypatch):
    import app.main as main

    warm = MagicMock()
    monkeypatch.setattr(main, "warm_up", warm)
    monkeypatch.setattr(main.settings, "rag_warmup_embeddings", False)

    await _run_lifespan()

    warm.assert_not_called()


@pytest.mark.asyncio
async def test_lifespan_survives_warm_up_failure(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "warm_up", MagicMock(side_effect=OSError("no network")))
    monkeypatch.setattr(main.settings, "rag_warmup_embeddings", True)

    await _run_lifespan()  # must not raise
