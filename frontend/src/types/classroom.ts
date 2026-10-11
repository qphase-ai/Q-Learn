import type { GateParams, GateType } from "@/types";

/** Realtime broadcast event name; the channel is `classroom:{session_id}`. */
export const CLASSROOM_EVENT = "classroom";
export const CLASSROOM_SCHEMA_VERSION = 1;

export type ClassroomEventType =
  | "agent.status"
  | "message.delta"
  | "message.completed"
  | "whiteboard.action"
  | "classroom.error";

/** Wire envelope shared with the backend (`schema_version` 1). */
export interface ClassroomEvent {
  schema_version: number;
  event_id: string;
  session_id: string;
  turn_id: string;
  /** Present on durable events only; null for `message.delta` / `agent.status`. */
  sequence_no: number | null;
  type: ClassroomEventType | (string & {});
  step_id: string | null;
  payload: Record<string, unknown>;
}

export interface WhiteboardGate {
  type: GateType;
  targets: number[];
  control?: number;
  params?: GateParams;
}

export type WhiteboardAction =
  | { action: "step_started"; title: string }
  | { action: "draw_quantum_circuit"; object_id: string; qubits: number; gates: WhiteboardGate[] }
  | { action: "render_equation"; object_id: string; latex: string }
  | { action: "draw_annotation"; object_id: string; text: string; target_id?: string }
  | { action: "highlight_object"; object_id: string }
  | { action: "clear_annotation"; object_id: string }
  | { action: "step_completed" }
  | { action: "tutor_error"; message: string };

export type WhiteboardActionName = WhiteboardAction["action"];

export interface CircuitObject {
  kind: "circuit";
  qubits: number;
  gates: WhiteboardGate[];
  step_id?: string | null;
}
export interface EquationObject {
  kind: "equation";
  latex: string;
  step_id?: string | null;
}
export interface AnnotationObject {
  kind: "annotation";
  text: string;
  target_id?: string;
  step_id?: string | null;
}
export type BoardObject = CircuitObject | EquationObject | AnnotationObject;

export interface BoardState {
  version: number;
  active_step: string | null;
  order: string[];
  objects: Record<string, BoardObject>;
  highlights: string[];
}

export interface ClassroomMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  error?: boolean;
  created_at?: string;
}

export type ClassroomStatus = "idle" | "running" | "completed" | "failed";
export type ConnectionStatus = "disconnected" | "connecting" | "live" | "error";

export interface ClassroomStep {
  id: string;
  title: string;
  done: boolean;
}

// REST payloads (unwrapped from StandardResponse by apiFetch)
export interface CreateSessionResponse {
  session_id: string;
}
export interface StartTurnResponse {
  turn_id: string;
}
export interface SessionDetailResponse {
  status: ClassroomStatus;
  messages: { id: string; role: ClassroomMessage["role"]; content: string; created_at?: string }[];
}
export interface ClassroomStateResponse {
  status: ClassroomStatus;
  snapshot: { board_state: BoardState; last_sequence_no: number } | null;
  events: ClassroomEvent[];
}
