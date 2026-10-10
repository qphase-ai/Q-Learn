"""Ingest the legacy `lessons` table into the RAG knowledge base.

Safe to re-run: each lesson is ingested under `qlearn://lesson/<id>`, and
`ingest_document` replaces an existing document with the same source_url.

    python -m scripts.ingest_lessons

Each document is linked to the lesson's content_refs row (same UUID, see
app/models/content_ref.py), so retrieval can boost the student's current lesson.
The `qlearn://` URI is a stable identity, not a web URL: clients route by lesson
id. `all-MiniLM-L6-v2` downloads on first use.
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning import Lesson
from app.rag.ingestion import chunk_text, ingest_document


@dataclass
class IngestResult:
    documents: int
    chunks: int


def lesson_source_url(lesson_id: uuid.UUID) -> str:
    return f"qlearn://lesson/{lesson_id}"


async def ingest_lessons(db: AsyncSession) -> IngestResult:
    """Ingest every lesson with a non-empty body. Returns document and chunk counts."""
    rows = (
        await db.execute(
            select(Lesson.id, Lesson.title, Lesson.content)
            .where(Lesson.content.is_not(None), func.length(func.trim(Lesson.content)) > 0)
            .order_by(Lesson.id)
        )
    ).all()

    documents = chunks = 0
    for lesson_id, title, content in rows:
        if not (content or "").strip():
            continue
        await ingest_document(
            db,
            title=title,
            source_url=lesson_source_url(lesson_id),
            source_type="course",
            text=content,
            content_ref_id=lesson_id,
        )
        documents += 1
        chunks += len(chunk_text(content))
    return IngestResult(documents=documents, chunks=chunks)


async def _main() -> None:
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await ingest_lessons(db)
    print(f"Ingested {result.documents} lessons as {result.chunks} chunks.")


if __name__ == "__main__":
    asyncio.run(_main())
