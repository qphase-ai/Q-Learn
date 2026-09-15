# Quantum Execution Layer

> Implementation detail: [`backend/design.md § Quantum Execution Backend`](../backend/design.md)

---

## Architecture

```mermaid
flowchart TD
    REQ["Circuit Execution Request"]
    VAL["Circuit Validator"]
    MODEL["Framework-Independent Circuit Model"]
    IFACE["QuantumBackend Interface"]
    QA["QiskitAerAdapter\nMVP — primary"]
    PA["PennyLaneAdapter\nPhase 2"]
    CA["CirqAdapter\nPhase 2"]
    QE["Qiskit Aer\nVercel Sandbox microVM"]
    PL["PennyLane"]
    CI["Cirq"]
    RES["Normalized ExecutionResult"]

    REQ --> VAL --> MODEL --> IFACE
    IFACE --> QA
    IFACE --> PA
    IFACE --> CA
    QA --> QE
    PA --> PL
    CA --> CI
    QE --> RES
    PL --> RES
    CI --> RES
```

---

## Backend Contract

```python
validate(circuit)         # → ValidationResult
compile(circuit)          # → CompiledCircuit
execute(circuit, shots)   # → ExecutionResult
get_statevector(circuit)  # → list[complex]
get_probabilities(result) # → dict[str, float]
get_measurements(result)  # → list[str]
```

---

## Execution Sequence

`QiskitAerAdapter.execute()` is **not** run in-process. It serialises the circuit to a self-contained Python script, forks a Vercel Sandbox microVM, runs Qiskit Aer there, and deserialises the JSON result. FastAPI stays I/O-bound. Each fork is an independent Vercel-managed microVM — 10 concurrent circuits = 10 concurrent forks with zero API-process CPU load.

```mermaid
sequenceDiagram
    participant UI as Circuit Builder
    participant API as FastAPI
    participant QS as QuantumService
    participant SA as QiskitAerAdapter
    participant VM as Vercel Sandbox microVM
    participant DB as PostgreSQL
    participant RT as Supabase Realtime

    UI->>API: POST /simulations/execute (circuit JSON)
    API->>QS: execute(CircuitSpec)
    QS->>SA: compile(CircuitSpec) → CompiledCircuit
    SA->>VM: AsyncSandbox.fork() + run Qiskit script
    VM-->>SA: JSON stdout (statevector · probabilities · measurements)
    SA-->>QS: ExecutionResult
    QS->>DB: INSERT circuit_executions
    QS->>RT: publish circuit:{id} result
    RT-->>UI: broadcast result event
    QS-->>API: ExecutionResult
    API-->>UI: 200 OK
```

---

## Key Rules

- AI never directly executes arbitrary shell commands
- Quantum execution happens only through controlled backend services
- AI-generated quantum code must be validated before execution
- The quantum simulator is the source of truth for execution results
- LLM never replaces deterministic computation — use the quantum engine for calculations
