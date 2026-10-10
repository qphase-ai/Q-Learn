"""RAG retrieval — hybrid dense (pgvector HNSW) + sparse (Postgres FTS) search.

Both arms fetch up to `rag_candidate_k` chunks:
- dense: cosine distance to the query embedding, via the HNSW index;
- sparse: `websearch_to_tsquery('english', q)` against `document_chunks.content_tsv`,
  ranked by `ts_rank_cd`.

A dense-only candidate must clear the `rag_min_score` similarity floor; any
sparse match is kept. The two rankings are fused with Reciprocal Rank Fusion,
chunks of the student's current lesson get a multiplicative boost, and the top
`rag_top_k` are hydrated. `RetrievedChunk.score` is the dense cosine similarity
(0.0 for a chunk only the sparse arm found), so higher is better.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select, text
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

    # Sparse arm.
    tsquery = func.websearch_to_tsquery("english", q.text)
    sparse_stmt = (
        select(DocumentChunk.id, KnowledgeDocument.content_ref_id)
        .join(KnowledgeDocument, KnowledgeDocument.id == DocumentChunk.document_id)
        .where(DocumentChunk.content_tsv.op("@@")(tsquery))
        .order_by(func.ts_rank_cd(DocumentChunk.content_tsv, tsquery).desc())
        .limit(candidate_k)
    )
    sparse_rows = (await db.execute(sparse_stmt)).all()

    similarity = {cid: 1.0 - float(dist) for cid, dist, _ in dense_rows}
    sparse_ids = [cid for cid, _ in sparse_rows]
    sparse_set = set(sparse_ids)
    dense_ids = [
        cid for cid, _, _ in dense_rows
        if similarity[cid] >= settings.rag_min_score or cid in sparse_set
    ]

    boosts: dict[uuid.UUID, float] = {}
    if q.content_ref_id is not None:
        for cid, _, ref in dense_rows:
            if ref == q.content_ref_id:
                boosts[cid] = LESSON_BOOST
        for cid, ref in sparse_rows:
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
                score=similarity.get(cid, 0.0),
                chunk_id=cid,
            )
        )
    return out
