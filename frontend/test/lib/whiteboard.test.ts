import { describe, it, expect } from "vitest";
import { applyEvent, emptyBoard, parseClassroomEvent, validateWhiteboardAction } from "@/lib/whiteboard";
import type { ClassroomEvent } from "@/types/classroom";

const ev = (payload: Record<string, unknown>, extra: Partial<ClassroomEvent> = {}): ClassroomEvent => ({
  schema_version: 1, event_id: crypto.randomUUID(), session_id: "s", turn_id: "t",
  sequence_no: 1, type: "whiteboard.action", step_id: "step-1", payload, ...extra,
});

describe("validateWhiteboardAction", () => {
  const circuit = { action: "draw_quantum_circuit", object_id: "c1", qubits: 2, gates: [{ type: "H", targets: [0] }, { type: "CX", targets: [1], control: 0 }] };
  it("accepts a valid circuit", () => expect(validateWhiteboardAction(circuit).ok).toBe(true));
  it.each([
    ["unknown action", { action: "run_code", code: "x" }],
    ["qubit index out of range", { ...circuit, gates: [{ type: "H", targets: [2] }] }],
    ["negative control", { ...circuit, gates: [{ type: "CX", targets: [1], control: -1 }] }],
    ["unknown gate", { ...circuit, gates: [{ type: "FOO", targets: [0] }] }],
    ["too many qubits", { ...circuit, qubits: 9 }],
    ["too many gates", { ...circuit, gates: Array.from({ length: 65 }, () => ({ type: "H", targets: [0] })) }],
    ["bad object id", { ...circuit, object_id: "a b<script>" }],
    ["non-finite param", { ...circuit, gates: [{ type: "RX", targets: [0], params: { theta: Infinity } }] }],
    ["html in annotation", { action: "draw_annotation", object_id: "a", text: "<img src=x onerror=alert(1)>" }],
    ["url in annotation", { action: "draw_annotation", object_id: "a", text: "see https://evil.example" }],
    ["long annotation", { action: "draw_annotation", object_id: "a", text: "x".repeat(201) }],
    ["long latex", { action: "render_equation", object_id: "e", latex: "x".repeat(501) }],
    ["href in latex", { action: "render_equation", object_id: "e", latex: "\\href{http://x}{y}" }],
    ["html in title", { action: "step_started", title: "<b>hi</b>" }],
  ])("rejects %s", (_n, payload) => expect(validateWhiteboardAction(payload).ok).toBe(false));

  it("accepts a plain equation", () =>
    expect(validateWhiteboardAction({ action: "render_equation", object_id: "e", latex: "|+\\rangle=\\tfrac{|0\\rangle+|1\\rangle}{\\sqrt2}" }).ok).toBe(true));
});

describe("parseClassroomEvent", () => {
  it("rejects wrong schema version and bad shapes", () => {
    expect(parseClassroomEvent({ ...ev({}), schema_version: 2 })).toBeNull();
    expect(parseClassroomEvent(null)).toBeNull();
    expect(parseClassroomEvent({ ...ev({}), payload: "x" })).toBeNull();
    expect(parseClassroomEvent(ev({}))).not.toBeNull();
  });
});

describe("applyEvent", () => {
  it("builds board state and is pure", () => {
    const b0 = emptyBoard();
    const b1 = applyEvent(b0, ev({ action: "draw_quantum_circuit", object_id: "c1", qubits: 1, gates: [{ type: "H", targets: [0] }] }));
    const b2 = applyEvent(b1, ev({ action: "render_equation", object_id: "e1", latex: "H|0\\rangle" }));
    const b3 = applyEvent(b2, ev({ action: "highlight_object", object_id: "c1" }));
    const b4 = applyEvent(b3, ev({ action: "draw_annotation", object_id: "a1", text: "Superposition" }));
    const b5 = applyEvent(b4, ev({ action: "clear_annotation", object_id: "a1" }));
    expect(b0).toEqual(emptyBoard());
    expect(b3.order).toEqual(["c1", "e1"]);
    expect(b3.highlights).toEqual(["c1"]);
    expect(b4.order).toEqual(["c1", "e1", "a1"]);
    expect(b5.order).toEqual(["c1", "e1"]);
    expect(b5.version).toBe(5);
  });
  it("returns the same board for invalid payloads and other event types", () => {
    const b = emptyBoard();
    expect(applyEvent(b, ev({ action: "nope" }))).toBe(b);
    expect(applyEvent(b, ev({ text: "hi" }, { type: "message.delta" }))).toBe(b);
  });
  it("tracks the active step", () => {
    const b1 = applyEvent(emptyBoard(), ev({ action: "step_started", title: "Intro" }));
    expect(b1.active_step).toBe("step-1");
    expect(applyEvent(b1, ev({ action: "step_completed" })).active_step).toBeNull();
  });
});
