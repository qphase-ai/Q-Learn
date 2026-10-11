"""Circuit agent — proposes a circuit as structured data; it never executes anything.

The draft is verified in the validator node (whiteboard schema + the quantum
backend's `validate`). This agent never states measurement results.
"""
from __future__ import annotations

import structlog

from app.agents.classroom import prompts
from app.agents.classroom.llm_io import llm_json
from app.agents.classroom.state import MAX_LLM_CALLS
from app.schemas.whiteboard import MAX_GATES, MAX_QUBITS

logger = structlog.get_logger(__name__)


def _errors_block(errors: list[str]) -> str:
    if not errors:
        return ""
    return prompts.CIRCUIT_ERRORS_BLOCK.format(errors="\n".join(f"- {e}" for e in errors[:6]))


async def circuit_agent_node(state, config=None):
    calls = state.get("llm_calls", 0)
    # LangGraph requires every node to write at least one state key, so the
    # no-op paths below write `llm_calls` back unchanged instead of `{}`.
    if not state.get("wants_circuit"):
        return {"llm_calls": calls}
    errors = state.get("circuit_errors") or []
    if state.get("circuit_draft") is not None and not errors:
        return {"llm_calls": calls}  # already drafted and nothing to fix
    if calls >= MAX_LLM_CALLS:
        logger.info("classroom_circuit_skipped_budget", session_id=state.get("session_id"))
        return {"circuit_draft": None, "circuit_errors": ["LLM budget exhausted"]}
    try:
        data = await llm_json(
            prompts.CIRCUIT_SYSTEM.format(max_qubits=MAX_QUBITS, max_gates=MAX_GATES),
            prompts.CIRCUIT_USER.format(
                question=state["user_message"],
                explanation=(state.get("explanation") or "")[:800],
                errors=_errors_block(errors),
            ),
        )
        if not isinstance(data, dict):
            raise ValueError("circuit must be a JSON object")
        return {"circuit_draft": data, "circuit_errors": [], "llm_calls": calls + 1}
    except Exception as exc:  # noqa: BLE001 — surfaces as a validation error → bounded retry
        logger.warning("classroom_circuit_draft_failed", session_id=state.get("session_id"), error=str(exc))
        return {"circuit_draft": None, "circuit_errors": [f"could not produce valid JSON: {exc}"], "llm_calls": calls + 1}
