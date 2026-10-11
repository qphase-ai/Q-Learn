import type { WhiteboardGate } from "@/types/classroom";

/**
 * One-shot bridge from the AI Classroom whiteboard to the Circuit Builder.
 *
 * Stores are intentionally decoupled (classroomStore never imports
 * circuitStore), so a validated circuit the tutor drew is handed off via
 * sessionStorage instead: `stashCircuitForBuilder` writes it just before
 * navigating to `/circuit`, and the circuit page's effect reads + clears it
 * on mount via `takeStashedCircuit`. Session-only by design — it must not
 * survive a tab close or leak to another tab.
 */
const KEY = "qlearn.circuit-handoff";

export interface CircuitHandoff {
  qubits: number;
  gates: WhiteboardGate[];
  name?: string;
}

export function stashCircuitForBuilder(payload: CircuitHandoff): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Storage unavailable (private browsing, quota) — the redirect still works,
    // the builder just opens empty instead of pre-loaded.
  }
}

/** Non-consuming check, for a synchronous initial-render decision (no storage read race). */
export function hasStashedCircuit(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function takeStashedCircuit(): CircuitHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<CircuitHandoff>;
    if (typeof parsed.qubits !== "number" || !Array.isArray(parsed.gates)) return null;
    return { qubits: parsed.qubits, gates: parsed.gates, name: parsed.name };
  } catch {
    return null;
  }
}
