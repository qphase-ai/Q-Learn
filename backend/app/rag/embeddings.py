"""RAG embedding helper — all-MiniLM-L6-v2 (dim=384).

The SentenceTransformer model is heavy (loads weights, may download on first use)
so it is created lazily on the first embed call and cached as a module-level
singleton — never at import time. Tests monkeypatch `_load_model` and reset
`_model` to stay hermetic.

Encoding is CPU-bound: async callers use `aembed_text`, which runs it in a
worker thread so the event loop keeps serving. The app lifespan calls
`warm_up` so the first tutor request does not pay the model load.
"""
from __future__ import annotations

import asyncio

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
# all-MiniLM-L6-v2 truncates input at 256 wordpieces. English prose runs about
# 1.3 wordpieces per word, so ~200 words is the widest chunk embedded in full.
# settings.rag_chunk_words must not exceed this.
MAX_WORDS_PER_CHUNK = 200

_model = None


def _load_model():
    """Import and construct the SentenceTransformer. Isolated so tests can patch it."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)


def _get_model():
    global _model
    if _model is None:
        _model = _load_model()
    return _model


def embed_text(text: str) -> list[float]:
    """Embed a single string into a 384-dim vector."""
    vec = _get_model().encode(text)
    return list(vec)


async def aembed_text(text: str) -> list[float]:
    """Embed a single string without blocking the event loop."""
    return await asyncio.to_thread(embed_text, text)


def warm_up() -> None:
    """Load the model now (idempotent). Blocking — call it via a thread."""
    _get_model()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings into a list of 384-dim vectors."""
    vecs = _get_model().encode(texts)
    return [list(v) for v in vecs]
