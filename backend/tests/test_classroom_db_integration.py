"""Integration tests: classroom service against real Postgres.

Skipped when the database is unreachable or lacks the AI Classroom migration
(`alembic upgrade head`). Committed rows are cleaned up by deleting the test users
(everything cascades). Realtime publishers and the LLM graph are mocked.
"""
from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.services.classroom_service as svc
from app.config import get_settings
from app.exceptions import NotFoundError, RunSupersededError
from app.models.agent import AgentMessage
from app.models.classroom import ClassroomSession, WhiteboardEvent, WhiteboardSnapshot
from app.models.user import User
from app.schemas.whiteboard import replay

_READY = text(
    "SELECT to_regclass('public.whiteboard_events') IS NOT NULL "
    "AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agent_messages' AND column_name='client_message_id')"
)


@pytest.fixture
async def factory(monkeypatch):
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            ready = await conn.scalar(_READY)
    except Exception as exc:  # noqa: BLE001
        await engine.dispose()
        pytest.skip(f"test database unavailable: {exc}")
    if not ready:
        await engine.dispose()
        pytest.skip("test database lacks the AI Classroom migration")
    f = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(svc, "AsyncSessionLocal", f)
    created: list[uuid.UUID] = []
    f.created = created  # type: ignore[attr-defined]
    yield f
    async with f() as db:
        for uid in created:
            u = await db.get(User, uid)
            if u is not None:
                await db.delete(u)
        await db.commit()
    await engine.dispose()


async def make_user(factory) -> uuid.UUID:
    uid = uuid.uuid4()
    async with factory() as db:
        db.add(User(id=uid, email=f"cls-{uid}@example.test"))
        await db.commit()
    factory.created.append(uid)
    return uid


@pytest.fixture
def publishers(monkeypatch):
    mocks = {}
    for name in ("publish_classroom_status", "publish_classroom_action", "publish_classroom_completed", "publish_classroom_error"):
        mocks[name] = AsyncMock()
        monkeypatch.setattr(svc, name, mocks[name])
    return mocks


async def new_session(factory, user_id):
    async with factory() as db:
        return (await svc.create_session(db, user_id)).id


def step(title="t"):
    return {"action": "step_started", "title": title}


CIRCUIT = {"action": "draw_quantum_circuit", "object_id": "c1", "qubits": 1, "gates": [{"type": "H", "targets": [0]}]}


# ---------------------------------------------------------------------------

async def test_ownership_other_users_session_is_not_found(factory):
    owner, other = await make_user(factory), await make_user(factory)
    sid = await new_session(factory, owner)
    async with factory() as db:
        for call in (
            svc.get_session_view(db, sid, other),
            svc.get_state(db, sid, other, 0),
            svc.start_turn(db, other, sid, "hi", uuid.uuid4()),
            svc.interrupt(db, other, sid),
        ):
            with pytest.raises(NotFoundError):
                await call
        with pytest.raises(NotFoundError):
            await svc.get_state(db, uuid.uuid4(), owner, 0)
        assert (await svc.get_session_view(db, sid, owner)).status == "idle"


async def test_start_turn_is_idempotent_on_client_message_id(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    cmid = uuid.uuid4()
    async with factory() as db:
        t1, new1 = await svc.start_turn(db, uid, sid, "hello", cmid)
    async with factory() as db:
        t2, new2 = await svc.start_turn(db, uid, sid, "hello", cmid)
        view = await svc.get_session_view(db, sid, uid)
    assert (t1, new1, new2) == (t2, True, False)
    assert [m.content for m in view.messages] == ["hello"] and view.status == "running"


async def test_concurrent_duplicate_turns_create_one_turn(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    cmid = uuid.uuid4()
    async with factory() as db:
        agent_sid = (await db.get(ClassroomSession, sid)).agent_session_id

    async def go():
        async with factory() as db:
            return await svc.start_turn(db, uid, sid, "dup", cmid)

    results = await asyncio.gather(*[go() for _ in range(5)])
    assert len({t for t, _ in results}) == 1 and sum(1 for _, new in results if new) == 1
    async with factory() as db:
        assert await db.scalar(select(func.count()).select_from(AgentMessage).where(AgentMessage.session_id == agent_sid, AgentMessage.client_message_id == cmid)) == 1


async def test_first_message_sets_title(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        await svc.start_turn(db, uid, sid, "Explain superposition. Please.", uuid.uuid4())
        assert (await db.get(ClassroomSession, sid)).title == "Explain superposition"


async def test_supersede_rejects_the_old_runs_late_events(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        a, _ = await svc.start_turn(db, uid, sid, "first", uuid.uuid4())
    seq, _ = await svc.persist_whiteboard_event(sid, a, step("A"), "s-a")
    assert seq == 1
    async with factory() as db:
        b, _ = await svc.start_turn(db, uid, sid, "second", uuid.uuid4())
    with pytest.raises(RunSupersededError):
        await svc.persist_whiteboard_event(sid, a, CIRCUIT, "s-a")  # late event from the superseded run
    seq_b, event_b = await svc.persist_whiteboard_event(sid, b, step("B"), "s-b")
    assert seq_b == 2 and event_b == await _event_id(factory, sid, 2)
    async with factory() as db:
        rows = (await db.execute(select(WhiteboardEvent).where(WhiteboardEvent.session_id == sid).order_by(WhiteboardEvent.sequence_no))).scalars().all()
    assert [(r.sequence_no, r.turn_id) for r in rows] == [(1, a), (2, b)]  # the rejected one left no row, no gap


async def _event_id(factory, sid, seq):
    async with factory() as db:
        return await db.scalar(select(WhiteboardEvent.event_id).where(WhiteboardEvent.session_id == sid, WhiteboardEvent.sequence_no == seq))


async def test_interrupt_rejects_further_events(factory, publishers):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "go", uuid.uuid4())
    async with factory() as db:
        assert await svc.interrupt(db, uid, sid) is True
    async with factory() as db:
        assert await svc.interrupt(db, uid, sid) is False  # nothing left to stop
        assert (await svc.get_session_view(db, sid, uid)).status == "idle"
    with pytest.raises(RunSupersededError):
        await svc.persist_whiteboard_event(sid, t, step(), None)
    publishers["publish_classroom_status"].assert_awaited_once()


async def test_invalid_action_is_never_stored(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "go", uuid.uuid4())
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        await svc.persist_whiteboard_event(sid, t, {**CIRCUIT, "gates": [{"type": "H", "targets": [3]}]}, None)
    async with factory() as db:
        assert await db.scalar(select(func.count()).select_from(WhiteboardEvent).where(WhiteboardEvent.session_id == sid)) == 0
        assert (await db.get(ClassroomSession, sid)).last_event_seq == 0  # no sequence consumed


async def test_concurrent_events_get_unique_gapless_sequence_numbers(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "go", uuid.uuid4())
    results = await asyncio.gather(
        *[svc.persist_whiteboard_event(sid, t, {"action": "highlight_object", "object_id": f"o{i}"}, None) for i in range(25)]
    )
    assert sorted(s for s, _ in results) == list(range(1, 26))
    async with factory() as db:
        assert (await db.get(ClassroomSession, sid)).last_event_seq == 25


async def test_database_enforces_unique_sequence_and_event_id(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "go", uuid.uuid4())
    await svc.persist_whiteboard_event(sid, t, step(), None)
    for kwargs in ({"sequence_no": 1, "event_id": "new-id"}, {"sequence_no": 99, "event_id": None}):
        async with factory() as db:
            ev_id = kwargs["event_id"] or await db.scalar(select(WhiteboardEvent.event_id).where(WhiteboardEvent.session_id == sid))
            db.add(WhiteboardEvent(session_id=sid, sequence_no=kwargs["sequence_no"], event_id=ev_id, event_type="whiteboard.action", payload={"action": "step_completed"}))
            with pytest.raises(IntegrityError):
                await db.commit()


async def test_snapshot_plus_replay_equals_full_replay(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "go", uuid.uuid4())
    await svc.persist_whiteboard_event(sid, t, step("one"), "st")
    await svc.persist_whiteboard_event(sid, t, CIRCUIT, "st")
    for i in range(svc.SNAPSHOT_EVERY + 3):
        await svc.persist_whiteboard_event(sid, t, {"action": "draw_annotation", "object_id": f"n{i}", "text": f"note {i}", "target_id": "c1"}, "st")
    await svc.persist_whiteboard_event(sid, t, {"action": "highlight_object", "object_id": "c1"}, "st")

    async with factory() as db:
        all_rows = (await db.execute(select(WhiteboardEvent).where(WhiteboardEvent.session_id == sid).order_by(WhiteboardEvent.sequence_no))).scalars().all()
        full = replay(None, [svc._row_to_envelope(r) for r in all_rows])
        snap = await db.get(WhiteboardSnapshot, sid)
        assert snap is not None and 0 < snap.last_sequence_no < len(all_rows)  # periodic + step boundary snapshot
        state = await svc.get_state(db, sid, uid, 0)
        assert state.snapshot is not None
        rebuilt = replay(state.snapshot.board_state, [e.model_dump() for e in state.events])
        assert rebuilt == full == await svc.get_board_state(db, sid)
        assert all(e.sequence_no > state.snapshot.last_sequence_no for e in state.events)


async def test_get_state_after_seq_semantics(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "go", uuid.uuid4())
    await svc.persist_whiteboard_event(sid, t, step(), "st")  # seq 1, snapshot at step boundary
    for i in range(3):
        await svc.persist_whiteboard_event(sid, t, {"action": "highlight_object", "object_id": f"o{i}"}, "st")  # 2..4
    async with factory() as db:
        s = await svc.get_state(db, sid, uid, 0)
        assert s.snapshot.last_sequence_no == 1 and [e.sequence_no for e in s.events] == [2, 3, 4]
        s = await svc.get_state(db, sid, uid, 2)  # client is past the snapshot: plain gap repair
        assert s.snapshot is None and [e.sequence_no for e in s.events] == [3, 4]
        s = await svc.get_state(db, sid, uid, 4)
        assert s.snapshot is None and s.events == []
        env = (await svc.get_state(db, sid, uid, 3)).events[0].model_dump()
        assert env["type"] == "whiteboard.action" and env["sequence_no"] == 4 and env["turn_id"] == str(t) and env["schema_version"] == 1


async def test_stale_lease_reports_failed_and_does_not_block_a_new_turn(factory):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        await svc.start_turn(db, uid, sid, "go", uuid.uuid4())
        await db.execute(text("UPDATE classroom_sessions SET run_lease_expires_at = now() - interval '1 minute' WHERE id = :sid"), {"sid": sid})
        await db.commit()
    async with factory() as db:
        assert (await svc.get_session_view(db, sid, uid)).status == "failed"
        t2, new = await svc.start_turn(db, uid, sid, "again", uuid.uuid4())
        assert new and (await svc.get_session_view(db, sid, uid)).status == "running"


# ---------------------------------------------------------------------------
# run_turn end to end with a scripted graph
# ---------------------------------------------------------------------------

class ScriptedGraph:
    def __init__(self, script):
        self.script = script

    async def ainvoke(self, state, config):
        return await self.script(state, config["configurable"]["emitter"])


async def test_run_turn_persists_and_publishes_in_order(factory, publishers):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "show H", uuid.uuid4())

    async def script(state, em):
        await em.status("Teaching")
        await em.action(step("H gate"), state["step_id"])
        await em.delta("Hello ")
        await em.action(CIRCUIT, state["step_id"])
        await em.action({"action": "bogus"}, state["step_id"])  # invalid: dropped, run continues
        await em.action({"action": "step_completed"}, state["step_id"])
        return {"final_message": "Hello there"}

    await svc.run_turn(sid, uid, t, "show H", graph=ScriptedGraph(script))
    pub = publishers["publish_classroom_action"].await_args_list
    assert [c.args[3] for c in pub] == [1, 2, 3]  # sequence numbers, no gap from the dropped action
    publishers["publish_classroom_completed"].assert_awaited_once()
    publishers["publish_classroom_error"].assert_not_awaited()
    async with factory() as db:
        view = await svc.get_session_view(db, sid, uid)
        state = await svc.get_state(db, sid, uid, 0)
    assert view.status == "completed" and [(m.role, m.content) for m in view.messages] == [("user", "show H"), ("assistant", "Hello there")]
    assert state.snapshot is not None and state.snapshot.last_sequence_no == 3  # snapshot at run end
    assert state.snapshot.board_state["objects"]["c1"]["kind"] == "circuit" and state.snapshot.board_state["active_step"] is None
    async with factory() as db:
        agent_sid = (await db.get(ClassroomSession, sid)).agent_session_id
        assistant = (await db.execute(select(AgentMessage).where(AgentMessage.session_id == agent_sid, AgentMessage.role == "assistant"))).scalar_one()
    assert assistant.agent_name == "teacher" and assistant.turn_id == t


async def test_run_turn_superseded_midway_stops_and_writes_nothing_more(factory, publishers):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        a, _ = await svc.start_turn(db, uid, sid, "first", uuid.uuid4())
    proceed = asyncio.Event()

    async def slow(state, em):
        await em.action(step("A"), state["step_id"])
        await proceed.wait()
        await em.action(CIRCUIT, state["step_id"])  # late: must be rejected
        return {"final_message": "stale answer"}

    task = asyncio.create_task(svc.run_turn(sid, uid, a, "first", graph=ScriptedGraph(slow)))
    await asyncio.sleep(0.2)
    async with factory() as db:
        b, _ = await svc.start_turn(db, uid, sid, "second", uuid.uuid4())
    proceed.set()
    await task
    async with factory() as db:
        rows = (await db.execute(select(WhiteboardEvent).where(WhiteboardEvent.session_id == sid))).scalars().all()
        view = await svc.get_session_view(db, sid, uid)
        assert (await db.get(ClassroomSession, sid)).active_run_id == b
    assert len(rows) == 1 and view.status == "running"
    assert [m.role for m in view.messages] == ["user", "user"]  # no assistant message from the old run
    publishers["publish_classroom_completed"].assert_not_awaited()
    publishers["publish_classroom_error"].assert_not_awaited()


async def test_run_turn_failure_marks_failed_and_publishes_safe_error(factory, publishers):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "go", uuid.uuid4())

    async def boom(state, em):
        raise RuntimeError("secret internals")

    await svc.run_turn(sid, uid, t, "go", graph=ScriptedGraph(boom))
    err = publishers["publish_classroom_error"].await_args.args
    assert err[2] == "TURN_FAILED" and "secret" not in err[3]
    async with factory() as db:
        assert (await svc.get_session_view(db, sid, uid)).status == "failed"


async def test_run_turn_interrupted_midway_publishes_no_completion(factory, publishers):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    async with factory() as db:
        t, _ = await svc.start_turn(db, uid, sid, "go", uuid.uuid4())
    gate = asyncio.Event()

    async def script(state, em):
        await gate.wait()
        await em.action(step(), state["step_id"])
        return {"final_message": "x"}

    task = asyncio.create_task(svc.run_turn(sid, uid, t, "go", graph=ScriptedGraph(script)))
    await asyncio.sleep(0.1)
    async with factory() as db:
        await svc.interrupt(db, uid, sid)
    gate.set()
    await task
    publishers["publish_classroom_completed"].assert_not_awaited()
    async with factory() as db:
        assert await db.scalar(select(func.count()).select_from(WhiteboardEvent).where(WhiteboardEvent.session_id == sid)) == 0
        assert (await svc.get_session_view(db, sid, uid)).status == "idle"


async def test_summary_refresh_is_bounded(factory, publishers):
    uid = await make_user(factory)
    sid = await new_session(factory, uid)
    for i in range(8):
        async with factory() as db:
            t, _ = await svc.start_turn(db, uid, sid, f"question number {i} about qubits", uuid.uuid4())

        async def script(state, em):
            return {"final_message": "answer " * 50}

        await svc.run_turn(sid, uid, t, "q", graph=ScriptedGraph(script))
    async with factory() as db:
        s = await db.get(ClassroomSession, sid)
    assert s.summary_version >= 1 and s.summary and len(s.summary) <= 1700 and "question number 0" in s.summary


async def test_new_tables_have_rls_enabled(factory):
    async with factory() as db:
        rows = (await db.execute(text(
            "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN "
            "('classroom_sessions','whiteboard_events','whiteboard_snapshots')"))).all()
    assert len(rows) == 3 and all(r[1] for r in rows)
