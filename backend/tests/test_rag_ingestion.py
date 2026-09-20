"""Tests for RAG ingestion — chunk_text (pure) and ingest_document (mocked DB).

Hermetic: embed_batch is patched, the DB session is an AsyncMock. No model or
network I/O.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.ingestion import chunk_text, ingest_document
from app.models.knowledge import KnowledgeDocument, DocumentChunk, KnowledgeEmbedding


# ---------------------------------------------------------------------------
# chunk_text — pure
# ---------------------------------------------------------------------------

def test_chunk_text_short_returns_single_chunk():
    assert chunk_text("just a few words", size=800, overlap=120) == ["just a few words"]


def test_chunk_text_empty_returns_empty():
    assert chunk_text("", size=800, overlap=120) == []


def test_chunk_text_splits_with_overlap_and_covers_all_tokens():
    words = [f"w{i}" for i in range(1000)]
    text = " ".join(words)

    chunks = chunk_text(text, size=400, overlap=100)

    # Multiple chunks produced
    assert len(chunks) > 1

    # Overlap: tail of chunk[0] equals head of chunk[1] (100 tokens)
    c0 = chunks[0].split()
    c1 = chunks[1].split()
    assert c0[-100:] == c1[:100]

    # Coverage: every token appears somewhere, incl. the very last one
    seen = set()
    for c in chunks:
        seen.update(c.split())
    assert seen == set(words)
    assert "w999" in chunks[-1].split()


# ---------------------------------------------------------------------------
# ingest_document — mocked DB + embed_batch
# ---------------------------------------------------------------------------

def _make_mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_ingest_document_writes_document_chunks_and_embeddings():
    words = [f"w{i}" for i in range(1000)]
    text = " ".join(words)
    db = _make_mock_db()

    with patch("app.rag.ingestion.embed_batch") as mock_embed:
        # one 384-vector per chunk
        def _fake_embed(texts):
            return [[0.1] * 384 for _ in texts]

        mock_embed.side_effect = _fake_embed

        doc = await ingest_document(
            db,
            title="Superposition",
            source_url="https://example.com/superposition",
            source_type="documentation",
            text=text,
        )

    assert isinstance(doc, KnowledgeDocument)

    added = [call.args[0] for call in db.add.call_args_list]
    docs = [a for a in added if isinstance(a, KnowledgeDocument)]
    chunks = [a for a in added if isinstance(a, DocumentChunk)]
    embeddings = [a for a in added if isinstance(a, KnowledgeEmbedding)]

    assert len(docs) == 1
    n_chunks = len(chunk_text(text, size=800, overlap=120))
    assert len(chunks) == n_chunks
    assert len(embeddings) == n_chunks
    # embed_batch called once over the chunk list
    mock_embed.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_ingest_document_sets_metadata_on_document():
    db = _make_mock_db()
    with patch("app.rag.ingestion.embed_batch", side_effect=lambda t: [[0.0] * 384 for _ in t]):
        doc = await ingest_document(
            db,
            title="Hadamard",
            source_url="https://example.com/h",
            source_type="paper",
            text="short body",
        )
    assert doc.title == "Hadamard"
    assert doc.source_url == "https://example.com/h"
    assert doc.source_type == "paper"
