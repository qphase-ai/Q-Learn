"""RAG embedding helper — all-MiniLM-L6-v2 (dim=384).

The SentenceTransformer model is heavy (loads weights, may download on first use)
so it is created lazily on the first embed call and cached as a module-level
singleton — never at import time. Tests monkeypatch `_load_model` and reset
`_model` to stay hermetic.
"""
from __future__ import annotations

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

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


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings into a list of 384-dim vectors."""
    vecs = _get_model().encode(texts)
    return [list(v) for v in vecs]
