"""Tests for RAG retrieval — retrieve() with a mocked DB session.

Hermetic: embed_text is patched; db.execute returns canned (chunk, doc, distance)
rows. We assert retrieve maps rows to RetrievedChunk with citation metadata,
preserves DB ordering, and converts cosine distance to a similarity score.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.retrieval import retrieve, RetrievedChunk


def _make_chunk(content: str, index: int) -> MagicMock:
    c = MagicMock()
    c.content = content
    c.chunk_index = index
    return c


def _make_doc(title: str, url: str) -> MagicMock:
    d = MagicMock()
    d.title = title
    d.source_url = url
    return d


def _make_result(rows):
    result = MagicMock()
    result.all.return_value = rows
    return result


@pytest.mark.asyncio
async def test_retrieve_maps_rows_to_retrieved_chunks_in_order():
    rows = [
        (_make_chunk("Superposition lets a qubit be 0 and 1.", 0),
         _make_doc("Superposition", "https://example.com/superposition"), 0.10),
        (_make_chunk("The Hadamard gate creates superposition.", 1),
         _make_doc("Hadamard", "https://example.com/hadamard"), 0.25),
    ]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_make_result(rows))

    with patch("app.rag.retrieval.embed_text", return_value=[0.1] * 384):
        out = await retrieve(db, "what is superposition", k=5)

    assert len(out) == 2
    assert all(isinstance(o, RetrievedChunk) for o in out)

    first = out[0]
    assert first.content.startswith("Superposition lets")
    assert first.title == "Superposition"
    assert first.source_url == "https://example.com/superposition"
    assert first.chunk_index == 0
    # score is a cosine similarity (1 - distance); higher for the closer row
    assert first.score == pytest.approx(0.90)
    assert out[1].score == pytest.approx(0.75)
    assert first.score > out[1].score


@pytest.mark.asyncio
async def test_retrieve_passes_k_as_limit():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_make_result([]))

    with patch("app.rag.retrieval.embed_text", return_value=[0.0] * 384):
        out = await retrieve(db, "query", k=3)

    assert out == []
    db.execute.assert_awaited_once()
