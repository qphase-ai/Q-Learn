"""The classroom StateGraph.

    START → load_context → orchestrate ─┬─ (needs_plan) → lesson_plan ─┐
                                        └─────────────────────────────┴→ teacher
    teacher ─┬─ (wants visuals) → circuit_agent → math_agent → validate ─┬─ (retry ≤1) → retry → circuit_agent
             └─ (text only) ─────────────────────────────→ emit ←────────┘ (valid / budget spent)
    emit → END

Collaborators come in through `config["configurable"]`: `emitter` (see state.Emitter)
and `context_loader` (async fn(state) -> dict). Nothing here touches the database,
so the graph is testable with fakes. The thread id is the classroom session id.
"""
from __future__ import annotations

import structlog
from langgraph.graph import END, START, StateGraph

from app.agents.classroom import prompts
from app.agents.classroom.circuit_agent import circuit_agent_node
from app.agents.classroom.math_agent import math_agent_node
from app.agents.classroom.orchestrator import orchestrate_node
from app.agents.classroom.planner import plan_node
from app.agents.classroom.state import ClassroomState
from app.agents.classroom.teacher import teacher_node
from app.agents.classroom.validator import (
    clean_caption,
    retry_node,
    route_after_validate,
    validate_node,
)

logger = structlog.get_logger(__name__)


async def load_context_node(state, config):
    loader = config["configurable"].get("context_loader")
    if loader is None:
        return {"context": {}}
    return {"context": await loader(state)}


def route_after_orchestrate(state) -> str:
    return "lesson_plan" if state.get("needs_plan") else "teacher"


def route_after_teacher(state) -> str:
    return "circuit_agent" if (state.get("wants_circuit") or state.get("wants_math")) else "emit"


async def emit_node(state, config):
    """Put verified visuals on the board, report failures, close the step."""
    emitter = config["configurable"]["emitter"]
    step_id = state["step_id"]
    emitted: list[str] = []

    circuit = state.get("circuit_action")
    if state.get("wants_circuit"):
        if circuit:
            await emitter.status("Drawing the circuit")
            await emitter.action(circuit, step_id)
            emitted.append(circuit["object_id"])
            caption = clean_caption((state.get("circuit_draft") or {}).get("caption"))
            await emitter.action({"action": "highlight_object", "object_id": circuit["object_id"]}, step_id)
            if caption:
                ann_id = f"note-{state['turn_id'][:8]}-1"
                await emitter.action(
                    {"action": "draw_annotation", "object_id": ann_id, "text": caption, "target_id": circuit["object_id"]},
                    step_id,
                )
                emitted.append(ann_id)
        else:
            await emitter.action({"action": "tutor_error", "message": prompts.CIRCUIT_FAILED_MESSAGE}, step_id)

    equations = state.get("equation_actions") or []
    if state.get("wants_math"):
        if equations:
            await emitter.status("Writing the equations")
            for eq in equations:
                await emitter.action(eq, step_id)
                emitted.append(eq["object_id"])
        else:
            await emitter.action({"action": "tutor_error", "message": prompts.EQUATION_FAILED_MESSAGE}, step_id)

    await emitter.action({"action": "step_completed"}, step_id)
    return {"final_message": state.get("explanation", ""), "emitted_ids": emitted}


def build_graph(checkpointer=None):
    """Compile the workflow. `checkpointer=None` runs without resumability."""
    g = StateGraph(ClassroomState)
    g.add_node("load_context", load_context_node)
    g.add_node("orchestrate", orchestrate_node)
    g.add_node("lesson_plan", plan_node)  # "plan" is a ClassroomState key; node ids share the same namespace
    g.add_node("teacher", teacher_node)
    g.add_node("circuit_agent", circuit_agent_node)
    g.add_node("math_agent", math_agent_node)
    g.add_node("validate", validate_node)
    g.add_node("retry", retry_node)
    g.add_node("emit", emit_node)

    g.add_edge(START, "load_context")
    g.add_edge("load_context", "orchestrate")
    g.add_conditional_edges(
        "orchestrate", route_after_orchestrate, {"lesson_plan": "lesson_plan", "teacher": "teacher"}
    )
    g.add_edge("lesson_plan", "teacher")
    g.add_conditional_edges("teacher", route_after_teacher, {"circuit_agent": "circuit_agent", "emit": "emit"})
    g.add_edge("circuit_agent", "math_agent")
    g.add_edge("math_agent", "validate")
    g.add_conditional_edges("validate", route_after_validate, {"retry": "retry", "emit": "emit"})
    g.add_edge("retry", "circuit_agent")
    g.add_edge("emit", END)
    return g.compile(checkpointer=checkpointer)


_graph = None
_graph_checkpointer = None


def get_graph():
    """Process-wide compiled graph, rebuilt if the checkpointer changed (startup)."""
    global _graph, _graph_checkpointer
    from app.agents.classroom.checkpointer import get_checkpointer

    saver = get_checkpointer()
    if _graph is None or saver is not _graph_checkpointer:
        _graph = build_graph(saver)
        _graph_checkpointer = saver
    return _graph
