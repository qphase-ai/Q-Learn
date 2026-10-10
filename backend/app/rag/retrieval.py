"""RAG retrieval — hybrid dense (pgvector HNSW) + sparse (Postgres FTS) search.

Both arms fetch up to `rag_candidate_k` chunks:
- dense: cosine distance to the query embedding, via the HNSW index;
- sparse: any stemmed query term (OR) against `document_chunks.content_tsv`,
  ranked by `ts_rank_cd`, so chunks matching more terms still rank first.

Every candidate must clear a dense cosine-similarity floor: `rag_min_score`,
or the lower `rag_min_score_fts` when the sparse arm matched it too. The OR
query matches almost any on-topic text, so a shared word alone is weak evidence:
"transformer" stems to "transform" and matches "Quantum Fourier Transform". The
surviving rankings are fused with Reciprocal Rank Fusion, chunks of the
student's current lesson get a multiplicative boost, and the top `rag_top_k`
are hydrated. `RetrievedChunk.score` is the dense cosine similarity, so higher
is better.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import Text, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.knowledge import DocumentChunk, KnowledgeDocument, KnowledgeEmbedding
from app.rag.embeddings import aembed_text

RRF_K = 60
LESSON_BOOST = 1.5
# HNSW returns at most ef_search rows per scan, so keep it >= the candidate limit.
HNSW_EF_SEARCH = 40


@dataclass
class RetrievedChunk:
    content: str
    title: str
    source_url: str | None
    chunk_index: int
    score: float
    chunk_id: uuid.UUID | None = None


@dataclass
class RetrievalQuery:
    text: str
    # The student's current lesson (a content_refs id); its chunks are boosted.
    content_ref_id: uuid.UUID | None = None


def rrf_fuse(
    rankings: list[list[uuid.UUID]],
    k: int = RRF_K,
    boosts: dict[uuid.UUID, float] | None = None,
) -> list[tuple[uuid.UUID, float]]:
    """Reciprocal Rank Fusion: sum 1/(k + rank) over rankings, then apply boosts."""
    scores: dict[uuid.UUID, float] = {}
    for ranking in rankings:
        for rank, cid in enumerate(ranking, start=1):
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank)
    for cid, b in (boosts or {}).items():
        if cid in scores:
            scores[cid] *= b
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)


def _any_term_tsquery(query_text: str):
    """tsquery matching ANY of the query's stemmed, non-stopword terms.

    `plainto_tsquery` ANDs every term, which a multi-sentence query almost never
    satisfies. Its output is a normalised tsquery (quoted lexemes joined by ` & `),
    so swapping the joins for ` | ` and re-parsing is safe: the user's text is only
    ever a bound parameter. The 'simple' config re-reads the already-stemmed
    lexemes without stemming them again. An all-stopword query yields an empty
    tsquery, which matches nothing and does not error.
    """
    anded = cast(func.plainto_tsquery("english", query_text), Text)
    return func.to_tsquery("simple", func.replace(anded, " & ", " | "))


async def retrieve(
    db: AsyncSession, query: RetrievalQuery | str, k: int | None = None
) -> list[RetrievedChunk]:
    """Return up to k relevant chunks, best first. Empty when nothing is relevant."""
    q = RetrievalQuery(text=query) if isinstance(query, str) else query
    if not q.text.strip():
        return []

    settings = get_settings()
    top_k = k or settings.rag_top_k
    candidate_k = max(settings.rag_candidate_k, top_k)

    query_vec = await aembed_text(q.text)

    # Dense arm. SET LOCAL lasts until the end of the current transaction.
    ef_search = max(HNSW_EF_SEARCH, candidate_k)
    await db.execute(text(f"SET LOCAL hnsw.ef_search = {int(ef_search)}"))
    distance = KnowledgeEmbedding.embedding.cosine_distance(query_vec)
    dense_stmt = (
        select(KnowledgeEmbedding.chunk_id, distance.label("distance"), KnowledgeDocument.content_ref_id)
        .join(DocumentChunk, DocumentChunk.id == KnowledgeEmbedding.chunk_id)
        .join(KnowledgeDocument, KnowledgeDocument.id == DocumentChunk.document_id)
        .order_by(distance)
        .limit(candidate_k)
    )
    dense_rows = (await db.execute(dense_stmt)).all()

    # Sparse arm. It also reads each match's dense distance for the floor.
    tsquery = _any_term_tsquery(q.text)
    sparse_stmt = (
        select(DocumentChunk.id, distance.label("distance"), KnowledgeDocument.content_ref_id)
        .join(KnowledgeEmbedding, KnowledgeEmbedding.chunk_id == DocumentChunk.id)
        .join(KnowledgeDocument, KnowledgeDocument.id == DocumentChunk.document_id)
        .where(DocumentChunk.content_tsv.op("@@")(tsquery))
        .order_by(func.ts_rank_cd(DocumentChunk.content_tsv, tsquery).desc())
        .limit(candidate_k)
    )
    sparse_rows = (await db.execute(sparse_stmt)).all()

    similarity = {cid: 1.0 - float(dist) for cid, dist, _ in [*dense_rows, *sparse_rows]}
    sparse_set = {cid for cid, _, _ in sparse_rows}

    def relevant(cid: uuid.UUID) -> bool:
        floor = settings.rag_min_score_fts if cid in sparse_set else settings.rag_min_score
        return similarity[cid] >= floor

    dense_ids = [cid for cid, _, _ in dense_rows if relevant(cid)]
    sparse_ids = [cid for cid, _, _ in sparse_rows if relevant(cid)]

    boosts: dict[uuid.UUID, float] = {}
    if q.content_ref_id is not None:
        for cid, _, ref in dense_rows:
            if ref == q.content_ref_id:
                boosts[cid] = LESSON_BOOST
        for cid, _, ref in sparse_rows:
            if ref == q.content_ref_id:
                boosts[cid] = LESSON_BOOST

    fused = rrf_fuse([dense_ids, sparse_ids], boosts=boosts)[:top_k]
    if not fused:
        return []

    top_ids = [cid for cid, _ in fused]
    hydrate_stmt = (
        select(DocumentChunk, KnowledgeDocument)
        .join(KnowledgeDocument, KnowledgeDocument.id == DocumentChunk.document_id)
        .where(DocumentChunk.id.in_(top_ids))
    )
    by_id = {chunk.id: (chunk, doc) for chunk, doc in (await db.execute(hydrate_stmt)).all()}

    out: list[RetrievedChunk] = []
    for cid in top_ids:
        if cid not in by_id:  # deleted between the candidate and hydrate queries
            continue
        chunk, doc = by_id[cid]
        out.append(
            RetrievedChunk(
                content=chunk.content,
                title=doc.title,
                source_url=doc.source_url,
                chunk_index=chunk.chunk_index,
                score=similarity[cid],
                chunk_id=cid,
            )
        )
    return out
