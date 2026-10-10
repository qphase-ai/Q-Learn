"""Integration tests: real retrieve() and ingest_document() against Postgres.

These run the actual SQL (HNSW cosine search, full-text arm, floors, RRF, lesson
boost, upsert by source_url) against the test database. CI provides it: the
pgvector/pgvector image, migrated with `alembic upgrade head`. The tests skip
when the database is unreachable or lacks the `vector` extension or the
hybrid-search schema.

The embedder is a deterministic fake (no model download): each text maps to a
unit vector whose cosine similarity to the query axis is chosen per test, so
which chunk is nearest is set by construction.

Each test runs inside one outer transaction that is rolled back at the end
(ingest_document's commits become savepoints), after first deleting every
knowledge document inside it, so existing rows neither interfere nor change.
"""
from __future__ import annotations

import math
import uuid

import pytest
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.models.content_ref import ContentRef
from app.models.knowledge import DocumentChunk, KnowledgeDocument, KnowledgeEmbedding
from app.rag.ingestion import ingest_document
from app.rag.retrieval import RetrievalQuery, retrieve

DIM = 384
QUERY_AXIS = 0

_SCHEMA_READY = text(
    "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') "
    "AND EXISTS (SELECT 1 FROM information_schema.columns "
    "WHERE table_name = 'document_chunks' AND column_name = 'content_tsv') "
    "AND EXISTS (SELECT 1 FROM information_schema.columns "
    "WHERE table_name = 'knowledge_documents' AND column_name = 'content_ref_id')"
)


def _vector(similarity: float, axis: int) -> list[float]:
    """Unit vector with the given cosine similarity to the query axis.

    The remainder lies on its own `axis`, so documents differ from each other.
    """
    v = [0.0] * DIM
    v[QUERY_AXIS] = similarity
    v[axis] = math.sqrt(max(0.0, 1.0 - similarity * similarity))
    return v


class FakeEmbedder:
    """Maps a text to a vector by the first word: `key` -> chosen similarity."""

    def __init__(self) -> None:
        self.by_key: dict[str, list[float]] = {}

    def set(self, key: str, similarity: float) -> None:
        self.by_key[key] = _vector(similarity, axis=len(self.by_key) + 1)

    def _embed(self, value: str) -> list[float]:
        first = value.split()[0]
        if first in self.by_key:
            return self.by_key[first]
        q = [0.0] * DIM
        q[QUERY_AXIS] = 1.0  # queries sit on the query axis
        return q

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    async def aembed_text(self, value: str) -> list[float]:
        return self._embed(value)


@pytest.fixture
async def db():
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    try:
        conn = await engine.connect()
    except Exception as exc:  # noqa: BLE001 — no database: skip, don't fail
        await engine.dispose()
        pytest.skip(f"test database unavailable: {exc}")

    trans = await conn.begin()
    session = AsyncSession(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        if not await conn.scalar(_SCHEMA_READY):
            pytest.skip("test database lacks pgvector or the hybrid-search migration")
        await session.execute(delete(KnowledgeDocument))  # rolled back afterwards
        yield session
    finally:
        await session.close()
        await trans.rollback()
        await conn.close()
        await engine.dispose()


@pytest.fixture
def embedder(monkeypatch):
    fake = FakeEmbedder()
    monkeypatch.setattr("app.rag.ingestion.embed_batch", fake.embed_batch)
    monkeypatch.setattr("app.rag.retrieval.aembed_text", fake.aembed_text)
    return fake


async def _ingest(db, key: str, body: str, ref: uuid.UUID | None = None, url: str | None = None):
    return await ingest_document(
        db,
        title=key.title(),
        source_url=url or f"test://rag/{key}",
        source_type="test",
        text=f"{key} {body}",
        content_ref_id=ref,
    )


async def test_dense_hit_is_returned_with_its_cosine_score(db, embedder):
    embedder.set("alpha", 0.9)
    embedder.set("bravo", 0.1)
    await _ingest(db, "alpha", "amplitudes add up")
    await _ingest(db, "bravo", "unrelated notes")

    out = await retrieve(db, "zzqx")  # shares no word with either document

    assert [c.title for c in out] == ["Alpha"]
    assert out[0].score == pytest.approx(0.9, abs=1e-4)
    assert out[0].source_url == "test://rag/alpha"
    assert out[0].chunk_id is not None


async def test_full_text_match_rescues_a_chunk_between_the_floors(db, embedder):
    s = get_settings()
    between = (s.rag_min_score_fts + s.rag_min_score) / 2
    embedder.set("charlie", between)  # matches the query's word
    embedder.set("delta", between)    # same similarity, no shared word
    await _ingest(db, "charlie", "entanglement links two qubits")
    await _ingest(db, "delta", "measurement collapses states")

    out = await retrieve(db, "entanglement")

    assert [c.title for c in out] == ["Charlie"]
    assert out[0].score == pytest.approx(between, abs=1e-4)


async def test_full_text_match_below_the_fts_floor_is_rejected(db, embedder):
    s = get_settings()
    embedder.set("echo", s.rag_min_score_fts - 0.05)
    await _ingest(db, "echo", "entanglement in passing")

    assert await retrieve(db, "entanglement") == []


async def test_current_lesson_is_boosted_above_a_closer_chunk(db, embedder):
    lesson = ContentRef(kind="lesson", payload_id=f"rag-it-{uuid.uuid4()}")
    db.add(lesson)
    await db.flush()
    embedder.set("foxtrot", 0.80)
    embedder.set("golf", 0.78)
    await _ingest(db, "foxtrot", "the hadamard gate")
    await _ingest(db, "golf", "the hadamard gate again", ref=lesson.id)

    plain = await retrieve(db, "zzqx")
    boosted = await retrieve(db, RetrievalQuery(text="zzqx", content_ref_id=lesson.id))

    assert [c.title for c in plain] == ["Foxtrot", "Golf"]
    assert [c.title for c in boosted] == ["Golf", "Foxtrot"]


async def test_re_ingesting_a_source_replaces_it(db, embedder):
    embedder.set("hotel", 0.9)
    url = "test://rag/hotel"
    first = await _ingest(db, "hotel", "old text about phases", url=url)
    second = await _ingest(db, "hotel", "new text about phases", url=url)

    docs = (await db.execute(
        select(KnowledgeDocument.id).where(KnowledgeDocument.source_url == url)
    )).scalars().all()
    assert docs == [second.id] and first.id != second.id
    chunks = await db.scalar(select(func.count()).select_from(DocumentChunk))
    embeddings = await db.scalar(select(func.count()).select_from(KnowledgeEmbedding))
    assert chunks == embeddings == 1

    out = await retrieve(db, "zzqx")
    assert [c.content for c in out] == ["hotel new text about phases"]
