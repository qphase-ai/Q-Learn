import type { WhiteboardGate } from "@/types/classroom";

/**
 * One-shot bridge from the AI Classroom whiteboard to the Circuit Builder.
 *
 * Stores are intentionally decoupled (classroomStore never imports
 * circuitStore), so a validated circuit the tutor drew is handed off via
 * sessionStorage instead: `stashCircuitForBuilder` writes it just before
 * navigating to `/circuit`, and `useCircuitHandoff` (mounted by
 * `CentralWorkspace` on the circuit route) reads + clears it on mount via
 * `takeStashedCircuit`. Session-only by design — it must not
 * survive a tab close or leak to another tab.
 */
const KEY = "qlearn.circuit-handoff";

export interface CircuitHandoff {
  qubits: number;
  gates: WhiteboardGate[];
  name?: string;
}

/** Returns false when storage is unavailable (private browsing, quota) so the caller can stay put. */
export function stashCircuitForBuilder(payload: CircuitHandoff): boolean {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
    return true;
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
