"""Validator — deterministic review of agent drafts (no LLM call).

Checks the whiteboard schema (gate catalog, qubit range, size caps, no markup)
and then the circuit against the quantum backend's `validate`. Valid drafts become
wire payloads; invalid ones become error strings fed back to the agent once.
"""
from __future__ import annotations

import structlog
from pydantic import ValidationError as PydanticValidationError

import app.quantum.base as quantum_base
from app.agents.classroom.state import MAX_LLM_CALLS, MAX_VALIDATION_RETRIES
from app.schemas.whiteboard import (
    DrawQuantumCircuit,
    RenderEquation,
    _plain_text,
    action_payload,
)

logger = structlog.get_logger(__name__)

_backend = None


def get_backend():
    """The quantum backend used for validation only (nothing is executed here)."""
    global _backend
    if _backend is None:
        from app.quantum.sandbox_adapter import QiskitAerAdapter

        _backend = QiskitAerAdapter()
    return _backend


def _pydantic_errors(exc: PydanticValidationError) -> list[str]:
    out = []
    for e in exc.errors()[:5]:
        loc = ".".join(str(p) for p in e.get("loc", ()) if p != "action")
        out.append(f"{loc}: {e.get('msg', 'invalid')}" if loc else e.get("msg", "invalid"))
    return out


def circuit_object_id(turn_id: str, n: int = 1) -> str:
    return f"circuit-{turn_id[:8]}-{n}"


def equation_object_id(turn_id: str, n: int) -> str:
    return f"eq-{turn_id[:8]}-{n}"


async def validate_circuit(draft: dict, turn_id: str, backend=None) -> tuple[dict | None, list[str]]:
    """Return (wire payload, []) or (None, errors)."""
    try:
        action = DrawQuantumCircuit.model_validate(
            {
                "action": "draw_quantum_circuit",
                "object_id": circuit_object_id(turn_id),
                "qubits": draft.get("qubits"),
                "gates": draft.get("gates"),
            }
        )
    except PydanticValidationError as exc:
        return None, _pydantic_errors(exc)
    spec = quantum_base.CircuitSpec(
        qubits=action.qubits,
        classical_bits=action.qubits,
        gates=[
            quantum_base.GateSpec(
                type=g.type,
                targets=list(g.targets),
                control=g.control,
                params=g.params.to_dict() if g.params else {},
            )
            for g in action.gates
        ],
    )
    ok, errors = await (backend or get_backend()).validate(spec)
    if not ok:
        return None, list(errors)[:5]
    return action_payload(action), []


def validate_equations(drafts: list[dict], turn_id: str) -> tuple[list[dict], list[str]]:
    """Valid equations in order; invalid ones are dropped and reported."""
    good: list[dict] = []
    errors: list[str] = []
    for i, d in enumerate(drafts, 1):
        latex = d.get("latex") if isinstance(d, dict) else None
        try:
            action = RenderEquation.model_validate(
                {"action": "render_equation", "object_id": equation_object_id(turn_id, i), "latex": latex}
            )
            good.append(action_payload(action))
        except PydanticValidationError as exc:
            errors.append(f"equation {i}: " + "; ".join(_pydantic_errors(exc)))
    return good, errors


def clean_caption(caption: object) -> str | None:
    if not isinstance(caption, str):
        return None
    try:
        text = _plain_text(caption, "caption")[:200].strip()
    except ValueError:
        return None
    return text or None


async def validate_node(state, config=None):
    turn_id = state["turn_id"]
    # LangGraph requires every node to write at least one state key; `retries`
    # is a harmless baseline write when neither branch below applies (e.g. the
    # circuit/math draft already failed upstream with no draft to validate).
    update: dict = {"retries": state.get("retries", 0)}
    if state.get("wants_circuit") and state.get("circuit_draft") is not None and not state.get("circuit_errors"):
        payload, errors = await validate_circuit(state["circuit_draft"], turn_id)
        update["circuit_action"] = payload
        update["circuit_errors"] = errors
    if state.get("wants_math") and state.get("equation_drafts") and not state.get("equation_errors"):
        good, errors = validate_equations(state["equation_drafts"], turn_id)
        update["equation_actions"] = good
        # Dropped equations are only worth a retry when nothing valid survived.
        update["equation_errors"] = errors if not good else []
    return update


def route_after_validate(state) -> str:
    """Retry the drafting agents once (and only with LLM budget left), else emit."""
    failing = bool(state.get("circuit_errors") or state.get("equation_errors"))
    if (
        failing
        and state.get("retries", 0) < MAX_VALIDATION_RETRIES
        and state.get("llm_calls", 0) < MAX_LLM_CALLS
    ):
        return "retry"
    return "emit"


async def retry_node(state, config=None):
    """Counts the single bounded retry before looping back to the drafting agents."""
    return {"retries": state.get("retries", 0) + 1}
