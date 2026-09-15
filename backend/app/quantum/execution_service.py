from app.quantum.base import QuantumBackend, CircuitSpec, ExecutionResult
from app.quantum.sandbox_adapter import QiskitAerAdapter


class QuantumExecutionService:
    def __init__(self):
        self._backends: dict[str, QuantumBackend] = {
            "qiskit_aer": QiskitAerAdapter(),
        }
        self._default = "qiskit_aer"

    def get_backend(self, name: str | None = None) -> QuantumBackend:
        return self._backends[name or self._default]

    async def execute(self, circuit: CircuitSpec, shots: int = 1024, backend: str | None = None) -> ExecutionResult:
        backend_impl = self.get_backend(backend)
        is_valid, errors = await backend_impl.validate(circuit)
        if not is_valid:
            from app.exceptions import ValidationError
            raise ValidationError("Circuit validation failed", details=errors)
        compiled = await backend_impl.compile(circuit)
        return await backend_impl.execute(compiled, shots)
