"""Checkpointer lifecycle: URL resolution, graceful degradation, and (optional) real Postgres."""
import uuid

import pytest
from langchain_core.messages import AIMessageChunk

import app.agents.classroom.checkpointer as cp
import app.agents.classroom.llm_io as llm_io
import app.agents.classroom.validator as validator
from app.agents.classroom.graph import build_graph, get_graph
from app.agents.classroom.state import initial_state
from app.config import Settings, get_settings


def settings(**kw):
    base = dict(secret_key="x", database_url="postgresql+asyncpg://u:p@db:5432/q", supabase_url="u",
                supabase_service_key="k", supabase_anon_key="a")
    base.update(kw)
    return Settings(_env_file=None, **base)


def test_url_prefers_explicit_setting_and_strips_driver():
    s = settings(checkpoint_database_url="postgresql+asyncpg://u:p@direct:5432/q")
    assert cp.resolve_checkpoint_url(s) == "postgresql://u:p@direct:5432/q"


def test_url_derived_from_database_url_when_direct():
    assert cp.resolve_checkpoint_url(settings()) == "postgresql://u:p@db:5432/q"


def test_pooler_url_without_explicit_setting_is_unusable():
    s = settings(database_url="postgresql+asyncpg://u:p@pooler.supabase.com:6543/postgres")
    assert cp.resolve_checkpoint_url(s) is None
    ok = settings(database_url=s.database_url, checkpoint_database_url="postgresql://u:p@db.supabase.co:5432/postgres")
    assert cp.resolve_checkpoint_url(ok) == "postgresql://u:p@db.supabase.co:5432/postgres"


async def test_open_degrades_to_none_when_pooler(monkeypatch):
    s = settings(database_url="postgresql+asyncpg://u:p@pooler:6543/postgres")
    assert await cp.open_checkpointer(s) is None
    assert cp.get_checkpointer() is None


async def test_open_degrades_to_none_when_unreachable():
    s = settings(checkpoint_database_url="postgresql://nobody:nope@127.0.0.1:1/none")
    cp.OPEN_TIMEOUT_SECONDS, old = 2, cp.OPEN_TIMEOUT_SECONDS
    try:
        assert await cp.open_checkpointer(s) is None
    finally:
        cp.OPEN_TIMEOUT_SECONDS = old
    assert cp.get_checkpointer() is None


def test_get_graph_works_without_a_checkpointer():
    assert cp.get_checkpointer() is None
    g = get_graph()
    assert g is get_graph()  # cached
    assert g.checkpointer is None


class _Llm:
    async def astream(self, messages):
        yield AIMessageChunk(content="persisted answer")


class _Em:
    async def status(self, label): ...
    async def delta(self, text): ...
    async def action(self, payload, step_id): ...


async def test_postgres_saver_round_trip(monkeypatch):
    """Real AsyncPostgresSaver on the test database; skipped when unreachable."""
    s = get_settings()
    if cp.resolve_checkpoint_url(s) is None:
        pytest.skip("DATABASE_URL is on the pooler")
    saver = await cp.open_checkpointer(s)
    if saver is None:
        pytest.skip("Postgres checkpointer unavailable in this environment")
    try:
        monkeypatch.setattr(llm_io, "get_llm", lambda **k: _Llm())
        graph = build_graph(saver)
        thread = str(uuid.uuid4())
        cfg = {"configurable": {"thread_id": thread, "emitter": _Em()}}
        result = await graph.ainvoke(initial_state(session_id="s", turn_id="t", user_message="What is a qubit?"), cfg)
        assert result["final_message"] == "persisted answer"
        # a fresh graph object (as after a restart) sees the same thread state
        again = build_graph(saver)
        snap = await again.aget_state({"configurable": {"thread_id": thread}})
        assert snap.values["final_message"] == "persisted answer" and snap.next == ()
        async with saver.conn.connection() as conn:
            rls = await (await conn.execute(
                "SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname = ANY(%s)", (list(cp.CHECKPOINT_TABLES),)
            )).fetchone()
        assert list(rls.values())[0] is True
    finally:
        await cp.close_checkpointer()
