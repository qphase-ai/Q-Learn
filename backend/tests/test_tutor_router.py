"""Tests for the tutor router — POST /chat and GET /sessions/{id}.

Hermetic — FastAPI dependency_overrides + monkeypatching; no DB, no streaming.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

import app.routers.tutor as tutor_router_module
from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import NotFoundError
from app.main import app
from app.schemas.tutor import TutorSessionResponse, MessageOut, Citation


def _fake_user(user_id: uuid.UUID | None = None):
    user = MagicMock()
    user.id = user_id or uuid.uuid4()
    return user


@pytest.fixture
async def clean_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

async def test_chat_accepts_and_schedules_stream(client, clean_overrides, monkeypatch):
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user(user_id)

    monkeypatch.setattr(
        tutor_router_module, "start_message", AsyncMock(return_value=session_id)
    )
    mock_run = AsyncMock()
    monkeypatch.setattr(tutor_router_module, "run_and_stream", mock_run)

    response = await client.post(
        "/api/v1/tutor/chat",
        json={"message": "Explain superposition", "session_id": str(session_id)},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "pending"
    assert body["data"]["session_id"] == str(session_id)

    mock_run.assert_called_once()
    call = mock_run.call_args
    assert call.args[0] == session_id
    assert call.args[1] == user_id
    assert call.args[2] == "Explain superposition"


async def test_chat_requires_auth(client, clean_overrides):
    response = await client.post(
        "/api/v1/tutor/chat",
        json={"message": "hi", "session_id": str(uuid.uuid4())},
    )
    assert response.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /sessions/{id}
# ---------------------------------------------------------------------------

async def test_get_session_returns_history(client, clean_overrides, monkeypatch):
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user(user_id)

    resp_obj = TutorSessionResponse(
        session_id=session_id,
        messages=[
            MessageOut(role="user", content="Explain superposition", citations=[]),
            MessageOut(
                role="assistant",
                content="Superposition is ...",
                citations=[Citation(title="Superposition", url="u", score=0.9)],
            ),
        ],
    )
    monkeypatch.setattr(
        tutor_router_module, "get_session", AsyncMock(return_value=resp_obj)
    )

    response = await client.get(f"/api/v1/tutor/sessions/{session_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["session_id"] == str(session_id)
    assert len(body["data"]["messages"]) == 2
    assert body["data"]["messages"][1]["citations"][0]["title"] == "Superposition"


async def test_get_unknown_session_404(client, clean_overrides, monkeypatch):
    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        tutor_router_module,
        "get_session",
        AsyncMock(side_effect=NotFoundError("Session not found")),
    )

    response = await client.get(f"/api/v1/tutor/sessions/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


async def test_get_other_users_session_404(client, clean_overrides, monkeypatch):
    """Ownership enforced in the service → NotFoundError → 404."""
    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        tutor_router_module,
        "get_session",
        AsyncMock(side_effect=NotFoundError("Session not found")),
    )

    response = await client.get(f"/api/v1/tutor/sessions/{uuid.uuid4()}")
    assert response.status_code == 404
