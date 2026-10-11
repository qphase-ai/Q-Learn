"""Math agent — LaTeX equations for the whiteboard (verified in the validator node)."""
from __future__ import annotations

import structlog

from app.agents.classroom import prompts
from app.agents.classroom.llm_io import llm_json
from app.agents.classroom.state import MAX_EQUATIONS, MAX_LLM_CALLS

logger = structlog.get_logger(__name__)


def _errors_block(errors: list[str]) -> str:
    if not errors:
        return ""
    return prompts.MATH_ERRORS_BLOCK.format(errors="\n".join(f"- {e}" for e in errors[:6]))


async def math_agent_node(state, config=None):
    if not state.get("wants_math"):
        return {}
    errors = state.get("equation_errors") or []
    if state.get("equation_drafts") and not errors:
        return {}
    calls = state.get("llm_calls", 0)
    if calls >= MAX_LLM_CALLS:
        logger.info("classroom_math_skipped_budget", session_id=state.get("session_id"))
        return {"equation_drafts": [], "equation_errors": ["LLM budget exhausted"]}
    try:
        data = await llm_json(
            prompts.MATH_SYSTEM.format(max_equations=MAX_EQUATIONS),
            prompts.MATH_USER.format(
                question=state["user_message"],
                explanation=(state.get("explanation") or "")[:800],
                errors=_errors_block(errors),
            ),
        )
        items = data.get("equations") if isinstance(data, dict) else None
        if not isinstance(items, list) or not items:
            raise ValueError("expected a non-empty 'equations' list")
        return {"equation_drafts": items[:MAX_EQUATIONS], "equation_errors": [], "llm_calls": calls + 1}
    except Exception as exc:  # noqa: BLE001
        logger.warning("classroom_math_draft_failed", session_id=state.get("session_id"), error=str(exc))
        return {"equation_drafts": [], "equation_errors": [f"could not produce valid JSON: {exc}"], "llm_calls": calls + 1}
