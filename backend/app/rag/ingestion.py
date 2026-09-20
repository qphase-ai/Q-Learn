"""RAG ingestion — chunk documents and persist chunks + embeddings.

`chunk_text` is a pure whitespace-token windowing helper. `ingest_document`
writes one KnowledgeDocument, N DocumentChunk rows, and N KnowledgeEmbedding
rows (vectors from `embed_batch`). No schema migration — the knowledge tables
already exist.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeDocument, DocumentChunk, KnowledgeEmbedding
from app.rag.embeddings import embed_batch


def chunk_text(text: str, size: int = 800, overlap: int = 120) -> list[str]:
    """Split text into overlapping windows of whitespace tokens.

    Windows are `size` tokens wide and advance by `size - overlap`, so adjacent
    chunks share `overlap` tokens. Every token is covered; the final window is
    clamped to the end of the text. Returns [] for empty text.
    """
    words = text.split()
    if not words:
        return []
    if len(words) <= size:
        return [" ".join(words)]

    step = max(size - overlap, 1)
    chunks: list[str] = []
    for start in range(0, len(words), step):
        window = words[start : start + size]
        chunks.append(" ".join(window))
        if start + size >= len(words):
            break
    return chunks


async def ingest_document(
    db: AsyncSession,
    *,
    title: str,
    source_url: str | None,
    source_type: str,
    text: str,
) -> KnowledgeDocument:
    """Create a document + its chunks + embeddings, then commit.

    Embeddings are computed in a single `embed_batch` call over the chunk list.
    """
    document = KnowledgeDocument(
        title=title,
        source_url=source_url,
        source_type=source_type,
    )
    db.add(document)
    await db.flush()  # assign document.id for the chunk FKs

    chunks = chunk_text(text)
    vectors = embed_batch(chunks) if chunks else []

    for index, (content, vector) in enumerate(zip(chunks, vectors)):
        chunk = DocumentChunk(
            document_id=document.id,
            content=content,
            chunk_index=index,
            token_count=len(content.split()),
        )
        db.add(chunk)
        await db.flush()  # assign chunk.id for the embedding FK

        db.add(KnowledgeEmbedding(chunk_id=chunk.id, embedding=vector))

    await db.commit()
    return document
