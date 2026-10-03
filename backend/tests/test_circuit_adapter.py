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


# ---------------------------------------------------------------------------
# Parametric / advanced gates
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "gate, expected",
    [
        (GateSpec(type="RX", targets=[0], params={"theta": 0.5}), "rx(0.5) q[0];"),
        (GateSpec(type="RY", targets=[0], params={"theta": 0.5}), "ry(0.5) q[0];"),
        (GateSpec(type="RZ", targets=[0], params={"theta": 0.25}), "rz(0.25) q[0];"),
        (GateSpec(type="P", targets=[0], params={"theta": 1.0}), "u1(1.0) q[0];"),
        (
            GateSpec(type="U", targets=[0], params={"theta": 1.0, "phi": 2.0, "lambda": 3.0}),
            "u3(1.0,2.0,3.0) q[0];",
        ),
        (
            GateSpec(type="U3", targets=[1], params={"theta": 1.0, "phi": 0.0, "lambda": 0.5}),
            "u3(1.0,0.0,0.5) q[1];",
        ),
        (GateSpec(type="SX", targets=[0]), "sx q[0];"),
        (GateSpec(type="RXX", targets=[1], control=0, params={"theta": 0.5}), "rxx(0.5) q[0],q[1];"),
        (GateSpec(type="RZZ", targets=[1], control=0, params={"theta": 0.5}), "rzz(0.5) q[0],q[1];"),
    ],
)
def test_qasm_parametric_gates(gate, expected):
    spec = CircuitSpec(qubits=2, classical_bits=2, gates=[gate])
    assert expected in _qasm(spec).splitlines()


def test_qasm_parametric_gate_without_params_defaults_to_zero():
    spec = CircuitSpec(qubits=1, classical_bits=1, gates=[GateSpec(type="RX", targets=[0])])
    assert "rx(0.0) q[0];" in _qasm(spec)


def test_qasm_ryy_is_decomposed_into_qelib1_gates():
    spec = CircuitSpec(
        qubits=2,
        classical_bits=2,
        gates=[GateSpec(type="RYY", targets=[1], control=0, params={"theta": 0.5})],
    )
    body = _qasm(spec).splitlines()[4:]
    assert body == [
        "rx(pi/2) q[0];", "rx(pi/2) q[1];",
        "cx q[0],q[1];", "rz(0.5) q[1];", "cx q[0],q[1];",
        "rx(-pi/2) q[0];", "rx(-pi/2) q[1];",
    ]


def test_qasm_legacy_gates_unchanged():
    spec = CircuitSpec(
        qubits=2,
        classical_bits=2,
        gates=[
            GateSpec(type="H", targets=[0]),
            GateSpec(type="CX", targets=[1], control=0),
            GateSpec(type="SWAP", targets=[1], control=0),
            GateSpec(type="M", targets=[0], classical=[0]),
        ],
    )
    assert _qasm(spec) == "\n".join([
        "OPENQASM 2.0;",
        'include "qelib1.inc";',
        "qreg q[2];",
        "creg c[2];",
        "h q[0];",
        "cx q[0],q[1];",
        "swap q[0],q[1];",
        "measure q[0] -> c[0];",
    ])


def _run_script(qasm: str) -> dict:
    """Run the rendered sandbox script locally (needs qiskit + qiskit-aer)."""
    import json
    import subprocess
    import sys

    proc = subprocess.run(
        [sys.executable, "-c", QISKIT_SCRIPT_TEMPLATE.format(qasm=qasm, shots=256)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_script_reports_statevector_with_final_measurements():
    pytest.importorskip("qiskit")
    pytest.importorskip("qiskit_aer")
    out = _run_script(
        'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\n'
        "h q[0];\ncx q[0],q[1];\nmeasure q[0] -> c[0];\nmeasure q[1] -> c[1];"
    )
    assert set(out["measurements"]) <= {"00", "11"}
    assert out["statevector"][0][0] == pytest.approx(2 ** -0.5)
    assert out["statevector"][3][0] == pytest.approx(2 ** -0.5)


def test_script_survives_mid_circuit_measurement():
    # A gate after a measurement on the same qubit used to crash
    # Statevector.from_instruction ("Cannot apply instruction with classical
    # bits: measure"), failing the whole run. Counts must still come back.
    pytest.importorskip("qiskit")
    pytest.importorskip("qiskit_aer")
    out = _run_script(
        'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\n'
        "x q[0];\nmeasure q[0] -> c[0];\nswap q[0],q[1];\n"
        "measure q[0] -> c[0];\nmeasure q[1] -> c[1];"
    )
    assert out["statevector"] is None
    assert out["measurements"] == {"10": 256}


def test_script_measures_all_qubits_when_circuit_has_no_measurement():
    # Aer records no counts without a measurement, so get_counts() used to
    # raise "No counts for experiment" and fail every unmeasured circuit.
    pytest.importorskip("qiskit")
    pytest.importorskip("qiskit_aer")
    out = _run_script(
        'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\n'
        "x q[0];\ncx q[0],q[1];"
    )
    assert out["measurements"] == {"11": 256}
    assert out["probabilities"] == {"11": 1.0}
    assert out["statevector"][3][0] == pytest.approx(1.0)


def test_qasm_parametric_gates_parse_and_match_qiskit():
    qiskit = pytest.importorskip("qiskit")
    from qiskit.circuit.library import RYYGate
    from qiskit.quantum_info import Operator

    gates = [
        GateSpec(type="RX", targets=[0], params={"theta": 0.3}),
        GateSpec(type="RY", targets=[1], params={"theta": 0.4}),
        GateSpec(type="RZ", targets=[0], params={"theta": 0.5}),
        GateSpec(type="P", targets=[0], params={"theta": 0.6}),
        GateSpec(type="U", targets=[1], params={"theta": 0.1, "phi": 0.2, "lambda": 0.3}),
        GateSpec(type="U3", targets=[0], params={"theta": 0.1, "phi": 0.2, "lambda": 0.3}),
        GateSpec(type="SX", targets=[1]),
        GateSpec(type="RXX", targets=[1], control=0, params={"theta": 0.7}),
        GateSpec(type="RZZ", targets=[1], control=0, params={"theta": 0.8}),
    ]
    qc = qiskit.QuantumCircuit.from_qasm_str(_qasm(CircuitSpec(qubits=2, classical_bits=2, gates=gates)))
    assert qc.size() == len(gates)

    ryy = CircuitSpec(
        qubits=2,
        classical_bits=2,
        gates=[GateSpec(type="RYY", targets=[1], control=0, params={"theta": 0.9})],
    )
    decomposed = qiskit.QuantumCircuit.from_qasm_str(_qasm(ryy))
    reference = qiskit.QuantumCircuit(2)
    reference.append(RYYGate(0.9), [0, 1])
    assert Operator(decomposed).equiv(Operator(reference))


@pytest.mark.parametrize("bad", ["abc", {}, float("nan"), "inf", True, 10**400])
async def test_validate_rejects_non_numeric_or_non_finite_params(bad):
    spec = CircuitSpec(
        qubits=2,
        classical_bits=2,
        gates=[
            GateSpec(type="RX", targets=[0], params={"theta": bad}),
            GateSpec(type="RYY", targets=[1], control=0, params={"theta": bad}),
        ],
    )
    ok, errors = await QiskitAerAdapter().validate(spec)
    assert not ok
    assert len(errors) == 2
    assert all("theta" in e for e in errors)


@pytest.mark.parametrize("gate_type", ["RX", "U3", "RYY"])
def test_qasm_bad_param_raises_validation_error(gate_type):
    from app.exceptions import ValidationError

    gate = GateSpec(type=gate_type, targets=[1], params={"theta": "abc"})
    if gate_type == "RYY":
        gate.control = 0
    with pytest.raises(ValidationError):
        _qasm(CircuitSpec(qubits=2, classical_bits=2, gates=[gate]))


async def test_numeric_string_params_are_accepted():
    spec = CircuitSpec(
        qubits=1, classical_bits=1, gates=[GateSpec(type="RZ", targets=[0], params={"theta": "0.5"})]
    )
    assert (await QiskitAerAdapter().validate(spec))[0]
    assert "rz(0.5) q[0];" in _qasm(spec)
