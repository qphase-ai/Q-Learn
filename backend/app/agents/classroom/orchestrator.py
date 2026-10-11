"""Orchestrator — intent routing, heuristics first.

Cheap keyword rules decide almost every turn. The LLM classifier runs only when
the message carries no signal at all (the ambiguous case), so routing normally
costs zero model calls.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import structlog

from app.agents.classroom import prompts
from app.agents.classroom.llm_io import llm_json
from app.agents.classroom.state import MAX_LLM_CALLS

logger = structlog.get_logger(__name__)

INTENTS = ("explain", "circuit", "math", "followup")

_CIRCUIT_RE = re.compile(
    r"\b(circuits?|gates?|cnot|cx|toffoli|bell state|ghz|qubits? diagram|diagram|"
    r"draw|sketch|build|construct|wire|entangle[a-z]*)\b",
    re.IGNORECASE,
)
_MATH_RE = re.compile(
    r"\b(equations?|formula|derive|derivation|prove|proof|math|matrix|matrices|amplitudes?|"
    r"bra-?ket|state ?vector|calculate|compute|tensor product|norm|probabilit(?:y|ies)|"
    r"eigen[a-z]*|unitary)\b",
    re.IGNORECASE,
)
_EXPLAIN_RE = re.compile(
    r"\b(explain|what|why|how|teach|describe|tell me|define|difference|intuition|overview|"
    r"understand|mean|means|example|help)\b|\?",
    re.IGNORECASE,
)
_FOLLOWUP_RE = re.compile(
    r"^\s*(why|how come|and\b|so\b|then\b|ok(?:ay)?\b|go on|continue|more|again|what do you mean|"
    r"can you (?:repeat|elaborate)|elaborate|i (?:don'?t|do not) (?:get|understand)|huh|really)\b",
    re.IGNORECASE,
)
_PLAN_RE = re.compile(
    r"\b(step[- ]by[- ]step|lesson|walk me through|teach me|full explanation|from scratch|in depth|in detail)\b",
    re.IGNORECASE,
)
FOLLOWUP_MAX_WORDS = 8
PLAN_MIN_WORDS = 25


@dataclass
class RouteDecision:
    intent: str
    wants_circuit: bool
    wants_math: bool
    needs_plan: bool
    used_llm: bool = False


def classify_heuristic(message: str, has_history: bool) -> RouteDecision | None:
    """Rule-based route, or None when the message is ambiguous (no signal at all)."""
    words = message.split()
    wants_circuit = bool(_CIRCUIT_RE.search(message))
    wants_math = bool(_MATH_RE.search(message))
    explain = bool(_EXPLAIN_RE.search(message))

    visuals = int(wants_circuit) + int(wants_math)
    complex_request = bool(_PLAN_RE.search(message)) or len(words) >= PLAN_MIN_WORDS or visuals == 2

    if has_history and len(words) <= FOLLOWUP_MAX_WORDS and not (wants_circuit or wants_math):
        if _FOLLOWUP_RE.search(message):
            return RouteDecision("followup", False, False, False)
    if wants_circuit:
        return RouteDecision("circuit", True, wants_math, complex_request)
    if wants_math:
        return RouteDecision("math", False, True, complex_request)
    if explain:
        return RouteDecision("explain", False, False, complex_request)
    return None


async def classify_with_llm(message: str) -> RouteDecision:
    """LLM fallback for ambiguous messages; any failure degrades to plain `explain`."""
    try:
        data = await llm_json(prompts.CLASSIFIER_SYSTEM.format(), message)
        intent = data.get("intent") if isinstance(data, dict) else None
        if intent not in INTENTS:
            raise ValueError(f"bad intent {intent!r}")
        wants_circuit = bool(data.get("wants_circuit")) or intent == "circuit"
        wants_math = bool(data.get("wants_math")) or intent == "math"
        return RouteDecision(intent, wants_circuit, wants_math, False, used_llm=True)
    except Exception as exc:  # noqa: BLE001 — routing must never fail the turn
        logger.warning("classroom_classify_failed", error=str(exc))
        return RouteDecision("explain", False, False, False, used_llm=True)


def topic_title(message: str, limit: int = 60) -> str:
    """A plain-text step title derived from the student's message."""
    first = re.split(r"[.?!\n]", message.strip(), maxsplit=1)[0]
    cleaned = re.sub(r"[<>&`$\\]|https?://\S+", " ", first)
    cleaned = " ".join(cleaned.split())
    return (cleaned[:limit].rstrip() or "Quantum computing")


async def orchestrate_node(state, config=None):
    message = state["user_message"]
    has_history = bool(state.get("context", {}).get("history"))
    decision = classify_heuristic(message, has_history)
    calls = state.get("llm_calls", 0)
    if decision is None:
        if calls < MAX_LLM_CALLS:
            decision = await classify_with_llm(message)
            calls += 1
        else:
            decision = RouteDecision("explain", False, False, False)
    logger.info(
        "classroom_routed",
        session_id=state.get("session_id"),
        intent=decision.intent,
        wants_circuit=decision.wants_circuit,
        wants_math=decision.wants_math,
        needs_plan=decision.needs_plan,
        used_llm=decision.used_llm,
    )
    update = {
        "intent": decision.intent,
        "wants_circuit": decision.wants_circuit,
        "wants_math": decision.wants_math,
        "needs_plan": decision.needs_plan,
        "llm_calls": calls,
    }
    if not decision.needs_plan:
        # Simple question: skip the planner LLM call with a trivial one-step plan.
        update["plan"] = {"title": topic_title(message), "steps": []}
    return update
