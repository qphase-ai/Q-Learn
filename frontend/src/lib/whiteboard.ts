import { GATES, isGateType } from "@/lib/gates";
import type {
  BoardObject,
  BoardState,
  ClassroomEvent,
  WhiteboardAction,
  WhiteboardGate,
} from "@/types/classroom";

// ---------------------------------------------------------------------------
// Runtime validation (hand-written; no schema dependency) + the pure board
// reducer. Mirrors backend/app/schemas/whiteboard.py — keep limits in sync.
// ---------------------------------------------------------------------------

export const MAX_QUBITS = 8;
export const MAX_GATES = 64;
export const MAX_LATEX = 500;
export const MAX_ANNOTATION = 200;
export const MAX_TITLE = 200;
const MAX_ID = 64;

const OBJECT_ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const HTML_RE = /<\s*\/?\s*[a-zA-Z!?]|&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/;
const URL_RE = /(?:[a-zA-Z][a-zA-Z0-9+.-]*:\/\/|\bwww\.|\bjavascript:|\bdata:|\bmailto:)/i;
const LATEX_FORBIDDEN_RE = /\\(?:href|url|includegraphics|input|include|write|def|newcommand|html[A-Za-z]*)\b|\$/;

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isObjectId(v: unknown): v is string {
  return typeof v === "string" && OBJECT_ID_RE.test(v);
}

function isQubit(v: unknown, qubits: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < qubits;
}

/** Plain text only: bounded, no markup, no URLs, no control characters. */
export function validatePlainText(v: unknown, max: number, field = "text"): Validation<string> {
  if (typeof v !== "string") return fail(`${field} must be a string`);
  const text = v.trim();
  if (!text) return fail(`${field} must not be empty`);
  if (text.length > max) return fail(`${field} exceeds ${max} characters`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return fail(`${field} has control characters`);
  if (HTML_RE.test(text)) return fail(`${field} must not contain markup`);
  if (URL_RE.test(text)) return fail(`${field} must not contain URLs`);
  return { ok: true, value: text };
}

function validateLatex(v: unknown): Validation<string> {
  if (typeof v !== "string") return fail("latex must be a string");
  const latex = v.trim();
  if (!latex) return fail("latex must not be empty");
  if (latex.length > MAX_LATEX) return fail(`latex exceeds ${MAX_LATEX} characters`);
  if (HTML_RE.test(latex)) return fail("latex must not contain markup");
  if (URL_RE.test(latex) || LATEX_FORBIDDEN_RE.test(latex)) return fail("latex contains a forbidden command");
  return { ok: true, value: latex };
}

function validateGate(raw: unknown, qubits: number): Validation<WhiteboardGate> {
  if (!isRecord(raw)) return fail("gate must be an object");
  const { type, targets, control, params } = raw;
  if (!isGateType(type)) return fail(`unknown gate "${String(type)}"`);
  if (!Array.isArray(targets) || targets.length === 0 || targets.length > qubits) {
    return fail("gate targets must be a non-empty array");
  }
  if (!targets.every((t) => isQubit(t, qubits))) return fail("gate target out of range");
  if (new Set(targets).size !== targets.length) return fail("gate targets must be distinct");
  const gate: WhiteboardGate = { type, targets: targets as number[] };
  if (control !== undefined && control !== null) {
    if (!isQubit(control, qubits)) return fail("gate control out of range");
    if ((targets as number[]).includes(control)) return fail("gate control equals a target");
    gate.control = control;
  }
  if (GATES[type].arity === 2 && gate.control === undefined && targets.length < 2) {
    return fail(`${type} needs a control or two targets`);
  }
  if (params !== undefined && params !== null) {
    if (!isRecord(params)) return fail("gate params must be an object");
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(params)) {
      if (k !== "theta" && k !== "phi" && k !== "lambda") return fail(`unknown param "${k}"`);
      if (typeof val !== "number" || !Number.isFinite(val)) return fail(`param ${k} must be a finite number`);
      out[k] = val;
    }
    gate.params = out;
  }
  return { ok: true, value: gate };
}

export function validateWhiteboardAction(raw: unknown): Validation<WhiteboardAction> {
  if (!isRecord(raw)) return fail("payload must be an object");
  switch (raw.action) {
    case "step_started": {
      const title = validatePlainText(raw.title, MAX_TITLE, "title");
      return title.ok ? { ok: true, value: { action: "step_started", title: title.value } } : title;
    }
    case "draw_quantum_circuit": {
      if (!isObjectId(raw.object_id)) return fail("invalid object_id");
      const q = raw.qubits;
      if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_QUBITS) {
        return fail(`qubits must be an integer 1-${MAX_QUBITS}`);
      }
      if (!Array.isArray(raw.gates) || raw.gates.length > MAX_GATES) return fail(`gates must be an array of at most ${MAX_GATES}`);
      const gates: WhiteboardGate[] = [];
      for (const g of raw.gates) {
        const r = validateGate(g, q);
        if (!r.ok) return r;
        gates.push(r.value);
      }
      return { ok: true, value: { action: "draw_quantum_circuit", object_id: raw.object_id, qubits: q, gates } };
    }
    case "render_equation": {
      if (!isObjectId(raw.object_id)) return fail("invalid object_id");
      const latex = validateLatex(raw.latex);
      return latex.ok
        ? { ok: true, value: { action: "render_equation", object_id: raw.object_id, latex: latex.value } }
        : latex;
    }
    case "draw_annotation": {
      if (!isObjectId(raw.object_id)) return fail("invalid object_id");
      const text = validatePlainText(raw.text, MAX_ANNOTATION);
      if (!text.ok) return text;
      const value: WhiteboardAction = { action: "draw_annotation", object_id: raw.object_id, text: text.value };
      if (raw.target_id !== undefined && raw.target_id !== null) {
        if (!isObjectId(raw.target_id)) return fail("invalid target_id");
        value.target_id = raw.target_id;
      }
      return { ok: true, value };
    }
    case "highlight_object":
    case "clear_annotation":
      return isObjectId(raw.object_id)
        ? { ok: true, value: { action: raw.action, object_id: raw.object_id } }
        : fail("invalid object_id");
    case "step_completed":
      return { ok: true, value: { action: "step_completed" } };
    case "tutor_error": {
      const message = validatePlainText(raw.message, MAX_ANNOTATION, "message");
      return message.ok ? { ok: true, value: { action: "tutor_error", message: message.value } } : message;
    }
    default:
      return fail(`unknown action "${String(raw.action)}"`);
  }
}

/** Structural check of the envelope; the payload is validated per type elsewhere. */
export function parseClassroomEvent(raw: unknown): ClassroomEvent | null {
  if (!isRecord(raw)) return null;
  const { schema_version, event_id, session_id, turn_id, sequence_no, type, step_id, payload } = raw;
  if (schema_version !== 1) return null;
  if (typeof event_id !== "string" || !event_id || event_id.length > MAX_ID * 2) return null;
  if (typeof session_id !== "string" || typeof turn_id !== "string" || typeof type !== "string") return null;
  if (sequence_no !== null && sequence_no !== undefined) {
    if (typeof sequence_no !== "number" || !Number.isInteger(sequence_no) || sequence_no < 0) return null;
  }
  if (step_id !== null && step_id !== undefined && typeof step_id !== "string") return null;
  if (!isRecord(payload)) return null;
  return {
    schema_version: 1,
    event_id,
    session_id,
    turn_id,
    sequence_no: (sequence_no as number | null | undefined) ?? null,
    type,
    step_id: (step_id as string | null | undefined) ?? null,
    payload,
  };
}

export function emptyBoard(): BoardState {
  return { version: 0, active_step: null, order: [], objects: {}, highlights: [] };
}

/** Defensive re-hydration of a server snapshot; returns null when malformed. */
export function parseBoardState(raw: unknown): BoardState | null {
  if (!isRecord(raw) || !isRecord(raw.objects) || !Array.isArray(raw.order)) return null;
  const objects: Record<string, BoardObject> = {};
  for (const [id, obj] of Object.entries(raw.objects)) {
    if (!isObjectId(id) || !isRecord(obj)) continue;
    let r: Validation<WhiteboardAction> | null = null;
    if (obj.kind === "circuit") r = validateWhiteboardAction({ ...obj, action: "draw_quantum_circuit", object_id: id });
    else if (obj.kind === "equation") r = validateWhiteboardAction({ ...obj, action: "render_equation", object_id: id });
    else if (obj.kind === "annotation") r = validateWhiteboardAction({ ...obj, action: "draw_annotation", object_id: id });
    if (!r || !r.ok) continue;
    objects[id] = toObject(r.value, typeof obj.step_id === "string" ? obj.step_id : null) as BoardObject;
  }
  const order = raw.order.filter((id): id is string => typeof id === "string" && id in objects);
  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights.filter((id): id is string => typeof id === "string" && id in objects)
    : [];
  return {
    version: typeof raw.version === "number" ? raw.version : 0,
    active_step: typeof raw.active_step === "string" ? raw.active_step : null,
    order,
    objects,
    highlights,
  };
}

function toObject(a: WhiteboardAction, stepId: string | null): BoardObject | null {
  switch (a.action) {
    case "draw_quantum_circuit":
      return { kind: "circuit", qubits: a.qubits, gates: a.gates, step_id: stepId };
    case "render_equation":
      return { kind: "equation", latex: a.latex, step_id: stepId };
    case "draw_annotation":
      return { kind: "annotation", text: a.text, ...(a.target_id ? { target_id: a.target_id } : {}), step_id: stepId };
    default:
      return null;
  }
}

/**
 * Pure reducer: apply one durable `whiteboard.action` event. Invalid or
 * non-board events return the SAME board reference (no change). Every applied
 * action bumps `version` by one.
 */
export function applyEvent(board: BoardState, event: ClassroomEvent): BoardState {
  if (event.type !== "whiteboard.action") return board;
  const parsed = validateWhiteboardAction(event.payload);
  if (!parsed.ok) return board;
  const a = parsed.value;
  const version = board.version + 1;

  switch (a.action) {
    case "step_started":
      return { ...board, version, active_step: event.step_id };
    case "step_completed":
      return { ...board, version, active_step: null };
    case "draw_quantum_circuit":
    case "render_equation":
    case "draw_annotation": {
      const obj = toObject(a, event.step_id) as BoardObject;
      const id = a.object_id;
      return {
        ...board,
        version,
        order: id in board.objects ? board.order : [...board.order, id],
        objects: { ...board.objects, [id]: obj },
      };
    }
    case "highlight_object":
      if (!(a.object_id in board.objects) || board.highlights.includes(a.object_id)) return { ...board, version };
      return { ...board, version, highlights: [...board.highlights, a.object_id] };
    case "clear_annotation": {
      const id = a.object_id;
      const highlights = board.highlights.filter((h) => h !== id);
      const target = board.objects[id];
      if (!target || target.kind !== "annotation") return { ...board, version, highlights };
      const { [id]: _removed, ...objects } = board.objects;
      void _removed;
      return { ...board, version, objects, highlights, order: board.order.filter((o) => o !== id) };
    }
    case "tutor_error":
      return { ...board, version };
  }
}
