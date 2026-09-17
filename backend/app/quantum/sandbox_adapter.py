import json
import time
from app.quantum.base import QuantumBackend, CircuitSpec, CompiledCircuit, ExecutionResult
from app.config import get_settings

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
        return len(errors) == 0, errors

    async def execute(self, circuit: CompiledCircuit, shots: int = 1024) -> ExecutionResult:
        from vercel_sandbox import AsyncSandbox

        code = QISKIT_SCRIPT_TEMPLATE.format(qasm=circuit.qasm, shots=shots)
        start = time.monotonic()

        async with await AsyncSandbox.fork(
            source_sandbox=self.settings.sandbox_base_name,
            network_policy={"mode": "deny-all"},
            resources={"vcpus": "1", "memory": "512"},
            timeout=self.settings.sandbox_timeout,
        ) as sandbox:
            result = await sandbox.run_command("python", ["-c", code])

        elapsed_ms = int((time.monotonic() - start) * 1000)
        output = json.loads(result.stdout)

        return ExecutionResult(
            statevector=output.get("statevector"),
            probabilities=output["probabilities"],
            measurements=output["measurements"],
            execution_time_ms=elapsed_ms,
            shots=shots,
        )

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
            "SWAP": "swap", "M": "measure",
        }
        for gate in circuit.gates:
            op = gate_map.get(gate.type, gate.type.lower())
            if gate.type == "M":
                for i, (q, c) in enumerate(zip(gate.targets, gate.classical or gate.targets)):
                    lines.append(f"measure q[{q}] -> c[{c}];")
            elif gate.control is not None:
                lines.append(f"{op} q[{gate.control}],q[{gate.targets[0]}];")
            else:
                qargs = ",".join(f"q[{t}]" for t in gate.targets)
                lines.append(f"{op} {qargs};")
        return "\n".join(lines)
