"""Tests for POST /api/v1/circuits/{circuit_id}/execute.

Hermetic — no live database. Uses FastAPI dependency_overrides and
monkeypatching so no PostgreSQL or Vercel Sandbox is needed.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

import app.routers.circuits as circuits_router_module
from app.database import get_db
from app.dependencies import get_current_user
from app.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_user(user_id: uuid.UUID | None = None):
    user = MagicMock()
    user.id = user_id or uuid.uuid4()
    return user


def _valid_body() -> dict:
    return {
        "circuit": {
            "qubits": 2,
            "classical_bits": 2,
            "gates": [
                {"type": "H", "targets": [0]},
                {"type": "CNOT", "targets": [1], "control": 0},
                {"type": "MEASURE", "targets": [0], "classical": [0]},
                {"type": "MEASURE", "targets": [1], "classical": [1]},
            ],
        },
        "shots": 1024,
        "name": "Bell State",
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def clean_overrides():
    """Ensure dependency_overrides are cleared after every test."""
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_execute_circuit_success(
    client: AsyncClient,
    clean_overrides,
    monkeypatch,
):
    """Valid POST → 202, success=True, status='pending', execution_id present."""
    user_id = uuid.uuid4()
    execution_id = uuid.uuid4()
    returned_qasm = "OPENQASM 2.0;"

    # Override DB dependency to avoid DB connection
    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user(user_id)

    # Monkeypatch CircuitsService.start_execution
    from app.services import circuits_service as svc_module
    monkeypatch.setattr(
        svc_module.CircuitsService,
        "start_execution",
        AsyncMock(return_value=(execution_id, returned_qasm)),
    )

    # Monkeypatch run_and_publish in the router module so no sandbox fires
    mock_run_and_publish = AsyncMock()
    monkeypatch.setattr(circuits_router_module, "run_and_publish", mock_run_and_publish)

    circuit_id = uuid.uuid4()
    payload = _valid_body()
    response = await client.post(
        f"/api/v1/circuits/{circuit_id}/execute",
        json=payload,
    )

    assert response.status_code == 202
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "pending"
    assert "execution_id" in body["data"]
    assert uuid.UUID(body["data"]["execution_id"])  # valid UUID

    # Background task must be scheduled (ASGITransport runs it in-process).
    # This is the load-bearing check that qasm + shots flow through correctly.
    mock_run_and_publish.assert_called_once()
    call = mock_run_and_publish.call_args
    assert call.args[0] == circuit_id
    assert call.args[1] == execution_id
    assert call.args[3] == payload["shots"]  # shots from the request body
    assert call.args[4] == returned_qasm     # qasm returned by start_execution


async def test_execute_circuit_requires_auth(
    client: AsyncClient,
    clean_overrides,
):
    """No Authorization header → 401 or 403 (HTTPBearer rejects before handler)."""
    # No dependency overrides — let real auth reject the request
    circuit_id = uuid.uuid4()
    response = await client.post(
        f"/api/v1/circuits/{circuit_id}/execute",
        json=_valid_body(),
    )
    assert response.status_code in (401, 403)


async def test_execute_circuit_validation_error(
    client: AsyncClient,
    clean_overrides,
    monkeypatch,
):
    """Service raises ValidationError → 422, error.code == 'VALIDATION_ERROR'."""
    from app.exceptions import ValidationError
    from app.services import circuits_service as svc_module

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        svc_module.CircuitsService,
        "start_execution",
        AsyncMock(
            side_effect=ValidationError(
                "Circuit validation failed",
                details=["Gate target 5 out of range for 2-qubit circuit"],
            )
        ),
    )

    # Monkeypatch run_and_publish so it won't be called
    mock_run_and_publish = AsyncMock()
    monkeypatch.setattr(circuits_router_module, "run_and_publish", mock_run_and_publish)

    circuit_id = uuid.uuid4()
    response = await client.post(
        f"/api/v1/circuits/{circuit_id}/execute",
        json=_valid_body(),
    )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"

    # No background task when validation fails before any DB write.
    mock_run_and_publish.assert_not_called()
