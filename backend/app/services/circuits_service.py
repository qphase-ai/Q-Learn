"""Circuits service — orchestrates circuit persistence and quantum execution.

Flow (per request):
    Router calls start_execution() → validates → writes Circuit + CircuitExecution
    (status="pending") → returns execution id.

    Router enqueues run_and_publish() as a BackgroundTask (module-level function
    so it owns its own DB session; the request session is already closed by the
    time the background task fires).
"""
import uuid
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

import app.quantum.base as quantum_base
from app.database import AsyncSessionLocal
from app.exceptions import ValidationError
from app.models.circuit import Circuit, CircuitExecution
from app.quantum.execution_service import QuantumExecutionService
from app.quantum.sandbox_adapter import QiskitAerAdapter
from app.schemas.circuit import CircuitSpec as PydanticCircuitSpec, ExecuteCircuitRequest
from app.services.realtime_service import publish_circuit_result

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _to_quantum_spec(spec: PydanticCircuitSpec) -> quantum_base.CircuitSpec:
    """Convert a Pydantic CircuitSpec (from HTTP request) into the dataclass
    expected by the quantum layer."""
    gates = [
        quantum_base.GateSpec(
            type=g.type,
            targets=g.targets,
            control=g.control,
            params=g.params or {},
            classical=g.classical,
        )
        for g in spec.gates
    ]
    return quantum_base.CircuitSpec(
        qubits=spec.qubits,
        classical_bits=spec.classical_bits,
        gates=gates,
    )


# ---------------------------------------------------------------------------
# CircuitsService
# ---------------------------------------------------------------------------

class CircuitsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def start_execution(
        self,
        circuit_id: uuid.UUID,
        body: ExecuteCircuitRequest,
        user_id: uuid.UUID,
    ) -> uuid.UUID:
        """Validate → upsert Circuit → insert CircuitExecution(pending) → return id.

        Raises ValidationError before any DB write if the circuit spec is invalid.
        """
        quantum_spec = _to_quantum_spec(body.circuit)

        # --- Validate before touching the DB ---
        backend = QuantumExecutionService().get_backend()
        is_valid, errors = await backend.validate(quantum_spec)
        if not is_valid:
            raise ValidationError("Circuit validation failed", details=errors)

        # --- Compile to get QASM (also used on the Circuit row) ---
        compiled = await QiskitAerAdapter().compile(quantum_spec)
        qasm = compiled.qasm

        # --- Upsert Circuit ---
        circuit = await self.db.get(Circuit, circuit_id)
        if circuit is None:
            circuit = Circuit(
                id=circuit_id,
                user_id=user_id,
                name=body.name,
                circuit_json=body.circuit.model_dump(),
                qasm=qasm,
                num_qubits=body.circuit.qubits,
            )
            self.db.add(circuit)
        else:
            circuit.name = body.name
            circuit.circuit_json = body.circuit.model_dump()
            circuit.qasm = qasm
            circuit.num_qubits = body.circuit.qubits

        # --- Insert CircuitExecution ---
        execution_id = uuid.uuid4()
        execution = CircuitExecution(
            id=execution_id,
            circuit_id=circuit_id,
            user_id=user_id,
            shots=body.shots,
            status="pending",
        )
        self.db.add(execution)

        await self.db.commit()
        return execution_id


# ---------------------------------------------------------------------------
# Module-level background function
# ---------------------------------------------------------------------------

async def run_and_publish(
    circuit_id: uuid.UUID,
    execution_id: uuid.UUID,
    spec: PydanticCircuitSpec,
    shots: int,
) -> None:
    """Execute a circuit in the quantum sandbox and publish the result via Realtime.

    Opens its own DB session (the request session is gone by the time this runs
    as a BackgroundTask). Never raises — any exception is caught, persisted as a
    failed status, and published so the frontend learns of the failure.
    """
    async with AsyncSessionLocal() as db:
        execution = await db.get(CircuitExecution, execution_id)

        try:
            quantum_spec = _to_quantum_spec(spec)

            # Execute in sandbox
            result = await QuantumExecutionService().execute(quantum_spec, shots=shots)

            # Compile to get qasm for the payload
            compiled = await QiskitAerAdapter().compile(quantum_spec)

            # Update execution row
            execution.status = "completed"
            execution.statevector = result.statevector
            execution.probabilities = result.probabilities
            execution.measurements = result.measurements
            execution.execution_time_ms = result.execution_time_ms
            execution.error_message = None

            await db.commit()

            payload = {
                "status": "completed",
                "probabilities": result.probabilities,
                "measurements": result.measurements,
                "statevector": result.statevector,
                "qasm": compiled.qasm,
                "execution_time_ms": result.execution_time_ms,
                "error_message": None,
            }

        except Exception as exc:  # noqa: BLE001 — background task, never re-raise
            logger.exception(
                "circuit_execution_failed",
                circuit_id=str(circuit_id),
                execution_id=str(execution_id),
                error=str(exc),
            )
            error_msg = str(exc)

            if execution is not None:
                execution.status = "failed"
                execution.error_message = error_msg
                try:
                    await db.commit()
                except Exception:  # noqa: BLE001
                    pass

            payload = {
                "status": "failed",
                "probabilities": None,
                "measurements": None,
                "statevector": None,
                "qasm": None,
                "execution_time_ms": None,
                "error_message": error_msg,
            }

        try:
            await publish_circuit_result(str(circuit_id), payload)
        except Exception:  # noqa: BLE001 — realtime is best-effort
            logger.warning(
                "realtime_publish_failed_in_background",
                circuit_id=str(circuit_id),
            )
