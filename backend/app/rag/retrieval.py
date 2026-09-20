"""RAG retrieval — pgvector cosine nearest-neighbour search.

Lean pgvector-only retrieval (no BM25/RRF/rerank): embed the query, order chunks
by cosine distance to the query vector, and return the top-k with citation
metadata. Score is the cosine similarity (1 - distance) so higher is better.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import DocumentChunk, KnowledgeDocument, KnowledgeEmbedding
from app.rag.embeddings import embed_text


@dataclass
class RetrievedChunk:
    content: str
    title: str
    source_url: str | None
    chunk_index: int
    score: float


async def retrieve(db: AsyncSession, query: str, k: int = 5) -> list[RetrievedChunk]:
    """Return the top-k chunks nearest the query, ordered closest-first."""
    query_vec = embed_text(query)
    distance = KnowledgeEmbedding.embedding.cosine_distance(query_vec)

    stmt = (
        select(DocumentChunk, KnowledgeDocument, distance.label("distance"))
        .join(KnowledgeEmbedding, KnowledgeEmbedding.chunk_id == DocumentChunk.id)
        .join(KnowledgeDocument, KnowledgeDocument.id == DocumentChunk.document_id)
        .order_by(distance)
        .limit(k)
    )

    result = await db.execute(stmt)
    return [
        RetrievedChunk(
            content=chunk.content,
            title=doc.title,
            source_url=doc.source_url,
            chunk_index=chunk.chunk_index,
            score=1.0 - float(dist),
        )
        for chunk, doc, dist in result.all()
    ]
