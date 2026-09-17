export interface User {
  id: string;
  email: string;
  role: "student" | "instructor" | "admin";
  subscription_status: "free" | "pro";
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  modules: Module[];
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  lesson_type: "text" | "circuit" | "code" | "quiz";
  is_pro: boolean;
}

export type GateType = "H" | "X" | "Y" | "Z" | "S" | "T" | "I" | "CX" | "CZ" | "SWAP" | "M";

export interface GateNodeData extends Record<string, unknown> {
  type: GateType;
  qubit: number;
  column: number;
  control?: number;
}

export interface GateSpec {
  type: string;
  targets: number[];
  control?: number;
  classical?: number[];
}

export interface CircuitSpec {
  qubits: number;
  classical_bits: number;
  gates: GateSpec[];
}

export interface SimulationResult {
  status: string;
  probabilities: Record<string, number> | null;
  measurements: Record<string, number> | null;
  statevector: [number, number][] | null;
  qasm?: string | null;
  execution_time_ms: number | null;
  error_message?: string | null;
  id?: string;
}

export interface Plan {
  id: string;
  name: string;
  price_inr: number;
  billing_cycle: string | null;
  features: Record<string, boolean>;
}
