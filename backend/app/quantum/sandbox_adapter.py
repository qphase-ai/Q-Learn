import json
import math
import time
from app.quantum.base import QuantumBackend, CircuitSpec, CompiledCircuit, ExecutionResult
from app.quantum.sandbox_runner import SandboxRunner
from app.config import get_settings
from app.exceptions import SandboxExecutionError, ValidationError

QISKIT_SCRIPT_TEMPLATE = """
import json, sys
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit.quantum_info import Statevector

qc = QuantumCircuit.from_qasm_str({qasm!r})
simulator = AerSimulator()
compiled = transpile(qc, simulator)

# Statevector on a measurement-free copy: measurement collapse would otherwise
# zero out the amplitudes the State Vector tab renders.
qc_sv = qc.remove_final_measurements(inplace=False)
statevector = [[c.real, c.imag] for c in Statevector.from_instruction(qc_sv).data]

# Shots
job = simulator.run(compiled, shots={shots})
result = job.result()
counts = result.get_counts()
total = sum(counts.values())

output = {{
    "probabilities": {{k: v / total for k, v in counts.items()}},
    "measurements": counts,
    "statevector": statevector,
}}
print(json.dumps(output))
"""


class QiskitAerAdapter(QuantumBackend):
    def __init__(self):
        self.settings = get_settings()
        self._runner = SandboxRunner()

    async def compile(self, circuit: CircuitSpec) -> CompiledCircuit:
        qasm = self._spec_to_qasm(circuit)
        return CompiledCircuit(qasm=qasm, original_spec=circuit)

    async def validate(self, circuit: CircuitSpec) -> tuple[bool, list[str]]:
        errors = []
        if circuit.qubits < 1:
            errors.append("Circuit must have at least 1 qubit")
        if circuit.qubits > 29:
            errors.append("Maximum 29 qubits supported")
        for gate in circuit.gates:
            for t in gate.targets:
                if t >= circuit.qubits:
                    errors.append(f"Gate target {t} out of range for {circuit.qubits} qubits")
            for key in self._param_keys(gate.type):
                try:
                    self._angle(gate.params, key)
                except ValidationError as exc:
                    errors.append(f"{gate.type}: {exc.message}")
        return len(errors) == 0, errors

    async def execute(self, circuit: CompiledCircuit, shots: int = 1024) -> ExecutionResult:
        code = QISKIT_SCRIPT_TEMPLATE.format(qasm=circuit.qasm, shots=shots)
        start = time.monotonic()

        result = await self._runner.run_python(code, self.settings.sandbox_timeout)

        elapsed_ms = int((time.monotonic() - start) * 1000)

        # Surface sandbox/script failures as a typed error instead of letting a
        # bad/empty stdout blow up json.loads. run_and_publish catches this and
        # records status="failed" with the stderr text.
        if result.exit_code != 0 or not result.stdout.strip():
            raise SandboxExecutionError(
                "Quantum circuit execution failed in sandbox",
                details=(result.stderr or result.stdout or "no output").strip()[:2000],
            )

        try:
            output = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise SandboxExecutionError(
                "Sandbox returned unparseable output",
                details=f"{exc}: {result.stdout.strip()[:2000]}",
            ) from exc

        return ExecutionResult(
            statevector=output.get("statevector"),
            probabilities=output["probabilities"],
            measurements=output["measurements"],
            execution_time_ms=elapsed_ms,
            shots=shots,
        )

    # Parametric gates: frontend gate type → (qelib1 op, ordered param names).
    # U and U3 are both the generic single-qubit rotation u3(θ,φ,λ); P is u1(λ).
    _PARAM_GATES: dict[str, tuple[str, tuple[str, ...]]] = {
        "RX": ("rx", ("theta",)),
        "RY": ("ry", ("theta",)),
        "RZ": ("rz", ("theta",)),
        "P": ("u1", ("theta",)),
        "U": ("u3", ("theta", "phi", "lambda")),
        "U3": ("u3", ("theta", "phi", "lambda")),
        "RXX": ("rxx", ("theta",)),
        "RZZ": ("rzz", ("theta",)),
    }

    @classmethod
    def _param_keys(cls, gate_type: str) -> tuple[str, ...]:
        if gate_type in cls._PARAM_GATES:
            return cls._PARAM_GATES[gate_type][1]
        return ("theta",) if gate_type == "RYY" else ()

    @staticmethod
    def _angle(params: dict | None, key: str) -> float:
        """A gate angle from request-supplied params, as a finite float."""
        raw = (params or {}).get(key, 0.0)
        if isinstance(raw, bool):
            raise ValidationError(f"Gate parameter '{key}' must be a number")
        try:
            value = float(raw)
        except (TypeError, ValueError):
            raise ValidationError(f"Gate parameter '{key}' must be a number") from None
        if not math.isfinite(value):
            raise ValidationError(f"Gate parameter '{key}' must be finite")
        return value

    def _spec_to_qasm(self, circuit: CircuitSpec) -> str:
        lines = [
            f"OPENQASM 2.0;",
            f'include "qelib1.inc";',
            f"qreg q[{circuit.qubits}];",
            f"creg c[{circuit.classical_bits}];",
        ]
        gate_map = {
            "H": "h", "X": "x", "Y": "y", "Z": "z",
            "S": "s", "T": "t", "I": "id", "CX": "cx", "CZ": "cz",
            "SWAP": "swap", "M": "measure", "SX": "sx",
        }
        for gate in circuit.gates:
            op = gate_map.get(gate.type, gate.type.lower())
            if gate.type in self._PARAM_GATES:
                name, keys = self._PARAM_GATES[gate.type]
                args = ",".join(repr(self._angle(gate.params, k)) for k in keys)
                op = f"{name}({args})"
            if gate.type == "RYY":
                # ryy is not in qelib1.inc — emit its standard decomposition.
                theta = self._angle(gate.params, "theta")
                a = f"q[{gate.control if gate.control is not None else gate.targets[0]}]"
                b = f"q[{gate.targets[-1] if gate.control is not None else gate.targets[1]}]"
                lines += [
                    f"rx(pi/2) {a};", f"rx(pi/2) {b};",
                    f"cx {a},{b};", f"rz({theta!r}) {b};", f"cx {a},{b};",
                    f"rx(-pi/2) {a};", f"rx(-pi/2) {b};",
                ]
            elif gate.type == "M":
                for i, (q, c) in enumerate(zip(gate.targets, gate.classical or gate.targets)):
                    lines.append(f"measure q[{q}] -> c[{c}];")
            elif gate.control is not None:
                lines.append(f"{op} q[{gate.control}],q[{gate.targets[0]}];")
            else:
                qargs = ",".join(f"q[{t}]" for t in gate.targets)
                lines.append(f"{op} {qargs};")
        return "\n".join(lines)
