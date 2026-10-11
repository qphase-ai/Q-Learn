"""AI Classroom service — sessions, idempotent turns, run lease, durable board events.

Flow:
    POST /sessions            create_session()            → ClassroomSession (+ AgentSession)
    POST /sessions/{id}/turns start_turn()                → persist the user message, take the run
                                                            lease (supersedes any running turn), 202.
                                                            Router enqueues run_turn() as a background task.
    run_turn()                graph.ainvoke(thread_id=session_id) with a `_RunEmitter`:
                              durable whiteboard actions go through persist_whiteboard_event()
                              (atomic sequence allocation + run-id check), deltas through the token
                              batcher, then the assistant message is persisted and published.
    GET  /sessions/{id}       get_session_view()          → status + chat history
    GET  /sessions/{id}/state get_state()                 → snapshot + events after N (reload / gap repair)
    POST /sessions/{id}/interrupt  interrupt()            → drops the lease; the run's late events are rejected

Concurrency model: the row in `classroom_sessions` is the lock. `active_run_id` is the
only run allowed to write events; every event write is a conditional
`UPDATE … WHERE active_run_id = :run RETURNING last_event_seq`, so a superseded or
interrupted run gets no sequence number and stops (RunSupersededError). The lease
expiry marks a run whose process died (reported as `failed`, never blocks a new turn).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.classroom.context import build_summary, load_context
from app.agents.classroom.graph import get_graph
from app.agents.classroom.orchestrator import topic_title
from app.agents.classroom.state import CONTEXT_HISTORY_WITH_SUMMARY, initial_state
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.exceptions import NotFoundError, RunSupersededError
from app.models.agent import AgentMessage, AgentSession
from app.models.classroom import ClassroomSession, WhiteboardEvent, WhiteboardSnapshot
from app.schemas.classroom import (
    BoardSnapshot,
    ClassroomMessageOut,
    ClassroomSessionResponse,
    ClassroomStateResponse,
    make_envelope,
)
from app.schemas.whiteboard import (
    SCHEMA_VERSION,
    action_payload,
    empty_board,
    parse_action,
    replay,
)
from app.services.realtime_service import (
    ClassroomTokenBatcher,
    publish_classroom_action,
    publish_classroom_completed,
    publish_classroom_error,
    publish_classroom_status,
)

logger = structlog.get_logger(__name__)

DEFAULT_TITLE = "New classroom"
SNAPSHOT_EVERY = 10           # events between snapshots (also taken at step boundaries)
HISTORY_LOAD_LIMIT = 40       # messages read to build the model context
SUMMARY_MESSAGE_THRESHOLD = 12  # refresh the rolling summary beyond this many messages
SUMMARY_SCAN_LIMIT = 200
MAX_STATE_EVENTS = 1000
GENERIC_FAILURE = "The teacher ran into a problem. Please try again."

# session_id -> run_id this process believes is current ("" = interrupted).
# A fast path to stop streaming deltas; the database check is authoritative.
_active_runs: dict[str, str] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _lease_deadline() -> datetime:
    return _now() + timedelta(seconds=get_settings().classroom_run_lease_seconds)


def _as_aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def effective_status(session: ClassroomSession) -> str:
    """`running` with an expired lease means the run's process died → `failed`."""
    if session.status == "running":
        expires = _as_aware(session.run_lease_expires_at)
        if expires is None or expires < _now():
            return "failed"
    return session.status


def _row_to_envelope(row: WhiteboardEvent) -> dict[str, Any]:
    return make_envelope(
        session_id=row.session_id,
        turn_id=row.turn_id or "",
        type=row.event_type,  # type: ignore[arg-type]
        payload=row.payload,
        sequence_no=row.sequence_no,
        step_id=row.step_id,
        event_id=row.event_id,
    )


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

async def _owned_session(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID, *, lock: bool = False
) -> ClassroomSession:
    """The caller's session, or NotFoundError (also for someone else's session)."""
    stmt = select(ClassroomSession).where(
        ClassroomSession.id == session_id, ClassroomSession.user_id == user_id
    )
    if lock:
        stmt = stmt.with_for_update()
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        raise NotFoundError("Session not found")
    return session


async def create_session(db: AsyncSession, user_id: uuid.UUID) -> ClassroomSession:
    session_id = uuid.uuid4()
    db.add(AgentSession(id=session_id, user_id=user_id, session_type="classroom"))
    await db.flush()
    session = ClassroomSession(
        id=session_id,
        user_id=user_id,
        agent_session_id=session_id,
        title=DEFAULT_TITLE,
        status="idle",
        last_event_seq=0,
        summary_version=0,
    )
    db.add(session)
    await db.commit()
    return session


async def get_session_view(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> ClassroomSessionResponse:
    session = await _owned_session(db, session_id, user_id)
    rows = (
        await db.execute(
            select(AgentMessage)
            .where(AgentMessage.session_id == session.agent_session_id, AgentMessage.role.in_(("user", "assistant")))
            .order_by(AgentMessage.created_at, AgentMessage.id)
        )
    ).scalars().all()
    return ClassroomSessionResponse(
        status=effective_status(session),  # type: ignore[arg-type]
        messages=[
            ClassroomMessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at) for m in rows
        ],
    )


# ---------------------------------------------------------------------------
# Turns, lease, interrupt
# ---------------------------------------------------------------------------

async def _existing_turn(db: AsyncSession, session_id: uuid.UUID, client_message_id: uuid.UUID):
    return await db.scalar(
        select(AgentMessage).where(
            AgentMessage.session_id == session_id, AgentMessage.client_message_id == client_message_id
        )
    )


async def start_turn(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    message: str,
    client_message_id: uuid.UUID,
) -> tuple[uuid.UUID, bool]:
    """Persist the user message and take the run lease. Returns (turn_id, is_new).

    Idempotent on `client_message_id`: a retry returns the original turn_id with
    is_new=False and starts nothing. A new turn while another is running supersedes
    it — the old run's later events are rejected because `active_run_id` moves on.
    """
    session = await _owned_session(db, session_id, user_id, lock=True)  # row lock serialises turns

    existing = await _existing_turn(db, session.agent_session_id, client_message_id)
    if existing is not None:
        turn_id = existing.turn_id  # read before rollback expires the instance
        await db.rollback()  # release the row lock
        return turn_id, False

    turn_id = uuid.uuid4()
    db.add(
        AgentMessage(
            session_id=session.agent_session_id,
            role="user",
            content=message,
            turn_id=turn_id,
            client_message_id=client_message_id,
        )
    )
    session.active_run_id = turn_id
    session.status = "running"
    session.run_lease_expires_at = _lease_deadline()
    session.last_activity_at = _now()
    if session.title == DEFAULT_TITLE:
        session.title = topic_title(message, 80)
    try:
        await db.commit()
    except IntegrityError:
        # A concurrent retry with the same client_message_id won the race.
        await db.rollback()
        existing = await _existing_turn(db, session.agent_session_id, client_message_id)
        if existing is None:
            raise
        return existing.turn_id, False

    _active_runs[str(session_id)] = str(turn_id)
    return turn_id, True


async def interrupt(db: AsyncSession, user_id: uuid.UUID, session_id: uuid.UUID) -> bool:
    """Stop the running turn (if any). Its late events are rejected from now on."""
    session = await _owned_session(db, session_id, user_id, lock=True)
    run_id = session.active_run_id
    if run_id is None:
        await db.rollback()
        return False
    session.active_run_id = None
    session.status = "idle"
    session.run_lease_expires_at = None
    session.last_activity_at = _now()
    await db.commit()
    _active_runs[str(session_id)] = ""
    await publish_classroom_status(session_id, run_id, "Interrupted")
    return True


# ---------------------------------------------------------------------------
# Durable events
# ---------------------------------------------------------------------------

async def _write_snapshot(db: AsyncSession, session_id: uuid.UUID, upto_seq: int) -> None:
    """Materialise board state through `upto_seq` (snapshot + tail replay)."""
    snap = await db.get(WhiteboardSnapshot, session_id)
    base = snap.board_state if snap else empty_board()
    last = snap.last_sequence_no if snap else 0
    if upto_seq <= last:
        return
    rows = (
        await db.execute(
            select(WhiteboardEvent)
            .where(
                WhiteboardEvent.session_id == session_id,
                WhiteboardEvent.sequence_no > last,
                WhiteboardEvent.sequence_no <= upto_seq,
            )
            .order_by(WhiteboardEvent.sequence_no)
        )
    ).scalars().all()
    board = replay(base, [_row_to_envelope(r) for r in rows])
    if snap is None:
        db.add(WhiteboardSnapshot(session_id=session_id, version=board["version"], board_state=board, last_sequence_no=upto_seq))
    else:
        snap.version = board["version"]
        snap.board_state = board
        snap.last_sequence_no = upto_seq


async def persist_whiteboard_event(
    session_id: uuid.UUID,
    run_id: uuid.UUID,
    payload: dict[str, Any],
    step_id: str | None,
    *,
    db_factory=None,
) -> tuple[int, str]:
    """Validate, allocate the next sequence number and store one whiteboard action.

    Atomic: the conditional UPDATE both allocates `last_event_seq + 1` and proves
    `run_id` still owns the board with an unexpired lease (it also extends the lease). No row → the run was
    superseded/interrupted → RunSupersededError and nothing is written.
    Returns (sequence_no, event_id).
    """
    action = parse_action(payload)  # defence in depth: never store an unvalidated action
    body = action_payload(action)
    event_id = str(uuid.uuid4())
    factory = db_factory or AsyncSessionLocal
    async with factory() as db:
        seq = (
            await db.execute(
                update(ClassroomSession)
                .where(
                    ClassroomSession.id == session_id,
                    ClassroomSession.active_run_id == run_id,
                    # An expired lease is already reported as `failed`: it must not revive itself.
                    ClassroomSession.run_lease_expires_at > _now(),
                )
                .values(
                    last_event_seq=ClassroomSession.last_event_seq + 1,
                    run_lease_expires_at=_lease_deadline(),
                    last_activity_at=_now(),
                )
                .returning(ClassroomSession.last_event_seq)
                .execution_options(synchronize_session=False)
            )
        ).scalar_one_or_none()
        if seq is None:
            await db.rollback()
            raise RunSupersededError("Turn was superseded or interrupted")
        db.add(
            WhiteboardEvent(
                session_id=session_id,
                sequence_no=seq,
                event_id=event_id,
                schema_version=SCHEMA_VERSION,
                event_type="whiteboard.action",
                step_id=step_id,
                turn_id=run_id,
                payload=body,
            )
        )
        await db.flush()
        if body["action"] in ("step_started", "step_completed") or seq % SNAPSHOT_EVERY == 0:
            await _write_snapshot(db, session_id, seq)
        await db.commit()
    return seq, event_id


async def get_board_state(db: AsyncSession, session_id: uuid.UUID) -> dict[str, Any]:
    """Current board: latest snapshot plus the events after it."""
    snap = await db.get(WhiteboardSnapshot, session_id)
    base = snap.board_state if snap else empty_board()
    last = snap.last_sequence_no if snap else 0
    rows = (
        await db.execute(
            select(WhiteboardEvent)
            .where(WhiteboardEvent.session_id == session_id, WhiteboardEvent.sequence_no > last)
            .order_by(WhiteboardEvent.sequence_no)
        )
    ).scalars().all()
    return replay(base, [_row_to_envelope(r) for r in rows])


async def get_state(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID, after_seq: int = 0
) -> ClassroomStateResponse:
    """Snapshot + events after `after_seq`, for reload and gap repair.

    - If a snapshot is newer than `after_seq`, it is returned and `events` are those
      after the snapshot (the client replaces its board with the snapshot, then applies them).
    - Otherwise `snapshot` is null and `events` are those with sequence_no > after_seq.
    """
    session = await _owned_session(db, session_id, user_id)
    snap = await db.get(WhiteboardSnapshot, session_id)
    use_snapshot = snap is not None and snap.last_sequence_no > after_seq
    floor = snap.last_sequence_no if use_snapshot else after_seq
    rows = (
        await db.execute(
            select(WhiteboardEvent)
            .where(WhiteboardEvent.session_id == session_id, WhiteboardEvent.sequence_no > floor)
            .order_by(WhiteboardEvent.sequence_no)
            .limit(MAX_STATE_EVENTS)
        )
    ).scalars().all()
    return ClassroomStateResponse(
        status=effective_status(session),  # type: ignore[arg-type]
        snapshot=BoardSnapshot(board_state=snap.board_state, last_sequence_no=snap.last_sequence_no)
        if use_snapshot
        else None,
        events=[_row_to_envelope(r) for r in rows],
    )


# ---------------------------------------------------------------------------
# Running a turn
# ---------------------------------------------------------------------------

class _RunEmitter:
    """The graph's outbound channel: ordering, persistence and publishing for one run."""

    def __init__(self, session_id: uuid.UUID, turn_id: uuid.UUID, batcher: ClassroomTokenBatcher, db_factory=None):
        self.session_id = session_id
        self.turn_id = turn_id
        self.batcher = batcher
        self._db_factory = db_factory

    def _check(self) -> None:
        current = _active_runs.get(str(self.session_id))
        if current is not None and current != str(self.turn_id):
            raise RunSupersededError("Turn was superseded or interrupted")

    async def status(self, label: str) -> None:
        self._check()
        await publish_classroom_status(self.session_id, self.turn_id, label)

    async def delta(self, text: str) -> None:
        self._check()
        await self.batcher.add(text)

    async def action(self, payload: dict[str, Any], step_id: str | None) -> None:
        self._check()
        try:
            parse_action(payload)
        except PydanticValidationError as exc:
            logger.warning("classroom_action_rejected", session_id=str(self.session_id), error=str(exc)[:300])
            return
        await self.batcher.flush()  # text so far goes out before the board changes
        seq, event_id = await persist_whiteboard_event(
            self.session_id, self.turn_id, payload, step_id, db_factory=self._db_factory
        )
        await publish_classroom_action(
            self.session_id, self.turn_id, action_payload(parse_action(payload)), seq, event_id, step_id
        )


async def _load_history(db: AsyncSession, agent_session_id: uuid.UUID, exclude_turn: uuid.UUID) -> list[dict[str, str]]:
    rows = (
        await db.execute(
            select(AgentMessage)
            .where(
                AgentMessage.session_id == agent_session_id,
                AgentMessage.role.in_(("user", "assistant")),
            )
            .order_by(AgentMessage.created_at.desc(), AgentMessage.id.desc())
            .limit(HISTORY_LOAD_LIMIT)
        )
    ).scalars().all()
    return [
        {"role": m.role, "content": m.content}
        for m in reversed(rows)
        if m.turn_id != exclude_turn or m.role != "user"
    ]


def _make_context_loader(session_id: uuid.UUID, user_id: uuid.UUID, turn_id: uuid.UUID, message: str):
    async def loader(_state) -> dict[str, Any]:
        async with AsyncSessionLocal() as db:
            session = await db.get(ClassroomSession, session_id)
            history = await _load_history(db, session.agent_session_id, turn_id)
            board = await get_board_state(db, session_id)
            return await load_context(
                db,
                user_id=user_id,
                messages=history,
                summary=session.summary,
                board_state=board,
                user_message=message,
            )

    return loader


async def _refresh_summary(db: AsyncSession, session: ClassroomSession) -> None:
    rows = (
        await db.execute(
            select(AgentMessage)
            .where(AgentMessage.session_id == session.agent_session_id, AgentMessage.role.in_(("user", "assistant")))
            .order_by(AgentMessage.created_at.desc(), AgentMessage.id.desc())
            .limit(SUMMARY_SCAN_LIMIT)
        )
    ).scalars().all()
    if len(rows) <= SUMMARY_MESSAGE_THRESHOLD:
        return
    chronological = [{"role": m.role, "content": m.content} for m in reversed(rows)]
    summary = build_summary(chronological[:-CONTEXT_HISTORY_WITH_SUMMARY])
    if summary and summary != session.summary:
        session.summary = summary
        session.summary_version = (session.summary_version or 0) + 1


async def _finish_success(session_id: uuid.UUID, turn_id: uuid.UUID, content: str) -> uuid.UUID | None:
    """Persist the assistant message and close the run — only if it still owns the lease."""
    async with AsyncSessionLocal() as db:
        session = (
            await db.execute(select(ClassroomSession).where(ClassroomSession.id == session_id).with_for_update())
        ).scalar_one_or_none()
        if session is None or session.active_run_id != turn_id:
            await db.rollback()
            return None
        assistant = AgentMessage(
            session_id=session.agent_session_id,
            role="assistant",
            content=content,
            agent_name="teacher",
            turn_id=turn_id,
        )
        db.add(assistant)
        await db.flush()
        session.status = "completed"
        session.active_run_id = None
        session.run_lease_expires_at = None
        session.last_activity_at = _now()
        await _write_snapshot(db, session_id, session.last_event_seq)
        await _refresh_summary(db, session)
        await db.commit()
        return assistant.id


async def _finish_failure(session_id: uuid.UUID, turn_id: uuid.UUID) -> bool:
    async with AsyncSessionLocal() as db:
        session = (
            await db.execute(select(ClassroomSession).where(ClassroomSession.id == session_id).with_for_update())
        ).scalar_one_or_none()
        if session is None or session.active_run_id != turn_id:
            await db.rollback()
            return False
        session.status = "failed"
        session.active_run_id = None
        session.run_lease_expires_at = None
        await db.commit()
        return True


async def run_turn(
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    turn_id: uuid.UUID,
    message: str,
    *,
    graph=None,
) -> None:
    """Run the classroom graph for one turn. Never raises (background task)."""
    sid, tid = str(session_id), str(turn_id)
    batcher = ClassroomTokenBatcher(sid, tid)
    emitter = _RunEmitter(session_id, turn_id, batcher)
    _active_runs.setdefault(sid, tid)
    try:
        graph = graph or get_graph()
        config = {
            "configurable": {
                "thread_id": sid,
                "emitter": emitter,
                "context_loader": _make_context_loader(session_id, user_id, turn_id, message),
            }
        }
        result = await graph.ainvoke(initial_state(session_id=sid, turn_id=tid, user_message=message), config)
        content = (result.get("final_message") or "").strip()
        if not content:
            raise ValueError("teacher produced no answer")
        await batcher.flush()
        message_id = await _finish_success(session_id, turn_id, content)
        if message_id is None:
            logger.info("classroom_run_superseded_at_finish", session_id=sid, turn_id=tid)
            return
        await publish_classroom_completed(session_id, turn_id, message_id, content)
    except RunSupersededError:
        await batcher.discard()
        logger.info("classroom_run_superseded", session_id=sid, turn_id=tid)
    except Exception as exc:  # noqa: BLE001 — background task, never re-raise
        logger.exception("classroom_run_failed", session_id=sid, turn_id=tid, error=str(exc))
        await batcher.discard()
        try:
            if await _finish_failure(session_id, turn_id):
                await publish_classroom_error(session_id, turn_id, "TURN_FAILED", GENERIC_FAILURE)
        except Exception:  # noqa: BLE001
            logger.warning("classroom_failure_report_failed", session_id=sid)
    finally:
        if _active_runs.get(sid) in (tid, ""):
            _active_runs.pop(sid, None)
