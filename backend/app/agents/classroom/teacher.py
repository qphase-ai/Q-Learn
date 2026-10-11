"""Teacher — streams the spoken-friendly explanation to the student."""
from __future__ import annotations

import asyncio

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.classroom import prompts
from app.agents.classroom.llm_io import build_llm, message_text
from app.agents.tutor import normalise_math

logger = structlog.get_logger(__name__)


def _render_history(context: dict) -> str:
    parts = []
    if context.get("summary"):
        parts.append(f"Earlier in this class: {context['summary']}")
    for m in context.get("history", []):
        parts.append(f"{m['role']}: {m['content']}")
    if context.get("mastery"):
        parts.append("Student is weaker on: " + ", ".join(context["mastery"]))
    return "\n".join(parts) or "(first message)"


def _render_board(context: dict) -> str:
    board = context.get("board") or []
    return "\n".join(f"- {o['id']} ({o['kind']}): {o['brief']}" for o in board) or "(empty)"


def _render_sources(context: dict) -> str:
    sources = context.get("sources") or []
    return "\n".join(f"[{i}] {s['title']}: {s['content']}" for i, s in enumerate(sources, 1)) or "(none)"


def build_teacher_messages(state) -> list:
    ctx = state.get("context") or {}
    plan = state.get("plan") or {}
    steps = plan.get("steps") or []
    outline = ("\nCover these points in order: " + "; ".join(steps)) if steps else ""
    wants_visual = state.get("wants_circuit") or state.get("wants_math")
    system = prompts.TEACHER_SYSTEM.format(
        level=prompts.LEVEL_DEFAULT,
        board_note=prompts.TEACHER_BOARD_NOTE if wants_visual else "",
        outline=outline,
    )
    user = prompts.TEACHER_USER.format(
        context=_render_history(ctx),
        board=_render_board(ctx),
        sources=_render_sources(ctx),
        question=state["user_message"],
    )
    return [SystemMessage(content=system), HumanMessage(content=user)]


async def teacher_node(state, config):
    emitter = config["configurable"]["emitter"]
    plan = state.get("plan") or {}
    step_id = state["step_id"]

    await emitter.status("Preparing the lesson")
    await emitter.action({"action": "step_started", "title": plan.get("title") or "Lesson"}, step_id)
    await emitter.status("Teaching")

    messages = build_teacher_messages(state)
    llm = build_llm(messages)
    text = ""
    async for chunk in llm.astream(messages):
        piece = message_text(chunk)
        if piece:
            text += piece
            await emitter.delta(piece)
    # Off the event loop: pure CPU on model-written text (same as the tutor).
    text = await asyncio.to_thread(normalise_math, text)
    return {"explanation": text, "llm_calls": state.get("llm_calls", 0) + 1}
