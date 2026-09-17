"""Tests for CircuitsService and run_and_publish.

Hermetic — no real DB or Supabase connections. All external I/O is mocked.
"""
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.quantum.base import ExecutionResult as QuantumExecutionResult
from app.schemas.circuit import CircuitSpec as PydanticCircuitSpec, ExecuteCircuitRequest, GateSpec as PydanticGateSpec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_pydantic_spec() -> PydanticCircuitSpec:
    return PydanticCircuitSpec(
        qubits=2,
        classical_bits=2,
        gates=[
            PydanticGateSpec(type="H", targets=[0]),
            PydanticGateSpec(type="M", targets=[0, 1], classical=[0, 1]),
        ],
    )


def _make_request(name: str = "Bell State") -> ExecuteCircuitRequest:
    return ExecuteCircuitRequest(
        circuit=_make_pydantic_spec(),
        shots=512,
        name=name,
    )


def _make_execution_result() -> QuantumExecutionResult:
    return QuantumExecutionResult(
        statevector=[[0.707, 0.0], [0.0, 0.0], [0.0, 0.0], [0.707, 0.0]],
        probabilities={"00": 0.5, "11": 0.5},
        measurements={"00": 256, "11": 256},
        execution_time_ms=42,
        shots=512,
    )


def _make_mock_db():
    db = AsyncMock()
    # db.get returns None → new Circuit (will be created)
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    db.commit = AsyncMock()
    return db


# ---------------------------------------------------------------------------
# CircuitsService.start_execution
# ---------------------------------------------------------------------------

class TestStartExecution:
    @pytest.fixture(autouse=True)
    def _patch_quantum(self):
        """Patch validate (returns valid) and compile (returns fake qasm)."""
        compiled = MagicMock()
        compiled.qasm = "OPENQASM 2.0; fake;"

        with (
            patch(
                "app.services.circuits_service.QuantumExecutionService",
                autospec=True,
            ) as MockQES,
            patch(
                "app.services.circuits_service.QiskitAerAdapter",
                autospec=True,
            ) as MockAdapter,
        ):
            mock_backend = AsyncMock()
            mock_backend.validate = AsyncMock(return_value=(True, []))
            MockQES.return_value.get_backend.return_value = mock_backend

            mock_adapter_instance = AsyncMock()
            mock_adapter_instance.compile = AsyncMock(return_value=compiled)
            MockAdapter.return_value = mock_adapter_instance

            self.mock_backend = mock_backend
            self.compiled = compiled
            yield

    @pytest.mark.asyncio
    async def test_returns_uuid(self):
        from app.services.circuits_service import CircuitsService

        db = _make_mock_db()
        svc = CircuitsService(db=db)
        circuit_id = uuid.uuid4()
        body = _make_request()

        exec_id = await svc.start_execution(circuit_id, body, user_id=uuid.uuid4())

        assert isinstance(exec_id, uuid.UUID)

    @pytest.mark.asyncio
    async def test_adds_circuit_and_execution_rows(self):
        from app.services.circuits_service import CircuitsService
        from app.models.circuit import Circuit, CircuitExecution

        db = _make_mock_db()
        svc = CircuitsService(db=db)
        circuit_id = uuid.uuid4()
        user_id = uuid.uuid4()
        body = _make_request("My Circuit")

        await svc.start_execution(circuit_id, body, user_id=user_id)

        # db.add must have been called at least twice (Circuit + CircuitExecution)
        assert db.add.call_count >= 2
        added_types = [type(call.args[0]) for call in db.add.call_args_list]
        assert Circuit in added_types
        assert CircuitExecution in added_types

    @pytest.mark.asyncio
    async def test_execution_row_has_pending_status(self):
        from app.services.circuits_service import CircuitsService
        from app.models.circuit import CircuitExecution

        db = _make_mock_db()
        svc = CircuitsService(db=db)
        circuit_id = uuid.uuid4()
        body = _make_request()

        await svc.start_execution(circuit_id, body, user_id=uuid.uuid4())

        exec_rows = [
            call.args[0]
            for call in db.add.call_args_list
            if isinstance(call.args[0], CircuitExecution)
        ]
        assert len(exec_rows) == 1
        assert exec_rows[0].status == "pending"
        assert exec_rows[0].shots == 512

    @pytest.mark.asyncio
    async def test_commit_called(self):
        from app.services.circuits_service import CircuitsService

        db = _make_mock_db()
        svc = CircuitsService(db=db)
        body = _make_request()

        await svc.start_execution(uuid.uuid4(), body, user_id=uuid.uuid4())

        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_circuit_upsert_updates_existing(self):
        """When db.get returns an existing Circuit, update its fields (no duplicate add)."""
        from app.services.circuits_service import CircuitsService
        from app.models.circuit import Circuit, CircuitExecution

        existing_circuit = MagicMock(spec=Circuit)
        db = _make_mock_db()
        db.get = AsyncMock(return_value=existing_circuit)
        svc = CircuitsService(db=db)
        body = _make_request("Updated")

        await svc.start_execution(uuid.uuid4(), body, user_id=uuid.uuid4())

        # Only CircuitExecution should be added (Circuit already existed)
        added_types = [type(call.args[0]) for call in db.add.call_args_list]
        assert Circuit not in added_types
        assert CircuitExecution in added_types

    @pytest.mark.asyncio
    async def test_validation_failure_raises_before_db_write(self):
        """ValidationError raised before any db.add if validate() returns errors.

        The autouse _patch_quantum fixture already replaces QuantumExecutionService;
        here we just reconfigure its get_backend return value to simulate failure.
        """
        from app.services.circuits_service import CircuitsService
        from app.exceptions import ValidationError
        import app.services.circuits_service as svc_module

        # The autouse fixture has patched QuantumExecutionService in this scope.
        # Reconfigure the mock that's already in place to return invalid.
        mock_backend = AsyncMock()
        mock_backend.validate = AsyncMock(return_value=(False, ["too many qubits"]))
        svc_module.QuantumExecutionService.return_value.get_backend.return_value = mock_backend

        db = _make_mock_db()
        svc = CircuitsService(db=db)
        body = _make_request()

        with pytest.raises(ValidationError):
            await svc.start_execution(uuid.uuid4(), body, user_id=uuid.uuid4())

        db.add.assert_not_called()
        db.commit.assert_not_awaited()


# ---------------------------------------------------------------------------
# run_and_publish
# ---------------------------------------------------------------------------

def _make_session_cm(mock_db):
    """Return an async context manager that yields mock_db."""
    @asynccontextmanager
    async def _cm():
        yield mock_db
    return _cm


class TestRunAndPublish:
    """Tests for the module-level run_and_publish function."""

    def _patch_all(self, mock_db, exec_result, execute_side_effect=None):
        """Return a context manager that patches AsyncSessionLocal, QES, compile, and publisher."""
        compiled = MagicMock()
        compiled.qasm = "OPENQASM 2.0; fake;"

        session_factory = MagicMock(return_value=_make_session_cm(mock_db)())

        mock_execute = AsyncMock(
            return_value=exec_result,
            side_effect=execute_side_effect,
        )
        mock_compile = AsyncMock(return_value=compiled)
        spy_publish = AsyncMock()

        patches = [
            patch("app.services.circuits_service.AsyncSessionLocal", session_factory),
            patch.object(
                __import__("app.quantum.execution_service", fromlist=["QuantumExecutionService"]).QuantumExecutionService,
                "execute",
                mock_execute,
            ),
            patch(
                "app.services.circuits_service.QiskitAerAdapter",
                autospec=True,
            ),
            patch("app.services.circuits_service.publish_circuit_result", spy_publish),
        ]
        return patches, spy_publish, mock_execute, mock_compile, compiled

    @pytest.mark.asyncio
    async def test_run_and_publish_success(self):
        from app.services.circuits_service import run_and_publish
        from app.models.circuit import CircuitExecution

        exec_result = _make_execution_result()
        circuit_id = uuid.uuid4()
        execution_id = uuid.uuid4()
        spec = _make_pydantic_spec()

        fake_exec_row = MagicMock(spec=CircuitExecution)
        fake_exec_row.status = "pending"
        mock_db = AsyncMock()
        mock_db.get = AsyncMock(return_value=fake_exec_row)
        mock_db.commit = AsyncMock()

        compiled = MagicMock()
        compiled.qasm = "OPENQASM 2.0; fake;"

        spy_publish = AsyncMock()

        with (
            patch(
                "app.services.circuits_service.AsyncSessionLocal",
                MagicMock(return_value=_make_session_cm(mock_db)()),
            ),
            patch(
                "app.services.circuits_service.QuantumExecutionService",
            ) as MockQES,
            patch(
                "app.services.circuits_service.QiskitAerAdapter",
                autospec=True,
            ) as MockAdapter,
            patch(
                "app.services.circuits_service.publish_circuit_result",
                spy_publish,
            ),
        ):
            MockQES.return_value.execute = AsyncMock(return_value=exec_result)
            MockAdapter.return_value.compile = AsyncMock(return_value=compiled)

            await run_and_publish(circuit_id, execution_id, spec, shots=512)

        spy_publish.assert_awaited_once()
        call_args = spy_publish.call_args
        assert call_args.args[0] == str(circuit_id)
        payload = call_args.args[1]
        assert payload["status"] == "completed"
        assert payload["probabilities"] == {"00": 0.5, "11": 0.5}
        assert payload["measurements"] == {"00": 256, "11": 256}

    @pytest.mark.asyncio
    async def test_run_and_publish_sets_row_completed(self):
        from app.services.circuits_service import run_and_publish
        from app.models.circuit import CircuitExecution

        exec_result = _make_execution_result()
        circuit_id = uuid.uuid4()
        execution_id = uuid.uuid4()
        spec = _make_pydantic_spec()

        fake_exec_row = MagicMock(spec=CircuitExecution)
        mock_db = AsyncMock()
        mock_db.get = AsyncMock(return_value=fake_exec_row)
        mock_db.commit = AsyncMock()

        compiled = MagicMock()
        compiled.qasm = "OPENQASM 2.0; fake;"

        with (
            patch(
                "app.services.circuits_service.AsyncSessionLocal",
                MagicMock(return_value=_make_session_cm(mock_db)()),
            ),
            patch(
                "app.services.circuits_service.QuantumExecutionService",
            ) as MockQES,
            patch(
                "app.services.circuits_service.QiskitAerAdapter",
                autospec=True,
            ) as MockAdapter,
            patch("app.services.circuits_service.publish_circuit_result", AsyncMock()),
        ):
            MockQES.return_value.execute = AsyncMock(return_value=exec_result)
            MockAdapter.return_value.compile = AsyncMock(return_value=compiled)

            await run_and_publish(circuit_id, execution_id, spec, shots=512)

        assert fake_exec_row.status == "completed"
        assert fake_exec_row.execution_time_ms == 42
        mock_db.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_run_and_publish_failure_sets_failed_and_publishes(self):
        from app.services.circuits_service import run_and_publish
        from app.models.circuit import CircuitExecution

        circuit_id = uuid.uuid4()
        execution_id = uuid.uuid4()
        spec = _make_pydantic_spec()

        fake_exec_row = MagicMock(spec=CircuitExecution)
        mock_db = AsyncMock()
        mock_db.get = AsyncMock(return_value=fake_exec_row)
        mock_db.commit = AsyncMock()

        spy_publish = AsyncMock()

        with (
            patch(
                "app.services.circuits_service.AsyncSessionLocal",
                MagicMock(return_value=_make_session_cm(mock_db)()),
            ),
            patch(
                "app.services.circuits_service.QuantumExecutionService",
            ) as MockQES,
            patch(
                "app.services.circuits_service.QiskitAerAdapter",
                autospec=True,
            ) as MockAdapter,
            patch(
                "app.services.circuits_service.publish_circuit_result",
                spy_publish,
            ),
        ):
            MockQES.return_value.execute = AsyncMock(
                side_effect=RuntimeError("sandbox timeout")
            )
            compiled = MagicMock()
            compiled.qasm = "OPENQASM 2.0; fake;"
            MockAdapter.return_value.compile = AsyncMock(return_value=compiled)

            # Must NOT raise — background task swallows exceptions
            await run_and_publish(circuit_id, execution_id, spec, shots=512)

        assert fake_exec_row.status == "failed"
        assert "sandbox timeout" in fake_exec_row.error_message

        spy_publish.assert_awaited_once()
        payload = spy_publish.call_args.args[1]
        assert payload["status"] == "failed"
        assert payload["probabilities"] is None
        assert payload["measurements"] is None

    @pytest.mark.asyncio
    async def test_run_and_publish_never_raises(self):
        """Even if publish itself explodes, run_and_publish must not propagate."""
        from app.services.circuits_service import run_and_publish
        from app.models.circuit import CircuitExecution

        circuit_id = uuid.uuid4()
        execution_id = uuid.uuid4()
        spec = _make_pydantic_spec()

        fake_exec_row = MagicMock(spec=CircuitExecution)
        mock_db = AsyncMock()
        mock_db.get = AsyncMock(return_value=fake_exec_row)
        mock_db.commit = AsyncMock()

        with (
            patch(
                "app.services.circuits_service.AsyncSessionLocal",
                MagicMock(return_value=_make_session_cm(mock_db)()),
            ),
            patch(
                "app.services.circuits_service.QuantumExecutionService",
            ) as MockQES,
            patch(
                "app.services.circuits_service.QiskitAerAdapter",
                autospec=True,
            ) as MockAdapter,
            patch(
                "app.services.circuits_service.publish_circuit_result",
                AsyncMock(side_effect=Exception("supabase down")),
            ),
        ):
            MockQES.return_value.execute = AsyncMock(
                side_effect=RuntimeError("boom")
            )
            compiled = MagicMock()
            compiled.qasm = "OPENQASM 2.0; fake;"
            MockAdapter.return_value.compile = AsyncMock(return_value=compiled)

            # Should complete without raising
            await run_and_publish(circuit_id, execution_id, spec, shots=512)
