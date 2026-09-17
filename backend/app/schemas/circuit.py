from pydantic import BaseModel
from typing import Any
import uuid


class GateSpec(BaseModel):
    type: str
    targets: list[int]
    control: int | None = None
    params: dict[str, Any] | None = None
    classical: list[int] | None = None


class CircuitSpec(BaseModel):
    qubits: int
    classical_bits: int
    gates: list[GateSpec]


class CircuitCreateRequest(BaseModel):
    name: str
    description: str | None = None
    circuit_json: CircuitSpec


class CircuitResponse(BaseModel):
    id: uuid.UUID
    name: str
    num_qubits: int
    circuit_json: dict

    model_config = {"from_attributes": True}


class ExecutionRequest(BaseModel):
    circuit_id: uuid.UUID
    shots: int = 1024


class ExecuteCircuitRequest(BaseModel):
    circuit: CircuitSpec
    shots: int = 1024
    name: str = "Untitled"


class ExecutionAccepted(BaseModel):
    execution_id: uuid.UUID
    status: str


class ExecutionResult(BaseModel):
    id: uuid.UUID
    status: str
    statevector: list | None = None
    probabilities: dict | None = None
    measurements: dict | None = None
    execution_time_ms: int | None = None
    error_message: str | None = None

    model_config = {"from_attributes": True}
