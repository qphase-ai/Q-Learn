from app.quantum.base import CircuitSpec, GateSpec
from app.quantum.sandbox_adapter import QiskitAerAdapter, QISKIT_SCRIPT_TEMPLATE


def _qasm(spec: CircuitSpec) -> str:
    return QiskitAerAdapter()._spec_to_qasm(spec)


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
