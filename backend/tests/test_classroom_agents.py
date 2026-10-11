"""Classroom agents + graph with a mocked LLM and a recording emitter.

Hermetic: `llm_io.get_llm` is replaced by a scripted fake, the quantum backend by a
fake validator (one test uses the real QiskitAerAdapter.validate, which never touches
the sandbox), the emitter records everything. No network, no database.
"""
import uuid

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk
from langgraph.checkpoint.memory import MemorySaver

import app.agents.classroom.llm_io as llm_io
import app.agents.classroom.validator as validator
from app.agents.classroom.context import assemble_context, build_summary, context_size
from app.agents.classroom.graph import build_graph
from app.agents.classroom.orchestrator import classify_heuristic, topic_title
from app.agents.classroom.planner import normalise_plan
from app.agents.classroom.state import (
    CONTEXT_HISTORY_MESSAGES,
    CONTEXT_HISTORY_WITH_SUMMARY,
    CONTEXT_TOTAL_CHARS,
    MAX_LLM_CALLS,
    initial_state,
)
from app.schemas.whiteboard import parse_action


def kind_of(messages) -> str:
    system = messages[0].content
    if "route a student" in system:
        return "classify"
    if "plan a short" in system:
        return "plan"
    if "AI Teacher" in system:
        return "teach"
    if "one small quantum circuit" in system:
        return "circuit"
    if "key equations" in system:
        return "math"
    raise AssertionError(f"unexpected prompt: {system[:60]}")


class FakeLLM:
    """Scripted per agent kind: responses[kind] is a list consumed in order (last one repeats)."""

    def __init__(self, responses, fail_teach_times=0):
        self.responses = {k: list(v) for k, v in responses.items()}
        self.calls: list[str] = []
        self.fail_teach_times = fail_teach_times

    def _next(self, kind):
        self.calls.append(kind)
        queue = self.responses[kind]
        return queue.pop(0) if len(queue) > 1 else queue[0]

    async def ainvoke(self, messages):
        return AIMessage(content=self._next(kind_of(messages)))

    async def astream(self, messages):
        kind = kind_of(messages)
        if kind == "teach" and self.fail_teach_times > 0:
            self.calls.append(kind)
            self.fail_teach_times -= 1
            raise RuntimeError("provider down")
        text = self._next(kind)
        for i in range(0, len(text), 8):
            yield AIMessageChunk(content=text[i : i + 8])


class FakeBackend:
    def __init__(self, ok=True, errors=None):
        self.ok, self.errors = ok, errors or []
        self.specs = []

    async def validate(self, circuit):
        self.specs.append(circuit)
        return self.ok, self.errors


class RecordingEmitter:
    def __init__(self):
        self.statuses, self.deltas, self.actions = [], [], []

    async def status(self, label):
        self.statuses.append(label)

    async def delta(self, text):
        self.deltas.append(text)

    async def action(self, payload, step_id):
        parse_action(payload)  # everything emitted must already be schema-valid
        self.actions.append((payload, step_id))

    @property
    def names(self):
        return [p["action"] for p, _ in self.actions]


GOOD_CIRCUIT = '{"qubits": 2, "gates": [{"type": "H", "targets": [0]}, {"type": "CX", "control": 0, "targets": [1]}], "caption": "Bell pair"}'
BAD_CIRCUIT = '{"qubits": 2, "gates": [{"type": "H", "targets": [5]}]}'
GOOD_MATH = '{"equations": [{"latex": "|\\\\psi\\\\rangle = \\\\frac{|0\\\\rangle + |1\\\\rangle}{\\\\sqrt{2}}"}]}'


@pytest.fixture
def fake(monkeypatch):
    def install(responses, **kw):
        llm = FakeLLM(responses, **kw)
        monkeypatch.setattr(llm_io, "get_llm", lambda **k: llm)
        return llm

    monkeypatch.setattr(validator, "_backend", FakeBackend())
    return install


async def run(graph, message, emitter=None, loader=None, thread="t", state_over=None, history=False):
    emitter = emitter or RecordingEmitter()
    turn = str(uuid.uuid4())
    cfg = {"configurable": {"thread_id": thread, "emitter": emitter}}
    if loader is not None:
        cfg["configurable"]["context_loader"] = loader
    elif history:
        async def loader(_s):
            return {"history": [{"role": "user", "content": "what is a qubit"}], "board": [], "sources": []}
        cfg["configurable"]["context_loader"] = loader
    state = initial_state(session_id="s", turn_id=turn, user_message=message)
    state.update(state_over or {})
    result = await graph.ainvoke(state, cfg)
    return result, emitter


# ---------------------------------------------------------------------------
# Orchestrator heuristics
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "message,history,intent,circuit,math,plan",
    [
        ("What is superposition?", False, "explain", False, False, False),
        ("Draw a Bell state circuit", False, "circuit", True, False, False),
        ("Explain superposition and show me a Hadamard circuit", False, "circuit", True, False, False),
        ("Derive the Hadamard matrix", False, "math", False, True, False),
        ("Show the circuit and the equation for a Bell state", False, "circuit", True, True, True),
        ("Teach me quantum teleportation step by step", False, "explain", False, False, True),
        ("why?", True, "followup", False, False, False),
        ("and then?", True, "followup", False, False, False),
    ],
)
def test_heuristic_routing(message, history, intent, circuit, math, plan):
    d = classify_heuristic(message, history)
    assert d is not None
    assert (d.intent, d.wants_circuit, d.wants_math, d.needs_plan) == (intent, circuit, math, plan)


def test_short_followup_without_history_is_not_a_followup():
    d = classify_heuristic("why?", False)
    assert d is not None and d.intent == "explain"


def test_message_with_no_signal_is_ambiguous():
    assert classify_heuristic("superposition", False) is None


def test_long_request_needs_plan():
    msg = " ".join(["Please talk about quantum entanglement and measurement"] * 4) + " in class?"
    assert classify_heuristic(msg, False).needs_plan


def test_topic_title_is_plain_text():
    t = topic_title("Explain <b>qubits</b> & https://x.io now. Thanks")
    assert "<" not in t and "http" not in t and len(t) <= 60


async def test_simple_question_uses_only_the_teacher(fake):
    llm = fake({"teach": ["A qubit is a two-level system."]})
    result, em = await run(build_graph(), "What is a qubit?")
    assert llm.calls == ["teach"]  # no classifier, no planner
    assert result["final_message"].startswith("A qubit")
    assert em.names == ["step_started", "step_completed"]
    assert "".join(em.deltas).startswith("A qubit")


async def test_ambiguous_message_uses_llm_classifier_once(fake):
    llm = fake({"classify": ['{"intent": "circuit", "wants_circuit": true, "wants_math": false}'],
                "teach": ["Sure."], "circuit": [GOOD_CIRCUIT]})
    result, em = await run(build_graph(), "superposition")
    assert llm.calls == ["classify", "teach", "circuit"]
    assert "draw_quantum_circuit" in em.names


async def test_classifier_failure_degrades_to_explain(fake):
    llm = fake({"classify": ["not json at all"], "teach": ["ok"]})
    result, em = await run(build_graph(), "superposition")
    assert result["intent"] == "explain" and llm.calls == ["classify", "teach"]


# ---------------------------------------------------------------------------
# Planner
# ---------------------------------------------------------------------------

def test_normalise_plan_caps_and_cleans():
    plan = normalise_plan({"title": "<b>x</b>", "steps": ["a", "<i>b</i>", "c", "d", "e", "f"]}, "Fallback")
    assert plan["title"] == "Fallback"
    assert plan["steps"] == ["a", "c", "d", "e"]
    assert normalise_plan("garbage", "F") == {"title": "F", "steps": []}


async def test_complex_request_runs_planner(fake):
    llm = fake({"plan": ['{"title": "Teleportation", "steps": ["Setup", "Protocol"]}'], "teach": ["Lesson."]})
    result, em = await run(build_graph(), "Teach me quantum teleportation step by step")
    assert llm.calls == ["plan", "teach"]
    assert em.actions[0][0] == {"action": "step_started", "title": "Teleportation"}


# ---------------------------------------------------------------------------
# Circuit / math agents, validation, bounded retry
# ---------------------------------------------------------------------------

async def test_circuit_turn_draws_validated_circuit(fake):
    llm = fake({"teach": ["Here is H then CX."], "circuit": [GOOD_CIRCUIT]})
    result, em = await run(build_graph(), "Draw a Bell state circuit")
    assert llm.calls == ["teach", "circuit"]
    assert em.names == ["step_started", "draw_quantum_circuit", "highlight_object", "draw_annotation", "step_completed"]
    drawn = em.actions[1][0]
    assert drawn["qubits"] == 2 and drawn["gates"][1] == {"type": "CX", "control": 0, "targets": [1]}
    assert em.actions[3][0]["target_id"] == drawn["object_id"]
    assert all(step == f"{result['turn_id']}-s1" for _, step in em.actions)
    assert validator._backend.specs  # went through QuantumBackend.validate


async def test_invalid_circuit_is_retried_once_then_succeeds(fake):
    llm = fake({"teach": ["x"], "circuit": [BAD_CIRCUIT, GOOD_CIRCUIT]})
    result, em = await run(build_graph(), "Draw a Bell state circuit")
    assert llm.calls.count("circuit") == 2
    assert "draw_quantum_circuit" in em.names and "tutor_error" not in em.names
    assert result["retries"] == 1


async def test_retry_is_bounded_and_ends_in_tutor_error(fake):
    llm = fake({"teach": ["x"], "circuit": [BAD_CIRCUIT]})
    result, em = await run(build_graph(), "Draw a Bell state circuit")
    assert llm.calls.count("circuit") == 2  # original + exactly one retry
    assert em.names == ["step_started", "tutor_error", "step_completed"]
    assert result["final_message"] == "x"  # the text answer is still delivered


async def test_backend_rejection_triggers_retry(fake, monkeypatch):
    monkeypatch.setattr(validator, "_backend", FakeBackend(ok=False, errors=["Maximum 29 qubits supported"]))
    llm = fake({"teach": ["x"], "circuit": [GOOD_CIRCUIT]})
    result, em = await run(build_graph(), "Draw a Bell state circuit")
    assert llm.calls.count("circuit") == 2 and "tutor_error" in em.names


async def test_real_qiskit_adapter_validate_is_used_without_the_sandbox(fake, monkeypatch):
    monkeypatch.setattr(validator, "_backend", None)
    from app.quantum.sandbox_adapter import QiskitAerAdapter

    adapter = QiskitAerAdapter()
    import app.quantum.base as qb

    ok, errors = await adapter.validate(qb.CircuitSpec(2, 2, [qb.GateSpec("H", [5])]))
    assert not ok and "out of range" in errors[0]
    fake({"teach": ["x"], "circuit": [GOOD_CIRCUIT]})
    result, em = await run(build_graph(), "Draw a Bell state circuit")
    assert "draw_quantum_circuit" in em.names


async def test_unparseable_circuit_output_becomes_tutor_error(fake):
    llm = fake({"teach": ["x"], "circuit": ["I cannot do that"]})
    result, em = await run(build_graph(), "Draw a Bell state circuit")
    assert llm.calls.count("circuit") == 2 and "tutor_error" in em.names


async def test_math_turn_renders_equation_and_drops_markup(fake):
    llm = fake({"teach": ["x"], "math": [GOOD_MATH]})
    result, em = await run(build_graph(), "Derive the Hadamard matrix")
    assert em.names == ["step_started", "render_equation", "step_completed"]

    bad = '{"equations": [{"latex": "<script>x</script>"}, {"latex": "a+b"}]}'
    llm = fake({"teach": ["x"], "math": [bad]})
    result, em = await run(build_graph(), "Derive the Hadamard matrix")
    assert [p["latex"] for p, _ in em.actions if p["action"] == "render_equation"] == ["a+b"]
    assert llm.calls.count("math") == 1  # a partial success is not retried


async def test_all_equations_invalid_is_retried_then_errors(fake):
    llm = fake({"teach": ["x"], "math": ['{"equations": [{"latex": "<b>x</b>"}]}']})
    result, em = await run(build_graph(), "Derive the Hadamard matrix")
    assert llm.calls.count("math") == 2 and "tutor_error" in em.names


async def test_dollar_delimited_latex_is_retried_then_accepted(fake):
    llm = fake({"teach": ["x"], "math": ['{"equations": [{"latex": "$x^2$"}]}', GOOD_MATH]})
    result, em = await run(build_graph(), "Derive the Hadamard matrix")
    assert llm.calls.count("math") == 2 and "render_equation" in em.names and "tutor_error" not in em.names


async def test_llm_budget_is_never_exceeded(fake):
    llm = fake({"plan": ['{"title": "t", "steps": ["a"]}'], "teach": ["x"], "circuit": [BAD_CIRCUIT], "math": [GOOD_MATH]})
    result, em = await run(build_graph(), "Show the circuit and the equation for a Bell state step by step")
    assert len(llm.calls) <= MAX_LLM_CALLS
    assert result["llm_calls"] <= MAX_LLM_CALLS


# ---------------------------------------------------------------------------
# Checkpointing
# ---------------------------------------------------------------------------

async def test_resume_from_checkpoint_after_a_node_failure(fake):
    llm = fake({"teach": ["Recovered answer."]}, fail_teach_times=1)
    loads = []

    async def loader(_s):
        loads.append(1)
        return {"history": [], "board": [], "sources": []}

    graph = build_graph(MemorySaver())
    emitter = RecordingEmitter()
    cfg = {"configurable": {"thread_id": "resume", "emitter": emitter, "context_loader": loader}}
    state = initial_state(session_id="s", turn_id="t1", user_message="What is a qubit?")
    with pytest.raises(RuntimeError):
        await graph.ainvoke(state, cfg)
    assert (await graph.aget_state(cfg)).next == ("teacher",)

    result = await graph.ainvoke(None, cfg)  # resume: load_context/orchestrate are not re-run
    assert result["final_message"] == "Recovered answer."
    assert len(loads) == 1


async def test_same_thread_second_turn_resets_per_turn_state(fake):
    fake({"teach": ["x"], "circuit": [GOOD_CIRCUIT]})
    graph = build_graph(MemorySaver())
    r1, e1 = await run(graph, "Draw a Bell state circuit", thread="same")
    assert "draw_quantum_circuit" in e1.names
    r2, e2 = await run(graph, "What is a qubit?", thread="same")
    assert r2["circuit_action"] is None and r2["circuit_draft"] is None and r2["retries"] == 0
    assert e2.names == ["step_started", "step_completed"]


# ---------------------------------------------------------------------------
# Context assembly limits
# ---------------------------------------------------------------------------

def _msgs(n, size=3000):
    return [{"role": "user" if i % 2 == 0 else "assistant", "content": "w" * size} for i in range(n)]


def test_context_is_bounded():
    ctx = assemble_context(
        messages=_msgs(50),
        summary=None,
        board_state=None,
        sources=[{"title": "T" * 500, "content": "c" * 5000}] * 10,
        mastery=["m"] * 10,
    )
    assert len(ctx["history"]) <= CONTEXT_HISTORY_MESSAGES
    assert all(len(m["content"]) <= 1200 for m in ctx["history"])
    assert len(ctx["sources"]) <= 3 and len(ctx["mastery"]) <= 3
    assert context_size(ctx) <= CONTEXT_TOTAL_CHARS


def test_summary_shrinks_history_window():
    ctx = assemble_context(messages=_msgs(20, 50), summary="s" * 5000, board_state=None)
    assert len(ctx["history"]) == CONTEXT_HISTORY_WITH_SUMMARY
    assert len(ctx["summary"]) <= 1500


def test_context_describes_board_objects():
    board = {"order": ["c1", "e1"], "objects": {
        "c1": {"kind": "circuit", "qubits": 2, "gates": [{"type": "H"}, {"type": "CX"}]},
        "e1": {"kind": "equation", "latex": "x^2"}}}
    ctx = assemble_context(messages=[], summary=None, board_state=board)
    assert [b["id"] for b in ctx["board"]] == ["c1", "e1"]
    assert "H CX" in ctx["board"][0]["brief"]


def test_build_summary_is_bounded_and_deterministic():
    s = build_summary(_msgs(100, 500), limit=600)
    assert len(s) < 700 and s == build_summary(_msgs(100, 500), limit=600)
    assert build_summary([{"role": "assistant", "content": "x"}]) == ""
