"""Tests for RAG ingestion — chunk_text (pure) and ingest_document (mocked DB).

Hermetic: embed_batch is patched, the DB session is an AsyncMock. No model or
network I/O.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import get_settings
from app.rag import embeddings
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


def test_chunk_text_defaults_fit_the_embedder_window():
    """Default chunks are <= 200 words and adjacent chunks share exactly 40."""
    text = " ".join(f"w{i}" for i in range(1000))

    chunks = [c.split() for c in chunk_text(text)]

    assert len(chunks) > 1
    assert all(len(c) <= 200 for c in chunks)
    for prev, nxt in zip(chunks, chunks[1:]):
        assert len(set(prev) & set(nxt)) == 40
        assert prev[-40:] == nxt[:40]


def test_chunk_words_fit_embedder_max_words():
    """A chunk wider than the embedder's window would be silently truncated."""
    settings = get_settings()
    assert settings.rag_chunk_words == 200
    assert settings.rag_chunk_overlap == 40
    assert embeddings.MAX_WORDS_PER_CHUNK == 200
    assert embeddings.MAX_WORDS_PER_CHUNK >= settings.rag_chunk_words


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
    n_chunks = len(chunk_text(text))
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


# ---------------------------------------------------------------------------
# ingest_document — idempotent by source_url, lesson link
# ---------------------------------------------------------------------------

def _executed_sql(db) -> list[str]:
    from sqlalchemy.dialects import postgresql

    return [
        str(call.args[0].compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        for call in db.execute.call_args_list
    ]


@pytest.mark.asyncio
async def test_reingest_deletes_existing_document_with_same_source_url_first():
    """Re-ingesting a source_url replaces the old document in the same transaction."""
    db = _make_mock_db()
    order: list[str] = []
    db.execute.side_effect = lambda *a, **k: order.append("delete")
    db.add.side_effect = lambda obj: order.append(type(obj).__name__)
    db.commit.side_effect = lambda: order.append("commit")

    with patch("app.rag.ingestion.embed_batch", side_effect=lambda t: [[0.0] * 384 for _ in t]):
        await ingest_document(
            db, title="H", source_url="qlearn://lesson/abc", source_type="course", text="body"
        )

    sql = _executed_sql(db)
    assert len(sql) == 1
    assert sql[0].startswith("DELETE FROM knowledge_documents")
    assert "knowledge_documents.source_url = 'qlearn://lesson/abc'" in sql[0]
    # delete, then the new rows, then a single commit
    assert order[0] == "delete"
    assert order[1] == "KnowledgeDocument"
    assert order[-1] == "commit" and order.count("commit") == 1


@pytest.mark.asyncio
async def test_ingest_without_source_url_deletes_nothing():
    db = _make_mock_db()
    with patch("app.rag.ingestion.embed_batch", side_effect=lambda t: [[0.0] * 384 for _ in t]):
        await ingest_document(db, title="H", source_url=None, source_type="course", text="body")
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_ingest_sets_content_ref_id():
    import uuid

    ref = uuid.uuid4()
    db = _make_mock_db()
    with patch("app.rag.ingestion.embed_batch", side_effect=lambda t: [[0.0] * 384 for _ in t]):
        doc = await ingest_document(
            db, title="H", source_url="qlearn://lesson/x", source_type="course",
            text="body", content_ref_id=ref,
        )
    assert doc.content_ref_id == ref


@pytest.mark.asyncio
async def test_failed_ingest_rolls_back_and_keeps_the_old_document():
    """If embedding fails nothing is deleted; if a write fails the delete is rolled back."""
    db = _make_mock_db()
    with patch("app.rag.ingestion.embed_batch", side_effect=RuntimeError("model down")):
        with pytest.raises(RuntimeError):
            await ingest_document(
                db, title="H", source_url="qlearn://lesson/x", source_type="course", text="body"
            )
    db.execute.assert_not_awaited()
    db.commit.assert_not_awaited()

    db = _make_mock_db()
    db.flush.side_effect = RuntimeError("db down")
    with patch("app.rag.ingestion.embed_batch", side_effect=lambda t: [[0.0] * 384 for _ in t]):
        with pytest.raises(RuntimeError):
            await ingest_document(
                db, title="H", source_url="qlearn://lesson/x", source_type="course", text="body"
            )
    db.rollback.assert_awaited_once()
    db.commit.assert_not_awaited()
