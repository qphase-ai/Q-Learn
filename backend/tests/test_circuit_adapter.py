import json

import pytest

from app.quantum.base import CircuitSpec, CompiledCircuit, GateSpec
from app.quantum.sandbox_adapter import QiskitAerAdapter, QISKIT_SCRIPT_TEMPLATE
from app.quantum.sandbox_runner import SandboxResult
from app.exceptions import SandboxExecutionError


def _qasm(spec: CircuitSpec) -> str:
    return QiskitAerAdapter()._spec_to_qasm(spec)


class _FakeRunner:
    """Stand-in for SandboxRunner that returns a canned SandboxResult."""

    def __init__(self, result: SandboxResult) -> None:
        self._result = result
        self.calls: list[tuple[str, int | None]] = []

    async def run_python(self, code: str, timeout_ms=None) -> SandboxResult:
        self.calls.append((code, timeout_ms))
        return self._result


def _adapter_with(result: SandboxResult) -> tuple[QiskitAerAdapter, _FakeRunner]:
    adapter = QiskitAerAdapter()
    runner = _FakeRunner(result)
    adapter._runner = runner  # type: ignore[assignment]
    return adapter, runner


_COMPILED = CompiledCircuit(
    qasm="OPENQASM 2.0;",
    original_spec=CircuitSpec(qubits=1, classical_bits=1, gates=[]),
)


def test_qasm_single_qubit_gate():
    spec = CircuitSpec(qubits=1, classical_bits=1, gates=[GateSpec(type="H", targets=[0])])
    qasm = _qasm(spec)
    assert "qreg q[1];" in qasm
    assert "h q[0];" in qasm


def test_qasm_identity_gate_maps_to_id():
    spec = CircuitSpec(qubits=1, classical_bits=1, gates=[GateSpec(type="I", targets=[0])])
    # Regression guard: a bare "i q[0];" is invalid QASM; qelib1 defines "id".
    assert "id q[0];" in _qasm(spec)


def test_qasm_two_qubit_gate_uses_control_target():
    spec = CircuitSpec(
        qubits=2,
        classical_bits=2,
        gates=[GateSpec(type="CX", targets=[1], control=0)],
    )
    assert "cx q[0],q[1];" in _qasm(spec)


def test_qasm_measurement():
    spec = CircuitSpec(
        qubits=1,
        classical_bits=1,
        gates=[GateSpec(type="M", targets=[0], classical=[0])],
    )
    assert "measure q[0] -> c[0];" in _qasm(spec)


def test_script_template_computes_statevector_without_measurements():
    # The State Vector tab needs real amplitudes; measurement collapse would zero
    # them out, so the script computes the statevector on a measurement-free copy.
    assert "remove_final_measurements" in QISKIT_SCRIPT_TEMPLATE
    assert "Statevector" in QISKIT_SCRIPT_TEMPLATE
    assert '"statevector"' in QISKIT_SCRIPT_TEMPLATE


# ---------------------------------------------------------------------------
# execute() — sandbox runner is mocked; no real microVM is forked.
# ---------------------------------------------------------------------------

async def test_execute_parses_sandbox_output():
    payload = {
        "probabilities": {"00": 0.5, "11": 0.5},
        "measurements": {"00": 512, "11": 512},
        "statevector": [[0.7071, 0.0], [0.0, 0.0], [0.0, 0.0], [0.7071, 0.0]],
    }
    adapter, runner = _adapter_with(
        SandboxResult(stdout=json.dumps(payload), stderr="", exit_code=0)
    )

    result = await adapter.execute(_COMPILED, shots=1024)

    assert result.probabilities == payload["probabilities"]
    assert result.measurements == payload["measurements"]
    assert result.statevector == payload["statevector"]
    assert result.shots == 1024
    assert result.execution_time_ms >= 0
    # The compiled QASM was passed through into the executed script.
    assert runner.calls and _COMPILED.qasm in runner.calls[0][0]


async def test_execute_raises_on_nonzero_exit():
    adapter, _ = _adapter_with(
        SandboxResult(stdout="", stderr="Traceback: boom", exit_code=1)
    )

    with pytest.raises(SandboxExecutionError) as exc:
        await adapter.execute(_COMPILED, shots=256)
    assert "boom" in str(exc.value.details)


async def test_execute_raises_on_empty_stdout():
    adapter, _ = _adapter_with(SandboxResult(stdout="   ", stderr="", exit_code=0))

    with pytest.raises(SandboxExecutionError):
        await adapter.execute(_COMPILED, shots=256)


async def test_execute_raises_on_unparseable_stdout():
    adapter, _ = _adapter_with(
        SandboxResult(stdout="not-json{", stderr="", exit_code=0)
    )

    with pytest.raises(SandboxExecutionError):
        await adapter.execute(_COMPILED, shots=256)
