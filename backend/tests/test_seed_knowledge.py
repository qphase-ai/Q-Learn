"""Tests for the knowledge-base seed script.

Hermetic: embed_batch is mocked and the DB session is an AsyncMock, so `seed`
runs end-to-end without a model or database. We assert it ingests the curated
corpus (documents + chunks), that it is the documentation excerpts only (the
lessons come from scripts.ingest_lessons), and that it removes the legacy lesson
duplicates.
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


def test_corpus_is_the_documentation_excerpts_only():
    """Lessons come from scripts.ingest_lessons; the seed keeps only non-lesson docs."""
    assert [d["title"] for d in seed_knowledge.CORPUS] == ["Quantum Circuit Basics", "Measurement"]
    assert all(d["source_type"] == "documentation" for d in seed_knowledge.CORPUS)
    bodies = " ".join(d["text"] for d in seed_knowledge.CORPUS).lower()
    assert "cnot" in bodies
    assert "measure" in bodies
    # every corpus entry has a citable source_url, none of them a legacy lesson URL
    assert all(d.get("source_url") for d in seed_knowledge.CORPUS)
    assert not {d["source_url"] for d in seed_knowledge.CORPUS} & set(seed_knowledge.LEGACY_LESSON_URLS)


def test_legacy_lesson_urls_are_the_three_old_duplicates():
    assert set(seed_knowledge.LEGACY_LESSON_URLS) == {
        "https://qlearn.dev/lessons/superposition",
        "https://qlearn.dev/lessons/hadamard",
        "https://qlearn.dev/lessons/entanglement",
    }


@pytest.mark.asyncio
async def test_seed_removes_legacy_lesson_documents_before_ingesting():
    from sqlalchemy.dialects import postgresql

    db = _make_mock_db()
    order = []
    db.execute.side_effect = lambda *a, **k: order.append("delete") or MagicMock(rowcount=3)
    spy = AsyncMock(side_effect=lambda *a, **k: order.append("ingest"))

    with patch("scripts.seed_knowledge.ingest_document", spy):
        result = await seed_knowledge.seed(db)

    assert result.removed_legacy == 3
    assert order[0] == "delete" and order.count("delete") == 1
    sql = str(
        db.execute.call_args.args[0].compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert sql.startswith("DELETE FROM knowledge_documents")
    for url in seed_knowledge.LEGACY_LESSON_URLS:
        assert f"'{url}'" in sql


@pytest.mark.asyncio
async def test_seed_is_a_no_op_for_legacy_documents_when_absent():
    db = _make_mock_db()
    db.execute.return_value = MagicMock(rowcount=0)

    with patch("scripts.seed_knowledge.ingest_document", AsyncMock()):
        result = await seed_knowledge.seed(db)

    assert result.removed_legacy == 0
    assert result.ingested == len(seed_knowledge.CORPUS)


@pytest.mark.asyncio
async def test_seed_ingests_every_corpus_document():
    spy = AsyncMock(return_value=MagicMock(spec=KnowledgeDocument))
    db = _make_mock_db()

    db.execute.return_value = MagicMock(rowcount=0)

    with patch("scripts.seed_knowledge.ingest_document", spy):
        result = await seed_knowledge.seed(db)

    assert result.ingested == len(seed_knowledge.CORPUS)
    assert spy.await_count == len(seed_knowledge.CORPUS)
    # each document is ingested under its own source_url, so re-runs replace it
    assert [c.kwargs["source_url"] for c in spy.await_args_list] == [
        d["source_url"] for d in seed_knowledge.CORPUS
    ]


@pytest.mark.asyncio
async def test_seed_writes_documents_and_chunks_to_db():
    db = _make_mock_db()
    db.execute.return_value = MagicMock(rowcount=0)

    with patch(
        "app.rag.ingestion.embed_batch",
        side_effect=lambda texts: [[0.1] * 384 for _ in texts],
    ):
        result = await seed_knowledge.seed(db)

    assert result.ingested == len(seed_knowledge.CORPUS)
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
