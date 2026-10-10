"""Tests for RAG retrieval — hybrid retrieve() with a mocked DB session.

Hermetic: aembed_text is patched; db.execute returns canned results in call
order: SET LOCAL hnsw.ef_search, dense candidates (chunk_id, distance,
content_ref_id), sparse candidates (chunk_id, content_ref_id), then the hydrate
query (chunk, doc). With the default settings rag_min_score is 0.30.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.retrieval import RetrievalQuery, RetrievedChunk, retrieve


def _chunk(content: str, index: int = 0) -> MagicMock:
    c = MagicMock()
    c.id = uuid.uuid4()
    c.content = content
    c.chunk_index = index
    return c


def _doc(title: str, url: str | None = None, content_ref_id=None) -> MagicMock:
    d = MagicMock()
    d.title = title
    d.source_url = url or f"https://example.com/{title.lower()}"
    d.content_ref_id = content_ref_id
    return d


def _result(rows):
    result = MagicMock()
    result.all.return_value = rows
    return result


def _db(dense, sparse, hydrate=None):
    """dense: [(chunk, doc, distance)], sparse: [(chunk, doc)], hydrate: [(chunk, doc)]."""
    if hydrate is None:
        seen: dict = {}
        for chunk, doc, *_ in [*dense, *sparse]:
            seen[chunk.id] = (chunk, doc)
        hydrate = list(seen.values())
    results = [
        _result([]),  # SET LOCAL
        _result([(c.id, dist, d.content_ref_id) for c, d, dist in dense]),
        _result([(c.id, d.content_ref_id) for c, d in sparse]),
        _result(hydrate),
    ]
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=results)
    return db


def _embed():
    return patch("app.rag.retrieval.aembed_text", AsyncMock(return_value=[0.1] * 384))


async def test_maps_rows_to_retrieved_chunks_in_order_from_plain_string():
    s, h = _chunk("Superposition lets a qubit be 0 and 1."), _chunk("The Hadamard gate.", 1)
    sd, hd = _doc("Superposition"), _doc("Hadamard")
    db = _db(dense=[(s, sd, 0.10), (h, hd, 0.25)], sparse=[])

    with _embed() as embed:
        out = await retrieve(db, "what is superposition")

    embed.assert_awaited_once_with("what is superposition")
    assert [o.title for o in out] == ["Superposition", "Hadamard"]
    assert all(isinstance(o, RetrievedChunk) for o in out)
    first = out[0]
    assert first.content.startswith("Superposition lets")
    assert first.source_url == "https://example.com/superposition"
    assert first.chunk_index == 0
    assert first.chunk_id == s.id
    # score is the dense cosine similarity (1 - distance)
    assert first.score == pytest.approx(0.90)
    assert out[1].score == pytest.approx(0.75)


async def test_sets_hnsw_ef_search_before_dense_query():
    db = _db(dense=[], sparse=[])
    with _embed():
        await retrieve(db, "query")
    first_stmt = str(db.execute.await_args_list[0].args[0])
    assert "SET LOCAL hnsw.ef_search" in first_stmt


async def test_below_floor_dense_only_hit_is_dropped():
    good, weak = _chunk("relevant"), _chunk("unrelated")
    db = _db(dense=[(good, _doc("Good"), 0.40), (weak, _doc("Weak"), 0.85)], sparse=[])

    with _embed():
        out = await retrieve(db, "q")

    assert [o.title for o in out] == ["Good"]


async def test_sparse_only_hit_is_kept_with_zero_score():
    kw = _chunk("CNOT entangles two qubits")
    db = _db(dense=[], sparse=[(kw, _doc("CNOT"))])

    with _embed():
        out = await retrieve(db, "CNOT")

    assert [o.title for o in out] == ["CNOT"]
    assert out[0].score == 0.0


async def test_below_floor_dense_hit_kept_when_sparse_also_matched():
    c = _chunk("CNOT")
    doc = _doc("CNOT")
    db = _db(dense=[(c, doc, 0.80)], sparse=[(c, doc)])

    with _embed():
        out = await retrieve(db, "CNOT")

    assert [o.title for o in out] == ["CNOT"]
    assert out[0].score == pytest.approx(0.20)


async def test_lesson_boost_reorders():
    lesson_id = uuid.uuid4()
    other, lesson = _chunk("other"), _chunk("lesson")
    dense = [(other, _doc("Other"), 0.10), (lesson, _doc("Lesson", content_ref_id=lesson_id), 0.20)]

    with _embed():
        plain = await retrieve(_db(dense=dense, sparse=[]), RetrievalQuery(text="q"))
        boosted = await retrieve(
            _db(dense=dense, sparse=[]), RetrievalQuery(text="q", content_ref_id=lesson_id)
        )

    assert [o.title for o in plain] == ["Other", "Lesson"]
    assert [o.title for o in boosted] == ["Lesson", "Other"]


async def test_zero_candidates_returns_empty_without_hydrate_query():
    db = _db(dense=[], sparse=[])
    with _embed():
        out = await retrieve(db, "recipe for chocolate cake")
    assert out == []
    assert db.execute.await_count == 3  # SET LOCAL, dense, sparse — no hydrate


async def test_all_dense_below_floor_returns_empty():
    db = _db(dense=[(_chunk("x"), _doc("X"), 0.9)], sparse=[])
    with _embed():
        out = await retrieve(db, "q")
    assert out == []
    assert db.execute.await_count == 3


async def test_k_caps_results():
    rows = [(_chunk(f"c{i}"), _doc(f"D{i}"), 0.1 + i * 0.01) for i in range(6)]
    with _embed():
        out = await retrieve(_db(dense=rows, sparse=[]), "q", k=3)
    assert [o.title for o in out] == ["D0", "D1", "D2"]


async def test_blank_query_skips_db():
    db = AsyncMock()
    with _embed() as embed:
        out = await retrieve(db, "   ")
    assert out == []
    db.execute.assert_not_awaited()
    embed.assert_not_awaited()
