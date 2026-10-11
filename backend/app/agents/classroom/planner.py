"""Planner — a bounded mini lesson plan, only for complex requests."""
from __future__ import annotations

import structlog

from app.agents.classroom import prompts
from app.agents.classroom.llm_io import llm_json
from app.agents.classroom.orchestrator import topic_title
from app.agents.classroom.state import MAX_LLM_CALLS, MAX_PLAN_STEPS
from app.schemas.whiteboard import MAX_TITLE_CHARS, _plain_text

logger = structlog.get_logger(__name__)


def _clean(text: object, limit: int) -> str | None:
    if not isinstance(text, str):
        return None
    try:
        cleaned = _plain_text(text, "plan")[:limit].strip()
    except ValueError:
        return None
    return cleaned or None


def normalise_plan(data: object, fallback_title: str) -> dict:
    """Coerce model output into {title, steps<=MAX_PLAN_STEPS}, plain text only."""
    title = fallback_title
    steps: list[str] = []
    if isinstance(data, dict):
        title = _clean(data.get("title"), MAX_TITLE_CHARS) or fallback_title
        raw_steps = data.get("steps")
        if isinstance(raw_steps, list):
            for s in raw_steps:
                cleaned = _clean(s, 100)
                if cleaned:
                    steps.append(cleaned)
                if len(steps) >= MAX_PLAN_STEPS:
                    break
    return {"title": title, "steps": steps}


async def plan_node(state, config=None):
    fallback = topic_title(state["user_message"])
    calls = state.get("llm_calls", 0)
    if calls >= MAX_LLM_CALLS:
        return {"plan": {"title": fallback, "steps": []}}
    try:
        data = await llm_json(prompts.PLANNER_SYSTEM.format(), state["user_message"])
    except Exception as exc:  # noqa: BLE001 — a plan is a nicety
        logger.warning("classroom_plan_failed", session_id=state.get("session_id"), error=str(exc))
        data = None
    return {"plan": normalise_plan(data, fallback), "llm_calls": calls + 1}
