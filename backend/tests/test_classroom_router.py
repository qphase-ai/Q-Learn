"""Classroom router: auth/ownership mapping, validation, idempotent scheduling, rate limit.

Hermetic: the service module is monkeypatched; FastAPI dependency overrides.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import NotFoundError
from app.main import app
from app.schemas.classroom import (
    BoardSnapshot,
    ClassroomMessageOut,
    ClassroomSessionResponse,
    ClassroomStateResponse,
)
from app.services import classroom_service

PREFIX = "/api/v1/classroom"


@pytest.fixture
async def client():
    user = MagicMock()
    user.id = uuid.uuid4()
    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"x-forwarded-for": f"10.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}.1"},
    ) as c:
        c.user = user
        yield c
    app.dependency_overrides.clear()


async def test_create_session(client, monkeypatch):
    sid = uuid.uuid4()
    monkeypatch.setattr(classroom_service, "create_session", AsyncMock(return_value=MagicMock(id=sid)))
    r = await client.post(f"{PREFIX}/sessions")
    assert r.status_code == 201
    assert r.json() == {"success": True, "data": {"session_id": str(sid)}, "message": "OK"}


async def test_turn_is_accepted_and_scheduled_once(client, monkeypatch):
    sid, tid = uuid.uuid4(), uuid.uuid4()
    start = AsyncMock(return_value=(tid, True))
    run = AsyncMock()
    monkeypatch.setattr(classroom_service, "start_turn", start)
    monkeypatch.setattr(classroom_service, "run_turn", run)
    cmid = uuid.uuid4()
    r = await client.post(f"{PREFIX}/sessions/{sid}/turns", json={"message": "  hi  ", "client_message_id": str(cmid)})
    assert r.status_code == 202 and r.json()["data"] == {"turn_id": str(tid)}
    start.assert_awaited_once()
    assert start.await_args.args[1:] == (client.user.id, sid, "hi", cmid)
    run.assert_awaited_once_with(sid, client.user.id, tid, "hi")


async def test_duplicate_client_message_does_not_schedule_a_run(client, monkeypatch):
    tid = uuid.uuid4()
    run = AsyncMock()
    monkeypatch.setattr(classroom_service, "start_turn", AsyncMock(return_value=(tid, False)))
    monkeypatch.setattr(classroom_service, "run_turn", run)
    r = await client.post(
        f"{PREFIX}/sessions/{uuid.uuid4()}/turns", json={"message": "hi", "client_message_id": str(uuid.uuid4())}
    )
    assert r.status_code == 202 and r.json()["data"]["turn_id"] == str(tid)
    run.assert_not_awaited()


@pytest.mark.parametrize(
    "body",
    [
        {"message": "x" * 2001, "client_message_id": str(uuid.uuid4())},
        {"message": "", "client_message_id": str(uuid.uuid4())},
        {"message": "   ", "client_message_id": str(uuid.uuid4())},
        {"message": "hi", "client_message_id": "not-a-uuid"},
        {"message": "hi"},
    ],
)
async def test_turn_body_validation(client, monkeypatch, body):
    monkeypatch.setattr(classroom_service, "start_turn", AsyncMock())
    r = await client.post(f"{PREFIX}/sessions/{uuid.uuid4()}/turns", json=body)
    assert r.status_code == 422


async def test_message_at_the_cap_is_accepted(client, monkeypatch):
    monkeypatch.setattr(classroom_service, "start_turn", AsyncMock(return_value=(uuid.uuid4(), False)))
    r = await client.post(
        f"{PREFIX}/sessions/{uuid.uuid4()}/turns", json={"message": "x" * 2000, "client_message_id": str(uuid.uuid4())}
    )
    assert r.status_code == 202


@pytest.mark.parametrize(
    "method,path,svc",
    [
        ("post", "/turns", "start_turn"),
        ("post", "/interrupt", "interrupt"),
        ("get", "", "get_session_view"),
        ("get", "/state", "get_state"),
    ],
)
async def test_other_users_session_is_404(client, monkeypatch, method, path, svc):
    monkeypatch.setattr(classroom_service, svc, AsyncMock(side_effect=NotFoundError("Session not found")))
    kwargs = {"json": {"message": "hi", "client_message_id": str(uuid.uuid4())}} if path == "/turns" else {}
    r = await getattr(client, method)(f"{PREFIX}/sessions/{uuid.uuid4()}{path}", **kwargs)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


async def test_interrupt(client, monkeypatch):
    monkeypatch.setattr(classroom_service, "interrupt", AsyncMock(return_value=True))
    r = await client.post(f"{PREFIX}/sessions/{uuid.uuid4()}/interrupt")
    assert r.status_code == 200 and r.json()["data"] == {"interrupted": True}


async def test_get_session_shape(client, monkeypatch):
    mid = uuid.uuid4()
    monkeypatch.setattr(
        classroom_service,
        "get_session_view",
        AsyncMock(
            return_value=ClassroomSessionResponse(
                status="idle",
                messages=[ClassroomMessageOut(id=mid, role="user", content="hi", created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))],
            )
        ),
    )
    d = (await client.get(f"{PREFIX}/sessions/{uuid.uuid4()}")).json()["data"]
    assert d["status"] == "idle" and d["messages"][0]["id"] == str(mid) and set(d["messages"][0]) == {"id", "role", "content", "created_at"}


async def test_state_shape_and_after_seq_validation(client, monkeypatch):
    state = AsyncMock(
        return_value=ClassroomStateResponse(
            status="running",
            snapshot=BoardSnapshot(board_state={"version": 1}, last_sequence_no=3),
            events=[],
        )
    )
    monkeypatch.setattr(classroom_service, "get_state", state)
    sid = uuid.uuid4()
    r = await client.get(f"{PREFIX}/sessions/{sid}/state?after_seq=2")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d == {"status": "running", "snapshot": {"board_state": {"version": 1}, "last_sequence_no": 3}, "events": []}
    assert state.await_args.args[1:] == (sid, client.user.id, 2) or state.await_args.args[2:] == (client.user.id, 2)
    assert (await client.get(f"{PREFIX}/sessions/{sid}/state?after_seq=-1")).status_code == 422


async def test_turn_endpoint_is_rate_limited_but_other_routes_are_not(client, monkeypatch):
    monkeypatch.setattr(classroom_service, "start_turn", AsyncMock(return_value=(uuid.uuid4(), False)))
    codes = []
    for _ in range(25):
        r = await client.post(
            f"{PREFIX}/sessions/{uuid.uuid4()}/turns", json={"message": "hi", "client_message_id": str(uuid.uuid4())}
        )
        codes.append(r.status_code)
    assert codes[:20] == [202] * 20 and set(codes[20:]) == {429}
    assert r.json()["error"]["code"] == "RATE_LIMITED"
    assert (await client.get("/health")).status_code == 200  # untouched
