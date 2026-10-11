"""Whiteboard action schema + apply_event reducer. Pure, no I/O."""
import copy

import pytest
from pydantic import ValidationError

from app.schemas.whiteboard import (
    GATE_CATALOG,
    apply_event,
    action_payload,
    empty_board,
    parse_action,
    replay,
)


def circuit(**over):
    base = {
        "action": "draw_quantum_circuit",
        "object_id": "c1",
        "qubits": 2,
        "gates": [{"type": "H", "targets": [0]}, {"type": "CX", "control": 0, "targets": [1]}],
    }
    base.update(over)
    return base


def ev(payload, step_id="s1"):
    return {"payload": payload, "step_id": step_id}


# ---------------------------------------------------------------------------
# Accept
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "payload",
    [
        {"action": "step_started", "title": "Superposition"},
        circuit(),
        circuit(gates=[{"type": "RX", "targets": [0], "params": {"theta": 1.57}}]),
        circuit(gates=[{"type": "U3", "targets": [1], "params": {"theta": 1, "phi": 2, "lambda": 3}}]),
        circuit(gates=[{"type": "SWAP", "targets": [0, 1]}, {"type": "M", "targets": [0]}]),
        {"action": "render_equation", "object_id": "e1", "latex": r"|\psi\rangle = \frac{1}{\sqrt{2}}(|0\rangle+|1\rangle)"},
        {"action": "draw_annotation", "object_id": "n1", "text": "Hadamard makes a superposition", "target_id": "c1"},
        {"action": "highlight_object", "object_id": "c1"},
        {"action": "clear_annotation", "object_id": "n1"},
        {"action": "step_completed"},
        {"action": "tutor_error", "message": "Could not draw that"},
    ],
)
def test_valid_actions_parse(payload):
    assert parse_action(payload) is not None


def test_every_catalog_gate_with_right_arity_is_accepted():
    shapes = {
        **{g: {"targets": [0]} for g in "H X Y Z S T I RX RY RZ U P SX U3".split()},
        "CX": {"control": 0, "targets": [1]},
        "CZ": {"control": 1, "targets": [0]},
        **{g: {"targets": [0, 1]} for g in ("SWAP", "RXX", "RYY", "RZZ")},
        "M": {"targets": [0]},
    }
    assert set(shapes) == set(GATE_CATALOG)
    for g, shape in shapes.items():
        parse_action(circuit(gates=[{"type": g, **shape}]))


def test_wire_payload_drops_unset_params_and_keeps_lambda_alias():
    a = parse_action(circuit(gates=[{"type": "U", "targets": [0], "params": {"theta": 1, "lambda": 2}}, {"type": "H", "targets": [1]}]))
    out = action_payload(a)
    assert out["gates"][0]["params"] == {"theta": 1.0, "lambda": 2.0}
    assert "params" not in out["gates"][1]
    assert "control" not in out["gates"][1]


# ---------------------------------------------------------------------------
# Reject
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "payload,why",
    [
        (circuit(gates=[{"type": "H", "targets": [2]}]), "target out of range"),
        (circuit(gates=[{"type": "CX", "control": 5, "targets": [0]}]), "control out of range"),
        (circuit(gates=[{"type": "H", "targets": [-1]}]), "negative qubit"),
        (circuit(gates=[{"type": "FOO", "targets": [0]}]), "unknown gate"),
        (circuit(gates=[{"type": "CCX", "targets": [0]}]), "gate not in frontend catalog"),
        (circuit(gates=[{"type": "CX", "targets": [1]}]), "CX without control"),
        (circuit(gates=[{"type": "CX", "control": 0, "targets": [0]}]), "control == target"),
        (circuit(gates=[{"type": "H", "targets": [0], "control": 1}]), "control on 1q gate"),
        (circuit(gates=[{"type": "SWAP", "targets": [0]}]), "swap arity"),
        (circuit(qubits=9), "too many qubits"),
        (circuit(qubits=0), "no qubits"),
        (circuit(gates=[{"type": "H", "targets": [0]}] * 65, qubits=1), "too many gates"),
        (circuit(gates=[{"type": "RX", "targets": [0], "params": {"theta": 1e9}}]), "huge angle"),
        (circuit(gates=[{"type": "RX", "targets": [0], "params": {"alpha": 1}}]), "unknown param"),
        (circuit(object_id="bad id!"), "bad object id"),
        (circuit(extra="x"), "extra field"),
        ({"action": "render_equation", "object_id": "e", "latex": "<script>alert(1)</script>"}, "html in latex"),
        ({"action": "render_equation", "object_id": "e", "latex": r"\href{http://x.io}{click}"}, "href"),
        ({"action": "render_equation", "object_id": "e", "latex": "see https://evil.example"}, "url"),
        ({"action": "render_equation", "object_id": "e", "latex": "x" * 501}, "too long"),
        ({"action": "render_equation", "object_id": "e", "latex": "a &amp; b"}, "entity"),
        ({"action": "draw_annotation", "object_id": "n", "text": "<b>hi</b>"}, "html in annotation"),
        ({"action": "draw_annotation", "object_id": "n", "text": "see www.evil.com"}, "url in annotation"),
        ({"action": "draw_annotation", "object_id": "n", "text": "y" * 201}, "annotation too long"),
        ({"action": "step_started", "title": "<img src=x>"}, "html in title"),
        ({"action": "explode"}, "unknown action"),
        ({"action": "tutor_error", "message": "javascript:alert(1)"}, "url scheme"),
    ],
)
def test_invalid_actions_rejected(payload, why):
    with pytest.raises(ValidationError):
        parse_action(payload)


def test_latex_with_comparison_is_allowed():
    parse_action({"action": "render_equation", "object_id": "e", "latex": r"a < b \quad c > d"})


# ---------------------------------------------------------------------------
# apply_event
# ---------------------------------------------------------------------------

def test_apply_event_does_not_mutate_input():
    board = empty_board()
    before = copy.deepcopy(board)
    apply_event(board, ev(circuit()))
    assert board == before


def test_apply_event_semantics():
    b = apply_event(None, ev({"action": "step_started", "title": "t"}, "step-1"))
    assert b["active_step"] == "step-1" and b["version"] == 1
    b = apply_event(b, ev(circuit()))
    assert b["order"] == ["c1"] and b["objects"]["c1"]["kind"] == "circuit" and b["objects"]["c1"]["qubits"] == 2
    b = apply_event(b, ev({"action": "render_equation", "object_id": "e1", "latex": "x"}))
    b = apply_event(b, ev({"action": "draw_annotation", "object_id": "n1", "text": "hi", "target_id": "c1"}))
    assert b["order"] == ["c1", "e1", "n1"]
    assert b["objects"]["n1"] == {"kind": "annotation", "text": "hi", "target_id": "c1"}
    b = apply_event(b, ev({"action": "highlight_object", "object_id": "c1"}))
    b = apply_event(b, ev({"action": "highlight_object", "object_id": "c1"}))  # dedupe
    b = apply_event(b, ev({"action": "highlight_object", "object_id": "ghost"}))  # unknown: ignored
    assert b["highlights"] == ["c1"]
    b = apply_event(b, ev({"action": "clear_annotation", "object_id": "n1"}))
    assert "n1" not in b["objects"] and b["order"] == ["c1", "e1"]
    b = apply_event(b, ev({"action": "clear_annotation", "object_id": "c1"}))  # not an annotation: kept
    assert "c1" in b["objects"] and b["highlights"] == []
    b = apply_event(b, ev({"action": "tutor_error", "message": "oops"}))
    b = apply_event(b, ev({"action": "step_completed"}))
    assert b["active_step"] is None
    assert b["version"] == 11  # one per applied event


def test_redrawing_same_id_replaces_in_place():
    b = apply_event(None, ev(circuit()))
    b = apply_event(b, ev(circuit(qubits=3)))
    assert b["order"] == ["c1"] and b["objects"]["c1"]["qubits"] == 3


def test_snapshot_plus_tail_equals_full_replay():
    events = [
        ev({"action": "step_started", "title": "t"}, "s"),
        ev(circuit()),
        ev({"action": "render_equation", "object_id": "e1", "latex": "x"}),
        ev({"action": "highlight_object", "object_id": "c1"}),
        ev({"action": "draw_annotation", "object_id": "n1", "text": "n"}),
        ev({"action": "clear_annotation", "object_id": "n1"}),
        ev({"action": "step_completed"}),
    ]
    full = replay(None, events)
    for cut in range(len(events) + 1):
        snap = replay(None, events[:cut])
        assert replay(snap, events[cut:]) == full
