"""Whiteboard action schema (version 1) and the pure board reducer.

Everything an agent puts on the whiteboard is a `WhiteboardAction`: a discriminated
union on `action`. Models are strict (`extra="forbid"`) with size caps, a closed
gate catalog, qubit-range checks and no HTML/URLs in any text field, so a
confused or prompt-injected model cannot push markup or oversized payloads to
students. The frontend mirrors `apply_event` in `src/lib/whiteboard.ts`.

Board state (JSON):
    {version, active_step, order: [object_id], objects: {id: {kind, ...}},
     highlights: [object_id]}

`apply_event` semantics (the frontend must match exactly):
- Every applied event increments `version` by 1 (even a no-op such as tutor_error).
- step_started   -> active_step = event.step_id
- step_completed -> active_step = None
- draw_quantum_circuit / render_equation / draw_annotation -> objects[id] is set
  (replacing any object with that id); id appended to `order` if new.
- highlight_object -> object_id appended to `highlights` if the object exists and
  is not already highlighted.
- clear_annotation -> object_id removed from `highlights`; if the object is an
  annotation it is also removed from `objects` and `order`.
- tutor_error -> no board change.
"""
from __future__ import annotations

import copy
import re
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator, model_validator

SCHEMA_VERSION = 1

MAX_QUBITS = 8
MAX_GATES = 64
MAX_LATEX_CHARS = 500
MAX_ANNOTATION_CHARS = 200
MAX_TITLE_CHARS = 120
MAX_ERROR_CHARS = 300
MAX_PARAM_ABS = 1000.0

# Frontend gate catalog (frontend/src/lib/gates.ts). Anything else is rejected.
SINGLE_QUBIT_GATES = frozenset({"H", "X", "Y", "Z", "S", "T", "I", "RX", "RY", "RZ", "U", "P", "SX", "U3"})
CONTROLLED_GATES = frozenset({"CX", "CZ"})  # control + one target
TWO_QUBIT_GATES = frozenset({"SWAP", "RXX", "RYY", "RZZ"})  # two targets, no control
MEASURE_GATE = "M"
GATE_CATALOG = SINGLE_QUBIT_GATES | CONTROLLED_GATES | TWO_QUBIT_GATES | {MEASURE_GATE}
PARAM_KEYS = frozenset({"theta", "phi", "lambda"})

_OBJECT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_HTML_TAG_RE = re.compile(r"</?[A-Za-z!?]")  # "a < b" is fine, "<b>" / "</p>" / "<!--" are not
_HTML_ENTITY_RE = re.compile(r"&#?\w+;")
_URL_RE = re.compile(r"(?:https?|ftp|file|data|javascript|vbscript)\s*:|www\.|//\w+\.\w+", re.IGNORECASE)
_LATEX_FORBIDDEN_RE = re.compile(
    r"\\(?:href|url|includegraphics|html\w*|style|class|input|include|write|def|edef|gdef|newcommand|"
    r"renewcommand|catcode|csname|immediate|openin|openout|read)\b|\$",
    re.IGNORECASE,
)
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _plain_text(value: str, label: str) -> str:
    if _CONTROL_CHARS_RE.search(value):
        raise ValueError(f"{label} contains control characters")
    if _HTML_TAG_RE.search(value) or _HTML_ENTITY_RE.search(value):
        raise ValueError(f"{label} must not contain HTML")
    if _URL_RE.search(value):
        raise ValueError(f"{label} must not contain URLs")
    return value.strip()


def _object_id(value: str) -> str:
    if not _OBJECT_ID_RE.match(value):
        raise ValueError("object id must be 1-64 chars of letters, digits, '_' or '-'")
    return value


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _HasObjectId(_Strict):
    object_id: str

    @field_validator("object_id")
    @classmethod
    def _valid_object_id(cls, v: str) -> str:
        return _object_id(v)


class GateParams(_Strict):
    theta: float | None = None
    phi: float | None = None
    lambda_: float | None = Field(default=None, alias="lambda")

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    @field_validator("theta", "phi", "lambda_")
    @classmethod
    def _finite(cls, v: float | None) -> float | None:
        if v is not None and not (-MAX_PARAM_ABS <= v <= MAX_PARAM_ABS):
            raise ValueError("gate parameter out of range")
        return v

    def to_dict(self) -> dict[str, float]:
        return self.model_dump(by_alias=True, exclude_none=True)


class WhiteboardGate(_Strict):
    type: str
    targets: list[int] = Field(min_length=1, max_length=8)
    control: int | None = None
    params: GateParams | None = None

    @field_validator("type")
    @classmethod
    def _known_gate(cls, v: str) -> str:
        if v not in GATE_CATALOG:
            raise ValueError(f"unknown gate type {v!r}")
        return v

    @model_validator(mode="after")
    def _arity(self) -> "WhiteboardGate":
        t = self.type
        if t in SINGLE_QUBIT_GATES:
            if len(self.targets) != 1 or self.control is not None:
                raise ValueError(f"{t} takes exactly one target and no control")
        elif t in CONTROLLED_GATES:
            if len(self.targets) != 1 or self.control is None:
                raise ValueError(f"{t} takes one control and one target")
            if self.control == self.targets[0]:
                raise ValueError(f"{t} control and target must differ")
        elif t in TWO_QUBIT_GATES:
            if len(self.targets) != 2 or self.control is not None or self.targets[0] == self.targets[1]:
                raise ValueError(f"{t} takes two distinct targets and no control")
        if len(set(self.targets)) != len(self.targets):
            raise ValueError("duplicate targets")
        return self


class StepStarted(_Strict):
    action: Literal["step_started"]
    title: str = Field(min_length=1, max_length=MAX_TITLE_CHARS)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        return _plain_text(v, "title")


class DrawQuantumCircuit(_HasObjectId):
    action: Literal["draw_quantum_circuit"]
    qubits: int = Field(ge=1, le=MAX_QUBITS)
    gates: list[WhiteboardGate] = Field(max_length=MAX_GATES)

    @model_validator(mode="after")
    def _qubit_range(self) -> "DrawQuantumCircuit":
        for g in self.gates:
            indices = list(g.targets) + ([g.control] if g.control is not None else [])
            for q in indices:
                if q < 0 or q >= self.qubits:
                    raise ValueError(f"qubit index {q} out of range for {self.qubits} qubits")
        return self


class RenderEquation(_HasObjectId):
    action: Literal["render_equation"]
    latex: str = Field(min_length=1, max_length=MAX_LATEX_CHARS)

    @field_validator("latex")
    @classmethod
    def _latex(cls, v: str) -> str:
        v = _plain_text(v, "latex")
        if not v:
            raise ValueError("latex is empty")
        if _LATEX_FORBIDDEN_RE.search(v):
            raise ValueError("latex uses a forbidden command or $ delimiter")
        return v


class DrawAnnotation(_HasObjectId):
    action: Literal["draw_annotation"]
    text: str = Field(min_length=1, max_length=MAX_ANNOTATION_CHARS)
    target_id: str | None = None

    @field_validator("target_id")
    @classmethod
    def _target(cls, v: str | None) -> str | None:
        return None if v is None else _object_id(v)

    @field_validator("text")
    @classmethod
    def _text(cls, v: str) -> str:
        v = _plain_text(v, "text")
        if not v:
            raise ValueError("text is empty")
        return v


class HighlightObject(_HasObjectId):
    action: Literal["highlight_object"]


class ClearAnnotation(_HasObjectId):
    action: Literal["clear_annotation"]


class StepCompleted(_Strict):
    action: Literal["step_completed"]


class TutorError(_Strict):
    action: Literal["tutor_error"]
    message: str = Field(min_length=1, max_length=MAX_ERROR_CHARS)

    @field_validator("message")
    @classmethod
    def _message(cls, v: str) -> str:
        return _plain_text(v, "message")


WhiteboardAction = Annotated[
    Union[
        StepStarted,
        DrawQuantumCircuit,
        RenderEquation,
        DrawAnnotation,
        HighlightObject,
        ClearAnnotation,
        StepCompleted,
        TutorError,
    ],
    Field(discriminator="action"),
]

_action_adapter: TypeAdapter = TypeAdapter(WhiteboardAction)


def parse_action(payload: dict[str, Any]) -> BaseModel:
    """Validate an action payload; raises pydantic.ValidationError when invalid."""
    return _action_adapter.validate_python(payload)


def action_payload(action: BaseModel) -> dict[str, Any]:
    """The wire form of a validated action (aliases applied, unset params dropped)."""
    data = action.model_dump(by_alias=True, exclude_none=True)
    if data.get("action") == "draw_quantum_circuit":
        for g in data["gates"]:
            if not g.get("params"):
                g.pop("params", None)
    return data


# ---------------------------------------------------------------------------
# Board state
# ---------------------------------------------------------------------------

def empty_board() -> dict[str, Any]:
    return {"version": 0, "active_step": None, "order": [], "objects": {}, "highlights": []}


def apply_event(board_state: dict[str, Any] | None, event: dict[str, Any]) -> dict[str, Any]:
    """Pure reducer: return a new board state with `event` applied.

    `event` is an envelope-shaped dict: it needs `payload` (with `action`) and may
    carry `step_id`. The input is never mutated. See the module docstring for the
    exact semantics.
    """
    board = copy.deepcopy(board_state) if board_state else empty_board()
    payload = event.get("payload") or {}
    action = payload.get("action")
    objects: dict[str, Any] = board["objects"]
    order: list[str] = board["order"]

    def put(obj_id: str, obj: dict[str, Any]) -> None:
        if obj_id not in objects:
            order.append(obj_id)
        objects[obj_id] = obj

    if action == "step_started":
        board["active_step"] = event.get("step_id")
    elif action == "step_completed":
        board["active_step"] = None
    elif action == "draw_quantum_circuit":
        put(payload["object_id"], {"kind": "circuit", "qubits": payload["qubits"], "gates": payload["gates"]})
    elif action == "render_equation":
        put(payload["object_id"], {"kind": "equation", "latex": payload["latex"]})
    elif action == "draw_annotation":
        put(
            payload["object_id"],
            {"kind": "annotation", "text": payload["text"], "target_id": payload.get("target_id")},
        )
    elif action == "highlight_object":
        oid = payload["object_id"]
        if oid in objects and oid not in board["highlights"]:
            board["highlights"].append(oid)
    elif action == "clear_annotation":
        oid = payload["object_id"]
        if oid in board["highlights"]:
            board["highlights"].remove(oid)
        if oid in objects and objects[oid].get("kind") == "annotation":
            del objects[oid]
            if oid in order:
                order.remove(oid)
    # tutor_error and unknown actions: no board change.

    board["version"] = int(board.get("version", 0)) + 1
    return board


def replay(board_state: dict[str, Any] | None, events: list[dict[str, Any]]) -> dict[str, Any]:
    """Fold `events` over `board_state` (snapshot + tail == full replay)."""
    board = board_state if board_state else empty_board()
    for ev in events:
        board = apply_event(board, ev)
    return board
