"""Hermetic tests for the knowledge-base ORM shape and its hybrid-search migration."""
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Computed
from sqlalchemy.dialects.postgresql import TSVECTOR

from app.models.knowledge import DocumentChunk, KnowledgeDocument, KnowledgeEmbedding

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_embedding_index_is_hnsw_cosine():
    indexes = {ix.name: ix for ix in KnowledgeEmbedding.__table__.indexes}
    assert "ix_knowledge_embeddings_ivfflat" not in indexes
    hnsw = indexes["ix_knowledge_embeddings_hnsw"]
    opts = hnsw.dialect_options["postgresql"]
    assert opts["using"] == "hnsw"
    assert opts["with"] == {"m": 16, "ef_construction": 64}
    assert opts["ops"] == {"embedding": "vector_cosine_ops"}


def test_chunk_content_tsv_is_generated_and_gin_indexed():
    column = DocumentChunk.__table__.c.content_tsv
    assert isinstance(column.type, TSVECTOR)
    assert isinstance(column.computed, Computed)
    assert column.computed.persisted is True
    assert "to_tsvector('english', content)" in str(column.computed.sqltext)

    indexes = {ix.name: ix for ix in DocumentChunk.__table__.indexes}
    assert indexes["ix_document_chunks_content_tsv"].dialect_options["postgresql"]["using"] == "gin"


def test_document_links_to_content_ref():
    column = KnowledgeDocument.__table__.c.content_ref_id
    assert column.nullable is True
    assert {fk.target_fullname: fk.ondelete for fk in column.foreign_keys} == {
        "content_refs.id": "SET NULL"
    }
    names = {ix.name for ix in KnowledgeDocument.__table__.indexes}
    assert "ix_knowledge_documents_content_ref_id" in names


def test_document_source_url_unique_when_set():
    indexes = {ix.name: ix for ix in KnowledgeDocument.__table__.indexes}
    uq = indexes["uq_knowledge_documents_source_url"]
    assert uq.unique is True
    assert str(uq.dialect_options["postgresql"]["where"]) == "source_url IS NOT NULL"


def test_document_chunk_still_constructs_without_tsv():
    chunk = DocumentChunk(content="hello", chunk_index=0)
    assert chunk.content_tsv is None


def test_rag_hybrid_search_migration_is_head():
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    script = ScriptDirectory.from_config(cfg)
    assert script.get_heads() == ["e5f6a7b8c9d0"]
    assert script.get_revision("e5f6a7b8c9d0").down_revision == "d4e5f6a7b8c9"


def test_rag_hybrid_search_migration_dedupes_source_url_before_unique_index(monkeypatch):
    """Duplicate source_url rows would make CREATE UNIQUE INDEX fail on upgrade."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    module = ScriptDirectory.from_config(cfg).get_revision("e5f6a7b8c9d0").module

    calls: list[tuple[str, str]] = []

    class _Op:
        def execute(self, sql):
            calls.append(("execute", str(sql)))

        def add_column(self, *a, **k):
            calls.append(("add_column", ""))

        def create_index(self, name, *a, **k):
            calls.append(("create_index", name))

    monkeypatch.setattr(module, "op", _Op())
    module.upgrade()

    unique_at = calls.index(("create_index", "uq_knowledge_documents_source_url"))
    dedupe = [
        i for i, (kind, sql) in enumerate(calls)
        if kind == "execute" and "DELETE FROM knowledge_documents" in sql
    ]
    assert dedupe and dedupe[0] < unique_at
    sql = calls[dedupe[0]][1]
    # newest wins, deterministic tie-break, NULL source_urls untouched
    assert "ingested_at DESC" in sql and "id DESC" in sql
    assert "source_url IS NOT NULL" in sql
