"""rag hybrid search: hnsw index, fts column, lesson link, unique source

Replaces the ivfflat index on knowledge_embeddings with HNSW. ivfflat trains
its centroids at build time, so built on an empty table it returns too few or
no rows; HNSW needs no training and stays correct as the corpus grows.

Adds document_chunks.content_tsv (a stored generated tsvector) with a GIN index
for the full-text half of hybrid retrieval, knowledge_documents.content_ref_id
(nullable FK to content_refs, so retrieval can boost the current lesson) and a
partial unique index on knowledge_documents.source_url (re-ingestion upserts by
source).

Downgrade restores the ivfflat index and drops the new columns and indexes.
The dropped columns hold only derived (content_tsv) or re-ingestable
(content_ref_id) data.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_knowledge_embeddings_ivfflat")
    op.execute(
        "CREATE INDEX ix_knowledge_embeddings_hnsw ON knowledge_embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    op.execute(
        "ALTER TABLE document_chunks ADD COLUMN content_tsv tsvector "
        "GENERATED ALWAYS AS (to_tsvector('english', content)) STORED"
    )
    op.execute(
        "CREATE INDEX ix_document_chunks_content_tsv ON document_chunks USING gin (content_tsv)"
    )

    op.add_column(
        "knowledge_documents",
        sa.Column(
            "content_ref_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("content_refs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_knowledge_documents_content_ref_id", "knowledge_documents", ["content_ref_id"]
    )
    op.create_index(
        "uq_knowledge_documents_source_url",
        "knowledge_documents",
        ["source_url"],
        unique=True,
        postgresql_where=sa.text("source_url IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_knowledge_documents_source_url", table_name="knowledge_documents")
    op.drop_index("ix_knowledge_documents_content_ref_id", table_name="knowledge_documents")
    op.drop_column("knowledge_documents", "content_ref_id")

    op.execute("DROP INDEX IF EXISTS ix_document_chunks_content_tsv")
    op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS content_tsv")

    op.execute("DROP INDEX IF EXISTS ix_knowledge_embeddings_hnsw")
    op.execute(
        "CREATE INDEX ix_knowledge_embeddings_ivfflat ON knowledge_embeddings "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
