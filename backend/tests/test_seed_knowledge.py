"""Tests for the knowledge-base seed script.

Hermetic: embed_batch is mocked and the DB session is an AsyncMock, so `seed`
runs end-to-end without a model or database. We assert it ingests the curated
corpus (documents + chunks) and that the superposition material is present.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from scripts import seed_knowledge
from app.models.knowledge import KnowledgeDocument, DocumentChunk


def _make_mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    return db


def test_corpus_covers_core_concepts():
    titles = " ".join(d["title"] for d in seed_knowledge.CORPUS).lower()
    bodies = " ".join(d["text"] for d in seed_knowledge.CORPUS).lower()
    assert "superposition" in titles or "superposition" in bodies
    assert "hadamard" in bodies
    assert "entangl" in bodies
    # every corpus entry has a citable source_url
    assert all(d.get("source_url") for d in seed_knowledge.CORPUS)


@pytest.mark.asyncio
async def test_seed_ingests_every_corpus_document():
    spy = AsyncMock(return_value=MagicMock(spec=KnowledgeDocument))
    db = _make_mock_db()

    with patch("scripts.seed_knowledge.ingest_document", spy):
        count = await seed_knowledge.seed(db)

    assert count == len(seed_knowledge.CORPUS)
    assert spy.await_count == len(seed_knowledge.CORPUS)


@pytest.mark.asyncio
async def test_seed_writes_documents_and_chunks_to_db():
    db = _make_mock_db()

    with patch(
        "app.rag.ingestion.embed_batch",
        side_effect=lambda texts: [[0.1] * 384 for _ in texts],
    ):
        count = await seed_knowledge.seed(db)

    assert count == len(seed_knowledge.CORPUS)
    added = [call.args[0] for call in db.add.call_args_list]
    assert sum(isinstance(a, KnowledgeDocument) for a in added) == len(seed_knowledge.CORPUS)
    assert any(isinstance(a, DocumentChunk) for a in added)
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_superposition_document_is_ingestible():
    """The superposition doc should chunk into retrievable content."""
    from app.rag.ingestion import chunk_text

    superposition_docs = [
        d for d in seed_knowledge.CORPUS if "superposition" in d["text"].lower()
    ]
    assert superposition_docs
    chunks = chunk_text(superposition_docs[0]["text"])
    assert chunks
    assert any("superposition" in c.lower() for c in chunks)
