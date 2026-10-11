"""Graph state, run-time collaborators and limits for the classroom workflow.

State keys have a single owner node (noted per key). Every per-turn key is reset
by `initial_state()`, because a checkpointed thread keeps the previous turn's
values for any key the new input does not overwrite.
"""
from __future__ import annotations

from typing import Any, Protocol, TypedDict

# Hard cap on LLM calls in one turn (classifier, planner, teacher, circuit, math,
# plus the one bounded retry all count). Optional work is skipped once spent.
MAX_LLM_CALLS = 4
MAX_VALIDATION_RETRIES = 1
MAX_PLAN_STEPS = 4
MAX_EQUATIONS = 3

# Bounded context (characters unless noted).
CONTEXT_HISTORY_MESSAGES = 8
CONTEXT_HISTORY_WITH_SUMMARY = 4
CONTEXT_MESSAGE_CHARS = 1200
CONTEXT_SUMMARY_CHARS = 1500
CONTEXT_BOARD_OBJECTS = 12
CONTEXT_SOURCES = 3
CONTEXT_SOURCE_CHARS = 700
CONTEXT_MASTERY = 3
CONTEXT_TOTAL_CHARS = 8000


class Emitter(Protocol):
    """Outbound channel for one run. `action` may raise RunSupersededError."""

    async def status(self, label: str) -> None: ...

    async def delta(self, text: str) -> None: ...

    async def action(self, payload: dict[str, Any], step_id: str | None) -> None: ...


class ClassroomState(TypedDict, total=False):
    # Inputs (set by initial_state)
    session_id: str
    turn_id: str
    step_id: str
    user_message: str
    # load_context
    context: dict[str, Any]
    # orchestrate
    intent: str  # explain | circuit | math | followup
    wants_circuit: bool
    wants_math: bool
    needs_plan: bool
    # plan
    plan: dict[str, Any]  # {"title": str, "steps": [str]}
    # teacher
    explanation: str
    # circuit_agent / math_agent (drafts) and validate (verified payloads)
    circuit_draft: dict[str, Any] | None
    equation_drafts: list[dict[str, Any]]
    circuit_action: dict[str, Any] | None
    equation_actions: list[dict[str, Any]]
    circuit_errors: list[str]
    equation_errors: list[str]
    # shared counters
    llm_calls: int
    retries: int
    # emit
    final_message: str
    emitted_ids: list[str]


def initial_state(*, session_id: str, turn_id: str, user_message: str) -> ClassroomState:
    return ClassroomState(
        session_id=session_id,
        turn_id=turn_id,
        step_id=f"{turn_id}-s1",
        user_message=user_message,
        context={},
        intent="explain",
        wants_circuit=False,
        wants_math=False,
        needs_plan=False,
        plan={},
        explanation="",
        circuit_draft=None,
        equation_drafts=[],
        circuit_action=None,
        equation_actions=[],
        circuit_errors=[],
        equation_errors=[],
        llm_calls=0,
        retries=0,
        final_message="",
        emitted_ids=[],
    )
