"""Tests for the lesson ingestion script.

Hermetic: the DB session is an AsyncMock whose execute() returns canned lesson
rows, and ingest_document is replaced by a spy. No model or database.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.dialects import postgresql

from scripts import ingest_lessons


def _db_with_rows(rows):
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = rows
    db.execute.return_value = result
    return db


@pytest.mark.asyncio
async def test_every_lesson_row_becomes_one_ingest_call_linked_to_its_content_ref():
    a, b = uuid.uuid4(), uuid.uuid4()
    db = _db_with_rows([
        (a, "Superposition", "A qubit can be in a superposition of 0 and 1."),
        (b, "The Hadamard Gate", "H maps |0> to |+>."),
    ])
    spy = AsyncMock()

    with patch("scripts.ingest_lessons.ingest_document", spy):
        result = await ingest_lessons.ingest_lessons(db)

    assert spy.await_count == 2
    calls = [c.kwargs for c in spy.await_args_list]
    assert calls[0] == {
        "title": "Superposition",
        "source_url": f"qlearn://lesson/{a}",
        "source_type": "course",
        "text": "A qubit can be in a superposition of 0 and 1.",
        "content_ref_id": a,
    }
    assert calls[1]["content_ref_id"] == b
    assert calls[1]["source_url"] == f"qlearn://lesson/{b}"
    assert all(c.args == (db,) for c in spy.await_args_list)
    assert result.documents == 2
    assert result.chunks == 2  # each short body is a single chunk


@pytest.mark.asyncio
async def test_blank_lessons_are_skipped():
    db = _db_with_rows([(uuid.uuid4(), "Empty", "   \n "), (uuid.uuid4(), "Real", "body")])
    spy = AsyncMock()

    with patch("scripts.ingest_lessons.ingest_document", spy):
        result = await ingest_lessons.ingest_lessons(db)

    assert spy.await_count == 1
    assert spy.await_args.kwargs["title"] == "Real"
    assert result.documents == 1


@pytest.mark.asyncio
async def test_query_reads_non_empty_lessons_only():
    db = _db_with_rows([])

    with patch("scripts.ingest_lessons.ingest_document", AsyncMock()):
        result = await ingest_lessons.ingest_lessons(db)

    stmt = db.execute.await_args.args[0]
    sql = str(stmt.compile(dialect=postgresql.dialect()))
    assert "FROM lessons" in sql
    assert "lessons.content IS NOT NULL" in sql
    assert result.documents == 0 and result.chunks == 0


def test_lesson_source_url_is_a_stable_qlearn_uri():
    lesson_id = uuid.UUID("c1000000-0000-4000-8000-000000000001")
    assert ingest_lessons.lesson_source_url(lesson_id) == (
        "qlearn://lesson/c1000000-0000-4000-8000-000000000001"
    )
