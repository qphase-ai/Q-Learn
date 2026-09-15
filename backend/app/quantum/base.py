from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class GateSpec:
    type: str
    targets: list[int]
    control: int | None = None
    params: dict[str, Any] = field(default_factory=dict)
    classical: list[int] | None = None


@dataclass
class CircuitSpec:
    qubits: int
    classical_bits: int
    gates: list[GateSpec]


@dataclass
class CompiledCircuit:
    qasm: str
    original_spec: CircuitSpec


@dataclass
class ExecutionResult:
    statevector: list[complex] | None
    probabilities: dict[str, float]
    measurements: dict[str, int]
    execution_time_ms: int
    shots: int


class QuantumBackend(ABC):
    @abstractmethod
    async def compile(self, circuit: CircuitSpec) -> CompiledCircuit: ...

    @abstractmethod
    async def validate(self, circuit: CircuitSpec) -> tuple[bool, list[str]]: ...

    @abstractmethod
    async def execute(self, circuit: CompiledCircuit, shots: int = 1024) -> ExecutionResult: ...
